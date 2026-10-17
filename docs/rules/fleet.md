# Fleet Finder: rules (Battleship-style, two players)

This is an original take on the familiar hidden-ships guessing game. The names, ships and look are our own.

- **Board:**
  - 8×8 with 4 ships: Liner 4, Ferry 3, Trawler 3, Dinghy 2. This is the default: the squares are bigger on a phone.
  - Or 10×10 with 5 ships: Tanker 5, Liner 4, Ferry 3, Trawler 3, Dinghy 2.
- **Placing ships:**
  - Both players place at the same time.
  - Ships go across or down, must stay on the board and can't overlap. Touching is allowed.
  - "Place my ships for me" places them randomly. The randomness comes from the server.
  - Ships can be moved freely until "My ships are ready". After that they're locked.
- **Battle:**
  - Once both are ready, the server picks who fires first at random.
  - Players take turns firing at one square. You can't fire at the same square twice.
  - Each shot is announced as a hit or a miss. When every square of a ship has been hit, it's sunk, and its name is announced.
  - Turns alternate whether you hit or miss. This is a deliberate simplification to keep the game calm and fair.
- **Winning:** the first player to sink the whole fleet wins. The results show hits for both players and reveal where the remaining ships were.
- **Privacy:** the other player's ship positions are never sent to your device, during placement or battle. Your view of their board only shows the results of your own shots until the game ends. This is tested in `test/games/fleet.test.js`.
