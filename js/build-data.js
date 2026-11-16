#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");

var src = path.join(__dirname, "..", "data", "garrison-data.json");
var outFile = path.join(__dirname, "data.js");
var raw = fs.readFileSync(src, "utf8");
JSON.parse(raw); /* 校验 */

var header =
  "/* 由 js/build-data.js 根据 data/garrison-data.json 生成，供 file:// 本地打开时使用。 */\n" +
  "/* 换赛季或改数据：先改 data/garrison-data.json，再运行 node js/build-data.js */\n";

fs.writeFileSync(outFile, header + "window.APP_DATA = " + raw.trim() + ";\n", "utf8");
console.log("wrote " + path.relative(path.join(__dirname, ".."), outFile));
