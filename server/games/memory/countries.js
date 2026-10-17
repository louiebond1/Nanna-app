"use strict";
// Original country cards. Questions are derived from the same fields that the
// browser illustrates; factual recall is never needed beyond the visible card.
const rows = [
  ["france", "France", "Paris", "Eiffel Tower", "Baguette", "Mediterranean Sea", "blue", 3],
  ["italy", "Italy", "Rome", "Leaning Tower", "Pizza", "Mediterranean Sea", "red", 2],
  ["greece", "Greece", "Athens", "Parthenon", "Olives", "Aegean Sea", "yellow", 4],
  ["spain", "Spain", "Madrid", "Sagrada Familia", "Paella", "Atlantic Ocean", "green", 3],
  ["japan", "Japan", "Tokyo", "Mount Fuji", "Sushi", "Pacific Ocean", "red", 2],
  ["egypt", "Egypt", "Cairo", "Pyramids", "Dates", "Red Sea", "blue", 4],
  ["australia", "Australia", "Canberra", "Sydney Opera House", "Pavlova", "Indian Ocean", "green", 2],
  ["brazil", "Brazil", "Brasília", "Christ the Redeemer", "Pineapple", "Atlantic Ocean", "yellow", 3],
  ["canada", "Canada", "Ottawa", "CN Tower", "Maple syrup", "Pacific Ocean", "red", 4],
  ["india", "India", "New Delhi", "Taj Mahal", "Samosas", "Indian Ocean", "blue", 2],
  ["netherlands", "Netherlands", "Amsterdam", "Windmill", "Gouda cheese", "North Sea", "green", 3],
  ["germany", "Germany", "Berlin", "Brandenburg Gate", "Pretzel", "Baltic Sea", "yellow", 4],
];
const fields = ["capital", "landmark", "food", "water", "shirt", "birds"];
const prompts = ["Which capital city was named?", "Which landmark was shown?", "Which food was shown?", "Which sea or ocean was named?", "What colour was the traveller’s shirt?", "How many birds were in the sky?"];
const countries = rows.map(([id, name, capital, landmark, food, water, shirt, birds]) => {
  const country = { id, name, capital, landmark, food, water, shirt, birds };
  return { id: `country-${id}`, title: name, sky: "day", items: [], country,
    questions: fields.map((field, i) => ({ type: "country", field, text: prompts[i] })) };
});
module.exports = { countries };
