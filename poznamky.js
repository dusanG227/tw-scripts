// ==UserScript==
// @name         Divoke kmene - Scanner poznamok mapy
// @namespace    https://divoke-kmene.sk/
// @version      0.1.0
// @description  Nascanuje poznamky z mapovej zalozky, doplni majitela a kmen a umozni filtrovanie typu OFF/DEF/custom.
// @match        *://*.divoke-kmene.sk/game.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "dk-note-scanner-state";
  const NOTE_PRESETS = {
    all: [],
    off: ["off", "full off", "opka", "offka", "off village", "utok"],
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
    rowsDetected: [],
  };

  boot();

  function boot() {
    if (!/screen=map/.test(location.search)) {
      console.info("[DK Notes Scanner] Script je nacitany, ale najlepsi flow je na obrazovke mapy.");
    }

    injectPanel();
    renderResults();
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
        <label>Preset
          <select data-field="preset">
            <option value="all">Vsetko</option>
            <option value="off">OFF</option>
            <option value="def">DEF</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>Hrac
          <input data-field="owner" type="text" placeholder="napr. Sus scrofa" />
        </label>
        <label>Kmen
          <input data-field="tribe" type="text" placeholder="napr. GOOD GUYS 2.0" />
        </label>
        <label>Poznamka obsahuje
          <input data-field="include" type="text" placeholder="off, nuke, 1x noble" />
        </label>
        <label>Poznamka neobsahuje
          <input data-field="exclude" type="text" placeholder="farm, fake" />
        </label>
        <label>Nazov dediny / coords
          <input data-field="village" type="text" placeholder="napr. 405|495 alebo -0002-" />
        </label>
        <div class="dkns-actions">
          <button type="button" data-action="detect">Najdi list</button>
          <button type="button" data-action="scan">Scan page</button>
          <button type="button" data-action="stop">Stop</button>
          <button type="button" data-action="clear">Clear</button>
        </div>
        <div class="dkns-actions">
          <button type="button" data-action="filter">Filter</button>
          <button type="button" data-action="export-csv">CSV</button>
          <button type="button" data-action="copy-json">JSON</button>
        </div>
        <div class="dkns-status" data-role="status">Pripravene.</div>
        <div class="dkns-hint">Otvor mapu, potom zalozku s poznamkami a spusti scan. Ak mas viac stran, prejdi ich postupne a scan sa bude spajat.</div>
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
        width: 360px;
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

    panel.querySelector("[data-field='preset']").value = state.filters.preset;
    panel.querySelector("[data-field='owner']").value = state.filters.owner;
    panel.querySelector("[data-field='tribe']").value = state.filters.tribe;
    panel.querySelector("[data-field='include']").value = state.filters.include;
    panel.querySelector("[data-field='exclude']").value = state.filters.exclude;
    panel.querySelector("[data-field='village']").value = state.filters.village;

    panel.addEventListener("click", onPanelClick);
    panel.addEventListener("input", onFilterInput);
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
      detectRows(true);
      return;
    }

    if (action === "scan") {
      scanCurrentPage().catch((error) => {
        setStatus(`Scan zlyhal: ${error.message}`);
        console.error("[DK Notes Scanner]", error);
      });
      return;
    }

    if (action === "stop") {
      runtime.stopRequested = true;
      setStatus("Zastavenie po aktualnom kroku...");
      return;
    }

    if (action === "clear") {
      clearResults();
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

  function loadState() {
    const fallback = {
      results: [],
      filters: {
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
        filters: { ...fallback.filters, ...(parsed.filters || {}) },
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
    } catch (error) {
      console.warn("[DK Notes Scanner] Nepodarilo sa nacitat localStorage.", error);
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      `Zobrazenie po filtri: <strong>${filtered.length}</strong>`,
    ].join(" | ");
  }

  function renderResults() {
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
      const meta = [item.owner || "?", item.tribe || "?", item.villageId ? `id ${item.villageId}` : ""]
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

  function clearResults() {
    state.results = [];
    saveState();
    renderResults();
    setStatus("Vysledky vymazane.");
  }

  function detectRows(announce) {
    clearHighlights();

    const root = findLikelyNotesRoot();
    if (!root) {
      runtime.rowsDetected = [];
      if (announce) {
        setStatus("Nenasiel som zalozku s poznamkami. Otvor ju a skus znova.");
      }
      return [];
    }

    const rows = extractRowsFromRoot(root);
    rows.forEach((row) => row.classList.add("dk-note-scanner-highlight"));
    runtime.rowsDetected = rows;

    if (announce) {
      setStatus(`Nasiel som ${rows.length} riadkov na aktualnej strane.`);
    }

    return rows;
  }

  async function scanCurrentPage() {
    if (runtime.running) {
      setStatus("Scan uz bezi.");
      return;
    }

    const rows = detectRows(false);
    if (!rows.length) {
      setStatus("Nenasli sa riadky poznamok. Skontroluj, ze je otvorena spravna zalozka.");
      return;
    }

    runtime.running = true;
    runtime.stopRequested = false;
    setStatus(`Spustam scan ${rows.length} riadkov...`);

    try {
      const currentVillageId = new URLSearchParams(location.search).get("village");
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

        if (state.results.some((item) => item.signature === rowInfo.signature)) {
          setStatus(`Preskakujem duplicitu ${index + 1}/${rows.length}...`);
          continue;
        }

        setStatus(`Spracovavam ${index + 1}/${rows.length}: ${rowInfo.coords || rowInfo.villageName || rowInfo.villageId || "riadok"}`);

        const detail = await openRowAndExtractDetail(row);
        const merged = {
          ...rowInfo,
          ...detail,
          noteText: detail.noteText || rowInfo.rowText,
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
          }
        }

        state.results.push(merged);
        saveState();
        renderResults();
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
    const sizeBonus = Math.min(text.length / 300, 10);
    return rowCount * 10 + linkCount * 6 + coordsCount * 3 + sizeBonus;
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
    const villageId = href ? new URL(href, location.origin).searchParams.get("id") : row.dataset.villageId || "";
    const rowText = normalizeWhitespace(row.innerText);
    const coordsMatch = rowText.match(/\b\d{3}\|\d{3}\b/);
    const villageMatch = rowText.match(/^(.+?)\s+\d{3}\|\d{3}\b/);
    const villageName = villageMatch ? villageMatch[1].trim() : "";
    const coords = coordsMatch ? coordsMatch[0] : "";
    const signature = [villageId, coords, rowText].filter(Boolean).join("::");

    return {
      villageId,
      villageName,
      coords,
      rowText,
      signature,
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

    const detailText = normalizeWhitespace(container.innerText);
    const noteText = findNoteText(container, row);

    return {
      ...parseVillageText(detailText),
      noteText,
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

    if (!candidates.length) {
      return null;
    }

    let winner = null;
    let bestScore = -1;

    candidates.forEach((node) => {
      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length < 30) {
        return;
      }
      let score = 0;
      if (/Majite[ľl]:/i.test(text)) score += 8;
      if (/Kme[ňn]:/i.test(text)) score += 8;
      if (/\b\d{3}\|\d{3}\b/.test(text)) score += 5;
      if (/pozn[aá]m/i.test(text)) score += 4;
      if (/mor[aá]lka/i.test(text)) score += 2;
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

    const detailText = normalizeWhitespace(container.innerText);
    const extractedFromLabels = detailText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => {
        return !/^(Body|Majite[ľl]|Kme[ňn]|Mor[aá]lka|Vlastn[eé] pr[ií]kazy|[A-Za-z ]+kon[čc]i|Jeden hr[aá]?[čc] zdie[ľl]a)/i.test(line);
      })
      .filter((line) => !/\b\d{2}:\d{2}:\d{2}\b/.test(line))
      .join(" | ");

    if (extractedFromLabels.length >= 3) {
      return extractedFromLabels;
    }

    return normalizeWhitespace(row.innerText);
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
    const parsed = parseVillageHtml(html);
    return parsed;
  }

  function parseVillageHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = normalizeWhitespace(doc.body?.innerText || "");
    const parsed = parseVillageText(text);

    const textarea = doc.querySelector("textarea");
    if (textarea?.value?.trim()) {
      parsed.noteText = normalizeWhitespace(textarea.value);
    }

    return parsed;
  }

  function parseVillageText(text) {
    const compact = normalizeWhitespace(text);
    const headerMatch = compact.match(/(.+?)\s+\((\d{3}\|\d{3})\)\s+(K\d{2})/i);
    const ownerMatch = compact.match(/Majite[ľl]:\s*(.+?)(?=Kme[ňn]:|[A-Z][a-z]+:|$)/i);
    const tribeMatch = compact.match(/Kme[ňn]:\s*(.+?)(?=Š[ľl]achtick[yý]\s+n[aá]rok|Mor[aá]lka|[A-Z][a-z]+:|$)/i);

    return {
      villageName: headerMatch ? headerMatch[1].trim() : "",
      coords: headerMatch ? headerMatch[2] : extractCoords(compact),
      continent: headerMatch ? headerMatch[3] : "",
      owner: ownerMatch ? cleanupField(ownerMatch[1]) : "",
      tribe: tribeMatch ? cleanupField(tribeMatch[1]) : "",
    };
  }

  function cleanupField(value) {
    return normalizeWhitespace(
      value
        .replace(/\s+\(\d[\d.\s]*bodov.*?\)/i, "")
        .replace(/\s+\|\s+\d+\s+ded[ií]n/i, "")
    );
  }

  function exportCsv() {
    const rows = getFilteredResults();
    if (!rows.length) {
      setStatus("Nie je co exportovat.");
      return;
    }

    const header = ["villageId", "villageName", "coords", "continent", "owner", "tribe", "noteText", "sourcePage", "scannedAt"];
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

    const payload = JSON.stringify(rows, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setStatus(`JSON skopirovany (${rows.length} zaznamov).`);
    } catch (error) {
      console.error(error);
      setStatus("Clipboard zlyhal. Skus HTTPS, alebo pouzi CSV export.");
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
    const link = node.matches("a, button") ? node : node.querySelector("a, button");
    (link || node).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
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

  function extractCoords(text) {
    const match = String(text || "").match(/\b\d{3}\|\d{3}\b/);
    return match ? match[0] : "";
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
