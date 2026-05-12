(() => {
  const CONFIG = {
    safetyMarginPercent: 5,
    offTemplates: [
      {
        name: "Full OFF Axe/LC",
        units: { axe: 7000, light: 3000, ram: 300, catapult: 200 },
      },
      {
        name: "Full OFF Axe/MA",
        units: { axe: 6500, marcher: 2500, ram: 300, catapult: 200 },
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

  function formatNumber(value) {
    return Math.round(value).toLocaleString("sk-SK");
  }

  function formatDecimal(value) {
    return Number(value || 0).toLocaleString("sk-SK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getState() {
    if (!window[STATE_KEY]) {
      window[STATE_KEY] = { manualReserveScenario: null };
    }
    return window[STATE_KEY];
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

  function extractTroops() {
    let best = null;

    for (const table of collectTables()) {
      const candidate = extractTroopsFromTable(table);
      if (candidate && (!best || candidate.score > best.score)) {
        best = candidate;
      }
    }

    return best ? best.counts : null;
  }

  function collectBonusSources() {
    const sources = new Set();

    String(document.body?.innerText || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.includes("%") && line.length <= 180)
      .forEach((line) => sources.add(line));

    const bonusAttributes = ["title", "data-title", "data-tooltip-content", "aria-label"];
    for (const element of document.querySelectorAll("*")) {
      for (const attribute of bonusAttributes) {
        const value = element.getAttribute(attribute);
        if (value && value.includes("%")) {
          sources.add(value.trim());
        }
      }
    }

    return Array.from(sources);
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

  function collectDetectedBonuses() {
    const bonusMap = buildEmptyBonusMap();
    const seen = new Set();

    for (const rawSource of collectBonusSources()) {
      const source = rawSource.trim();
      const normalized = normalizeText(source);

      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);

      if (!BONUS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
        continue;
      }

      const percentMatch = source.match(/([+-]?\d{1,3})(?:[.,]\d+)?\s*%/);
      if (!percentMatch) {
        continue;
      }

      const percent = Number.parseInt(percentMatch[1], 10);
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

  function calculateTemplateAttack(template) {
    let infantryAttack = 0;
    let cavalryAttack = 0;

    for (const [unitName, count] of Object.entries(template.units || {})) {
      if (!UNIT_STATS[unitName] || !count) {
        continue;
      }

      const attackValue = UNIT_STATS[unitName].attack * count;
      if (UNIT_STATS[unitName].group === "cavalry") {
        cavalryAttack += attackValue;
      } else {
        infantryAttack += attackValue;
      }
    }

    return {
      infantryAttack,
      cavalryAttack,
      totalAttack: infantryAttack + cavalryAttack,
    };
  }

  function calculateTemplateResult(template, defense) {
    const attack = calculateTemplateAttack(template);
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
      lines.push(`Global defense: +${bonusMap.globalDefensePercent}%`);
    }

    for (const unitName of UNIT_ORDER) {
      const percent = bonusMap.unitDefensePercent[unitName] || 0;
      if (percent) {
        lines.push(`${UNIT_STATS[unitName].label}: +${percent}%`);
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

  function calculateScenario(units, detectedBonuses, extraBonusMap, label) {
    const mergedBonusMap = mergeBonusMaps(detectedBonuses, extraBonusMap);
    const defense = calculateDefense(units, mergedBonusMap);
    const templates = CONFIG.offTemplates
      .map((template) => calculateTemplateResult(template, defense))
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
      return true;
    }

    state.manualReserveScenario = {
      raw: value,
      label: "Manualna rezerva",
      bonusMap: parsed,
    };
    return true;
  }

  function clearReserveScenario() {
    getState().manualReserveScenario = null;
  }

  function buildResult() {
    const units = extractTroops();
    if (!units) {
      throw new Error(
        "Nepodarilo sa najst tabulku s jednotkami v otvorenom spy reporte. Otvor report s jednotkami a skus bookmarklet znova."
      );
    }

    const detectedBonuses = collectDetectedBonuses();
    const scenarios = [];

    scenarios.push(
      calculateScenario(units, detectedBonuses, buildEmptyBonusMap(), "Aktualny stav")
    );

    if (CONFIG.reserveScenario.enabled) {
      scenarios.push(
        calculateScenario(
          units,
          detectedBonuses,
          {
            globalDefensePercent: CONFIG.reserveScenario.globalDefensePercent || 0,
            unitDefensePercent: CONFIG.reserveScenario.unitDefensePercent || {},
            entries: [{ label: CONFIG.reserveScenario.label || "Rezervny bonus" }],
          },
          CONFIG.reserveScenario.label || "Rezervny bonus"
        )
      );
    }

    const state = getState();
    if (state.manualReserveScenario) {
      scenarios.push(
        calculateScenario(
          units,
          detectedBonuses,
          state.manualReserveScenario.bonusMap,
          state.manualReserveScenario.label
        )
      );
    }

    return {
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
