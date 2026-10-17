"use strict";
const path = require("path");
const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

const { server } = createApp({ dataFile: path.join(DATA_DIR, "nanna.sqlite") });
server.listen(PORT, () => console.log(`Nanna Games listening on http://localhost:${PORT}`));
