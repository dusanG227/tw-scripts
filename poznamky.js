// ==UserScript==
// @name         Divoke kmene - Scanner poznamok mapy
// @namespace    https://divoke-kmene.sk/
// @version      0.2.0
// @description  Cita poznamky zo zalozky poznamok alebo zo zdielanych poznamok na dedinach mapy, doplna hraca a kmen a umoznuje filtrovanie.
// @match        *://*.divoke-kmene.sk/game.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "dk-note-scanner-state";
  const NOTE_PRESETS = {
    all: [],
    off: ["off", "full off", "opka", "offka", "off village", "utok", "nuke"],
    def: ["def", "deff", "support", "podpora"],
    custom: [],
  };

  const SELECTORS = {
    likelyListRoots: [
      "#map_notes",
      "#notes",
      ".notes",
      ".note_list",
      ".note-container",
      ".popup_box_content",
      ".content",
      "#content_value",
      "#map_config",
    ],
    detailContainers: [
      "#info_content",
      ".popup_box_content",
      ".popup_box",
      ".vis",
      ".ui-dialog",
      "#content_value",
      ".map_popup",
      ".dialog",
      ".modal",
    ],
    noteTextTargets: [
      "textarea",
      "pre",
      "[contenteditable='true']",
      ".note",
      ".notes",
      "[class*='note']",
      "[id*='note']",
      ".text",
      ".content",
    ],
  };

  const state = loadState();
  const runtime = {
    running: false,
    stopRequested: false,
    panel: null,
    detectedTargets: [],
  };

  boot();

  function boot() {
    injectPanel();
    renderResults();
  }

  function loadState() {
    const fallback = {
      results: [],
      filters: {
        source: "notes-list",
        preset: "all",
        owner: "",
        tribe: "",
        include: "",
        exclude: "",
        village: "",
      },
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      return {
        ...fallback,
        ...parsed,
        filters: {
          ...fallback.filters,
          ...(parsed.filters || {}),
        },
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
    } catch (error) {
      console.warn("[DK Notes Scanner] localStorage read failed", error);
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function injectPanel() {
    const panel = document.createElement("div");
    panel.id = "dk-note-scanner-panel";
    panel.innerHTML = `
      <div class="dkns-header">
        <strong>DK Notes Scanner</strong>
        <button type="button" data-action="toggle">_</button>
      </div>
      <div class="dkns-body">
        <label>Zdroj
          <select data-field="source">
            <option value="notes-list">Zalozka poznamok</option>
            <option value="shared-map">Zdielane poznamky z viditelnych dedin</option>
          </select>
        </label>
        <label>Preset
          <select data-field="preset">
            <option value="all">Vsetko</option>
            <option value="off">OFF</option>
            <option value="def">DEF</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>Hrac
          <input data-field="owner" type="text" list="dkns-owner-list" placeholder="napr. Sus scrofa" />
        </label>
        <label>Kmen
          <input data-field="tribe" type="text" list="dkns-tribe-list" placeholder="napr. GOOD GUYS 2.0" />
        </label>
        <label>Poznamka obsahuje
          <input data-field="include" type="text" placeholder="off, nuke, 1x noble" />
        </label>
        <label>Poznamka neobsahuje
          <input data-field="exclude" type="text" placeholder="farm, fake" />
        </label>
        <label>Nazov dediny / coords
          <input data-field="village" type="text" list="dkns-village-list" placeholder="napr. 405|495 alebo -0002-" />
        </label>
        <datalist id="dkns-owner-list"></datalist>
        <datalist id="dkns-tribe-list"></datalist>
        <datalist id="dkns-village-list"></datalist>
        <div class="dkns-actions">
          <button type="button" data-action="detect">Najdi ciel</button>
          <button type="button" data-action="scan">Spusti scan</button>
          <button type="button" data-action="stop">Stop</button>
          <button type="button" data-action="clear">Clear</button>
        </div>
        <div class="dkns-actions">
          <button type="button" data-action="filter">Filter</button>
          <button type="button" data-action="export-csv">CSV</button>
          <button type="button" data-action="copy-json">JSON</button>
        </div>
        <div class="dkns-status" data-role="status">Pripravene.</div>
        <div class="dkns-hint">Zdroj Zalozka poznamok cita tvoj list poznamok. Zdroj Zdielane poznamky z viditelnych dedin ide po dedinach na aktualnej mape a cita info dediny, takze vie zachytit aj shared notes od inych hracov.</div>
        <div class="dkns-summary" data-role="summary"></div>
        <div class="dkns-results" data-role="results"></div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #dk-note-scanner-panel {
        position: fixed;
        top: 70px;
        right: 20px;
        z-index: 999999;
        width: 380px;
        background: rgba(33, 24, 14, 0.96);
        color: #f9f0d9;
        border: 2px solid #b38b4d;
        border-radius: 8px;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        font: 13px/1.35 Verdana, sans-serif;
      }
      #dk-note-scanner-panel * { box-sizing: border-box; }
      #dk-note-scanner-panel .dkns-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        background: linear-gradient(180deg, #6a512d 0%, #4d391f 100%);
      }
      #dk-note-scanner-panel .dkns-header button {
        width: 28px;
        height: 24px;
        border: 1px solid #d6b67b;
        background: #f1e1bb;
        cursor: pointer;
      }
      #dk-note-scanner-panel .dkns-body {
        padding: 10px;
        max-height: 78vh;
        overflow: auto;
      }
      #dk-note-scanner-panel label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
      }
      #dk-note-scanner-panel input,
      #dk-note-scanner-panel select,
      #dk-note-scanner-panel button {
        width: 100%;
        margin-top: 4px;
        padding: 6px 8px;
        font: 12px Verdana, sans-serif;
      }
      #dk-note-scanner-panel input,
      #dk-note-scanner-panel select {
        border: 1px solid #a9854f;
        background: #fff9ec;
        color: #2d2214;
      }
      #dk-note-scanner-panel button {
        border: 1px solid #8f6f3d;
        background: linear-gradient(180deg, #f6e5be 0%, #e4c990 100%);
        color: #2e210f;
        cursor: pointer;
      }
      #dk-note-scanner-panel .dkns-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        margin-bottom: 8px;
      }
      #dk-note-scanner-panel .dkns-status,
      #dk-note-scanner-panel .dkns-hint,
      #dk-note-scanner-panel .dkns-summary {
        margin-bottom: 8px;
      }
      #dk-note-scanner-panel .dkns-hint {
        color: #e7cf9b;
        font-size: 11px;
      }
      #dk-note-scanner-panel .dkns-results {
        border-top: 1px solid rgba(255,255,255,0.18);
        padding-top: 8px;
      }
      #dk-note-scanner-panel .dkns-row {
        padding: 6px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #dk-note-scanner-panel .dkns-row strong {
        display: block;
        color: #ffe9bb;
      }
      #dk-note-scanner-panel .dkns-meta {
        color: #d9c7a2;
        margin-bottom: 3px;
      }
      #dk-note-scanner-panel .dkns-note {
        color: #fff8e8;
        white-space: pre-wrap;
      }
      #dk-note-scanner-panel.is-collapsed .dkns-body {
        display: none;
      }
      .dk-note-scanner-highlight {
        outline: 2px solid #17d06d !important;
        outline-offset: 1px !important;
      }
    `;

    document.documentElement.appendChild(style);
    document.body.appendChild(panel);
    runtime.panel = panel;

    panel.querySelector("[data-field='source']").value = state.filters.source;
    panel.querySelector("[data-field='preset']").value = state.filters.preset;
    panel.querySelector("[data-field='owner']").value = state.filters.owner;
    panel.querySelector("[data-field='tribe']").value = state.filters.tribe;
    panel.querySelector("[data-field='include']").value = state.filters.include;
    panel.querySelector("[data-field='exclude']").value = state.filters.exclude;
    panel.querySelector("[data-field='village']").value = state.filters.village;

    panel.addEventListener("click", onPanelClick);
    panel.addEventListener("input", onFilterInput);
    refreshAutocompleteLists();
    updateSummary();
  }

  function onPanelClick(event) {
    const action = event.target?.dataset?.action;
    if (!action) {
      return;
    }

    if (action === "toggle") {
      runtime.panel.classList.toggle("is-collapsed");
      return;
    }

    if (action === "detect") {
      if (state.filters.source === "shared-map") {
        detectVisibleVillageTargets(true);
      } else {
        detectNoteRows(true);
      }
      return;
    }

    if (action === "scan") {
      scanSelectedSource().catch((error) => {
        console.error("[DK Notes Scanner]", error);
        setStatus(`Scan zlyhal: ${error.message}`);
      });
      return;
    }

    if (action === "stop") {
      runtime.stopRequested = true;
      setStatus("Zastavenie po aktualnom kroku...");
      return;
    }

    if (action === "clear") {
      state.results = [];
      saveState();
      renderResults();
      setStatus("Vysledky vymazane.");
      return;
    }

    if (action === "filter") {
      renderResults();
      return;
    }

    if (action === "export-csv") {
      exportCsv();
      return;
    }

    if (action === "copy-json") {
      copyJson();
    }
  }

  function onFilterInput(event) {
    const field = event.target?.dataset?.field;
    if (!field) {
      return;
    }

    state.filters[field] = event.target.value;
    saveState();
    updateSummary();
  }

  function setStatus(message) {
    const target = runtime.panel?.querySelector("[data-role='status']");
    if (target) {
      target.textContent = message;
    }
  }

  function updateSummary() {
    const filtered = getFilteredResults();
    const summary = runtime.panel?.querySelector("[data-role='summary']");
    if (!summary) {
      return;
    }

    summary.innerHTML = [
      `Nascannene: <strong>${state.results.length}</strong>`,
      `Po filtri: <strong>${filtered.length}</strong>`,
    ].join(" | ");
  }

  function renderResults() {
    refreshAutocompleteLists();
    updateSummary();

    const target = runtime.panel?.querySelector("[data-role='results']");
    if (!target) {
      return;
    }

    const filtered = getFilteredResults().slice(0, 20);
    if (!filtered.length) {
      target.innerHTML = `<div class="dkns-row">Zatial nic. Spusti scan alebo uprav filter.</div>`;
      return;
    }

    target.innerHTML = filtered.map((item) => {
      const title = [item.villageName || "Bez nazvu", item.coords || "", item.continent || ""].filter(Boolean).join(" ");
      const meta = [item.owner || "?", item.tribe || "?", item.sourceType || "", item.villageId ? `id ${item.villageId}` : ""]
        .filter(Boolean)
        .join(" | ");

      return `
        <div class="dkns-row">
          <strong>${escapeHtml(title)}</strong>
          <div class="dkns-meta">${escapeHtml(meta)}</div>
          <div class="dkns-note">${escapeHtml(item.noteText || item.rowText || "(bez textu)")}</div>
        </div>
      `;
    }).join("");
  }

  function refreshAutocompleteLists() {
    if (!runtime.panel) {
      return;
    }

    fillDatalist(runtime.panel.querySelector("#dkns-owner-list"), uniqueSortedValues(state.results.map((item) => item.owner)));
    fillDatalist(runtime.panel.querySelector("#dkns-tribe-list"), uniqueSortedValues(state.results.map((item) => item.tribe)));
    fillDatalist(
      runtime.panel.querySelector("#dkns-village-list"),
      uniqueSortedValues(
        state.results.flatMap((item) => {
          return [item.villageName, item.coords, [item.villageName, item.coords].filter(Boolean).join(" ")];
        })
      )
    );
  }

  function fillDatalist(node, values) {
    if (!node) {
      return;
    }

    node.innerHTML = values
      .slice(0, 300)
      .map((value) => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
  }

  function getFilteredResults() {
    const presetTerms = NOTE_PRESETS[state.filters.preset] || [];
    const includeTerms = [...presetTerms, ...splitTerms(state.filters.include)];
    const excludeTerms = splitTerms(state.filters.exclude);
    const ownerNeedle = normalizeText(state.filters.owner);
    const tribeNeedle = normalizeText(state.filters.tribe);
    const villageNeedle = normalizeText(state.filters.village);

    return state.results.filter((item) => {
      const haystack = normalizeText([
        item.noteText,
        item.rowText,
        item.villageName,
        item.coords,
        item.owner,
        item.tribe,
      ].filter(Boolean).join(" | "));

      if (ownerNeedle && !normalizeText(item.owner).includes(ownerNeedle)) {
        return false;
      }

      if (tribeNeedle && !normalizeText(item.tribe).includes(tribeNeedle)) {
        return false;
      }

      if (villageNeedle && !haystack.includes(villageNeedle)) {
        return false;
      }

      if (includeTerms.length && !includeTerms.some((term) => haystack.includes(normalizeText(term)))) {
        return false;
      }

      if (excludeTerms.length && excludeTerms.some((term) => haystack.includes(normalizeText(term)))) {
        return false;
      }

      return true;
    });
  }

  async function scanSelectedSource() {
    if (state.filters.source === "shared-map") {
      await scanVisibleVillageNotes();
      return;
    }

    await scanNotesList();
  }

  function detectNoteRows(announce) {
    clearHighlights();

    const root = findLikelyNotesRoot();
    if (!root) {
      runtime.detectedTargets = [];
      if (announce) {
        setStatus("Nenasiel som zalozku s poznamkami. Otvor ju a skus znova.");
      }
      return [];
    }

    const rows = extractRowsFromRoot(root);
    rows.forEach((row) => row.classList.add("dk-note-scanner-highlight"));
    runtime.detectedTargets = rows;

    if (announce) {
      setStatus(`Nasiel som ${rows.length} riadkov na aktualnej strane.`);
    }

    return rows;
  }

  async function scanNotesList() {
    if (runtime.running) {
      setStatus("Scan uz bezi.");
      return;
    }

    const rows = detectNoteRows(false);
    if (!rows.length) {
      setStatus("Nenasli sa riadky poznamok. Skontroluj, ze je otvorena spravna zalozka.");
      return;
    }

    runtime.running = true;
    runtime.stopRequested = false;
    setStatus(`Spustam scan ${rows.length} riadkov...`);

    try {
      const currentVillageId = getCurrentVillageId();
      for (let index = 0; index < rows.length; index += 1) {
        if (runtime.stopRequested) {
          setStatus("Scan bol zastaveny.");
          break;
        }

        const row = rows[index];
        const rowInfo = extractRowInfo(row);
        if (!rowInfo.signature) {
          continue;
        }

        if (hasSignature(rowInfo.signature)) {
          setStatus(`Preskakujem duplicitu ${index + 1}/${rows.length}...`);
          continue;
        }

        setStatus(`Spracovavam ${index + 1}/${rows.length}: ${rowInfo.coords || rowInfo.villageName || rowInfo.villageId || "riadok"}`);

        const detail = await openRowAndExtractDetail(row);
        const merged = {
          ...rowInfo,
          ...detail,
          noteText: detail.noteText || rowInfo.rowText,
          sourceType: "notes-list",
          scannedAt: new Date().toISOString(),
          sourcePage: location.href,
        };

        if (merged.villageId && currentVillageId) {
          const info = await fetchVillageInfo(currentVillageId, merged.villageId).catch(() => null);
          if (info) {
            merged.villageName = merged.villageName || info.villageName;
            merged.coords = merged.coords || info.coords;
            merged.continent = merged.continent || info.continent;
            merged.owner = merged.owner || info.owner;
            merged.tribe = merged.tribe || info.tribe;
            if (!merged.noteText && info.noteText) {
              merged.noteText = info.noteText;
            }
          }
        }

        pushResult(merged);
        await sleep(250);
      }
    } finally {
      runtime.running = false;
      runtime.stopRequested = false;
      saveState();
      renderResults();
      setStatus(`Hotovo. Nascannene spolu ${state.results.length} zaznamov.`);
    }
  }

  function detectVisibleVillageTargets(announce) {
    clearHighlights();

    const targets = collectVisibleVillageTargets();
    targets.forEach((target) => {
      target.element?.classList?.add("dk-note-scanner-highlight");
    });
    runtime.detectedTargets = targets;

    if (announce) {
      setStatus(`Nasiel som ${targets.length} viditelnych dedin s id na aktualnej mape.`);
    }

    return targets;
  }

  async function scanVisibleVillageNotes() {
    if (runtime.running) {
      setStatus("Scan uz bezi.");
      return;
    }

    const currentVillageId = getCurrentVillageId();
    if (!currentVillageId) {
      setStatus("V URL chyba parameter village, neviem otvorit info dediny.");
      return;
    }

    const targets = detectVisibleVillageTargets(false);
    if (!targets.length) {
      setStatus("Nenasiel som viditelne dediny na mape. Skus iny zoom alebo otvor klasicku mapu.");
      return;
    }

    runtime.running = true;
    runtime.stopRequested = false;
    setStatus(`Spustam scan ${targets.length} dedin z mapy...`);

    try {
      for (let index = 0; index < targets.length; index += 1) {
        if (runtime.stopRequested) {
          setStatus("Scan bol zastaveny.");
          break;
        }

        const target = targets[index];
        setStatus(`Citam ${index + 1}/${targets.length}: ${target.coords || target.villageName || `id ${target.villageId}`}`);

        const info = await fetchVillageInfo(currentVillageId, target.villageId).catch(() => null);
        if (!info) {
          await sleep(140);
          continue;
        }

        if (!info.sharedNote && !normalizeWhitespace(info.noteText)) {
          await sleep(120);
          continue;
        }

        const noteText = info.noteText || "(shared note zachytena, ale bez textu)";
        const merged = {
          villageId: target.villageId,
          villageName: target.villageName || info.villageName || "",
          coords: target.coords || info.coords || "",
          continent: target.continent || info.continent || "",
          owner: info.owner || target.owner || "",
          tribe: info.tribe || target.tribe || "",
          noteText,
          sharedNote: Boolean(info.sharedNote),
          sourceType: "shared-map",
          signature: buildResultSignature("shared-map", target.villageId, noteText),
          scannedAt: new Date().toISOString(),
          sourcePage: location.href,
        };

        pushResult(merged);
        await sleep(180);
      }
    } finally {
      runtime.running = false;
      runtime.stopRequested = false;
      saveState();
      renderResults();
      setStatus(`Hotovo. Nascannene spolu ${state.results.length} zaznamov.`);
    }
  }

  function findLikelyNotesRoot() {
    const selectorHits = SELECTORS.likelyListRoots
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter(isVisible);

    const rootCandidates = new Set(selectorHits);
    Array.from(document.body.querySelectorAll("div, section, aside")).forEach((node) => {
      if (!isVisible(node)) {
        return;
      }

      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length < 40) {
        return;
      }

      const coordsCount = (text.match(/\b\d{3}\|\d{3}\b/g) || []).length;
      const linkCount = node.querySelectorAll("a[href*='info_village']").length;
      if (coordsCount >= 2 || linkCount >= 2) {
        rootCandidates.add(node);
      }
    });

    let winner = null;
    let winnerScore = -1;

    rootCandidates.forEach((root) => {
      const score = scoreRoot(root);
      if (score > winnerScore) {
        winner = root;
        winnerScore = score;
      }
    });

    return winner;
  }

  function scoreRoot(root) {
    if (!root || !isVisible(root)) {
      return -1;
    }

    const text = normalizeWhitespace(root.innerText);
    if (!text) {
      return -1;
    }

    const coordsCount = (text.match(/\b\d{3}\|\d{3}\b/g) || []).length;
    const linkCount = root.querySelectorAll("a[href*='info_village']").length;
    const rowCount = extractRowsFromRoot(root).length;
    return rowCount * 10 + linkCount * 6 + coordsCount * 3 + Math.min(text.length / 300, 10);
  }

  function extractRowsFromRoot(root) {
    const candidates = new Set();

    root.querySelectorAll("a[href*='info_village']").forEach((link) => {
      const row = link.closest("tr, li, .row, .entry, .item, div") || link;
      candidates.add(row);
    });

    root.querySelectorAll("tr, li, .row, .entry, .item, div").forEach((node) => {
      if (!isVisible(node)) {
        return;
      }

      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length < 3 || text.length > 600) {
        return;
      }

      if (/\b\d{3}\|\d{3}\b/.test(text) || /screen=info_village/.test(node.innerHTML)) {
        candidates.add(node);
      }
    });

    return Array.from(candidates)
      .filter(isVisible)
      .filter((node) => {
        const text = normalizeWhitespace(node.innerText);
        return text && text.length >= 3 && text.length <= 600;
      })
      .filter((node) => !Array.from(node.children).some((child) => candidates.has(child)))
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function extractRowInfo(row) {
    const link = row.querySelector("a[href*='info_village']") || row.closest("a[href*='info_village']");
    const href = link?.href || "";
    const villageId = href ? safeReadVillageId(href) : row.dataset.villageId || "";
    const rowText = normalizeWhitespace(row.innerText);
    const coords = extractCoords(rowText);
    const villageNameMatch = rowText.match(/^(.+?)\s+\d{3}\|\d{3}\b/);
    const villageName = villageNameMatch ? villageNameMatch[1].trim() : "";

    return {
      villageId,
      villageName,
      coords,
      rowText,
      signature: buildResultSignature("notes-list", villageId, [coords, rowText].join("::")),
    };
  }

  async function openRowAndExtractDetail(row) {
    const beforeText = getBestDetailText();
    safeClick(row);
    await sleep(300);
    await waitFor(() => getBestDetailText() !== beforeText, 2200).catch(() => null);

    const container = findBestDetailContainer();
    if (!container) {
      return {};
    }

    const detailRaw = container.innerText || "";
    return {
      ...parseVillageRawText(detailRaw),
      noteText: findNoteText(container, row),
    };
  }

  function getBestDetailText() {
    const container = findBestDetailContainer();
    return container ? normalizeWhitespace(container.innerText) : "";
  }

  function findBestDetailContainer() {
    const candidates = SELECTORS.detailContainers
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter(isVisible);

    let winner = null;
    let bestScore = -1;

    candidates.forEach((node) => {
      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length < 30) {
        return;
      }

      let score = 0;
      if (/Majit/i.test(text)) score += 8;
      if (/Kme/i.test(text)) score += 8;
      if (/\b\d{3}\|\d{3}\b/.test(text)) score += 5;
      if (/pozn/i.test(text)) score += 4;
      if (/moral/i.test(text)) score += 2;
      score += Math.min(text.length / 150, 6);

      if (score > bestScore) {
        winner = node;
        bestScore = score;
      }
    });

    return winner;
  }

  function findNoteText(container, row) {
    for (const selector of SELECTORS.noteTextTargets) {
      const match = Array.from(container.querySelectorAll(selector)).find((node) => {
        const value = "value" in node ? node.value : node.innerText;
        return normalizeWhitespace(value).length >= 3;
      });

      if (match) {
        const value = "value" in match ? match.value : match.innerText;
        const clean = normalizeWhitespace(value);
        if (clean.length >= 3) {
          return clean;
        }
      }
    }

    const raw = container.innerText || "";
    const stripped = stripVillageInfoNoise(raw);
    if (stripped.length >= 3) {
      return stripped;
    }

    return normalizeWhitespace(row.innerText);
  }

  function collectVisibleVillageTargets() {
    const byId = new Map();

    collectVisibleVillageTargetsFromDom().forEach((target) => {
      if (target?.villageId) {
        byId.set(String(target.villageId), target);
      }
    });

    collectVisibleVillageTargetsFromGlobals().forEach((target) => {
      if (!target?.villageId) {
        return;
      }

      const key = String(target.villageId);
      const existing = byId.get(key) || {};
      byId.set(key, {
        villageId: key,
        villageName: existing.villageName || target.villageName || "",
        coords: existing.coords || target.coords || "",
        continent: existing.continent || target.continent || "",
        owner: existing.owner || target.owner || "",
        tribe: existing.tribe || target.tribe || "",
        element: existing.element || target.element || null,
      });
    });

    return Array.from(byId.values()).sort((a, b) => (a.coords || "").localeCompare(b.coords || "", "sk"));
  }

  function collectVisibleVillageTargetsFromDom() {
    const targets = [];
    const seen = new Set();
    const selectors = [
      "a[href*='screen=info_village'][href*='id=']",
      "[data-village-id]",
      "[data-id]",
      "[onclick*='info_village']",
      "[href*='info_village']",
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!isVisible(node)) {
          return;
        }

        const villageId = extractVillageIdFromNode(node);
        if (!villageId || seen.has(villageId)) {
          return;
        }

        seen.add(villageId);
        const text = [node.innerText, node.getAttribute("title"), node.getAttribute("aria-label")].filter(Boolean).join(" ");
        targets.push({
          villageId,
          villageName: extractVillageNameFromText(text),
          coords: extractCoords(text),
          continent: extractContinent(text),
          element: node,
        });
      });
    });

    return targets;
  }

  function collectVisibleVillageTargetsFromGlobals() {
    const twMap = window.TWMap;
    if (!twMap) {
      return [];
    }

    const sources = [
      twMap.villages,
      twMap.map?.villages,
      twMap.data?.villages,
      twMap.villageCache,
    ].filter(Boolean);

    const results = [];
    const seen = new Set();

    sources.forEach((source) => {
      flattenVillageCandidates(source).forEach((candidate) => {
        const normalized = normalizeVillageCandidate(candidate);
        if (!normalized || seen.has(normalized.villageId)) {
          return;
        }

        seen.add(normalized.villageId);
        results.push(normalized);
      });
    });

    return results;
  }

  function flattenVillageCandidates(source) {
    if (!source || typeof source !== "object") {
      return [];
    }

    const out = [];
    const queue = [source];
    const visited = new Set();

    while (queue.length && out.length < 2500) {
      const current = queue.shift();
      if (!current || typeof current !== "object" || visited.has(current)) {
        continue;
      }

      visited.add(current);
      out.push(current);

      if (Array.isArray(current)) {
        current.forEach((item) => queue.push(item));
      } else {
        Object.values(current).forEach((item) => {
          if (item && typeof item === "object") {
            queue.push(item);
          }
        });
      }
    }

    return out;
  }

  function normalizeVillageCandidate(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const villageId = firstNonEmpty([candidate.id, candidate.villageId, candidate.village_id, candidate.vid]);
    if (!villageId) {
      return null;
    }

    const x = firstNonEmpty([candidate.x, candidate.posX, candidate.coord_x]);
    const y = firstNonEmpty([candidate.y, candidate.posY, candidate.coord_y]);

    return {
      villageId: String(villageId),
      villageName: firstNonEmpty([candidate.name, candidate.villageName, candidate.label]) || "",
      coords: x !== "" && y !== "" ? `${String(x).padStart(3, "0")}|${String(y).padStart(3, "0")}` : "",
      continent: extractContinent(firstNonEmpty([candidate.continent, candidate.k]) || ""),
      owner: firstNonEmpty([candidate.owner_name, candidate.ownerName, candidate.player_name]) || "",
      tribe: firstNonEmpty([candidate.ally_name, candidate.allyName, candidate.tribe_name]) || "",
      element: null,
    };
  }

  function extractVillageIdFromNode(node) {
    const direct = firstNonEmpty([
      node.dataset?.villageId,
      node.dataset?.id,
      node.getAttribute("data-village-id"),
      node.getAttribute("data-id"),
    ]);
    if (direct) {
      return String(direct);
    }

    const href = node.getAttribute("href") || "";
    if (href.includes("info_village")) {
      return safeReadVillageId(href);
    }

    const onclick = node.getAttribute("onclick") || "";
    const match = onclick.match(/id[=:'"]+(\d+)/i);
    return match ? match[1] : "";
  }

  function safeReadVillageId(href) {
    try {
      return new URL(href, location.origin).searchParams.get("id") || "";
    } catch (error) {
      return "";
    }
  }

  async function fetchVillageInfo(currentVillageId, targetVillageId) {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set("village", currentVillageId);
    url.searchParams.set("screen", "info_village");
    url.searchParams.set("id", targetVillageId);

    const response = await fetch(url.toString(), {
      credentials: "include",
      headers: {
        "x-requested-with": "XMLHttpRequest",
      },
    });

    if (!response.ok) {
      throw new Error(`info_village HTTP ${response.status}`);
    }

    const html = await response.text();
    return parseVillageHtml(html);
  }

  function parseVillageHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rawText = doc.body?.innerText || "";
    const parsed = parseVillageRawText(rawText);
    const noteText = extractNoteTextFromDocument(doc, rawText);

    return {
      ...parsed,
      noteText,
      sharedNote: hasSharedNoteIndicator(rawText) || Boolean(noteText),
    };
  }

  function parseVillageRawText(rawText) {
    const raw = String(rawText || "");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const compact = normalizeWhitespace(raw);

    const headerLine = lines.find((line) => /\b\d{3}\|\d{3}\b/.test(line)) || compact;
    const headerMatch = headerLine.match(/(.+?)\s+\((\d{3}\|\d{3})\)\s+(K\d{2})/i);

    return {
      villageName: headerMatch ? headerMatch[1].trim() : extractVillageNameFromText(headerLine),
      coords: headerMatch ? headerMatch[2] : extractCoords(headerLine),
      continent: headerMatch ? headerMatch[3].toUpperCase() : extractContinent(headerLine),
      owner: extractLabeledValue(lines, /^Majit/i),
      tribe: extractLabeledValue(lines, /^Kme/i),
    };
  }

  function extractLabeledValue(lines, labelRegex) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!labelRegex.test(line)) {
        continue;
      }

      const parts = line.split(":");
      if (parts.length > 1 && normalizeWhitespace(parts.slice(1).join(":"))) {
        return cleanupField(parts.slice(1).join(":"));
      }

      const next = lines[index + 1] || "";
      if (next) {
        return cleanupField(next);
      }
    }

    return "";
  }

  function cleanupField(value) {
    return normalizeWhitespace(
      String(value || "")
        .replace(/\(\d[\d.\s]*bodov.*?\)/i, "")
        .replace(/\|\s*\d+\s*dedin/i, "")
    );
  }

  function extractNoteTextFromDocument(doc, rawText) {
    const textareaValues = Array.from(doc.querySelectorAll("textarea"))
      .map((node) => normalizeWhitespace(node.value))
      .filter(Boolean);
    if (textareaValues.length) {
      return textareaValues.sort((a, b) => b.length - a.length)[0];
    }

    const selector = SELECTORS.noteTextTargets.join(",");
    const blockValues = Array.from(doc.querySelectorAll(selector))
      .map((node) => normalizeWhitespace("value" in node ? node.value : node.innerText))
      .filter((value) => value.length >= 3);
    if (blockValues.length) {
      return blockValues.sort((a, b) => b.length - a.length)[0];
    }

    const stripped = stripVillageInfoNoise(rawText);
    if (stripped.length >= 3) {
      return stripped;
    }

    return "";
  }

  function stripVillageInfoNoise(rawText) {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const filtered = lines.filter((line) => {
      if (/^Body:/i.test(line)) return false;
      if (/^Majit/i.test(line)) return false;
      if (/^Kme/i.test(line)) return false;
      if (/^Moral/i.test(line)) return false;
      if (/^Vlastn/i.test(line)) return false;
      if (/zdie.*pozn.*dedine/i.test(line)) return false;
      if (/konc/i.test(line) && /narok/i.test(line)) return false;
      if (/\b\d{2}:\d{2}:\d{2}\b/.test(line)) return false;
      if (/^\d+[.]?\d*$/.test(line)) return false;
      return true;
    });

    const merged = filtered.join(" | ");
    const compact = normalizeWhitespace(merged);
    if (compact.length < 3) {
      return "";
    }

    return compact;
  }

  function hasSharedNoteIndicator(text) {
    return /zdie.*pozn.*dedin/i.test(String(text || ""));
  }

  function pushResult(result) {
    if (!result.signature) {
      result.signature = buildResultSignature(result.sourceType || "generic", result.villageId, result.noteText || result.rowText || result.coords);
    }

    if (hasSignature(result.signature)) {
      return false;
    }

    state.results.push(result);
    saveState();
    renderResults();
    return true;
  }

  function hasSignature(signature) {
    return state.results.some((item) => item.signature === signature);
  }

  function buildResultSignature(sourceType, villageId, uniqueText) {
    return [sourceType || "", villageId || "", normalizeText(uniqueText || "")].join("::");
  }

  function exportCsv() {
    const rows = getFilteredResults();
    if (!rows.length) {
      setStatus("Nie je co exportovat.");
      return;
    }

    const header = ["villageId", "villageName", "coords", "continent", "owner", "tribe", "sourceType", "noteText", "sourcePage", "scannedAt"];
    const csv = [
      header.join(";"),
      ...rows.map((item) => header.map((key) => csvEscape(item[key] || "")).join(";")),
    ].join("\n");

    downloadFile(`dk-notes-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
    setStatus(`CSV export hotovy (${rows.length} riadkov).`);
  }

  async function copyJson() {
    const rows = getFilteredResults();
    if (!rows.length) {
      setStatus("Nie je co kopirovat.");
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
      setStatus(`JSON skopirovany (${rows.length} zaznamov).`);
    } catch (error) {
      console.error(error);
      setStatus("Clipboard zlyhal. Skus CSV export.");
    }
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function clearHighlights() {
    document.querySelectorAll(".dk-note-scanner-highlight").forEach((node) => {
      node.classList.remove("dk-note-scanner-highlight");
    });
  }

  function safeClick(node) {
    if (!node) {
      return;
    }

    const clickable = node.matches("a, button") ? node : node.querySelector("a, button");
    (clickable || node).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function getCurrentVillageId() {
    return new URLSearchParams(location.search).get("village") || "";
  }

  function isVisible(node) {
    if (!node || !(node instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function splitTerms(input) {
    return String(input || "")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
  }

  function uniqueSortedValues(values) {
    return Array.from(
      new Set(
        values
          .map((value) => normalizeWhitespace(value))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "sk"));
  }

  function extractCoords(text) {
    const match = String(text || "").match(/\b\d{3}\|\d{3}\b/);
    return match ? match[0] : "";
  }

  function extractContinent(text) {
    const match = String(text || "").match(/\bK\d{2}\b/i);
    return match ? match[0].toUpperCase() : "";
  }

  function extractVillageNameFromText(text) {
    const compact = normalizeWhitespace(text);
    const withoutCoords = compact.replace(/\(\d{3}\|\d{3}\)\s*K\d{2}/i, "").replace(/\b\d{3}\|\d{3}\b/i, "").trim();
    return withoutCoords.length >= 2 ? withoutCoords : "";
  }

  function normalizeText(value) {
    return normalizeWhitespace(String(value || "").toLowerCase());
  }

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function csvEscape(value) {
    return `"${String(value || "").replaceAll('"', '""')}"`;
  }

  function firstNonEmpty(values) {
    for (const value of values) {
      if (value === 0 || value === "0") {
        return value;
      }
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
    return "";
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitFor(check, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (check()) {
        return true;
      }
      await sleep(100);
    }
    throw new Error("timeout");
  }
})();
