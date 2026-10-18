"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/memory");
const { CARDS, pack } = require("../../server/games/memory/content");
const { RoomService } = require("../../server/rooms/service");
const { Store } = require("../../server/store/db");
const { createRegistry } = require("../../server/games");

const players = [{ seat: 0, name: "Nanna" }, { seat: 1, name: "Sam" }];
const act = (s, seat, a) => {
  const r = g.applyAction(s, seat, a);
  if (r.error) throw new Error(r.error);
  return r;
};

test("content pack: every card has exactly 6 questions, all answerable from the picture", () => {
  assert.ok(CARDS.length >= 10);
  for (const c of CARDS) {
    assert.equal(c.questions.length, 6, c.id);
    assert.ok(c.items.every((i) => pack.kinds.includes(i.kind) && pack.colours.includes(i.colour)), c.id);
    assert.ok(c.items.every((i) => i.x >= 0 && i.x <= 100 && i.y >= 0 && i.y <= 100), c.id);
    for (const q of c.resolved) {
      assert.ok(q.options.includes(q.answer), `${c.id}: ${q.text}`);
      assert.equal(new Set(q.options).size, q.options.length);
      assert.ok(q.options.length >= 2);
    }
  }
});

test("answers really come from the picture", () => {
  const park = CARDS.find((c) => c.id === "park");
  assert.equal(park.resolved[0].answer, "3", "three birds");
  assert.equal(park.resolved[1].answer, "Red", "the ball");
  assert.equal(park.resolved[2].answer, "PARK");
  assert.equal(park.resolved[4].answer, "No", "no cat");
});

test("settings: study time and pictures each are validated", () => {
  assert.ok(g.normaliseSettings({ studySeconds: 15, cardsEach: 5 }).error);
  assert.deepEqual(g.normaliseSettings({ studySeconds: "0", cardsEach: "3" }), { studySeconds: 0, cardsEach: 3 });
});

test("a round: study, the dice picks an existing question, answer, reveal", () => {
  let s = g.createGame({ studySeconds: 20, cardsEach: 3 }, players, "x");
  const a = s.active;
  assert.match(g.applyAction(s, 1 - a, { type: "doneStudying" }).error, /turn/);
  assert.ok(g.getPlayerView(s, a).card.country.capital);
  s = act(s, a, { type: "doneStudying" }).state;
  assert.ok(s.die >= 1 && s.die <= 6);
  const v = g.getPlayerView(s, a);
  assert.equal(v.card, null, "picture hidden during the question");
  assert.equal(v.answer, null, "answer hidden until answered");
  const right = CARDS.find((c) => c.id === s.deck[0]).resolved[s.die - 1].answer;
  assert.match(g.applyAction(s, a, { type: "answer", option: "nonsense" }).error, /answers shown/);
  s = act(s, a, { type: "answer", option: right }).state;
  assert.equal(s.points[a], 1);
  assert.equal(g.getPlayerView(s, 1 - a).answer, right);
  s = act(s, 1 - a, { type: "next" }).state;
  assert.equal(s.active, 1 - a, "players take turns");
  assert.equal(s.phase, "study");
});

test("new decks use only country cards, all questions refer to visible fields", () => {
  for (let seed = 0; seed < 20; seed++) {
    const s = g.createGame({ studySeconds: 0, cardsEach: 5 }, players, `countries-${seed}`);
    assert.equal(s.deck.length, 10);
    assert.equal(new Set(s.deck).size, 10);
    for (const id of s.deck) {
      const card = CARDS.find(c => c.id === id);
      assert.ok(card.country, id);
      for (const [i, q] of card.questions.entries()) {
        const shown = String(card.country[q.field]);
        assert.equal(card.resolved[i].answer.toLowerCase(), shown.toLowerCase());
      }
    }
  }
});

test("saved scene games remain playable after the country pack update", () => {
  let s = g.createGame({ studySeconds: 0, cardsEach: 3 }, players, 'old-game');
  s.deck[0] = 'park';
  assert.ok(g.getPlayerView(s, s.active).card.items.length);
  s = act(s, s.active, { type: 'doneStudying' }).state;
  assert.equal(g.getPlayerView(s, s.active).card, null);
  assert.ok(g.getPlayerView(s, s.active).question.text);
});

test('illustrated cards have visible factual captions and a matching six-question set', () => {
  const {existsSync} = require('node:fs');
  const path = require('node:path');
  const cards=CARDS.filter(c=>c.country?.art);
  assert.equal(cards.length,12);
  for(const card of cards) {
    assert.ok(existsSync(path.join(__dirname,'../../client',card.country.art)),card.id);
    assert.ok(card.country.capital && card.country.food && card.country.animal && card.country.funFact);
    assert.ok(card.country.funFact.toLowerCase().includes(card.country.factAnswer.toLowerCase()),card.id);
    assert.deepEqual(card.questions.map(q=>q.field),['capital','food','animal','factAnswer','shirt','birds']);
    assert.equal(card.sources.length,2);
  }
  const s=g.createGame({studySeconds:0,cardsEach:5},players,'captions');
  assert.ok(s.deck.every(id=>id.startsWith('facts-country-')));
  const q=act(s,s.active,{type:'doneStudying'}).state;
  const view=g.getPlayerView(q,q.active);
  assert.equal(view.card,null);
  assert.equal(view.answer,null);
  assert.equal(view.title,null);
});

test("the dice never picks a missing question across many rolls", () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const start = g.createGame({ studySeconds: 0, cardsEach: 3 }, players, `d${i}`);
    const s = act(start, start.active, { type: "doneStudying" }).state;
    assert.ok(g.getPlayerView(s, s.active).question.text, `die ${s.die}`);
    seen.add(s.die);
  }
  assert.equal(seen.size, 6, "every face comes up");
});

test("wrong answer scores nothing; game ends after every picture; tie and winner", () => {
  let s = g.createGame({ studySeconds: 0, cardsEach: 3 }, players, "y");
  for (let r = 0; r < 6; r++) {
    const a = s.active;
    s = act(s, a, { type: "doneStudying" }).state;
    const q = CARDS.find((c) => c.id === s.deck[s.round]).resolved[s.die - 1];
    const pick = a === 0 ? q.answer : q.options.find((o) => o !== q.answer);
    s = act(s, a, { type: "answer", option: pick }).state;
    s = act(s, a, { type: "next" }).state;
  }
  assert.equal(g.isGameOver(s), true);
  assert.deepEqual(s.points, [3, 0]);
  assert.equal(g.score(s).winner, 0);
  assert.equal(new Set(s.deck).size, 6, "no picture repeats in a game");
});

test("flagging a question saves a report through the room service", () => {
  const store = new Store(":memory:");
  const service = new RoomService({ store, games: createRegistry([g]), newSeed: () => "flag-seed" });
  const a = service.createRoom("Nanna");
  service.joinRoom(a.roomId, "Sam");
  service.chooseGame(a.roomId, 0, "memory", { studySeconds: 0, cardsEach: 3 });
  service.setReady(a.roomId, 0, true);
  service.setReady(a.roomId, 1, true);
  let v = service.viewFor(a.roomId, 0).match;
  const active = v.view.active;
  service.act(a.roomId, active, { actionId: "1", version: v.version, move: { type: "doneStudying" } });
  v = service.viewFor(a.roomId, active).match;
  service.act(a.roomId, active, { actionId: "2", version: v.version, move: { type: "answer", option: v.view.question.options[0] } });
  v = service.viewFor(a.roomId, 0).match;
  assert.equal(service.act(a.roomId, 0, { actionId: "3", version: v.version, move: { type: "flag" } }).ok, true);
  const reports = store.reports();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].kind, "question-flag");
  assert.equal(reports[0].by, "Nanna");
  v = service.viewFor(a.roomId, 0).match;
  assert.match(service.act(a.roomId, 1, { actionId: "4", version: v.version, move: { type: "flag" } }).error, /already been flagged/);
});
