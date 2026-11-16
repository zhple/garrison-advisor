/**
 * 卫戍协议·阵容顾问 — 勾选计算（浏览器与 Node 共用）
 * 按「已勾选拥有」的不同干员计数，同名多份只算一人。
 * 兼容权威数据 garrison-data.json（officialName / activateCount / type=additional 等）。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Calc = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function uniqueNames(owned) {
    var seen = Object.create(null);
    var out = [];
    (owned || []).forEach(function (name) {
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push(name);
    });
    return out;
  }

  function unwrapData(data) {
    if (!data) return { covenants: [], operators: [], equipment: [], comps: [], strategies: [], raw: data };
    if (Array.isArray(data.covenants)) {
      return {
        season: data.season,
        covenants: data.covenants,
        operators: data.operators || [],
        equipment: data.equipment || data.items || [],
        comps: data.comps || [],
        strategies: data.strategies || [],
        countingRules: data.countingRules,
        disclaimer: data.disclaimer,
        sourcesPrimary: data.sourcesPrimary,
        raw: data
      };
    }
    return {
      season: (data.covenants && data.covenants.season) || data.season,
      covenants: (data.covenants && data.covenants.covenants) || [],
      operators: (data.operators && data.operators.operators) || data.operators || [],
      equipment: (data.items && data.items.items) || (data.equipment && data.equipment.items) || data.equipment || [],
      comps: (data.comps && data.comps.comps) || data.comps || [],
      strategies: (data.strategies && data.strategies.strategies) || data.strategies || [],
      raw: data
    };
  }

  function opName(op) {
    return (op && (op.officialName || op.name)) || "";
  }

  function findOp(operators, nameOrId) {
    if (!nameOrId) return null;
    var i, op;
    for (i = 0; i < (operators || []).length; i++) {
      op = operators[i];
      if (opName(op) === nameOrId || op.id === nameOrId || op.name === nameOrId) return op;
    }
    for (i = 0; i < (operators || []).length; i++) {
      op = operators[i];
      if (op.alias && op.alias.indexOf(nameOrId) !== -1) return op;
    }
    return null;
  }

  function findEquipment(equipment, nameOrId) {
    if (!nameOrId) return null;
    var i, it;
    for (i = 0; i < (equipment || []).length; i++) {
      it = equipment[i];
      if ((it.officialName || it.name) === nameOrId || it.id === nameOrId) return it;
    }
    for (i = 0; i < (equipment || []).length; i++) {
      it = equipment[i];
      if (it.alias && it.alias.indexOf(nameOrId) !== -1) return it;
    }
    return null;
  }

  function displayName(entity) {
    return (entity && (entity.officialName || entity.name)) || "";
  }

  function findCovenant(covenants, idOrName) {
    if (!idOrName) return null;
    var aliases = {
      arcane: "arts",
      sherag: "kjerag",
      syracuse: "siracusa",
      奥术: "arts"
    };
    var want = aliases[idOrName] || idOrName;
    var i, c;
    for (i = 0; i < (covenants || []).length; i++) {
      c = covenants[i];
      if (c.id === idOrName || c.id === want || c.name === idOrName || c.name === want) return c;
    }
    return null;
  }

  function activateAt(c) {
    if (!c) return 3;
    if (c.activateCount != null) return c.activateCount;
    if (c.activateAt != null) return c.activateAt;
    return 3;
  }

  function enhanceAt(c) {
    if (!c) return null;
    if (c.enhanceCount !== undefined) return c.enhanceCount;
    if (c.enhanceAt !== undefined) return c.enhanceAt;
    return null;
  }

  function isCoreCovenant(c) {
    return c && (c.kind === "core" || c.type === "core");
  }

  function opHasCovenant(op, covenant) {
    if (!op || !covenant) return false;
    var tags = op.covenants || [];
    for (var i = 0; i < tags.length; i++) {
      if (tags[i] === covenant.id || tags[i] === covenant.name) return true;
    }
    return false;
  }

  function ownedForCovenant(ownedNames, operators, covenantOrId, covenants) {
    var cov = typeof covenantOrId === "object" ? covenantOrId : findCovenant(covenants, covenantOrId);
    if (!cov) {
      /* 允许在未传入 covenants 时按字面标签计数 */
      return uniqueNames(ownedNames).filter(function (name) {
        var op = findOp(operators, name);
        return op && (op.covenants || []).indexOf(covenantOrId) !== -1;
      });
    }
    return uniqueNames(ownedNames).filter(function (name) {
      return opHasCovenant(findOp(operators, name), cov);
    });
  }

  function countCovenant(ownedNames, operators, covenantOrId, covenants) {
    return ownedForCovenant(ownedNames, operators, covenantOrId, covenants).length;
  }

  function isHarmonyActive(ownedNames, operators, covenants) {
    var harmony = findCovenant(covenants, "harmony") || { id: "harmony", name: "调和", activateCount: 1 };
    var owned = countCovenant(ownedNames, operators, harmony, covenants);
    return owned >= activateAt(harmony);
  }

  function coreProgress(ownedNames, operators, covenants, coreId) {
    var core = findCovenant(covenants, coreId);
    if (!core) throw new Error("未知核心盟约: " + coreId);
    var actAt = activateAt(core);
    var enhAt = enhanceAt(core);
    if (enhAt == null && isCoreCovenant(core)) enhAt = 6;
    var owned = countCovenant(ownedNames, operators, core, covenants);
    var harmony = isHarmonyActive(ownedNames, operators, covenants);
    var harmonyBonus = harmony ? 1 : 0;
    var activateCountVal = owned + harmonyBonus;
    return {
      id: core.id,
      name: core.name,
      kind: "core",
      owned: owned,
      activateAt: actAt,
      enhanceAt: enhAt,
      harmonyBonus: harmonyBonus,
      activateCount: activateCountVal,
      activated: activateCountVal >= actAt,
      enhanceOwned: typeof enhAt === "number" && owned >= enhAt,
      enhanceOnFieldRequired: core.enhanceRequireOnField !== false
    };
  }

  function isSoloCov(extra) {
    return extra && (extra.id === "solo" || extra.name === "独行");
  }

  function isUltimateCov(extra) {
    return extra && (extra.id === "ultimate" || extra.name === "绝技");
  }

  /**
   * 附加盟约进度。
   * 独行：恰好 1 人激活，2 人及以上失效。
   * 绝技：按 options.eliteCount（在场精锐人数）计 2/5，不按盟约所属人数。
   * 远见/奇迹/投资人：勾选已拥有即可计入激活（含整备区）。
   */
  function extraProgress(ownedNames, operators, covenants, extraId, options) {
    options = options || {};
    var extra = findCovenant(covenants, extraId);
    if (!extra) throw new Error("未知附加盟约: " + extraId);
    var actAt = activateAt(extra);
    var enhAt = enhanceAt(extra);
    var memberCount = countCovenant(ownedNames, operators, extra, covenants);
    var owned = isUltimateCov(extra)
      ? Math.max(0, Number(options.eliteCount) || 0)
      : memberCount;
    var enhanceIsHeadcount = typeof enhAt === "number";
    var note = extra.enhanceNote || null;
    if (!note && extra.layerThreshold) note = extra.layerThreshold + "层";
    var invalidated = isSoloCov(extra) && owned >= 2;
    var activated = isSoloCov(extra) ? owned === 1 : owned >= actAt;
    return {
      id: extra.id,
      name: extra.name,
      kind: "extra",
      owned: owned,
      memberCount: memberCount,
      activateAt: actAt,
      enhanceAt: enhAt,
      enhanceNote: note,
      activated: activated,
      invalidated: invalidated,
      enhanceIsHeadcount: enhanceIsHeadcount,
      enhanced: enhanceIsHeadcount ? owned >= enhAt : false,
      enhanceOnFieldRequired: !!extra.enhanceRequireOnField,
      benchCountsForActivation: !!extra.benchCountsForActivation,
      countsByElite: isUltimateCov(extra)
    };
  }

  function isArcane(progress) {
    return progress && (progress.id === "arts" || progress.id === "arcane" || progress.name === "奥术");
  }

  function formatCoreActivateText(progress) {
    if (progress.harmonyBonus) {
      if (progress.activated) {
        return (
          progress.name +
          " " +
          progress.owned +
          "+" +
          progress.harmonyBonus +
          " 调和 / " +
          progress.activateAt +
          " 已激活"
        );
      }
      return (
        progress.name +
        " " +
        progress.owned +
        "+" +
        progress.harmonyBonus +
        " 调和 / " +
        progress.activateAt
      );
    }
    var base = progress.name + " " + progress.owned + "/" + progress.activateAt;
    return progress.activated ? base + " 已激活" : base;
  }

  function formatCoreEnhanceText(progress) {
    if (progress.enhanceAt == null) return "";
    if (progress.enhanceOwned) {
      return "拥有 " + progress.owned + "/" + progress.enhanceAt + "；" + progress.enhanceAt + " 人强化需在场";
    }
    return "拥有 " + progress.owned + "/" + progress.enhanceAt + "；强化需在场";
  }

  function formatArcaneText(progress) {
    var act = progress.owned + "/" + progress.activateAt;
    var enh = progress.owned + "/" + progress.enhanceAt;
    if (progress.enhanced) {
      return "奥术 " + act + " 已激活 · 强化 " + enh + " 已达成（减抗 + 攻击范围内隐匿失效）";
    }
    if (progress.activated) {
      return "奥术 " + act + " 已激活 · 强化 " + enh + " 未达成，不会触发减抗";
    }
    return "奥术 " + act + " 未激活 · 强化 " + enh;
  }

  function formatExtraText(progress) {
    if (isArcane(progress)) return formatArcaneText(progress);
    if (progress.id === "solo" || progress.name === "独行") {
      if (progress.invalidated) {
        return "独行 " + progress.owned + " 人，已失效（须恰好 1 人才生效）";
      }
      if (progress.activated) return "独行 1/1 已激活（恰好 1 人）";
      return "独行 0/1 未激活（须恰好 1 人）";
    }
    if (progress.countsByElite || progress.id === "ultimate" || progress.name === "绝技") {
      var ult = "绝技 精锐 " + progress.owned + "/" + progress.activateAt;
      ult += progress.activated ? " 已激活" : " 未激活";
      if (progress.enhanceIsHeadcount) {
        ult += progress.enhanced
          ? " · 强化 " + progress.owned + "/" + progress.enhanceAt + " 已达成"
          : " · 强化 " + progress.owned + "/" + progress.enhanceAt + " 未达成";
      }
      ult += "（按在场精锐人数，不按盟约所属）";
      return ult;
    }
    var base = progress.name + " " + progress.owned + "/" + progress.activateAt;
    base += progress.activated ? " 已激活" : " 未激活";
    if (progress.benchCountsForActivation) base += "（整备区也可计入激活）";
    if (progress.enhanceIsHeadcount) {
      var enh = progress.owned + "/" + progress.enhanceAt;
      base += progress.enhanced ? " · 强化 " + enh + " 已达成" : " · 强化 " + enh + " 未达成";
      if (progress.enhanceOnFieldRequired && progress.enhanced) base += "（需在场）";
    } else if (progress.enhanceNote) {
      base += " · 额外效果：" + progress.enhanceNote;
    }
    return base;
  }

  function nextStepPriorityOf(comp) {
    if (comp && comp.nextStepPriority) return comp.nextStepPriority;
    var id = (comp && (comp.core || comp.covenantId)) || "";
    if (id === "ursus" || (comp && comp.name === "乌萨斯")) {
      return { beforeActivate: ["折桠", "烈夏", "乌啾"], afterActivate: ["奥术", "迅捷", "冻河"] };
    }
    return { beforeActivate: [], afterActivate: [] };
  }

  function nextStep(ownedNames, operators, covenants, comp) {
    var unique = uniqueNames(ownedNames);
    var ownedSet = Object.create(null);
    unique.forEach(function (n) {
      ownedSet[n] = true;
      var op = findOp(operators, n);
      if (op) ownedSet[opName(op)] = true;
    });
    var priority = nextStepPriorityOf(comp);
    var core = coreProgress(ownedNames, operators, covenants, comp.core || comp.covenantId);

    if (!core.activated) {
      var need = priority.beforeActivate || [];
      var missing = need.filter(function (n) {
        var op = findOp(operators, n);
        var formal = op ? opName(op) : n;
        return !ownedSet[n] && !ownedSet[formal];
      });
      var remain = Math.max(0, core.activateAt - core.activateCount);
      return {
        phase: "activate-core",
        missingOperators: missing,
        remainToActivate: remain,
        hints: missing,
        text: missing.length
          ? "优先补 " + missing.join(" / ") + "（还差 " + remain + " 人）"
          : "还需 " + remain + " 名" + core.name + "干员才能激活"
      };
    }

    var after = priority.afterActivate || [];
    var hints = [];
    after.forEach(function (item) {
      var cov = findCovenant(covenants, item);
      if (cov) {
        var extra = extraProgress(ownedNames, operators, covenants, cov.id);
        if (!extra.activated) hints.push(cov.name);
      } else {
        var op = findOp(operators, item);
        var formal = op ? opName(op) : item;
        if (!ownedSet[item] && !ownedSet[formal]) hints.push(formal);
      }
    });
    return {
      phase: "after-activate",
      missingOperators: hints.filter(function (h) {
        return !findCovenant(covenants, h);
      }),
      remainToActivate: 0,
      hints: hints,
      text: hints.length ? "下一步优先补 " + hints.join(" / ") : "成型目标可按配方继续补齐"
    };
  }

  function mainSentence(ownedNames, operators, covenants, comp) {
    var core = coreProgress(ownedNames, operators, covenants, comp.core || comp.covenantId);
    var step = nextStep(ownedNames, operators, covenants, comp);
    var sentence;

    if (!core.activated) {
      var remain = Math.max(0, core.activateAt - core.activateCount);
      sentence = core.name + "未激活，还差 " + remain + " 人";
    } else if (core.harmonyBonus && core.owned < core.activateAt) {
      sentence = core.name + "已激活（" + core.owned + "+" + core.harmonyBonus + " 调和）";
    } else {
      sentence = core.name + "已激活（" + core.activateCount + "/" + core.activateAt + "）";
    }

    if (core.activated && step.hints && step.hints.length) {
      sentence += "，下一步优先补 " + step.hints.join(" / ");
    }
    if (core.enhanceOwned) {
      sentence += "。拥有 " + core.owned + "/" + core.enhanceAt + "；" + core.enhanceAt + " 人强化需在场";
    }
    return sentence;
  }

  function inferExtraIds(comp, covenants, ownedNames, operators) {
    var ids = [];
    function add(idOrName) {
      var c = findCovenant(covenants, idOrName);
      if (c && ids.indexOf(c.id) === -1) ids.push(c.id);
    }
    (comp.extras || []).forEach(add);
    (comp.relatedExtras || []).forEach(add);
    (comp.recommendedAdditional || []).forEach(add);
    var cid = comp.core || comp.covenantId;
    if (cid === "ursus" || comp.name === "乌萨斯") {
      ["arts", "swift", "harmony", "gather", "miracle"].forEach(add);
    } else {
      add("harmony");
      uniqueNames(ownedNames).forEach(function (n) {
        var op = findOp(operators, n);
        (op && op.covenants ? op.covenants : []).forEach(function (tag) {
          var c = findCovenant(covenants, tag);
          if (c && !isCoreCovenant(c)) add(c.id);
        });
      });
    }
    return ids;
  }

  function evaluate(input) {
    var ownedNames = uniqueNames(input.owned || input.ownedNames || []);
    var operators = input.operators || [];
    var covenants = input.covenants || [];
    var comp = input.comp;
    if (!comp) throw new Error("缺少配方 comp");
    var options = { eliteCount: input.eliteCount };

    var coreId = comp.core || comp.covenantId;
    var core = coreProgress(ownedNames, operators, covenants, coreId);
    var extraIds = inferExtraIds(comp, covenants, ownedNames, operators);
    var extras = extraIds.map(function (id) {
      return extraProgress(ownedNames, operators, covenants, id, options);
    });
    var step = nextStep(ownedNames, operators, covenants, comp);
    var sentence = mainSentence(ownedNames, operators, covenants, comp);
    var progressLines = [formatCoreActivateText(core), formatCoreEnhanceText(core)];
    extras.forEach(function (ex) {
      progressLines.push(formatExtraText(ex));
    });
    var arcane = extras.filter(isArcane)[0] || null;
    return {
      ownedNames: ownedNames,
      core: core,
      extras: extras,
      arcane: arcane,
      step: step,
      mainSentence: sentence,
      progressLines: progressLines.filter(Boolean),
      forbidsResistTriggered: !!(arcane && arcane.activated && !arcane.enhanced)
    };
  }

  return {
    uniqueNames: uniqueNames,
    unwrapData: unwrapData,
    opName: opName,
    displayName: displayName,
    findOp: findOp,
    findEquipment: findEquipment,
    findCovenant: findCovenant,
    activateAt: activateAt,
    enhanceAt: enhanceAt,
    countCovenant: countCovenant,
    ownedForCovenant: ownedForCovenant,
    isHarmonyActive: isHarmonyActive,
    coreProgress: coreProgress,
    extraProgress: extraProgress,
    isArcane: isArcane,
    isSoloCov: isSoloCov,
    isUltimateCov: isUltimateCov,
    formatCoreActivateText: formatCoreActivateText,
    formatCoreEnhanceText: formatCoreEnhanceText,
    formatArcaneText: formatArcaneText,
    formatExtraText: formatExtraText,
    nextStepPriorityOf: nextStepPriorityOf,
    nextStep: nextStep,
    mainSentence: mainSentence,
    evaluate: evaluate
  };
});
