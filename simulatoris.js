(() => {
  const CONFIG = {
    safetyMarginPercent: 5,
    defaultAttackModifiers: {
      moralePercent: 100,
      luckPercent: 0,
    },
    defaultDefenseModifiers: {
      nightBonusEnabled: false,
      nightBonusPercent: 100,
    },
    offTemplates: [
      {
        name: "Full OFF Axe/LC",
        units: { axe: 6800, light: 2650, ram: 350, catapult: 125 },
      },
      {
        name: "Full OFF Axe/MA",
        units: { axe: 6800, marcher: 2650, ram: 350, catapult: 125 },
      },
    ],
    reserveScenario: {
      enabled: false,
      label: "Rezervny bonus",
      globalDefensePercent: 0,
      unitDefensePercent: {},
    },
  };

  const UNIT_STATS = {
    spear: {
      label: "Spear",
      attack: 10,
      defenseInf: 15,
      defenseCav: 45,
      group: "infantry",
      aliases: ["spear", "spearman", "kopij", "kopi", "copy", "unit_spear"],
    },
    sword: {
      label: "Sword",
      attack: 25,
      defenseInf: 50,
      defenseCav: 15,
      group: "infantry",
      aliases: ["sword", "swordsman", "mec", "mecnik", "unit_sword"],
    },
    axe: {
      label: "Axe",
      attack: 40,
      defenseInf: 10,
      defenseCav: 5,
      group: "infantry",
      aliases: ["axe", "axeman", "sekera", "sekernik", "unit_axe"],
    },
    archer: {
      label: "Archer",
      attack: 15,
      defenseInf: 50,
      defenseCav: 40,
      group: "infantry",
      aliases: ["archer", "luk", "lukostrelec", "unit_archer"],
    },
    spy: {
      label: "Spy",
      attack: 0,
      defenseInf: 2,
      defenseCav: 1,
      group: "infantry",
      aliases: ["spy", "scout", "zved", "spion", "unit_spy"],
    },
    light: {
      label: "Light Cavalry",
      attack: 130,
      defenseInf: 30,
      defenseCav: 40,
      group: "cavalry",
      aliases: [
        "light cavalry",
        "light",
        "lk",
        "lahka jazda",
        "lehká jízda",
        "unit_light",
      ],
    },
    marcher: {
      label: "Mounted Archer",
      attack: 120,
      defenseInf: 40,
      defenseCav: 50,
      group: "cavalry",
      aliases: [
        "mounted archer",
        "marcher",
        "ma",
        "lukostrelec na koni",
        "mounted",
        "unit_marcher",
      ],
    },
    heavy: {
      label: "Heavy Cavalry",
      attack: 150,
      defenseInf: 200,
      defenseCav: 80,
      group: "cavalry",
      aliases: [
        "heavy cavalry",
        "heavy",
        "tk",
        "tazka jazda",
        "těžká jízda",
        "unit_heavy",
      ],
    },
    ram: {
      label: "Ram",
      attack: 2,
      defenseInf: 2,
      defenseCav: 20,
      group: "infantry",
      aliases: ["ram", "beranidlo", "beranidla", "unit_ram"],
    },
    catapult: {
      label: "Catapult",
      attack: 100,
      defenseInf: 100,
      defenseCav: 50,
      group: "infantry",
      aliases: ["catapult", "katapult", "katapulta", "unit_catapult"],
    },
    knight: {
      label: "Knight",
      attack: 150,
      defenseInf: 250,
      defenseCav: 400,
      group: "cavalry",
      aliases: ["knight", "paladin", "rytier", "rytir", "unit_knight"],
    },
    snob: {
      label: "Noble",
      attack: 30,
      defenseInf: 100,
      defenseCav: 50,
      group: "infantry",
      aliases: ["snob", "noble", "nobleman", "slechtic", "šlechtic", "unit_snob"],
    },
  };

  const PANEL_ID = "tw-report-off-bookmarklet-panel";
  const STATE_KEY = "__twReportOffBookmarkletState";
  const STORAGE_KEY = "twReportOffBookmarkletStateV2";
  const UNIT_ORDER = Object.keys(UNIT_STATS);
  const CATEGORY_UNITS = {
    infantry: UNIT_ORDER.filter((unit) => UNIT_STATS[unit].group === "infantry"),
    cavalry: UNIT_ORDER.filter((unit) => UNIT_STATS[unit].group === "cavalry"),
    archers: ["archer", "marcher"],
  };
  const KNOWN_TABLE_SELECTORS = [
    "#attack_spy_units",
    "#attack_info_def",
    ".report_ReportSupportAttackMergedTable",
    "table.vis",
    "table",
  ];
  const BONUS_KEYWORDS = [
    "bonus",
    "obrana",
    "obranny",
    "obrann",
    "defense",
    "defensive",
    "paladin",
    "knight",
    "weapon",
    "zbran",
    "night",
    "noc",
    "wall",
    "hradb",
    "flag",
  ];
  const CATEGORY_ALIASES = {
    infantry: ["infantry", "pech", "foot"],
    cavalry: ["cavalry", "jazd", "mounted"],
    archers: ["archer", "luk", "bow"],
  };

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseInteger(value) {
    const digits = String(value || "").replace(/[^\d-]/g, "");
    if (!digits || digits === "-") {
      return null;
    }
    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseNumber(value) {
    const match = String(value || "")
      .replace(/\s+/g, "")
      .replace(",", ".")
      .match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }

    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString("sk-SK");
  }

  function formatDecimal(value) {
    return Number(value || 0).toLocaleString("sk-SK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatPercent(value, options = {}) {
    const numeric = Number(value || 0);
    const decimals =
      options.decimals ??
      (Math.abs(numeric % 1) > 0.0001 ? 1 : 0);
    return numeric.toLocaleString("sk-SK", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeAttackModifiers(modifiers) {
    const moraleSource = parseNumber(modifiers?.moralePercent);
    const luckSource = parseNumber(modifiers?.luckPercent);

    return {
      moralePercent: clamp(
        moraleSource ?? CONFIG.defaultAttackModifiers.moralePercent,
        1,
        100
      ),
      luckPercent: clamp(luckSource ?? CONFIG.defaultAttackModifiers.luckPercent, -25, 25),
    };
  }

  function normalizeDefenseModifiers(modifiers) {
    const nightBonusSource = parseNumber(modifiers?.nightBonusPercent);

    return {
      nightBonusEnabled: Boolean(modifiers?.nightBonusEnabled),
      nightBonusPercent: clamp(
        nightBonusSource ?? CONFIG.defaultDefenseModifiers.nightBonusPercent,
        0,
        300
      ),
    };
  }

  function calculateAttackMultiplier(attackModifiers) {
    const normalized = normalizeAttackModifiers(attackModifiers);
    return (normalized.moralePercent / 100) * (1 + normalized.luckPercent / 100);
  }

  function buildInitialState() {
    const defaults = {
      manualReserveScenario: null,
      attackModifiersOverride: null,
      defenseModifiers: normalizeDefenseModifiers(CONFIG.defaultDefenseModifiers),
    };

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaults;
      }

      const saved = JSON.parse(raw);
      const savedAttackModifiers = saved?.attackModifiersOverride || saved?.attackModifiers;
      if (savedAttackModifiers) {
        defaults.attackModifiersOverride = normalizeAttackModifiers(savedAttackModifiers);
      }
      defaults.defenseModifiers = normalizeDefenseModifiers(saved?.defenseModifiers);

      if (saved?.manualReserveScenario?.raw) {
        defaults.manualReserveScenario = {
          raw: saved.manualReserveScenario.raw,
          label: saved.manualReserveScenario.label || "Manualna rezerva",
          bonusMap: parseManualReserve(saved.manualReserveScenario.raw),
        };
      }
    } catch (error) {
      return defaults;
    }

    return defaults;
  }

  function getState() {
    if (!window[STATE_KEY]) {
      window[STATE_KEY] = buildInitialState();
    }
    return window[STATE_KEY];
  }

  function persistState() {
    try {
      const state = getState();
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          attackModifiersOverride: state.attackModifiersOverride
            ? normalizeAttackModifiers(state.attackModifiersOverride)
            : null,
          defenseModifiers: normalizeDefenseModifiers(state.defenseModifiers),
          manualReserveScenario: state.manualReserveScenario
            ? {
                raw: state.manualReserveScenario.raw,
                label: state.manualReserveScenario.label,
              }
            : null,
        })
      );
    } catch (error) {
      // Ignore localStorage issues and keep the bookmarklet functional.
    }
  }

  function extractReportAttackModifiers() {
    const bodyText = normalizeText(document.body?.innerText || "");
    if (!bodyText) {
      return null;
    }

    const moraleMatch = bodyText.match(/moralka\s*:?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/i);
    const luckMatch = bodyText.match(
      /stastie(?:\s+utocnika)?[^\d+-]{0,20}([+-]?\d{1,2}(?:[.,]\d+)?)\s*%/i
    );

    const moralePercent = parseNumber(moraleMatch?.[1]);
    const luckPercent = parseNumber(luckMatch?.[1]);

    if (moralePercent === null && luckPercent === null) {
      return null;
    }

    return normalizeAttackModifiers({
      moralePercent:
        moralePercent === null
          ? CONFIG.defaultAttackModifiers.moralePercent
          : moralePercent,
      luckPercent:
        luckPercent === null
          ? CONFIG.defaultAttackModifiers.luckPercent
          : luckPercent,
    });
  }

  function matchesAlias(text, aliases) {
    return aliases.some((alias) => text.includes(normalizeText(alias)));
  }

  function detectUnitFromText(value) {
    const text = normalizeText(value);
    if (!text) {
      return null;
    }

    for (const [unitName, unitConfig] of Object.entries(UNIT_STATS)) {
      if (matchesAlias(text, unitConfig.aliases)) {
        return unitName;
      }
    }

    return null;
  }

  function detectUnitFromCell(cell) {
    if (!cell) {
      return null;
    }

    const snippets = [];
    snippets.push(cell.textContent || "");
    snippets.push(cell.className || "");
    snippets.push(cell.id || "");

    for (const node of cell.querySelectorAll("img")) {
      snippets.push(node.alt || "");
      snippets.push(node.title || "");
      snippets.push(node.src || "");
      snippets.push(node.className || "");
    }

    for (const candidate of snippets) {
      const detected = detectUnitFromText(candidate);
      if (detected) {
        return detected;
      }
    }

    return null;
  }

  function collectTables() {
    const collected = [];
    const seen = new Set();

    for (const selector of KNOWN_TABLE_SELECTORS) {
      for (const table of document.querySelectorAll(selector)) {
        if (table instanceof HTMLTableElement && !seen.has(table)) {
          seen.add(table);
          collected.push(table);
        }
      }
    }

    return collected;
  }

  function extractTroopsFromTable(table) {
    const rows = Array.from(table.rows || []);
    let bestCandidate = null;

    for (let headerIndex = 0; headerIndex < rows.length; headerIndex += 1) {
      const headerCells = Array.from(rows[headerIndex].cells || []);
      const unitColumns = [];

      headerCells.forEach((cell, index) => {
        const unit = detectUnitFromCell(cell);
        if (unit) {
          unitColumns.push({ index, unit });
        }
      });

      if (unitColumns.length < 3) {
        continue;
      }

      for (
        let rowIndex = headerIndex + 1;
        rowIndex < Math.min(rows.length, headerIndex + 6);
        rowIndex += 1
      ) {
        const rowCells = Array.from(rows[rowIndex].cells || []);
        const counts = {};
        let nonZero = 0;
        let total = 0;

        for (const column of unitColumns) {
          const value = parseInteger(rowCells[column.index]?.textContent);
          if (value !== null) {
            counts[column.unit] = value;
            total += value;
            if (value > 0) {
              nonZero += 1;
            }
          }
        }

        if (nonZero < 3 || total <= 0) {
          continue;
        }

        const score = total + nonZero * 1000 + unitColumns.length * 100;
        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = {
            counts,
            score,
            table,
          };
        }
      }
    }

    return bestCandidate;
  }

  function extractTroopCandidate() {
    let best = null;

    for (const table of collectTables()) {
      const candidate = extractTroopsFromTable(table);
      if (candidate && (!best || candidate.score > best.score)) {
        best = candidate;
      }
    }

    return best;
  }

  function addBonusSource(targetMap, rawValue, isContextual) {
    String(rawValue || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.includes("%") && line.length <= 220)
      .forEach((line) => {
        const key = normalizeText(line);
        if (!key) {
          return;
        }

        const existing = targetMap.get(key);
        if (existing) {
          existing.isContextual = existing.isContextual || isContextual;
          return;
        }

        targetMap.set(key, { text: line, isContextual });
      });
  }

  function collectNearbyBonusNodes(table) {
    const nodes = new Set();
    if (!table) {
      return [];
    }

    nodes.add(table);
    let current = table.parentElement;
    for (let depth = 0; current && depth < 4; depth += 1) {
      nodes.add(current);

      let sibling = current.nextElementSibling;
      for (let steps = 0; sibling && steps < 4; steps += 1) {
        nodes.add(sibling);
        sibling = sibling.nextElementSibling;
      }

      current = current.parentElement;
    }

    return Array.from(nodes);
  }

  function collectBonusSources(troopTable) {
    const sources = new Map();

    addBonusSource(sources, document.body?.innerText || "", false);

    const bonusAttributes = ["title", "data-title", "data-tooltip-content", "aria-label", "alt"];
    for (const element of document.querySelectorAll("*")) {
      for (const attribute of bonusAttributes) {
        const value = element.getAttribute(attribute);
        if (value && value.includes("%")) {
          addBonusSource(sources, value, false);
        }
      }
    }

    for (const node of collectNearbyBonusNodes(troopTable)) {
      addBonusSource(sources, node.textContent || "", true);
      for (const attribute of bonusAttributes) {
        const ownValue = node.getAttribute?.(attribute);
        if (ownValue && ownValue.includes("%")) {
          addBonusSource(sources, ownValue, true);
        }
      }
      for (const nested of node.querySelectorAll?.("*") || []) {
        for (const attribute of bonusAttributes) {
          const value = nested.getAttribute(attribute);
          if (value && value.includes("%")) {
            addBonusSource(sources, value, true);
          }
        }
      }
    }

    return Array.from(sources.values());
  }

  function findUnitsForCategory(text) {
    if (matchesAlias(text, CATEGORY_ALIASES.infantry)) {
      return [...CATEGORY_UNITS.infantry];
    }
    if (matchesAlias(text, CATEGORY_ALIASES.cavalry)) {
      return [...CATEGORY_UNITS.cavalry];
    }
    if (matchesAlias(text, CATEGORY_ALIASES.archers)) {
      return [...CATEGORY_UNITS.archers];
    }
    return [];
  }

  function buildEmptyBonusMap() {
    return {
      globalDefensePercent: 0,
      unitDefensePercent: {},
      entries: [],
    };
  }

  function addUnitBonus(target, unitName, percent, label) {
    target.unitDefensePercent[unitName] =
      (target.unitDefensePercent[unitName] || 0) + percent;
    target.entries.push({ label, percent, unitName });
  }

  function addGlobalBonus(target, percent, label) {
    target.globalDefensePercent += percent;
    target.entries.push({ label, percent, unitName: null });
  }

  function collectDetectedBonuses(troopTable) {
    const bonusMap = buildEmptyBonusMap();
    const seen = new Set();

    for (const sourceInfo of collectBonusSources(troopTable)) {
      const source = sourceInfo.text.trim();
      const normalized = normalizeText(source);

      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);

      if (
        !sourceInfo.isContextual &&
        !BONUS_KEYWORDS.some((keyword) => normalized.includes(keyword))
      ) {
        continue;
      }

      const percentMatch = source.match(/([+-]?\d{1,3}(?:[.,]\d+)?)\s*%/);
      if (!percentMatch) {
        continue;
      }

      const percent = parseNumber(percentMatch[1]);
      if (!Number.isFinite(percent) || percent === 0) {
        continue;
      }

      const matchingUnits = UNIT_ORDER.filter((unitName) =>
        matchesAlias(normalized, UNIT_STATS[unitName].aliases)
      );

      if (matchingUnits.length > 0) {
        matchingUnits.forEach((unitName) => {
          addUnitBonus(bonusMap, unitName, percent, source);
        });
        continue;
      }

      const categoryUnits = findUnitsForCategory(normalized);
      if (categoryUnits.length > 0) {
        categoryUnits.forEach((unitName) => {
          addUnitBonus(bonusMap, unitName, percent, source);
        });
        continue;
      }

      addGlobalBonus(bonusMap, percent, source);
    }

    return bonusMap;
  }

  function mergeBonusMaps(base, extra) {
    const merged = buildEmptyBonusMap();
    merged.globalDefensePercent =
      (base?.globalDefensePercent || 0) + (extra?.globalDefensePercent || 0);
    merged.entries = [...(base?.entries || []), ...(extra?.entries || [])];

    for (const map of [base?.unitDefensePercent || {}, extra?.unitDefensePercent || {}]) {
      for (const [unitName, percent] of Object.entries(map)) {
        merged.unitDefensePercent[unitName] =
          (merged.unitDefensePercent[unitName] || 0) + percent;
      }
    }

    return merged;
  }

  function calculateDefense(units, bonusMap) {
    let defenseInf = 0;
    let defenseCav = 0;

    for (const [unitName, count] of Object.entries(units)) {
      if (!UNIT_STATS[unitName] || !count) {
        continue;
      }

      const unit = UNIT_STATS[unitName];
      const multiplier =
        1 +
        (bonusMap.globalDefensePercent || 0) / 100 +
        (bonusMap.unitDefensePercent[unitName] || 0) / 100;

      defenseInf += count * unit.defenseInf * multiplier;
      defenseCav += count * unit.defenseCav * multiplier;
    }

    return {
      defenseInf,
      defenseCav,
    };
  }

  function calculateTemplateAttack(template, attackModifiers) {
    let baseInfantryAttack = 0;
    let baseCavalryAttack = 0;

    for (const [unitName, count] of Object.entries(template.units || {})) {
      if (!UNIT_STATS[unitName] || !count) {
        continue;
      }

      const attackValue = UNIT_STATS[unitName].attack * count;
      if (UNIT_STATS[unitName].group === "cavalry") {
        baseCavalryAttack += attackValue;
      } else {
        baseInfantryAttack += attackValue;
      }
    }

    const attackMultiplier = calculateAttackMultiplier(attackModifiers);
    const infantryAttack = baseInfantryAttack * attackMultiplier;
    const cavalryAttack = baseCavalryAttack * attackMultiplier;

    return {
      attackMultiplier,
      baseInfantryAttack,
      baseCavalryAttack,
      totalBaseAttack: baseInfantryAttack + baseCavalryAttack,
      infantryAttack,
      cavalryAttack,
      totalAttack: infantryAttack + cavalryAttack,
    };
  }

  function calculateTemplateResult(template, defense, attackModifiers) {
    const attack = calculateTemplateAttack(template, attackModifiers);
    if (!attack.totalAttack) {
      return null;
    }

    const infantryShare = attack.infantryAttack / attack.totalAttack;
    const cavalryShare = attack.cavalryAttack / attack.totalAttack;
    const effectiveDefense =
      defense.defenseInf * infantryShare + defense.defenseCav * cavalryShare;
    const exactOffs = effectiveDefense / attack.totalAttack;
    const recommendedOffs = Math.max(
      1,
      Math.ceil(exactOffs * (1 + CONFIG.safetyMarginPercent / 100))
    );

    return {
      name: template.name,
      attackMultiplier: attack.attackMultiplier,
      totalBaseAttack: attack.totalBaseAttack,
      modifiedAttack: attack.totalAttack,
      totalAttack: attack.totalAttack,
      effectiveDefense,
      exactOffs,
      recommendedOffs,
    };
  }

  function summarizeUnits(units) {
    return UNIT_ORDER.filter((unitName) => units[unitName] > 0).map((unitName) => ({
      unitName,
      label: UNIT_STATS[unitName].label,
      count: units[unitName],
    }));
  }

  function summarizeBonuses(bonusMap) {
    const lines = [];
    const seen = new Set();

    if (bonusMap.globalDefensePercent) {
      lines.push(`Global defense: +${formatPercent(bonusMap.globalDefensePercent)}%`);
    }

    for (const unitName of UNIT_ORDER) {
      const percent = bonusMap.unitDefensePercent[unitName] || 0;
      if (percent) {
        lines.push(`${UNIT_STATS[unitName].label}: +${formatPercent(percent)}%`);
      }
    }

    for (const entry of bonusMap.entries || []) {
      const normalized = normalizeText(entry.label);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
      }
    }

    return lines;
  }

  function parseManualReserve(input) {
    const reserve = buildEmptyBonusMap();
    if (!input || !input.trim()) {
      return reserve;
    }

    const parts = input.split(",").map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const [rawKey, rawValue] = part.split("=");
      const key = normalizeText(rawKey);
      const percent = Number.parseInt(String(rawValue || "").trim(), 10);
      if (!key || !Number.isFinite(percent)) {
        continue;
      }

      if (key === "global") {
        addGlobalBonus(reserve, percent, `Manual reserve: ${part}`);
        continue;
      }

      const unitName = detectUnitFromText(key);
      if (unitName) {
        addUnitBonus(reserve, unitName, percent, `Manual reserve: ${part}`);
      }
    }

    return reserve;
  }

  function buildDefenseModifierBonusMap(defenseModifiers) {
    const normalized = normalizeDefenseModifiers(defenseModifiers);
    const map = buildEmptyBonusMap();

    if (normalized.nightBonusEnabled && normalized.nightBonusPercent) {
      addGlobalBonus(
        map,
        normalized.nightBonusPercent,
        `Nocny bonus +${formatPercent(normalized.nightBonusPercent)}%`
      );
    }

    return map;
  }

  function renderPanel(html) {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.remove();
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = html;
    document.body.appendChild(panel);
    return panel;
  }

  function buildPanelHtml(result) {
    const attackEfficiencyPercent = calculateAttackMultiplier(result.attackModifiers) * 100;
    const reportAttackText = result.reportAttackModifiers
      ? `Report: moralka ${formatPercent(
          result.reportAttackModifiers.moralePercent
        )}% / stastie ${formatPercent(result.reportAttackModifiers.luckPercent, {
          decimals: 1,
        })}%`
      : "Report: moralku ani stastie sa nepodarilo precitat.";
    const unitLines = summarizeUnits(result.units)
      .map(
        (entry) =>
          `<li><strong>${escapeHtml(entry.label)}:</strong> ${formatNumber(entry.count)}</li>`
      )
      .join("");

    const detectedBonusLines = summarizeBonuses(result.detectedBonuses)
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("");

    const scenarioHtml = result.scenarios
      .map((scenario) => {
        const scenarioBonusLines = summarizeBonuses(scenario.bonusMap)
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("");
        const templateRows = scenario.templates
          .map(
            (template) => `
              <tr>
                <td>${escapeHtml(template.name)}</td>
                <td>${formatNumber(template.modifiedAttack)}</td>
                <td>${formatDecimal(template.exactOffs)}</td>
                <td>${template.recommendedOffs}</td>
              </tr>
            `
          )
          .join("");

        return `
          <section class="tw-off-section">
            <h4>${escapeHtml(scenario.label)}</h4>
            <p class="tw-off-meta">
              DEF vs inf: <strong>${formatNumber(scenario.defense.defenseInf)}</strong><br>
              DEF vs cav: <strong>${formatNumber(scenario.defense.defenseCav)}</strong>
            </p>
            <ul>${
              scenarioBonusLines || "<li>Bez dodatkovej zmeny obrany.</li>"
            }</ul>
            <table class="tw-off-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Sila OFF</th>
                  <th>Exact OFF</th>
                  <th>Odporucanie</th>
                </tr>
              </thead>
              <tbody>${templateRows}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    return `
      <div style="all: initial;">
        <div class="tw-off-backdrop"></div>
        <div class="tw-off-panel">
          <div class="tw-off-header">
            <div>
              <h3>OFF kalkulacka</h3>
              <p>Spy report bookmarklet</p>
            </div>
            <button type="button" data-action="close">Zavriet</button>
          </div>

          <section class="tw-off-section">
            <h4>Najdene jednotky</h4>
            <ul>${unitLines || "<li>Ziadne jednotky neboli rozpoznane.</li>"}</ul>
          </section>

          <section class="tw-off-section">
            <h4>Utokove modifikatory</h4>
            <div class="tw-off-controls">
              <label class="tw-off-field">
                <span>Moralka %</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.1"
                  data-field="morale"
                  value="${escapeHtml(result.attackModifiers.moralePercent)}"
                >
              </label>
              <label class="tw-off-field">
                <span>Stastie %</span>
                <input
                  type="number"
                  min="-25"
                  max="25"
                  step="0.1"
                  data-field="luck"
                  value="${escapeHtml(result.attackModifiers.luckPercent)}"
                >
              </label>
              <label class="tw-off-field tw-off-check">
                <span>Nocny bonus</span>
                <input
                  type="checkbox"
                  data-field="night-enabled"
                  ${result.defenseModifiers.nightBonusEnabled ? "checked" : ""}
                >
              </label>
              <label class="tw-off-field">
                <span>Noc % obrany</span>
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="0.1"
                  data-field="night-percent"
                  value="${escapeHtml(result.defenseModifiers.nightBonusPercent)}"
                >
              </label>
              <button type="button" data-action="apply-modifiers">Pouzit</button>
              <button type="button" data-action="use-report-modifiers">Z reportu</button>
            </div>
            <p class="tw-off-meta">${escapeHtml(reportAttackText)}</p>
            <p class="tw-off-meta">
              Efektivita utoku: <strong>${formatDecimal(attackEfficiencyPercent)}%</strong>
              povodnej sily jednej OFF.
            </p>
          </section>

          <section class="tw-off-section">
            <h4>Detegovane bonusy</h4>
            <ul>${
              detectedBonusLines || "<li>Nenasiel som aktivne bonusy na strane obrany.</li>"
            }</ul>
          </section>

          ${scenarioHtml}

          <section class="tw-off-section">
            <p class="tw-off-note">
              Vypocet je odhad zalozeny na rozpoznanych jednotkach a percent bonusoch z reportu.
              Presnost zavisi od world nastaveni a tvojich OFF sablon.
            </p>
          </section>

          <div class="tw-off-actions">
            <button type="button" data-action="refresh">Prepocitat</button>
            <button type="button" data-action="reserve">Rezervny bonus</button>
            <button type="button" data-action="reset-reserve">Reset rezervy</button>
          </div>
        </div>
      </div>
      <style>
        #${PANEL_ID} {
          all: initial;
        }
        #${PANEL_ID} .tw-off-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(12, 17, 25, 0.55);
          z-index: 2147483645;
        }
        #${PANEL_ID} .tw-off-panel {
          position: fixed;
          top: 24px;
          right: 24px;
          width: min(540px, calc(100vw - 32px));
          max-height: calc(100vh - 48px);
          overflow: auto;
          padding: 18px 18px 14px;
          border-radius: 18px;
          background: linear-gradient(180deg, #f5efe4 0%, #eadcc4 100%);
          border: 2px solid #6c4a2d;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          color: #2b180a;
          font: 14px/1.45 Verdana, Tahoma, sans-serif;
          z-index: 2147483646;
        }
        #${PANEL_ID} h3,
        #${PANEL_ID} h4,
        #${PANEL_ID} p,
        #${PANEL_ID} ul,
        #${PANEL_ID} li,
        #${PANEL_ID} table,
        #${PANEL_ID} thead,
        #${PANEL_ID} tbody,
        #${PANEL_ID} tr,
        #${PANEL_ID} th,
        #${PANEL_ID} td,
        #${PANEL_ID} strong,
        #${PANEL_ID} button,
        #${PANEL_ID} section,
        #${PANEL_ID} div {
          all: revert;
          font-family: Verdana, Tahoma, sans-serif;
        }
        #${PANEL_ID} .tw-off-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        #${PANEL_ID} .tw-off-header h3 {
          margin: 0;
          font-size: 21px;
        }
        #${PANEL_ID} .tw-off-header p {
          margin: 4px 0 0;
          color: #5b4331;
        }
        #${PANEL_ID} .tw-off-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: end;
        }
        #${PANEL_ID} .tw-off-field {
          display: grid;
          gap: 4px;
          min-width: 130px;
        }
        #${PANEL_ID} .tw-off-check {
          min-width: 110px;
        }
        #${PANEL_ID} .tw-off-field span {
          font-size: 12px;
          color: #5b4331;
        }
        #${PANEL_ID} .tw-off-field input {
          box-sizing: border-box;
          width: 100%;
          border: 1px solid #9f7a53;
          border-radius: 8px;
          padding: 7px 9px;
          background: #fffdf8;
          color: #2b180a;
        }
        #${PANEL_ID} .tw-off-check input {
          width: 18px;
          height: 18px;
          padding: 0;
          accent-color: #7c5b37;
          background: transparent;
        }
        #${PANEL_ID} .tw-off-section {
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid rgba(108, 74, 45, 0.25);
        }
        #${PANEL_ID} .tw-off-section:first-of-type {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }
        #${PANEL_ID} .tw-off-section h4 {
          margin: 0 0 8px;
          font-size: 15px;
        }
        #${PANEL_ID} ul {
          margin: 0;
          padding-left: 18px;
        }
        #${PANEL_ID} .tw-off-table {
          width: 100%;
          border-collapse: collapse;
        }
        #${PANEL_ID} .tw-off-table th,
        #${PANEL_ID} .tw-off-table td {
          padding: 6px 8px;
          border-bottom: 1px solid rgba(108, 74, 45, 0.2);
          text-align: left;
        }
        #${PANEL_ID} .tw-off-meta {
          margin: 0 0 8px;
        }
        #${PANEL_ID} .tw-off-note {
          margin: 0;
          color: #5b4331;
        }
        #${PANEL_ID} .tw-off-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }
        #${PANEL_ID} button {
          appearance: none;
          border: 1px solid #6c4a2d;
          background: #fff7eb;
          color: #2b180a;
          border-radius: 10px;
          padding: 7px 12px;
          cursor: pointer;
          font-weight: 600;
        }
        #${PANEL_ID} button:hover {
          background: #f0debd;
        }
      </style>
    `;
  }

  function calculateScenario(units, detectedBonuses, extraBonusMap, label, attackModifiers) {
    const mergedBonusMap = mergeBonusMaps(detectedBonuses, extraBonusMap);
    const defense = calculateDefense(units, mergedBonusMap);
    const templates = CONFIG.offTemplates
      .map((template) => calculateTemplateResult(template, defense, attackModifiers))
      .filter(Boolean);

    return {
      label,
      defense,
      templates,
      bonusMap: mergedBonusMap,
    };
  }

  function promptReserveScenario() {
    const state = getState();
    const message =
      "Zadaj rezervny bonus vo formate spear=15,sword=15,heavy=10,global=5. Prazdne pole rezervu vymaze.";
    const current = state.manualReserveScenario?.raw || "";
    const value = window.prompt(message, current);
    if (value === null) {
      return false;
    }

    const parsed = parseManualReserve(value);
    if (!value.trim()) {
      state.manualReserveScenario = null;
      persistState();
      return true;
    }

    state.manualReserveScenario = {
      raw: value,
      label: "Manualna rezerva",
      bonusMap: parsed,
    };
    persistState();
    return true;
  }

  function clearReserveScenario() {
    getState().manualReserveScenario = null;
    persistState();
  }

  function buildResult() {
    const troopCandidate = extractTroopCandidate();
    if (!troopCandidate?.counts) {
      throw new Error(
        "Nepodarilo sa najst tabulku s jednotkami v otvorenom spy reporte. Otvor report s jednotkami a skus bookmarklet znova."
      );
    }

    const units = troopCandidate.counts;
    const detectedBonuses = collectDetectedBonuses(troopCandidate.table);
    const scenarios = [];
    const state = getState();
    const reportAttackModifiers = extractReportAttackModifiers();
    const attackModifiers = normalizeAttackModifiers(
      state.attackModifiersOverride || reportAttackModifiers || CONFIG.defaultAttackModifiers
    );
    const defenseModifiers = normalizeDefenseModifiers(state.defenseModifiers);
    const defenseModifierBonusMap = buildDefenseModifierBonusMap(defenseModifiers);

    scenarios.push(
      calculateScenario(
        units,
        detectedBonuses,
        defenseModifierBonusMap,
        "Aktualny stav",
        attackModifiers
      )
    );

    if (CONFIG.reserveScenario.enabled) {
      scenarios.push(
        calculateScenario(
          units,
          detectedBonuses,
          mergeBonusMaps(defenseModifierBonusMap, {
            globalDefensePercent: CONFIG.reserveScenario.globalDefensePercent || 0,
            unitDefensePercent: CONFIG.reserveScenario.unitDefensePercent || {},
            entries: [{ label: CONFIG.reserveScenario.label || "Rezervny bonus" }],
          }),
          CONFIG.reserveScenario.label || "Rezervny bonus",
          attackModifiers
        )
      );
    }

    if (state.manualReserveScenario) {
      scenarios.push(
        calculateScenario(
          units,
          detectedBonuses,
          mergeBonusMaps(defenseModifierBonusMap, state.manualReserveScenario.bonusMap),
          state.manualReserveScenario.label,
          attackModifiers
        )
      );
    }

    return {
      attackModifiers,
      defenseModifiers,
      reportAttackModifiers,
      units,
      detectedBonuses,
      scenarios,
    };
  }

  function mountPanel() {
    const result = buildResult();
    const panel = renderPanel(buildPanelHtml(result));

    panel.querySelector('[data-action="close"]')?.addEventListener("click", () => {
      panel.remove();
    });

    panel.querySelector('[data-action="refresh"]')?.addEventListener("click", () => {
      mountPanel();
    });

    panel.querySelector('[data-action="apply-modifiers"]')?.addEventListener("click", () => {
      const moraleInput = panel.querySelector('[data-field="morale"]');
      const luckInput = panel.querySelector('[data-field="luck"]');
      const nightEnabledInput = panel.querySelector('[data-field="night-enabled"]');
      const nightPercentInput = panel.querySelector('[data-field="night-percent"]');
      const state = getState();

      state.attackModifiersOverride = normalizeAttackModifiers({
        moralePercent: moraleInput?.value,
        luckPercent: luckInput?.value,
      });
      state.defenseModifiers = normalizeDefenseModifiers({
        nightBonusEnabled: nightEnabledInput?.checked,
        nightBonusPercent: nightPercentInput?.value,
      });
      persistState();
      mountPanel();
    });

    panel.querySelector('[data-action="use-report-modifiers"]')?.addEventListener("click", () => {
      const state = getState();
      state.attackModifiersOverride = null;
      state.defenseModifiers = normalizeDefenseModifiers({
        nightBonusEnabled: panel.querySelector('[data-field="night-enabled"]')?.checked,
        nightBonusPercent: panel.querySelector('[data-field="night-percent"]')?.value,
      });
      persistState();
      mountPanel();
    });

    panel
      .querySelectorAll(
        '[data-field="morale"], [data-field="luck"], [data-field="night-percent"]'
      )
      .forEach((field) => {
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          panel.querySelector('[data-action="apply-modifiers"]')?.click();
        }
      });
    });

    panel.querySelector('[data-action="reserve"]')?.addEventListener("click", () => {
      if (promptReserveScenario()) {
        mountPanel();
      }
    });

    panel
      .querySelector('[data-action="reset-reserve"]')
      ?.addEventListener("click", () => {
        clearReserveScenario();
        mountPanel();
      });
  }

  try {
    mountPanel();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : String(error));
  }
})();
