"use strict";
const path = require("path");
const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

// Optional: how many create/join/resume requests one IP may make per minute (default 20).
const entryPerMinute = Number(process.env.ENTRY_LIMIT_PER_MINUTE) || 20;
const limits = {
  entry: { capacity: entryPerMinute, refillPerSecond: entryPerMinute / 60 },
  action: { capacity: 60, refillPerSecond: 10 },
};

const { server } = createApp({ dataFile: path.join(DATA_DIR, "nanna.sqlite"), limits });
server.listen(PORT, () => console.log(`Nanna Games listening on http://localhost:${PORT}`));
