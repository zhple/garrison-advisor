/* 卫戍协议·阵容顾问 — 界面只展示 officialName；数据来自 window.APP_DATA，不依赖 fetch */
(function () {
  "use strict";

  var roman = { 1: "Ⅰ", 2: "Ⅱ", 3: "Ⅲ", 4: "Ⅳ", 5: "Ⅴ", 6: "Ⅵ" };
  var CORE_ORDER = [
    "yan", "sargon", "victoria", "kjerag", "aegir",
    "siracusa", "kazimierz", "ursus", "iberia", "leithanien"
  ];
  var THEME = {
    yan:        { accent: "#C45C2A", selectedBg: "#8A3A18", selectedFg: "#F2F4F8" },
    sargon:     { accent: "#C4A35A", selectedBg: "#C4A35A", selectedFg: "#12141A" },
    victoria:   { accent: "#3B5B8A", selectedBg: "#3B5B8A", selectedFg: "#F2F4F8" },
    kjerag:     { accent: "#5A7A96", selectedBg: "#3E5C74", selectedFg: "#F2F4F8" },
    aegir:      { accent: "#1F6B7A", selectedBg: "#1F6B7A", selectedFg: "#F2F4F8" },
    siracusa:   { accent: "#6B3A5C", selectedBg: "#6B3A5C", selectedFg: "#F2F4F8" },
    kazimierz:  { accent: "#C9A227", selectedBg: "#C9A227", selectedFg: "#12141A" },
    ursus:      { accent: "#8B2E2E", selectedBg: "#8B2E2E", selectedFg: "#F2F4F8" },
    iberia:     { accent: "#2A4A3A", selectedBg: "#2A4A3A", selectedFg: "#F2F4F8" },
    leithanien: { accent: "#5B4A8A", selectedBg: "#5B4A8A", selectedFg: "#F2F4F8" },
    arts:       { accent: "#6B5CDE", selectedBg: "#5A4CC8", selectedFg: "#F2F4F8" },
    swift:      { accent: "#2A9B8A", selectedBg: "#1B6F63", selectedFg: "#F2F4F8" },
    harmony:    { accent: "#C9B07A", selectedBg: "#C9B07A", selectedFg: "#12141A" }
  };

  if (!window.APP_DATA || !window.Calc) {
    document.body.innerHTML =
      '<p style="padding:16px;font-family:sans-serif">未加载到数据或计算模块。请确认 js/data.js、js/calc.js 与本页在同一目录，或先运行 <code>node js/build-data.js</code>。</p>';
    return;
  }

  var pack = window.Calc.unwrapData(window.APP_DATA);
  var covenants = pack.covenants;
  var operators = pack.operators;
  var equipment = pack.equipment;
  var comps = pack.comps;
  var strategies = pack.strategies;

  var covById = {};
  var covByName = {};
  covenants.forEach(function (c) {
    covById[c.id] = c;
    covByName[c.name] = c;
    if (THEME[c.id] && !c.accent) {
      c.accent = THEME[c.id].accent;
      c.selectedBg = THEME[c.id].selectedBg;
      c.selectedFg = THEME[c.id].selectedFg;
    }
  });

  var state = {
    coreId: "ursus",
    routeId: null,
    owned: Object.create(null),
    eliteCount: 0
  };

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "style" && typeof attrs[k] === "object") {
          Object.keys(attrs[k]).forEach(function (s) {
            node.style.setProperty(s, attrs[k][s]);
          });
        } else if (attrs[k] === false || attrs[k] == null) {
          /* skip */
        } else if (attrs[k] === true) {
          node.setAttribute(k, k);
        } else {
          node.setAttribute(k, String(attrs[k]));
        }
      });
    }
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function officialOf(name) {
    var op = window.Calc.findOp(operators, name);
    if (op) return window.Calc.opName(op);
    var eq = window.Calc.findEquipment(equipment, name);
    if (eq) return eq.officialName || eq.name;
    return name;
  }

  function prtsHref(name) {
    var op = window.Calc.findOp(operators, name);
    if (op && op.prtsUrl) return op.prtsUrl;
    var eq = window.Calc.findEquipment(equipment, name);
    if (eq && eq.prtsUrl) return eq.prtsUrl;
    var path = (op && op.prtsPath) || (eq && eq.prtsPath) || officialOf(name);
    return "https://prts.wiki/w/" + encodeURIComponent(path);
  }

  function isEquipmentName(name) {
    return !!window.Calc.findEquipment(equipment, name) && !window.Calc.findOp(operators, name);
  }

  function compsForCore(coreId) {
    return comps.filter(function (c) {
      return c.covenantId === coreId || c.core === coreId;
    });
  }

  function currentComp() {
    var list = compsForCore(state.coreId);
    if (!list.length) return null;
    if (state.routeId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].routeId === state.routeId) return list[i];
      }
    }
    var rec = list.filter(function (c) {
      return c.recommended;
    })[0];
    return rec || list[0];
  }

  function ownedList() {
    return Object.keys(state.owned).filter(function (n) {
      return state.owned[n];
    });
  }

  function setOwned(name, value) {
    var formal = officialOf(name);
    if (value) state.owned[formal] = true;
    else delete state.owned[formal];
  }

  function isOwned(name) {
    return !!state.owned[officialOf(name)];
  }

  function toggleOwned(name) {
    setOwned(name, !isOwned(name));
    renderAll();
  }

  function covenantIdsOf(name) {
    var op = window.Calc.findOp(operators, name);
    if (!op) return [];
    return (op.covenants || []).map(function (tag) {
      var c = covById[tag] || covByName[tag];
      return c ? c.id : tag;
    });
  }

  function fillAvatar(node, formalName) {
    node.textContent = "";
    var color = "#3A4050";
    var ids = covenantIdsOf(formalName);
    var i, c;
    for (i = 0; i < ids.length; i++) {
      c = covById[ids[i]];
      if (c && (c.type === "core" || c.kind === "core") && (c.accent || THEME[c.id])) {
        color = c.accent || THEME[c.id].accent;
        break;
      }
    }
    if (color === "#3A4050") {
      for (i = 0; i < ids.length; i++) {
        c = covById[ids[i]];
        if (c && (c.accent || (THEME[c.id] && THEME[c.id].accent))) {
          color = c.accent || THEME[c.id].accent;
          break;
        }
      }
    }
    node.style.background = color;

    var localSrc = "local-avatars/" + formalName + ".png";
    var iconSrc = "assets/icons/" + formalName + ".png";

    function showFallback() {
      node.textContent = (formalName || "?").charAt(0);
    }

    function showImg(src) {
      node.textContent = "";
      var img = document.createElement("img");
      img.alt = "";
      img.width = 40;
      img.height = 40;
      img.src = src;
      img.addEventListener("error", function () {
        if (src === localSrc) tryImg(iconSrc, showFallback);
        else showFallback();
      });
      node.appendChild(img);
    }

    function tryImg(src, onFail) {
      var probe = new Image();
      probe.onload = function () {
        showImg(src);
      };
      probe.onerror = onFail;
      probe.src = src;
    }

    tryImg(localSrc, function () {
      tryImg(iconSrc, showFallback);
    });
  }

  function avatarFor(name) {
    var formal = officialOf(name);
    var node = el("span", { className: "avatar", "aria-hidden": "true" });
    fillAvatar(node, formal);
    return node;
  }

  function rarityTag(name) {
    var op = window.Calc.findOp(operators, name);
    var eq = window.Calc.findEquipment(equipment, name);
    var tier = op && op.tier != null ? op.tier : op && op.rarityTier != null ? op.rarityTier : eq && eq.tier;
    if (tier == null) return null;
    var label = roman[tier] || String(tier) + "阶";
    if (eq && !op) label += " · 装备";
    return el("span", { className: "tag tag-rarity-" + tier }, [label]);
  }

  function covenantTags(name) {
    var op = window.Calc.findOp(operators, name);
    if (!op) return [];
    return (op.covenants || []).map(function (tag) {
      var c = covById[tag] || covByName[tag];
      var label = c ? c.name : tag;
      var node = el("span", { className: "tag tag-covenant" }, [label]);
      var accent = (c && (c.accent || (THEME[c.id] && THEME[c.id].accent))) || null;
      if (accent) node.style.setProperty("--tag-accent", accent);
      return node;
    });
  }

  function nameLink(name) {
    var formal = officialOf(name);
    return el(
      "a",
      {
        className: "op-name",
        href: prtsHref(formal),
        target: "_blank",
        rel: "noopener"
      },
      [formal]
    );
  }

  function completenessLabel(value) {
    var v = value || "";
    if (v === "完整") return el("span", { className: "label-complete" }, [v]);
    if (v.indexOf("单源") !== -1) return el("span", { className: "label-single" }, ["单源，待补充"]);
    if (v === "双源交叉偏弱") return el("span", { className: "label-weak" }, [v]);
    if (v === "仅官方池") return el("span", { className: "label-pending" }, [v]);
    return el("span", { className: "label-pending" }, [v || "待补充"]);
  }

  function isUnconfirmedEntry(g) {
    if (!g) return false;
    if (g.kind === "unconfirmed") return true;
    var n = g.name || "";
    return /m3\s*二技能/i.test(n);
  }

  function groupNames(g) {
    if (g.operators && g.operators.length) return g.operators.slice();
    var raw = (g.name || "").trim();
    if (!raw) return [];
    return raw.split(/[、，]/).map(function (s) {
      return s.trim();
    }).filter(Boolean);
  }

  function isKnownName(name) {
    var formal = officialOf(name);
    return !!(
      window.Calc.findOp(operators, formal) ||
      window.Calc.findEquipment(equipment, formal) ||
      formal === "魔王"
    );
  }

  function unconfirmedBlock(g) {
    var name = g.name || "未确认条目";
    var role = g.role || "";
    var tail = /m3/i.test(name)
      ? "不按装备 M3茧甲或干员 Mon3tr 坐实，也不写入勾选计算。"
      : "保留原文，正式名待核，不指定为其他干员，也不写入勾选计算。";
    return el("div", { className: "unconfirmed-note" }, [
      el("span", { className: "label-single" }, ["待确认"]),
      " " + name + "。" + (role ? role + " " : "") + tail
    ]);
  }

  function nameChip(name, avoid) {
    var formal = officialOf(name);
    if (isKnownName(formal)) return pillFor(formal, avoid);
    return el("span", { className: "op-pill is-inert" }, [name + "（资料库暂无条目，不计入勾选）"]);
  }

  function effectText(cov, stage) {
    if (cov.effects && cov.effects.length) {
      var bits = cov.effects
        .filter(function (e) {
          return !stage || e.stage === stage || (stage === "enhance" && e.stage === "threshold");
        })
        .map(function (e) {
          return (e.condition ? e.condition + "：" : "") + e.text;
        });
      if (bits.length) return bits.join(" ");
    }
    if (stage === "activate") return cov.effectActivate || "";
    if (stage === "enhance") return cov.effectEnhance || "";
    return "";
  }

  function officialEffects(core) {
    return el("div", { className: "effect-block" }, [
      el("h3", null, [
        el("span", { className: "label-official" }, ["官方效果"]),
        core.name + "（" + window.Calc.activateAt(core) + " 人激活 / " + (window.Calc.enhanceAt(core) || 6) + " 名不同在场强化）"
      ]),
      el("p", null, ["激活：" + (effectText(core, "activate") || "—")]),
      effectText(core, "enhance") ? el("p", null, ["强化（需在场）：" + effectText(core, "enhance")]) : null,
      core.notes ? el("p", { className: "phase-note" }, [core.notes]) : null
    ]);
  }

  function extraEffectBlock(idOrName) {
    var c = window.Calc.findCovenant(covenants, idOrName);
    if (!c) return null;
    var title = c.name + "（" + window.Calc.activateAt(c) + " 人激活";
    if (typeof window.Calc.enhanceAt(c) === "number") title += " / " + window.Calc.enhanceAt(c) + " 人强化";
    else if (c.layerThreshold) title += " / " + c.layerThreshold + "层";
    title += "）";
    var enh = effectText(c, "enhance");
    return el("div", { className: "effect-block" }, [
      el("h3", null, [el("span", { className: "label-official" }, ["官方效果"]), title]),
      el("p", null, ["激活：" + (effectText(c, "activate") || "—")]),
      enh ? el("p", null, [enh]) : null,
      c.notes ? el("p", { className: "phase-note" }, [c.notes]) : null
    ]);
  }

  function pillFor(name, avoid) {
    var formal = officialOf(name);
    var btn = el(
      "button",
      {
        type: "button",
        className: "op-pill" + (isOwned(formal) ? " is-owned" : "") + (avoid ? " is-avoid" : ""),
        "aria-pressed": isOwned(formal) ? "true" : "false"
      },
      [avatarFor(formal), formal]
    );
    btn.addEventListener("click", function () {
      toggleOwned(formal);
    });
    return btn;
  }

  function phaseTitle(key) {
    return { early: "前期", mid: "中期", late: "后期", avoid: "不优先", items: "巧物", flex: "补位" }[key] || key;
  }

  function hasPriority(comp) {
    var p = comp.priority || {};
    return ["early", "mid", "late", "avoid", "items"].some(function (k) {
      return p[k] && p[k].length;
    });
  }

  function extrasToShow(comp) {
    var ids = (comp.recommendedAdditional || []).slice();
    if ((comp.covenantId || comp.core) === "ursus") {
      ["arts", "swift", "harmony", "gather", "miracle"].forEach(function (id) {
        if (ids.indexOf(id) === -1 && ids.indexOf((covById[id] && covById[id].name) || "") === -1) ids.push(id);
      });
    }
    return ids;
  }

  function renderChips() {
    var wrap = $("chip-list");
    wrap.innerHTML = "";
    wrap.setAttribute("role", "radiogroup");
    wrap.setAttribute("aria-label", "选择核心盟约");
    CORE_ORDER.forEach(function (id, index) {
      var c = covById[id];
      if (!c) return;
      var theme = THEME[id] || {};
      var btn = el(
        "button",
        {
          type: "button",
          className: "chip",
          role: "radio",
          "aria-checked": state.coreId === id ? "true" : "false",
          "data-core": id,
          style:
            "--chip-accent:" +
            (theme.accent || "#3A4050") +
            ";--chip-selected-bg:" +
            (theme.selectedBg || theme.accent || "#3A4050") +
            ";--chip-selected-fg:" +
            (theme.selectedFg || "#F2F4F8")
        },
        [c.name]
      );
      btn.addEventListener("click", function () {
        state.coreId = id;
        state.routeId = null;
        renderAll();
      });
      btn.addEventListener("keydown", function (ev) {
        var next = ev.key === "ArrowRight" || ev.key === "ArrowDown";
        var prev = ev.key === "ArrowLeft" || ev.key === "ArrowUp";
        if (!next && !prev) return;
        ev.preventDefault();
        var ni = (index + (next ? 1 : -1) + CORE_ORDER.length) % CORE_ORDER.length;
        state.coreId = CORE_ORDER[ni];
        state.routeId = null;
        renderAll();
        var nextBtn = wrap.querySelector('[data-core="' + state.coreId + '"]');
        if (nextBtn) nextBtn.focus();
      });
      wrap.appendChild(btn);
    });
  }

  function renderRouteTabs(host, list, current) {
    if (list.length < 2) return;
    var tabs = el("div", { className: "route-tabs", role: "radiogroup", "aria-label": "选择运营路线" });
    list.forEach(function (c) {
      var label = c.routeName || c.name;
      if (c.recommended) label += "（推荐保底）";
      var btn = el(
        "button",
        {
          type: "button",
          className: "chip",
          role: "radio",
          "aria-checked": current.routeId === c.routeId ? "true" : "false"
        },
        [label]
      );
      btn.addEventListener("click", function () {
        state.routeId = c.routeId;
        renderAll();
      });
      tabs.appendChild(btn);
    });
    host.appendChild(tabs);
    host.appendChild(
      el("p", { className: "phase-note" }, ["同一核心的两条路线请分开看，不要混成一套默认板面。"])
    );
  }

  function renderTimeline(comp) {
    var host = $("route-panel");
    host.innerHTML = "";
    var titleRow = el("h2", { className: "section-title" }, ["推荐路线 ", completenessLabel(comp.completeness)]);
    host.appendChild(titleRow);

    var list = compsForCore(state.coreId);
    renderRouteTabs(host, list, comp);

    var core = covById[comp.covenantId || comp.core];
    if (core) host.appendChild(officialEffects(core));
    extrasToShow(comp).forEach(function (id) {
      var block = extraEffectBlock(id);
      if (block) host.appendChild(block);
    });

    if (comp.completeness === "仅官方池") {
      host.appendChild(
        el("div", { className: "pending-panel" }, [
          el("span", { className: "label-pending" }, ["本期抓取顺序待补充"]),
          " 目前没有可交叉核验的本期抓取表。下面只提供官方效果和干员池，可勾选已有干员估算激活与缺口，不编造抓取顺序。" +
            (comp.targetBoardNotes || comp.gap ? " " + (comp.targetBoardNotes || comp.gap) : "")
        ])
      );
    } else if (comp.targetBoard || comp.communityCoreIdea) {
      host.appendChild(
        el("p", { className: "goals" }, [
          el("span", { className: "label-community" }, ["社区推荐"]),
          completenessLabel(comp.completeness),
          (comp.routeName ? comp.routeName + "。" : "") +
            (comp.targetBoard ? "成型目标：" + comp.targetBoard + "。" : "") +
            (comp.communityCoreIdea || "")
        ])
      );
      if (comp.targetBoardNotes) {
        host.appendChild(el("p", { className: "phase-note" }, [comp.targetBoardNotes]));
      }
      if ((comp.completeness || "").indexOf("单源") !== -1) {
        host.appendChild(el("p", { className: "phase-note" }, ["此路线来自单源，尚待交叉验证，不能当成已多方核对的完整配方。"]));
      }
      if (comp.completeness === "双源交叉偏弱") {
        host.appendChild(el("p", { className: "phase-note" }, ["此路线已有两份来源对照，但交叉偏弱，不能标成完整配方。"]));
      }
    }

    if (comp.gap && comp.completeness !== "仅官方池") {
      host.appendChild(el("p", { className: "phase-note" }, [comp.gap]));
    }

    if (hasPriority(comp)) {
      var ol = el("ol", { className: "timeline-list" });
      ["early", "mid", "late", "avoid", "items"].forEach(function (key) {
        var groups = (comp.priority && comp.priority[key]) || [];
        if (!groups.length) return;
        var item = el("li", { className: "timeline-item" });
        item.appendChild(el("h3", { className: "phase-title" }, [phaseTitle(key)]));
        groups.forEach(function (g) {
          if (isUnconfirmedEntry(g)) {
            item.appendChild(unconfirmedBlock(g));
            return;
          }
          if (g.role) item.appendChild(el("p", { className: "phase-note" }, [g.role]));
          var pills = el("div", { className: "op-pills" });
          groupNames(g).forEach(function (n) {
            pills.appendChild(nameChip(n, key === "avoid"));
          });
          if (pills.childNodes.length) item.appendChild(pills);
        });
        ol.appendChild(item);
      });
      host.appendChild(ol);
    }

    if (comp.strategies && comp.strategies.length) {
      var box = el("div", { className: "strategy-block" }, [el("h3", null, ["开局策略"])]);
      comp.strategies.forEach(function (s) {
        if (typeof s === "string") {
          box.appendChild(el("p", null, [s]));
        } else {
          box.appendChild(el("p", null, [(s.operator ? s.operator + " 「" + (s.name || "") + "」" : "") + (s.note || s.text || "")]));
        }
      });
      if ((comp.covenantId || comp.core) === "ursus") {
        strategies.forEach(function (s) {
          if (s.id === "jessica-rally" || s.id === "gnosis-ursus") {
            box.appendChild(el("p", { className: "phase-note" }, ["官方效果（" + s.operator + "「" + s.name + "」）：" + s.text]));
          }
        });
      }
      host.appendChild(box);
    }

    if (comp.selfSelectNotes) {
      host.appendChild(
        el("div", { className: "note-block" }, [
          el("h3", null, ["自选干员"]),
          el("p", { className: "phase-note" }, [comp.selfSelectNotes])
        ])
      );
    }
    if (comp.exampleBoard && comp.exampleBoard.length) {
      host.appendChild(el("p", { className: "phase-note" }, [comp.exampleBoardNotes || "成型对照（不是强制阵容）"]));
      var pills = el("div", { className: "op-pills" });
      comp.exampleBoard.forEach(function (n) {
        pills.appendChild(pillFor(officialOf(n)));
      });
      host.appendChild(pills);
    }
    if (comp.recommendedAdditionalNotes) {
      host.appendChild(el("p", { className: "phase-note" }, [comp.recommendedAdditionalNotes]));
    }

    if (comp.sources && comp.sources.length) {
      var src = el("div", { className: "note-block" }, [el("h3", null, ["资料来源"])]);
      var ul = el("ul", { className: "source-list" });
      comp.sources.forEach(function (s) {
        ul.appendChild(
          el("li", null, [
            (s.date || "") + " · ",
            el("a", { href: s.url, target: "_blank", rel: "noopener" }, [s.title || s.note || s.url]),
            s.note ? " — " + s.note : ""
          ])
        );
      });
      src.appendChild(ul);
      host.appendChild(src);
    }
  }

  function operatorRow(name, opts) {
    opts = opts || {};
    var formal = officialOf(name);
    var avoid = !!opts.avoid;
    var label = el("label", { className: "op-row" + (isOwned(formal) ? " is-owned" : "") });
    var cb = el("input", { type: "checkbox" });
    cb.checked = isOwned(formal);
    cb.addEventListener("change", function () {
      setOwned(formal, cb.checked);
      renderAll();
    });
    label.appendChild(cb);
    label.appendChild(avatarFor(formal));
    var link = nameLink(formal);
    link.addEventListener("click", function (ev) {
      ev.stopPropagation();
    });
    label.appendChild(link);
    var meta = el("span", { className: "op-meta" });
    var rarity = rarityTag(formal);
    if (rarity) meta.appendChild(rarity);
    covenantTags(formal).forEach(function (t) {
      meta.appendChild(t);
    });
    if (avoid) meta.appendChild(el("span", { className: "tag tag-avoid" }, ["不优先"]));
    label.appendChild(meta);
    return el("li", null, [label]);
  }

  function collectPriorityNames(comp, keys, equipmentOnly) {
    var names = [];
    function push(n) {
      var formal = officialOf(n);
      var isEq = isEquipmentName(formal);
      if (equipmentOnly && !isEq && formal !== "魔王") return;
      if (!equipmentOnly && (isEq || formal === "魔王")) return;
      if (formal && names.indexOf(formal) === -1) names.push(formal);
    }
    keys.forEach(function (key) {
      ((comp.priority && comp.priority[key]) || []).forEach(function (g) {
        if (isUnconfirmedEntry(g)) return;
        groupNames(g).forEach(function (n) {
          if (isKnownName(n)) push(n);
        });
      });
    });
    return names;
  }

  function renderRoster(comp) {
    var host = $("roster-panel");
    host.innerHTML = "";
    host.appendChild(el("h2", { className: "section-title" }, ["已有干员"]));
    host.appendChild(
      el("p", { className: "section-kicker" }, [
        "勾选表示这把已经拿到，底部状态会即时重算。装备只出现在巧物区。显示名一律用 PRTS 正式名。"
      ])
    );

    var listed = Object.create(null);
    function addGroup(title, names, avoid) {
      var uniq = [];
      names.forEach(function (n) {
        var formal = officialOf(n);
        if (!formal || listed[formal]) return;
        listed[formal] = true;
        uniq.push(formal);
      });
      if (!uniq.length) return;
      host.appendChild(el("h3", { className: "group-title" }, [title]));
      var ul = el("ul", { className: "op-list" });
      uniq.forEach(function (n) {
        ul.appendChild(operatorRow(n, { avoid: avoid }));
      });
      host.appendChild(ul);
    }

    if (hasPriority(comp)) {
      addGroup("前期优先", collectPriorityNames(comp, ["early"]));
      addGroup("中期", collectPriorityNames(comp, ["mid"]));
      addGroup("后期", collectPriorityNames(comp, ["late"]));
      addGroup("不优先", collectPriorityNames(comp, ["avoid"]), true);
    }

    var pool = (comp.officialPool || []).map(officialOf);
    var restByTier = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], other: [] };
    pool.forEach(function (n) {
      if (listed[n]) return;
      var op = window.Calc.findOp(operators, n);
      var tier = op && op.tier;
      if (restByTier[tier]) restByTier[tier].push(n);
      else restByTier.other.push(n);
    });
    var poolTitle = hasPriority(comp) ? "官方池其余干员" : "官方干员池";
    [1, 2, 3, 4, 5, 6].forEach(function (t) {
      if (restByTier[t].length) addGroup(poolTitle + " · " + roman[t] + "阶", restByTier[t]);
      if (t === 1) poolTitle = "官方干员池";
    });
    if (restByTier.other.length) addGroup("官方干员池 · 其他", restByTier.other);

    var itemNames = collectPriorityNames(comp, ["items"], true);
    equipment.forEach(function (eq) {
      if (itemNames.indexOf(eq.officialName) === -1 && (comp.covenantId === "ursus" || isOwned(eq.officialName))) {
        /* 乌萨斯路线默认列出全部相关巧物里已写入 priority 的；其余不主动铺开全部装备图鉴 */
      }
    });
    if ((comp.covenantId || comp.core) === "ursus") {
      ["魔王", "M3茧甲"].forEach(function (n) {
        if (itemNames.indexOf(officialOf(n)) === -1) itemNames.push(officialOf(n));
      });
    }
    if (itemNames.length) addGroup("巧物 / 装备", itemNames);
  }

  function barWidth(owned, cap) {
    if (!cap) return 0;
    return Math.max(0, Math.min(100, Math.round((owned / cap) * 100)));
  }

  function renderStatus(comp) {
    var host = $("status-card");
    host.innerHTML = "";
    var result = window.Calc.evaluate({
      owned: ownedList(),
      operators: operators,
      covenants: covenants,
      comp: comp,
      eliteCount: state.eliteCount
    });

    var main = result.mainSentence;
    if (comp.completeness === "仅官方池" && !ownedList().length) {
      main = covById[comp.covenantId].name + "本期抓取顺序待补充。勾选已有干员仍可估算激活与缺口。";
    }
    host.appendChild(el("div", { className: "next-bar", role: "status" }, [main]));

    var list = el("ul", { className: "progress-list" });
    var coreItem = el("li", { className: "progress-item" });
    var coreLabel = el("div", { className: "progress-label" }, [result.progressLines[0] || ""]);
    if (result.core.harmonyBonus) {
      coreLabel.appendChild(el("span", { className: "harmony-flag" }, ["+1 调和"]));
    }
    coreItem.appendChild(coreLabel);
    var coreBar = el("div", { className: "bar" + (result.core.activated ? " is-on" : ""), "aria-hidden": "true" }, [el("span")]);
    coreBar.firstChild.style.width = barWidth(result.core.activateCount, result.core.activateAt) + "%";
    coreItem.appendChild(coreBar);
    if (result.progressLines[1]) {
      coreItem.appendChild(el("div", { className: "progress-sub" }, [result.progressLines[1]]));
      var enhBar = el("div", { className: "bar" + (result.core.enhanceOwned ? " is-on" : ""), "aria-hidden": "true" }, [el("span")]);
      enhBar.firstChild.style.width = barWidth(result.core.owned, result.core.enhanceAt) + "%";
      coreItem.appendChild(enhBar);
    }
    list.appendChild(coreItem);

    (result.extras || []).forEach(function (ex) {
      if (!ex.owned && (comp.completeness === "仅官方池" || (ex.id !== "arts" && ex.id !== "swift" && ex.id !== "harmony"))) {
        if ((comp.recommendedAdditional || []).indexOf(ex.name) === -1 && (comp.covenantId !== "ursus" || ["arts", "swift", "harmony"].indexOf(ex.id) === -1)) {
          return;
        }
      }
      var li = el("li", { className: "progress-item" });
      li.appendChild(el("div", { className: "progress-label" }, [window.Calc.formatExtraText(ex)]));
      var cap = ex.enhanceIsHeadcount ? ex.enhanceAt : ex.activateAt;
      var on = ex.enhanceIsHeadcount ? ex.enhanced : ex.activated;
      var bar = el("div", { className: "bar" + (on ? " is-on" : ""), "aria-hidden": "true" }, [el("span")]);
      bar.firstChild.style.width = barWidth(ex.owned, cap) + "%";
      li.appendChild(bar);
      list.appendChild(li);
    });
    host.appendChild(list);

    var showElite = (result.extras || []).some(function (ex) {
      return ex.countsByElite || ex.id === "ultimate" || ex.name === "绝技";
    }) || (comp.recommendedAdditional || []).indexOf("绝技") !== -1;
    if (showElite) {
      var eliteRow = el("div", { className: "elite-row" });
      var eliteLab = el("label", { "for": "elite-count" }, ["在场精锐人数（估算绝技，不按盟约所属）："]);
      var eliteInput = el("input", {
        id: "elite-count",
        type: "number",
        min: "0",
        max: "12",
        value: String(state.eliteCount),
        "aria-label": "在场精锐人数"
      });
      eliteInput.value = String(state.eliteCount);
      eliteInput.addEventListener("change", function () {
        var n = parseInt(eliteInput.value, 10);
        state.eliteCount = isNaN(n) ? 0 : Math.max(0, n);
        renderAll();
      });
      eliteRow.appendChild(eliteLab);
      eliteRow.appendChild(eliteInput);
      host.appendChild(eliteRow);
    }

    var rules = pack.countingRules || {};
    var notes = [
      rules.ownedVsOnField || "按「已勾选拥有」估算，不是实时对局商店推荐。",
      "核心盟约普遍 3 人激活；6 名不同干员的强化效果需在场，勾选满 6 人只表示拥有。",
      rules.arts || "奥术：2 人激活，3 人才强化（减抗 + 攻击范围内隐匿失效）。社区常见的 2 奥术成型不会触发减抗。",
      rules.harmony || "勾选魔王（调和）后，核心盟约激活人数按 +1 计算。",
      rules.crossCore || "跨核心干员按其全部所属核心计入，不以第一盟约单独登记。",
      rules.solo,
      rules.ultimate,
      rules.benchActivation
    ].filter(Boolean);
    var ul = el("ul", { className: "calc-notes" });
    notes.forEach(function (n) {
      ul.appendChild(el("li", null, [n]));
    });
    var details = el("details", { className: "calc-rules" });
    details.appendChild(el("summary", null, ["计算口径"]));
    details.appendChild(ul);
    details.addEventListener("toggle", updateStatusOffset);
    host.appendChild(details);
    updateStatusOffset();
  }

  function renderFooter() {
    var host = $("site-footer");
    if (!host) return;
    host.innerHTML = "";
    var season = pack.season || (pack.raw && pack.raw.season) || "规程·序列Ⅰ";
    var updated = pack.raw && pack.raw.updated;
    host.appendChild(el("p", null, ["赛季：" + season + (updated ? " · 数据整理 " + updated + "（Asia/Shanghai）" : "")]));
    host.appendChild(
      el("p", null, [
        "非官方工具，与鹰角网络无关。数值以 ",
        el("a", { href: "https://prts.wiki/w/卫戍协议·规程/PRTS盟约记录", target: "_blank", rel: "noopener" }, ["PRTS 盟约记录"]),
        " 为准。社区推荐与官方效果已分开标注，不能写成官方结论。数据随赛季或热更新变化，换赛季须更新 data/garrison-data.json。"
      ])
    );
    if (pack.sourcesPrimary && pack.sourcesPrimary.length) {
      var bits = pack.sourcesPrimary.map(function (s) {
        return (s.date || "") + " " + (s.title || s.url);
      });
      host.appendChild(el("p", null, ["资料来源：" + bits.join("；")]));
    }
    host.appendChild(
      el("p", null, [
        "工具不附带、不分发官方立绘或头像。默认显示原创简化图标；若要把游戏头像显示在本地页面上，请自行放到 ",
        el("a", { href: "README.md" }, ["local-avatars/正式名.png"]),
        "（例如 折桠.png），详见 README。"
      ])
    );
  }

  function updateStatusOffset() {
    var card = $("status-card");
    if (!card) return;
    if (window.matchMedia("(max-width: 899px)").matches) {
      document.documentElement.style.setProperty("--status-offset", card.offsetHeight + "px");
    } else {
      document.documentElement.style.setProperty("--status-offset", "0px");
    }
  }

  function renderAll() {
    var comp = currentComp();
    if (!comp) return;
    renderChips();
    renderTimeline(comp);
    renderRoster(comp);
    renderStatus(comp);
    renderFooter();
  }

  window.addEventListener("resize", updateStatusOffset);
  renderAll();
})();
