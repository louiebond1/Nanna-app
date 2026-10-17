"use strict";
// The Island Conquest map: three islands of four territories each.
// x/y place each territory on a 100 x 70 picture.
const ISLANDS = [
  { id: "north", name: "North Isle", bonus: 2 },
  { id: "west", name: "West Isle", bonus: 2 },
  { id: "east", name: "East Isle", bonus: 2 },
];
const TERRITORIES = [
  { id: "puffin", name: "Puffin Point", island: "north", x: 38, y: 8 },
  { id: "harbour", name: "Harbour Town", island: "north", x: 62, y: 10 },
  { id: "moor", name: "Misty Moor", island: "north", x: 42, y: 26 },
  { id: "lighthouse", name: "Lighthouse Rock", island: "north", x: 60, y: 28 },
  { id: "bramble", name: "Bramble Wood", island: "west", x: 14, y: 36 },
  { id: "mill", name: "Old Mill", island: "west", x: 30, y: 44 },
  { id: "fox", name: "Fox Hollow", island: "west", x: 12, y: 56 },
  { id: "shell", name: "Shell Bay", island: "west", x: 30, y: 62 },
  { id: "sunny", name: "Sunny Cove", island: "east", x: 84, y: 34 },
  { id: "castle", name: "Castle Hill", island: "east", x: 70, y: 46 },
  { id: "orchard", name: "Orchard Vale", island: "east", x: 66, y: 62 },
  { id: "windy", name: "Windy Ridge", island: "east", x: 86, y: 58 },
];
// Land links within each island, plus three sea crossings between islands.
const LINKS = [
  ["puffin", "harbour"], ["puffin", "moor"], ["harbour", "lighthouse"], ["moor", "lighthouse"],
  ["bramble", "mill"], ["bramble", "fox"], ["mill", "shell"], ["fox", "shell"], ["mill", "fox"],
  ["sunny", "castle"], ["sunny", "windy"], ["castle", "orchard"], ["orchard", "windy"], ["castle", "windy"],
  ["moor", "bramble"], ["lighthouse", "castle"], ["shell", "orchard"],
];
const SEA = new Set(["moor|bramble", "lighthouse|castle", "shell|orchard"]);

const ADJ = Object.fromEntries(TERRITORIES.map((t) => [t.id, []]));
for (const [a, b] of LINKS) { ADJ[a].push(b); ADJ[b].push(a); }

module.exports = { ISLANDS, TERRITORIES, LINKS, SEA, ADJ };
