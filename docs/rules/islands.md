# Island Conquest: rules (Risk-inspired, two players)

This is a **deliberately scoped two-player adaptation** inspired by classic territory-conquest games. **It isn't the official rules of Risk or any other game.** The map, names and wording are our own.

- **Map:**
  - Three islands (North, West and East Isle), each with four territories.
  - Neighbours are joined by land links, and three dashed **sea crossings** join the islands (`server/games/islands/map.js`).
  - Every link works both ways and the whole map is connected. This is tested.
- **Balanced start:**
  - Each player starts with 4 territories with 3 armies each. A grey **neutral** army holds the other 4, with 2 armies each.
  - On every island, each player has at least one territory: one island has two of yours, one has two of theirs, and one has two neutral. The arrangement is random but always this shape.
  - The server picks who goes first.
- **A turn has three steps:**
  1. **Reinforce:** you get 3 armies, or one per three territories you hold if that's more, plus **2 for each whole island** you hold. Place them all on your own territories, one at a time or all at once.
  2. **Attack:**
     - Attack from a territory with at least 2 armies to a neighbouring enemy or neutral territory, as often as you like, or stop.
     - The attacker rolls up to 3 dice (always one fewer than their armies there) and the defender up to 2. The server rolls them.
     - Highest dice are compared in pairs; the lower die loses an army, and **ties go to the defender**.
     - If a territory is emptied, you capture it and as many armies as you rolled dice move in, always leaving one behind. This is automatic, to keep things simple.
  3. **Move:** once per turn, move any number of armies between two neighbouring territories of yours (leaving one behind), or just end your turn.
- **Neutral army:** defends with its own dice, but never attacks or reinforces.
- **Winning:**
  - Take every territory of the other player's, **or**
  - hold **two whole islands** at the end of your turn, **or**
  - if a round limit was chosen (10 or 20 rounds each; agreed in the lobby), when it's reached the player with more territories wins. Ties are broken by total armies, and otherwise it's a draw. "Until someone wins" has no limit.
- **Left out on purpose:** territory cards and card trade-ins, choosing how many dice to roll, and choosing how many armies move in after a capture.
- **Privacy:** nothing is hidden in this game. Both players see the whole map, and all dice are rolled on the server.
