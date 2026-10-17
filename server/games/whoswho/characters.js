"use strict";
// The 24 original Who's Who characters. Pictures are drawn in the browser
// from these features (client/games/whoswho.js), so there is no artwork to license.
// hair: black | brown | blonde | ginger | grey | none
const C = (id, name, hair, long, glasses, hat, beard, moustache, earrings, smiling, skin, colour) =>
  ({ id, name, hair, long, glasses, hat, beard, moustache, earrings, smiling, skin, colour });

const CHARACTERS = [
  C("ada", "Ada", "grey", true, true, false, false, false, true, true, 1, "#7b4fa0"),
  C("bertie", "Bertie", "none", false, true, false, true, true, false, true, 2, "#2f6f9f"),
  C("cleo", "Cleo", "black", true, false, true, false, false, true, false, 4, "#c0392b"),
  C("dev", "Dev", "black", false, false, false, true, true, false, true, 3, "#16a085"),
  C("edna", "Edna", "grey", false, false, true, false, false, true, false, 1, "#8e6c3a"),
  C("felix", "Felix", "ginger", false, true, false, false, false, false, true, 1, "#d35400"),
  C("gwen", "Gwen", "blonde", true, false, false, false, false, false, true, 1, "#2980b9"),
  C("hamish", "Hamish", "ginger", false, false, true, true, false, false, false, 1, "#27ae60"),
  C("ivy", "Ivy", "brown", true, true, false, false, false, false, false, 2, "#8e44ad"),
  C("jun", "Jun", "black", false, true, false, false, false, false, false, 2, "#34495e"),
  C("kit", "Kit", "blonde", false, false, true, false, false, true, true, 1, "#e67e22"),
  C("lola", "Lola", "brown", true, false, false, false, false, true, true, 3, "#c2185b"),
  C("mo", "Mo", "none", false, false, false, false, true, false, true, 4, "#1e8449"),
  C("nell", "Nell", "grey", true, false, false, false, false, false, false, 2, "#5d6d7e"),
  C("otis", "Otis", "brown", false, false, true, false, true, false, false, 4, "#a04000"),
  C("priya", "Priya", "black", true, true, false, false, false, true, true, 3, "#6c3483"),
  C("quentin", "Quentin", "grey", false, true, true, false, true, false, false, 1, "#1f618d"),
  C("rosa", "Rosa", "ginger", true, false, false, false, false, true, false, 2, "#b03a2e"),
  C("sid", "Sid", "none", false, true, false, false, false, false, false, 3, "#117a65"),
  C("tess", "Tess", "blonde", true, true, true, false, false, false, false, 2, "#af601a"),
  C("umar", "Umar", "black", false, false, false, true, false, false, false, 4, "#2e4053"),
  C("vera", "Vera", "brown", false, false, false, false, false, true, false, 1, "#9b59b6"),
  C("wilf", "Wilf", "blonde", false, false, false, true, true, false, true, 2, "#148f77"),
  C("zara", "Zara", "brown", true, false, true, false, false, false, true, 4, "#ca6f1e"),
];

// Every question is answered by the server from the secret person's features.
const QUESTIONS = [
  { id: "glasses", text: "Do they wear glasses?", test: (c) => c.glasses },
  { id: "hat", text: "Are they wearing a hat?", test: (c) => c.hat },
  { id: "beard", text: "Do they have a beard?", test: (c) => c.beard },
  { id: "moustache", text: "Do they have a moustache?", test: (c) => c.moustache },
  { id: "earrings", text: "Do they wear earrings?", test: (c) => c.earrings },
  { id: "smiling", text: "Are they smiling with their teeth showing?", test: (c) => c.smiling },
  { id: "long", text: "Do they have long hair?", test: (c) => c.long },
  { id: "bald", text: "Are they bald?", test: (c) => c.hair === "none" },
  { id: "black", text: "Do they have black hair?", test: (c) => c.hair === "black" },
  { id: "brown", text: "Do they have brown hair?", test: (c) => c.hair === "brown" },
  { id: "blonde", text: "Do they have blonde hair?", test: (c) => c.hair === "blonde" },
  { id: "ginger", text: "Do they have ginger hair?", test: (c) => c.hair === "ginger" },
  { id: "grey", text: "Do they have grey hair?", test: (c) => c.hair === "grey" },
];

module.exports = { CHARACTERS, QUESTIONS };
