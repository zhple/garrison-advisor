#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var assert = require("assert");
var calc = require("./calc.js");

var dataPath = path.join(__dirname, "..", "data", "garrison-data.json");
var raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
var data = calc.unwrapData(raw);
var covenants = data.covenants;
var operators = data.operators;
var equipment = data.equipment;
var comps = data.comps;
var ursusComp = comps.filter(function (c) {
  return c.covenantId === "ursus" || c.core === "ursus";
})[0];

var failed = 0;
var passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("  PASS  " + name);
  } catch (err) {
    failed += 1;
    console.error("  FAIL  " + name);
    console.error("        " + (err && err.message ? err.message : err));
    if (err && err.stack) {
      console.error(
        err.stack
          .split("\n")
          .slice(1, 4)
          .map(function (l) {
            return "        " + l.trim();
          })
          .join("\n")
      );
    }
  }
}

function ev(owned) {
  return calc.evaluate({
    owned: owned,
    operators: operators,
    covenants: covenants,
    comp: ursusComp
  });
}

function officialNames() {
  return operators
    .map(function (o) {
      return o.officialName || o.name;
    })
    .concat(
      equipment.map(function (e) {
        return e.officialName || e.name;
      })
    );
}

console.log("计算验收（权威数据 garrison-data.json）\n");

test("正式名：使用折桠、乌啾、奥尔佳、M3茧甲、青枳、阿米娅", function () {
  var names = officialNames();
  ["折桠", "乌啾", "奥尔佳", "青枳", "阿米娅", "M3茧甲"].forEach(function (n) {
    assert.ok(names.indexOf(n) !== -1, "应含正式名 " + n);
  });
});

test("误写只出现在 alias，不作为 officialName", function () {
  var typo = ["折娅", "奥尔加", "M3茬甲", "昼雪", "折姐", "乌喾", "青柫", "阿米姬"];
  operators.forEach(function (o) {
    typo.forEach(function (t) {
      assert.notStrictEqual(o.officialName, t, "officialName 不应是 " + t);
      assert.notStrictEqual(o.id, t);
    });
  });
  equipment.forEach(function (e) {
    typo.forEach(function (t) {
      assert.notStrictEqual(e.officialName, t, "装备 officialName 不应是 " + t);
    });
  });
  var zheya = calc.findOp(operators, "折桠");
  assert.ok(zheya.alias && zheya.alias.indexOf("折娅") !== -1, "折娅应仅作为折桠的 alias");
  var m3 = calc.findEquipment(equipment, "M3茧甲");
  assert.ok(m3.alias && m3.alias.indexOf("M3茬甲") !== -1);
});

test("M3茧甲只在 equipment，不在 operators 表；魔王是调和干员", function () {
  operators.forEach(function (op) {
    var n = op.officialName || op.name;
    assert.ok(n.indexOf("M3") === -1, "operators 不应出现 M3：" + n);
  });
  assert.ok(calc.findEquipment(equipment, "M3茧甲"));
  var mowang = calc.findOp(operators, "魔王");
  assert.ok(mowang);
  assert.ok(mowang.covenants.indexOf("调和") !== -1 || mowang.covenants.indexOf("harmony") !== -1);
  assert.ok(mowang.covenants.indexOf("乌萨斯") === -1);
  assert.strictEqual(calc.countCovenant(["魔王"], operators, "ursus", covenants), 0);
  assert.strictEqual(calc.countCovenant(["魔王"], operators, "harmony", covenants), 1);
});

test("十个核心盟约都在数据里，完整度口径正确", function () {
  var cores = covenants.filter(function (c) {
    return c.type === "core" || c.kind === "core";
  });
  var expected = [
    "炎",
    "萨尔贡",
    "维多利亚",
    "谢拉格",
    "阿戈尔",
    "叙拉古",
    "卡西米尔",
    "乌萨斯",
    "伊比利亚",
    "莱塔尼亚"
  ];
  assert.strictEqual(cores.length, 10);
  assert.deepStrictEqual(
    cores.map(function (c) {
      return c.name;
    }),
    expected
  );
  var byId = {};
  comps.forEach(function (c) {
    byId[c.covenantId] = byId[c.covenantId] || [];
    byId[c.covenantId].push(c);
  });
  expected.forEach(function (name) {
    var cov = calc.findCovenant(covenants, name);
    assert.ok(byId[cov.id], "缺少配方入口：" + name);
  });
  assert.strictEqual(byId.ursus[0].completeness, "完整");
  assert.strictEqual(byId.siracusa[0].completeness, "单源待补充");
  assert.ok(byId.victoria.length >= 2, "维多利亚应分两条路线");
  var harold = byId.victoria.filter(function (c) { return c.routeId === "victoria-harold-arts"; })[0];
  var shapeshifter = byId.victoria.filter(function (c) { return c.routeId === "victoria-shapeshifter"; })[0];
  assert.ok(harold && shapeshifter, "维多利亚两条 routeId 均需存在");
  assert.strictEqual(harold.completeness, "单源待补充");
  assert.strictEqual(harold.recommended, true);
  assert.strictEqual(shapeshifter.completeness, "单源待补充");
  byId.victoria.forEach(function (c) {
    assert.ok(c.routeId, "维多利亚条目需要 routeId");
  });
  assert.ok(byId.yan.length >= 2, "炎应分两条路线，不要把久痴梦与杜遥夜合成一套");
  var yanJiuchi = byId.yan.filter(function (c) { return c.routeId === "yan-jiuchi"; })[0];
  var yanDuyaoye = byId.yan.filter(function (c) { return c.routeId === "yan-duyaoye"; })[0];
  assert.ok(yanJiuchi && yanDuyaoye, "炎两条 routeId 均需存在");
  assert.strictEqual(yanJiuchi.completeness, "单源待补充");
  assert.ok(!yanJiuchi.targetBoard, "久痴梦简介不写死目标人数");
  assert.strictEqual(yanDuyaoye.completeness, "单源待补充");
  assert.ok(yanDuyaoye.targetBoard && yanDuyaoye.targetBoard.indexOf("3 炎") !== -1, "杜遥夜线应写 3 炎 / 2 灵巧 / 2 聚合");
  assert.ok(yanDuyaoye.targetBoard.indexOf("不必强求 6 炎") !== -1 || yanDuyaoye.targetBoard.indexOf("不必强求本家 6") !== -1, "杜遥夜线不必强求 6 炎");
  assert.strictEqual(byId.sargon[0].completeness, "单源待补充");
  assert.ok(byId.kjerag.length >= 2, "谢拉格应分全盟约与 PPT 变体");
  byId.kjerag.forEach(function (c) {
    assert.strictEqual(c.completeness, "单源待补充");
    assert.ok(c.routeId, "谢拉格条目需要 routeId");
  });
  var kjeragPpt = byId.kjerag.filter(function (c) { return c.routeId === "kjerag-ppt"; })[0];
  assert.ok(kjeragPpt && /不写死|勿臆造人数/.test(String(kjeragPpt.targetBoard || "") + String(kjeragPpt.targetBoardNotes || "")), "PPT 变体不要写死人数");
  assert.strictEqual(byId.aegir[0].completeness, "单源待补充");
  assert.strictEqual(byId.kazimierz[0].completeness, "双源交叉偏弱");
  assert.ok(byId.iberia.length >= 2, "伊比利亚应分三本主线与精准趣味线");
  var iberiaMain = byId.iberia.filter(function (c) { return c.routeId === "iberia-sanzhong"; })[0];
  var iberiaPrec = byId.iberia.filter(function (c) { return c.routeId === "iberia-precision"; })[0];
  assert.ok(iberiaMain && iberiaMain.recommended === true, "白樱三本应是伊比利亚默认推荐");
  assert.ok(iberiaPrec && iberiaPrec.recommended === false, "精准伊比利亚不要当默认");
  assert.ok(byId.leithanien.length >= 2, "莱塔尼亚应分公式化与变形者两条");
  byId.leithanien.forEach(function (c) {
    assert.strictEqual(c.completeness, "单源待补充");
    assert.ok(c.routeId !== "leithanien-3333", "3333 线缺抓取表，不要编造入库");
  });
  assert.strictEqual(byId.siracusa.length, 1, "叙拉古全盟约行不要覆盖已入库的逻辑元路线");
});

test("奥术强化效果包含减抗和隐匿失效；2 人激活、3 人强化", function () {
  var arcane = calc.findCovenant(covenants, "arts") || calc.findCovenant(covenants, "奥术");
  var enhance = (arcane.effects || [])
    .filter(function (e) {
      return e.stage === "enhance";
    })
    .map(function (e) {
      return e.text;
    })
    .join("");
  enhance = enhance || arcane.effectEnhance || "";
  assert.ok(enhance.indexOf("法术抗性-1") !== -1, enhance);
  assert.ok(enhance.indexOf("隐匿") !== -1, enhance);
  assert.strictEqual(calc.activateAt(arcane), 2);
  assert.strictEqual(calc.enhanceAt(arcane), 3);
});

test("同名多份只算一人", function () {
  var r = ev(["折桠", "折桠", "烈夏"]);
  assert.strictEqual(r.core.owned, 2);
  assert.strictEqual(r.ownedNames.length, 2);
});

test("1. 勾折桠 + 烈夏 → 乌萨斯未激活，还差 1；主提示不说已激活", function () {
  var r = ev(["折桠", "烈夏"]);
  assert.strictEqual(r.core.owned, 2);
  assert.strictEqual(r.core.activateCount, 2);
  assert.strictEqual(r.core.activated, false);
  assert.ok(r.mainSentence.indexOf("未激活") !== -1, r.mainSentence);
  assert.ok(r.mainSentence.indexOf("还差 1") !== -1, r.mainSentence);
  assert.ok(r.mainSentence.indexOf("已激活") === -1, "主提示不应写已激活：" + r.mainSentence);
  assert.ok(
    r.progressLines.some(function (l) {
      return l.indexOf("乌萨斯 2/3") !== -1;
    })
  );
});

test("2. 再勾乌啾 → 乌萨斯已激活；下一步优先补奥术 / 迅捷 / 冻河", function () {
  var r = ev(["折桠", "烈夏", "乌啾"]);
  assert.strictEqual(r.core.owned, 3);
  assert.strictEqual(r.core.activated, true);
  assert.ok(r.mainSentence.indexOf("已激活") !== -1, r.mainSentence);
  assert.ok(r.mainSentence.indexOf("未激活") === -1, r.mainSentence);
  ["奥术", "迅捷", "冻河"].forEach(function (h) {
    assert.ok(r.step.hints.indexOf(h) !== -1, "下一步应含 " + h + "，实际：" + r.step.hints.join("/"));
    assert.ok(r.mainSentence.indexOf(h) !== -1, "主句应含 " + h + "：" + r.mainSentence);
  });
});

test("3. 勾折桠 + 烈夏 + 魔王 → 乌萨斯已激活（+1 调和）", function () {
  var r = ev(["折桠", "烈夏", "魔王"]);
  assert.strictEqual(r.core.owned, 2, "魔王不应计入乌萨斯人数");
  assert.strictEqual(r.core.harmonyBonus, 1);
  assert.strictEqual(r.core.activateCount, 3);
  assert.strictEqual(r.core.activated, true);
  assert.ok(r.mainSentence.indexOf("已激活") !== -1, r.mainSentence);
  assert.ok(
    r.mainSentence.indexOf("2+1 调和") !== -1 || r.mainSentence.indexOf("+1 调和") !== -1,
    "主句应标明调和加成：" + r.mainSentence
  );
  assert.ok(r.progressLines[0].indexOf("调和") !== -1, r.progressLines[0]);
});

test("4. 勾 2 个奥术（维伊、卡达）→ 已激活、强化未达成，不得出现已减抗", function () {
  var r = ev(["维伊", "卡达"]);
  assert.ok(r.arcane, "应有奥术进度");
  assert.strictEqual(r.arcane.owned, 2);
  assert.strictEqual(r.arcane.activated, true);
  assert.strictEqual(r.arcane.enhanced, false);
  var blob = r.mainSentence + "\n" + r.progressLines.join("\n") + "\n" + calc.formatArcaneText(r.arcane);
  assert.ok(blob.indexOf("已激活") !== -1, blob);
  assert.ok(blob.indexOf("未达成") !== -1, blob);
  assert.ok(blob.indexOf("不会触发减抗") !== -1, "应写明不会触发减抗：" + blob);
  ["已减抗", "已触发减抗", "减抗已生效", "已经减抗"].forEach(function (bad) {
    assert.ok(blob.indexOf(bad) === -1, "不得出现「" + bad + "」：" + blob);
  });
});

test("4b. 勾 3 个奥术才可以提到减抗生效", function () {
  var r = ev(["维伊", "卡达", "霍尔海雅"]);
  assert.strictEqual(r.arcane.enhanced, true);
  var text = calc.formatArcaneText(r.arcane);
  assert.ok(text.indexOf("不会触发减抗") === -1, text);
  assert.ok(text.indexOf("减抗") !== -1, text);
});

test("5. 勾 6 名不同乌萨斯 → 满 6 人强化门槛，文案须提及需在场", function () {
  var six = ["折桠", "烈夏", "乌啾", "真理", "奥尔佳", "维伊"];
  var r = ev(six);
  assert.strictEqual(r.core.owned, 6);
  assert.strictEqual(r.core.activated, true);
  assert.strictEqual(r.core.enhanceOwned, true);
  var blob = r.mainSentence + "\n" + r.progressLines.join("\n");
  assert.ok(blob.indexOf("需在场") !== -1, "须提及需在场：" + blob);
  assert.ok(blob.indexOf("6/6") !== -1 || blob.indexOf("拥有 6") !== -1, blob);
  assert.ok(
    blob.indexOf("已获得强化") === -1 && blob.indexOf("强化已生效") === -1,
    "不应写成已经自动获得在场强化：" + blob
  );
});

test("维伊同时计乌萨斯与奥术；勾折桠+烈夏+维伊即激活核心并已有 1 奥术", function () {
  var r = ev(["折桠", "烈夏", "维伊"]);
  assert.strictEqual(r.core.owned, 3);
  assert.strictEqual(r.core.activated, true);
  assert.strictEqual(r.arcane.owned, 1);
  assert.strictEqual(r.arcane.activated, false);
});


test("跨核心按全部所属核心计入，不把 covenants[0] 当第一盟约", function () {
  var jian = calc.findOp(operators, "锏");
  assert.ok(jian);
  ["谢拉格", "卡西米尔", "莱塔尼亚"].forEach(function (name) {
    assert.ok(jian.covenants.indexOf(name) !== -1, "锏应含 " + name);
  });
  assert.strictEqual(calc.countCovenant(["锏"], operators, "kjerag", covenants), 1);
  assert.strictEqual(calc.countCovenant(["锏"], operators, "kazimierz", covenants), 1);
  assert.strictEqual(calc.countCovenant(["锏"], operators, "leithanien", covenants), 1);
  assert.strictEqual(calc.countCovenant(["烛煌"], operators, "yan", covenants), 1);
  assert.strictEqual(calc.countCovenant(["烛煌"], operators, "victoria", covenants), 1);
  assert.strictEqual(calc.countCovenant(["老鲤"], operators, "yan", covenants), 1);
  assert.strictEqual(calc.countCovenant(["老鲤"], operators, "investor", covenants), 1);
});

test("独行恰好 1 人生效，2 人及以上失效", function () {
  var one = calc.extraProgress(["水灯心"], operators, covenants, "solo");
  assert.strictEqual(one.activated, true);
  assert.strictEqual(one.invalidated, false);
  var two = calc.extraProgress(["水灯心", "地灵"], operators, covenants, "solo");
  assert.strictEqual(two.activated, false);
  assert.strictEqual(two.invalidated, true);
  var t = calc.formatExtraText(two);
  assert.ok(t.indexOf("失效") !== -1, t);
});

test("绝技按精锐人数 2/5 计算，不按盟约所属干员", function () {
  var r0 = calc.extraProgress(["水灯心", "维伊"], operators, covenants, "ultimate", { eliteCount: 0 });
  assert.strictEqual(r0.activated, false);
  var r2 = calc.extraProgress([], operators, covenants, "ultimate", { eliteCount: 2 });
  assert.strictEqual(r2.activated, true);
  assert.strictEqual(r2.enhanced, false);
  var r5 = calc.extraProgress([], operators, covenants, "ultimate", { eliteCount: 5 });
  assert.strictEqual(r5.enhanced, true);
});

test("炎的 unconfirmed 条目不得记成 M3茧甲 或 Mon3tr", function () {
  var yan = comps.filter(function (c) { return c.covenantId === "yan"; })[0];
  var items = (yan.priority && yan.priority.items) || [];
  items.forEach(function (it) {
    if (it.kind === "unconfirmed" || (it.name && /m3/i.test(it.name))) {
      assert.notStrictEqual(it.name, "M3茧甲");
      assert.notStrictEqual(it.name, "Mon3tr");
      assert.ok(it.kind === "unconfirmed");
    }
  });
});


console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
