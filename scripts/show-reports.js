"use strict";
// Prints what players have reported from inside games, e.g. questions flagged
// as unclear in Look & Remember.  Usage: DATA_DIR=/data node scripts/show-reports.js
const path = require("path");
const { Store } = require("../server/store/db");

const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const store = new Store(path.join(dir, "nanna.sqlite"));
const reports = store.reports();
if (!reports.length) console.log("No reports yet.");
for (const r of reports) console.log(`${new Date(r.createdAt).toISOString()}  ${r.kind}  ${r.cardId ?? ""} q${r.question ?? ""}  "${r.text ?? ""}"  (by ${r.by ?? "?"})`);
store.close();
