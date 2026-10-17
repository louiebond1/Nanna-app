"use strict";
// Local QA only: starts the server with the test-only "High Card" game listed,
// so the lobby, turns, results and rematch can be tried in a browser before
// real games exist. Never used in production.
const path = require("path");
const os = require("os");
const fs = require("fs");
const { createApp } = require("../server/app");
const { createRegistry } = require("../server/games");
const highcard = require("../test/fixtures/highcard");

const PORT = Number(process.env.PORT) || 3000;
const dir = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "nanna-dev-"));
const { server } = createApp({ dataFile: path.join(dir, "dev.sqlite"), games: createRegistry([highcard]) });
server.listen(PORT, () => console.log(`QA server with test game on http://localhost:${PORT} (data in ${dir})`));
