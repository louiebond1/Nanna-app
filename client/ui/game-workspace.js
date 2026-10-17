import { h } from './components.js';
import { workspace, view } from './workspace.js';

// Each renderer still owns its original controls and move shapes. This file
// places those controls into game-sized views and a persistent action area.
export function gameWorkspace(raw, match, { banner, error, menu }) {
  error ||= raw.querySelector('[data-local-error]');
  error?.remove();
  const children = [...raw.children];
  const help = children.filter(e => e.tagName === 'DETAILS');
  help.forEach(e => e.remove());
  const all = children.filter(e => !help.includes(e));
  const find = selector => raw.querySelector(selector);
  const hand = find('[aria-label="Your hand"]');
  const actions = [];
  let main = [], secondary = [], extra = [];
  let title = 'Play';
  const takeButtons = (parent, predicate = () => true, limit = 2) => {
    if (!parent) return;
    const buttons = parent.matches('button') ? [parent] : [...parent.querySelectorAll('button')];
    buttons.filter(predicate).slice(0, limit).forEach(b => { actions.push(b); b.remove(); });
  };
  switch (match.gameId) {
    case 'gofish':
      main = [hand]; title = 'Your cards';
      all.filter(e => e.matches('button')).forEach(b => takeButtons(b));
      secondary = all.filter(e => e !== hand && !e.matches('button'));
      break;
    case 'clash': {
      const colours = find('[aria-label="Choose a colour"]');
      main = colours ? [colours] : [hand]; title = colours ? 'Choose a colour' : 'Your cards';
      if (!colours) all.filter(e => e.matches('button')).forEach(b => takeButtons(b));
      secondary = all.filter(e => e !== hand && e !== colours && !e.matches('button'));
      break;
    }
    case 'cheat': {
      const action = all.find(e => e !== hand && e.querySelector('button'));
      const responding = match.yourTurn && match.view.phase === 'respond';
      if (action) takeButtons(action);
      main = responding ? [action] : [hand]; title = responding ? 'Believe or call?' : 'Your cards';
      secondary = all.filter(e => !main.includes(e));
      break;
    }
    case 'gin': {
      const controls = all.find(e => e !== hand && (e.matches('button') || e.querySelector('button')));
      takeButtons(controls);
      const drawing = match.yourTurn && match.view.step === 'draw' && match.view.phase === 'playing';
      main = drawing ? [all[0]] : [hand]; title = drawing ? 'Draw a card' : 'Your cards';
      secondary = all.filter(e => !main.includes(e));
      break;
    }
    case 'canasta': {
      const controls = all.find(e => e !== hand && (e.matches('button') || e.querySelector('button')));
      takeButtons(controls, b => /Draw two cards|selected card|Next hand/.test(b.textContent));
      main = [hand]; title = 'Your cards';
      extra.push(view('moves', 'Moves', controls));
      secondary = all.filter(e => e !== hand && e !== controls);
      break;
    }
    case 'wheel':
    case 'grid': {
      const board = find('.wheel, .lettergrid');
      if (!board) { main = all; break; }
      const entry = find('.word-entry');
      const controls = all.find(e => e.matches('.row') && e.querySelector('button'));
      takeButtons(controls, b => /Enter word|Delete letter/.test(b.textContent));
      main = [board, entry]; title = 'Letters';
      const form = find('form');
      const words = all.find(e => e.matches('section'));
      extra.push(view('type', 'Type a word', form), view('words', 'Your words', words));
      secondary = all.filter(e => ![board, entry, form, words].includes(e));
      break;
    }
    case 'whoswho': {
      const board = find('.faces');
      board.classList.add('character-board');
      const faces = board.parentElement;
      faces.querySelector('h2')?.remove();
      const questions = all.find(e => e.querySelector('button') && !e.contains(faces) && !e.querySelector('.qa-list'));
      const answers = all.find(e => e.querySelector('.qa-list'));
      const guessing = !!find('.face.guessing');
      main = [faces];
      title = guessing ? 'Make your guess' : 'Your board';
      if (match.yourTurn && !guessing) actions.push(h('button', { type: 'button', class: 'btn', onclick: event => {
        const select = event.currentTarget.closest('.workspace').querySelector('.workspace-view');
        select.value = 'questions'; select.dispatchEvent(new Event('change'));
      } }, 'Ask a question'));
      if (questions) takeButtons(questions, b => /make a guess|Cancel guessing/.test(b.textContent));
      const guessButton = actions.find(b => /make a guess/.test(b.textContent));
      if (guessButton) { guessButton.textContent = 'Make a guess'; guessButton.setAttribute('aria-label', 'I know who it is: make a guess'); }
      extra.push(view('faces', 'Your board', ...(main.includes(faces) ? [] : [faces])),
        view('questions', 'Questions', ...(main.includes(questions) ? [] : [questions])),
        view('answers', 'Answers', ...(main.includes(answers) ? [] : [answers])));
      const secret = all.find(e => e.querySelector('.face-big'));
      const me = match.view.characters.find(c => c.id === match.view.yourPerson);
      banner.textContent = `${match.yourTurn ? 'Your turn' : 'Waiting'} · Your secret: ${me.name}`;
      secondary = all.filter(e => ![faces, questions, answers, secret].includes(e));
      extra.push(view('secret', 'Your secret person', secret));
      break;
    }
    case 'fleet': {
      const boards = all.filter(e => e.matches('.board-wrap'));
      const board = boards[0];
      const controls = board?.querySelector('.board-mobile .board-controls');
      if (controls && match.yourTurn) {
        controls.querySelector(':scope > p')?.remove();
        controls.classList.add('fleet-coordinate-actions');
        actions.push(controls); controls.remove();
      }
      main = [board]; title = match.view.phase === 'placing' ? 'Place your ships' : 'Choose a square';
      secondary = all.filter(e => e !== board);
      if (match.view.phase === 'placing') extra.push(view('ships', 'Ship setup', ...secondary));
      else extra.push(view('ships', 'Your fleet', ...secondary));
      secondary = [];
      break;
    }
    case 'islands': {
      const territories = all.find(e => e.matches('details'));
      // The territory list is a full-sized control, not rules/help.
      const list = help.find(e => e.querySelector('.territory-choice'));
      if (list) { help.splice(help.indexOf(list), 1); main = [list]; }
      const controls = all.find(e => e.querySelector('h2') && !e.matches('details') && !e.querySelector('.dice'));
      if (controls) takeButtons(controls, b => /Put all|Put 1|Attack |Stop attacking|End my turn|Move \d/.test(b.textContent));
      if (controls) main.unshift(controls);
      title = 'Your territories';
      const map = all.find(e => e.matches('.map') && !e.matches('.map-overview'));
      const overview = all.find(e => e.matches('.map-overview'));
      extra.push(view('map', 'Island map', map, overview));
      secondary = all.filter(e => !main.includes(e) && ![map, overview, territories, controls].includes(e));
      break;
    }
    case 'memory': {
      if (match.view.theme === 'countries') banner.textContent = match.view.phase === 'reveal' ? 'Answer revealed' : match.yourTurn ? match.view.phase === 'study' ? 'Your turn: study the card' : 'Your turn: answer from memory' : 'Waiting for the other player…';
      const question = match.view.phase === 'question';
      if (question) find('.scene-hidden')?.classList.add('memory-hidden-label');
      all.filter(e => e.matches('button') || e.matches('.row') && e.querySelector('button')).forEach(e => takeButtons(e));
      const picture = find('.scene');
      if (match.view.phase === 'study') {
        main = [picture];
        const timer = find('#study-timer');
        if (timer) { actions.push(timer); timer.remove(); }
      } else if (question) {
        const choices = all.find(e => e.matches('div.stack') && e.querySelector('button'));
        choices?.classList.add('memory-options');
        main = [all.find(e => e.tagName === 'H2'), choices];
      } else {
        picture?.classList.add('memory-reveal');
        main = [all.find(e => e.matches('.banner')), picture];
      }
      secondary = all.filter(e => !main.includes(e));
      title = question ? 'Choose your answer' : match.view.phase === 'study' ? 'Study the picture' : 'Picture revealed';
      break;
    }
    default: main = all;
  }
  main = main.filter(Boolean);
  if (!main.length) main = [h('p', {}, 'Waiting for the other player…')];
  // More holds status and controls that are useful but not the next move.
  const groups = [view('play', title, ...main), ...extra,
    view('details', 'Table & scores', ...secondary), view('help', 'How to play', ...help), view('menu', 'Menu', ...menu)];
  for (const group of groups) group.nodes = group.nodes.filter(n => !actions.includes(n) && n !== error);
  const signature = `${match.gameId}:${match.view.phase || ''}:${match.view.step || ''}:${match.yourTurn}:${title}`;
  const latest = match.events?.at(-1)?.text;
  const selected = hand?.querySelectorAll('[aria-pressed="true"]').length || 0;
  const description = match.gameId === 'memory' ? h('p', { class: 'workspace-last-move' }, `Card ${match.view.round + 1}/${match.view.rounds} · Points ${match.view.points.join('–')}`) : match.gameId === 'whoswho' ? null : latest || selected ? h('p', { class: 'workspace-last-move' },
    selected ? `${selected} card${selected === 1 ? '' : 's'} selected. ` : '', latest ? `Last move: ${latest}` : '') : null;
  const result = workspace({ key: signature, title: match.gameId === 'memory' && match.view.theme === 'countries' ? 'Countries' : match.title, banner, description, error, groups, actions,
    actionViews: match.gameId === 'islands' ? ['play', 'map'] : undefined });
  result.classList.add(`game-${match.gameId}`);
  return result;
}
