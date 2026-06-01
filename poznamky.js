// ==UserScript==
// @name         Divoke kmene - Notes Scanner
// @namespace    https://divoke-kmene.sk/
// @version      0.4.0
// @description  Jednoduchy scanner poznamok pre Divoke kmene: vsetky zdielane alebo len moje, filtre OFF/DEF/MOBILKA, kopirovanie coords.
// @match        *://*.divoke-kmene.sk/game.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const WORLD_SCOPE = `${location.host}:${window.game_data?.world || "global"}`;
  const STORAGE_KEY = `dk-simple-notes-scanner:${WORLD_SCOPE}`;
  const MAP_CACHE_KEY = `dk-simple-notes-map-cache:${WORLD_SCOPE}`;
  const LEGACY_STORAGE_KEY = "dk-simple-notes-scanner";
  const LEGACY_MAP_CACHE_KEY = "dk-simple-notes-map-cache";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  const TYPE_TERMS = {
    all: [],
    off: ["off", "offka", "opka", "nuke", "full off", "utok", "fake off"],
    def: ["def", "deff", "support", "podpora", "stack", "obrana"],
    mobilka: ["mobil", "mobilka", "mobilizacia"],
  };

  const PREVIEW_LIMIT = 30;

  const state = loadState();
  const runtime = {
    panel: null,
    running: false,
    stopRequested: false,
    lookup: {
      loaded: false,
      loading: false,
      allies: [],
      players: [],
      playersById: new Map(),
      alliesById: new Map(),
    },
    villages: {
      loaded: false,
      loading: false,
      rows: [],
    },
  };

  boot();

  function boot() {
    injectPanel();
    renderAll();
    ensureLookupData().catch((error) => {
      console.error("[DK Notes Scanner] Lookup load failed", error);
      setStatus("Nepodarilo sa nacitat kmene/hracov. Skus refresh.");
    });
  }

  function loadState() {
    const fallback = {
      results: [],
      filters: {
        source: "all",
        type: "all",
        tribe: "",
        allied: "",
        player: "",
        include: "",
      },
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      const loaded = {
        ...fallback,
        ...parsed,
        filters: {
          ...fallback.filters,
          ...(parsed.filters || {}),
        },
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
      loaded.filters.tribe = normalizeTokenList(loaded.filters.tribe);
      loaded.filters.allied = normalizeTokenList(loaded.filters.allied);
      loaded.filters.player = normalizeTokenList(loaded.filters.player);
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
      }
      return loaded;
    } catch (error) {
      console.warn("[DK Notes Scanner] State read failed", error);
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
        <strong data-action="go-map" title="Prejst na mapu">DK Notes Scanner</strong>
        <div class="dkns-header-actions">
          <button type="button" data-action="go-map">Mapa</button>
          <button type="button" data-action="toggle">_</button>
        </div>
      </div>
      <div class="dkns-body">
        <label>Zdroj
          <select data-field="source">
            <option value="all">Vsetky poznamky</option>
            <option value="mine">Len moje</option>
          </select>
        </label>
        <label>Typ poznamky
          <select data-field="type">
            <option value="all">Vsetky</option>
            <option value="off">OFF</option>
            <option value="def">DEF</option>
            <option value="mobilka">Mobilka</option>
          </select>
        </label>
        <label>Kmeny (skratky)
          <input data-field="tribe" data-suggest="tribe" type="text" placeholder="napr. GG,GGa,GGaa" />
        </label>
        <div class="dkns-suggest" data-role="tribe-suggest"></div>
        <label>Spojenci (ulozene)
          <input data-field="allied" data-suggest="tribe" type="text" placeholder="napr. ALLY1,ALLY2" />
        </label>
        <div class="dkns-suggest" data-role="allied-suggest"></div>
        <label>Hrac
          <input data-field="player" data-suggest="player" type="text" placeholder="napr. Sus scrofa" />
        </label>
        <div class="dkns-suggest" data-role="player-suggest"></div>
        <label>Poznamka obsahuje
          <input data-field="include" type="text" placeholder="napr. noble, vlak, 1x" />
        </label>
        <div class="dkns-actions">
          <button type="button" data-action="scan">Spustit scan</button>
          <button type="button" data-action="stop">Stop</button>
          <button type="button" data-action="clear">Clear</button>
        </div>
        <div class="dkns-status" data-role="status">Pripravene.</div>
        <div class="dkns-hint">Vsetky poznamky = zdielane poznamky z dedin vybraneho kmenu alebo hraca. Spojenci sa ukladaju natrvalo pre tento svet. Len moje = tvoja zalozka poznamok.</div>
        <div class="dkns-summary" data-role="summary"></div>
        <div class="dkns-copy" data-role="copy"></div>
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
        width: 390px;
        background: rgba(33, 24, 14, 0.97);
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
      #dk-note-scanner-panel .dkns-header-actions {
        display: flex;
        gap: 6px;
      }
      #dk-note-scanner-panel .dkns-header strong {
        cursor: pointer;
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
        max-height: 80vh;
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
      #dk-note-scanner-panel .dkns-actions,
      #dk-note-scanner-panel .dkns-copy-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-bottom: 8px;
      }
      #dk-note-scanner-panel .dkns-suggest {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: -2px 0 8px;
      }
      #dk-note-scanner-panel .dkns-suggest:empty {
        display: none;
      }
      #dk-note-scanner-panel .dkns-suggest button {
        width: auto;
        margin-top: 0;
        padding: 3px 7px;
        font-size: 11px;
      }
      #dk-note-scanner-panel .dkns-copy-row.two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
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
      #dk-note-scanner-panel .dkns-group {
        margin-bottom: 10px;
      }
      #dk-note-scanner-panel .dkns-group-title {
        color: #ffe9bb;
        font-weight: 700;
        margin-bottom: 4px;
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
        white-space: normal;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: flex-start;
      }
      #dk-note-scanner-panel .dkns-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 7px;
        border: 1px solid #8f6f3d;
        background: rgba(255, 248, 232, 0.08);
        color: #fff6e3;
        border-radius: 999px;
        line-height: 1.25;
      }
      #dk-note-scanner-panel .dkns-chip strong {
        display: inline;
      }
      #dk-note-scanner-panel .dkns-chip.off {
        background: rgba(153, 28, 28, 0.35);
        border-color: #d95c5c;
      }
      #dk-note-scanner-panel .dkns-chip.def {
        background: rgba(32, 56, 122, 0.35);
        border-color: #6d9cff;
      }
      #dk-note-scanner-panel .dkns-chip.beton {
        background: rgba(20, 103, 103, 0.35);
        border-color: #58d0d0;
      }
      #dk-note-scanner-panel .dkns-chip.wall {
        background: rgba(92, 54, 0, 0.35);
        border-color: #bd8a4b;
      }
      #dk-note-scanner-panel .dkns-chip.time {
        background: rgba(97, 73, 20, 0.35);
        border-color: #d8ba62;
      }
      #dk-note-scanner-panel .dkns-chip.misc {
        background: rgba(87, 87, 87, 0.28);
        border-color: #b8b8b8;
      }
      #dk-note-scanner-panel .dkns-building {
        font-size: 11px;
        letter-spacing: 0.04em;
        opacity: 0.9;
      }
      #dk-note-scanner-panel .dkns-note details {
        margin-top: 2px;
        width: 100%;
        padding: 4px 6px;
        border: 1px solid #8f6f3d;
        background: rgba(0, 0, 0, 0.14);
      }
      #dk-note-scanner-panel .dkns-note summary {
        display: inline-block;
        cursor: pointer;
        padding: 2px 6px;
        border: 1px solid #8f6f3d;
        background: linear-gradient(180deg, rgba(246, 229, 190, 0.26) 0%, rgba(228, 201, 144, 0.12) 100%);
        color: #ffe9bb;
      }
      #dk-note-scanner-panel .dkns-note .dkns-report-export {
        color: #c9b58d;
        font-style: italic;
        margin-top: 4px;
      }
      #dk-note-scanner-panel.is-collapsed .dkns-body {
        display: none;
      }
    `;

    document.documentElement.appendChild(style);
    document.body.appendChild(panel);
    runtime.panel = panel;

    panel.querySelector("[data-field='source']").value = state.filters.source;
    panel.querySelector("[data-field='type']").value = state.filters.type;
    panel.querySelector("[data-field='tribe']").value = state.filters.tribe;
    panel.querySelector("[data-field='allied']").value = state.filters.allied;
    panel.querySelector("[data-field='player']").value = state.filters.player;
    panel.querySelector("[data-field='include']").value = state.filters.include;

    panel.addEventListener("click", onPanelClick);
    panel.addEventListener("input", onPanelInput);
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

    if (action === "go-map") {
      goToMap();
      return;
    }

    if (action === "scan") {
      scanSelectedSource().catch((error) => {
        console.error("[DK Notes Scanner] Scan failed", error);
        setStatus(`Scan zlyhal: ${error.message}`);
      });
      return;
    }

    if (action === "stop") {
      runtime.stopRequested = true;
      setStatus("Zastavujem po aktualnom kroku...");
      return;
    }

    if (action === "clear") {
      state.results = [];
      saveState();
      renderAll();
      setStatus("Vysledky vymazane.");
      return;
    }

    if (action === "pick-suggestion") {
      applySuggestion(event.target.dataset.kind, event.target.dataset.value);
      return;
    }

    if (action.startsWith("copy-")) {
      const group = action.replace("copy-", "");
      copyCoords(group);
    }
  }

  function onPanelInput(event) {
    const field = event.target?.dataset?.field;
    if (!field) {
      return;
    }

    state.filters[field] = event.target.value;
    saveState();

    const suggest = event.target.dataset?.suggest;
    if (suggest) {
      const kind = field === "allied" ? "allied" : suggest;
      updateSuggestions(kind, event.target.value);
    }

    renderAll();
  }

  function setStatus(message) {
    const node = runtime.panel?.querySelector("[data-role='status']");
    if (node) {
      node.textContent = message;
    }
  }

  async function ensureLookupData() {
    if (runtime.lookup.loaded) {
      updateSuggestions("tribe", state.filters.tribe);
      updateSuggestions("allied", state.filters.allied);
      updateSuggestions("player", state.filters.player);
      return;
    }

    if (runtime.lookup.loading) {
      return;
    }

    runtime.lookup.loading = true;
    setStatus("Nacitavam kmene a hracov...");

    try {
      const cached = readMapCache();
      if (cached?.players?.length && cached?.allies?.length) {
        hydrateLookup(cached.allies, cached.players);
        setStatus("Kmene a hraci nacitani.");
        return;
      }

      const [allyText, playerText] = await Promise.all([
        fetchText("/map/ally.txt"),
        fetchText("/map/player.txt"),
      ]);

      const allies = parseAllies(allyText);
      const players = parsePlayers(playerText);
      hydrateLookup(allies, players);
      writeMapCache({ allies, players });
      setStatus("Kmene a hraci nacitani.");
    } finally {
      runtime.lookup.loading = false;
      renderAll();
    }
  }

  async function ensureVillageData() {
    if (runtime.villages.loaded) {
      return;
    }

    if (runtime.villages.loading) {
      return;
    }

    runtime.villages.loading = true;
    setStatus("Nacitavam dediny sveta...");

    try {
      await ensureLookupData();
      const villageText = await fetchText("/map/village.txt");
      runtime.villages.rows = parseVillages(villageText);
      runtime.villages.loaded = true;
      setStatus(`Dediny nacitane: ${runtime.villages.rows.length}`);
    } finally {
      runtime.villages.loading = false;
    }
  }

  function hydrateLookup(allies, players) {
    runtime.lookup.allies = allies;
    runtime.lookup.players = players;
    runtime.lookup.alliesById = new Map(allies.map((ally) => [ally.id, ally]));
    runtime.lookup.playersById = new Map(players.map((player) => [player.id, player]));
    runtime.lookup.loaded = true;
    updateSuggestions("tribe", state.filters.tribe);
    updateSuggestions("allied", state.filters.allied);
    updateSuggestions("player", state.filters.player);
  }

  function updateSuggestions(kind, query) {
    if (!runtime.panel || !runtime.lookup.loaded) {
      return;
    }

    const token = getLastToken(query);
    const lower = normalizeText(token);
    let values = [];

    if (kind === "tribe" || kind === "allied") {
      values = runtime.lookup.allies
        .map((ally) => ally.tag)
        .filter(Boolean)
        .filter((tag) => !lower || normalizeText(tag).startsWith(lower));
    }

    if (kind === "player") {
      values = runtime.lookup.players
        .map((player) => player.name)
        .filter(Boolean)
        .filter((name) => !lower || normalizeText(name).startsWith(lower));
    }

    const target = kind === "tribe"
      ? runtime.panel.querySelector("[data-role='tribe-suggest']")
      : kind === "allied"
        ? runtime.panel.querySelector("[data-role='allied-suggest']")
        : runtime.panel.querySelector("[data-role='player-suggest']");

    fillSuggestionBox(target, kind, uniqueSortedValues(values).slice(0, 10));
  }

  function fillSuggestionBox(node, kind, values) {
    if (!node) {
      return;
    }

    node.innerHTML = values
      .map((value) => `<button type="button" data-action="pick-suggestion" data-kind="${escapeHtml(kind)}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
      .join("");
  }

  function applySuggestion(kind, value) {
    const input = runtime.panel?.querySelector(`[data-field='${kind}']`);
    if (!input) {
      return;
    }

    input.value = replaceLastToken(input.value, value);
    state.filters[kind] = input.value;
    saveState();
    updateSuggestions(kind, input.value);
    renderAll();
  }

  async function scanSelectedSource() {
    if (runtime.running) {
      setStatus("Scan uz bezi.");
      return;
    }

    if (state.filters.source === "mine") {
      await scanMine();
      return;
    }

    await scanAllShared();
  }

  async function scanMine() {
    const rows = findMineRows();
    if (!rows.length) {
      setStatus("Pre Len moje otvor svoju zalozku poznamok a skus znova.");
      return;
    }

    runtime.running = true;
    runtime.stopRequested = false;
    setStatus(`Scanujem tvoje poznamky: ${rows.length} riadkov`);

    try {
      const currentVillageId = getCurrentVillageId();
      for (let index = 0; index < rows.length; index += 1) {
        if (runtime.stopRequested) {
          setStatus("Scan zastaveny.");
          break;
        }

        const row = rows[index];
        const rowInfo = extractRowInfo(row);
        if (!rowInfo.villageId) {
          continue;
        }

        const detail = await openMineRow(row);
        const info = currentVillageId
          ? await fetchVillageInfo(currentVillageId, rowInfo.villageId).catch(() => null)
          : null;

        const result = {
          villageId: rowInfo.villageId,
          coords: rowInfo.coords || info?.coords || "",
          villageName: rowInfo.villageName || info?.villageName || "",
          owner: info?.owner || "",
          tribeTag: info?.tribeTag || "",
          noteText: detail.noteText || rowInfo.rowText || info?.noteText || "",
          sourceType: "mine",
          scannedAt: new Date().toISOString(),
        };

        if (!result.noteText) {
          continue;
        }

        pushResult(result);
        setStatus(`Tvoje poznamky ${index + 1}/${rows.length}`);
        await sleep(180);
      }
    } finally {
      runtime.running = false;
      runtime.stopRequested = false;
      renderAll();
      setStatus(`Hotovo. Nalezy: ${getFilteredResults().length}`);
    }
  }

  async function scanAllShared() {
    await ensureLookupData();
    await ensureVillageData();

    const tribeQuery = state.filters.tribe.trim();
    const playerQuery = state.filters.player.trim();

    if (!tribeQuery && !playerQuery) {
      setStatus("Pri Vsetky poznamky zadaj aspon kmen alebo hraca.");
      return;
    }

    const targetInfo = resolveTargetVillages();
    const targetVillages = targetInfo.villages;
    if (!targetVillages.length) {
      if (targetInfo.preExcludedCount > 0 && targetInfo.excludedCount > 0) {
        setStatus(`Po odfiltrovani spojencov/vlastneho kmenu nezostala ani jedna dedina. Vyhodene: ${targetInfo.excludedCount}.`);
      } else {
        setStatus("Nenasiel som ziadne dediny pre zadany filter.");
      }
      return;
    }

    if (targetVillages.length > 600) {
      const ok = window.confirm(`Nasiel som ${targetVillages.length} dedin. Scan bude dlhy. Pokracovat?`);
      if (!ok) {
        setStatus("Scan zruseny.");
        return;
      }
    }

    const currentVillageId = getCurrentVillageId();
    if (!currentVillageId) {
      setStatus("Na mape chyba parameter village. Otvor hru normalne a skus znova.");
      return;
    }

    runtime.running = true;
    runtime.stopRequested = false;
    setStatus(`Scanujem ${targetVillages.length} dedin...`);

    try {
      for (let index = 0; index < targetVillages.length; index += 1) {
        if (runtime.stopRequested) {
          setStatus("Scan zastaveny.");
          break;
        }

        const village = targetVillages[index];
        const info = await fetchVillageInfo(currentVillageId, village.id).catch(() => null);
        setStatus(`Dedina ${index + 1}/${targetVillages.length}: ${village.coords}`);

        if (!info || (!info.sharedNote && !info.noteText)) {
          await sleep(140);
          continue;
        }

        const result = {
          villageId: village.id,
          coords: village.coords,
          villageName: village.name,
          owner: village.playerName || info.owner || "",
          tribeTag: village.tribeTag || info.tribeTag || "",
          noteText: info.noteText || "",
          sourceType: "all",
          scannedAt: new Date().toISOString(),
        };

        if (!result.noteText) {
          await sleep(120);
          continue;
        }

        pushResult(result);
        await sleep(140);
      }
    } finally {
      runtime.running = false;
      runtime.stopRequested = false;
      renderAll();
      setStatus(`Hotovo. Nalezy: ${getFilteredResults().length}`);
    }
  }

  function resolveTargetVillages() {
    const tribeFilter = parseListTokens(state.filters.tribe);
    const alliedFilter = parseListTokens(state.filters.allied);
    const playerFilter = parseListTokens(state.filters.player);
    const ownTribeTag = getOwnTribeTag();
    const excludedTribes = new Set(
      [...alliedFilter, ownTribeTag]
        .filter(Boolean)
        .map((value) => normalizeText(value))
    );

    let allowedPlayerIds = null;

    if (playerFilter.length) {
      const players = resolvePlayers(playerFilter);
      if (!players.length) {
        return { villages: [], preExcludedCount: 0, excludedCount: 0 };
      }
      allowedPlayerIds = new Set(players.map((player) => player.id));
    }

    if (tribeFilter.length) {
      const allies = resolveAllies(tribeFilter);
      if (!allies.length) {
        return { villages: [], preExcludedCount: 0, excludedCount: 0 };
      }

      const tribePlayerIds = new Set(
        runtime.lookup.players
          .filter((player) => allies.some((ally) => player.allyId === ally.id))
          .map((player) => player.id)
      );

      if (!allowedPlayerIds) {
        allowedPlayerIds = tribePlayerIds;
      } else {
        allowedPlayerIds = new Set([...allowedPlayerIds].filter((id) => tribePlayerIds.has(id)));
      }
    }

    if (!allowedPlayerIds || !allowedPlayerIds.size) {
      return { villages: [], preExcludedCount: 0, excludedCount: 0 };
    }

    const matched = runtime.villages.rows.filter((village) => allowedPlayerIds.has(village.playerId));
    const villages = matched.filter((village) => !excludedTribes.has(normalizeText(village.tribeTag)));

    return {
      villages,
      preExcludedCount: matched.length,
      excludedCount: matched.length - villages.length,
    };
  }

  function resolveAllies(inputs) {
    const resolved = [];
    for (const input of inputs) {
      const ally = resolveSingleAlly(input);
      if (!ally) {
        return [];
      }
      resolved.push(ally);
    }
    return uniqueById(resolved);
  }

  function resolvePlayers(inputs) {
    const resolved = [];
    for (const input of inputs) {
      const player = resolveSinglePlayer(input);
      if (!player) {
        return [];
      }
      resolved.push(player);
    }
    return uniqueById(resolved);
  }

  function resolveSingleAlly(input) {
    const exact = runtime.lookup.allies.find((ally) => normalizeText(ally.tag) === normalizeText(input));
    if (exact) {
      return exact;
    }

    const matches = runtime.lookup.allies.filter((ally) => normalizeText(ally.tag).startsWith(normalizeText(input)));
    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      setStatus(`Kmen ${input} nie je jednoznacny.`);
    } else {
      setStatus(`Kmen ${input} som nenasiel.`);
    }
    return null;
  }

  function resolveSinglePlayer(input) {
    const exact = runtime.lookup.players.find((player) => normalizeText(player.name) === normalizeText(input));
    if (exact) {
      return exact;
    }

    const matches = runtime.lookup.players.filter((player) => normalizeText(player.name).startsWith(normalizeText(input)));
    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      setStatus(`Hrac ${input} nie je jednoznacny.`);
    } else {
      setStatus(`Hraca ${input} som nenasiel.`);
    }
    return null;
  }

  function findMineRows() {
    const candidates = new Set();

    document.querySelectorAll("a[href*='screen=info_village']").forEach((link) => {
      const row = link.closest("tr, li, .row, .entry, .item, div") || link;
      const text = normalizeWhitespace(row.innerText);
      if (text && text.length <= 600) {
        candidates.add(row);
      }
    });

    return Array.from(candidates)
      .filter((node) => isVisible(node))
      .filter((node) => /\b\d{3}\|\d{3}\b/.test(node.innerText || ""))
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function extractRowInfo(row) {
    const link = row.querySelector("a[href*='screen=info_village']") || row.closest("a[href*='screen=info_village']");
    const href = link?.href || "";
    const villageId = href ? new URL(href, location.origin).searchParams.get("id") || "" : "";
    const rowText = normalizeWhitespace(row.innerText);
    const coords = extractCoords(rowText);
    const nameMatch = rowText.match(/^(.+?)\s+\d{3}\|\d{3}\b/);

    return {
      villageId,
      coords,
      villageName: nameMatch ? nameMatch[1].trim() : "",
      rowText,
    };
  }

  async function openMineRow(row) {
    const before = getBestPopupText();
    safeClick(row);
    await sleep(300);
    await waitFor(() => getBestPopupText() !== before, 2000).catch(() => null);

    const popup = findBestPopup();
    if (!popup) {
      return {};
    }

    return {
      noteText: extractPopupNoteText(popup),
    };
  }

  function getBestPopupText() {
    const popup = findBestPopup();
    return popup ? normalizeWhitespace(popup.innerText) : "";
  }

  function findBestPopup() {
    const candidates = Array.from(document.querySelectorAll("#info_content, .popup_box_content, .popup_box, .vis, .ui-dialog, #content_value"))
      .filter((node) => isVisible(node));

    let best = null;
    let bestScore = -1;

    candidates.forEach((node) => {
      const text = normalizeWhitespace(node.innerText);
      if (!text) {
        return;
      }

      let score = 0;
      if (/Majit/i.test(text)) score += 5;
      if (/Kme/i.test(text)) score += 5;
      if (/\b\d{3}\|\d{3}\b/.test(text)) score += 3;
      if (/pozn/i.test(text)) score += 3;
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    });

    return best;
  }

  function extractPopupNoteText(popup) {
    const selectors = ["textarea", "pre", ".note", ".notes", "[class*='note']", "[id*='note']", ".text", ".content"];
    for (const selector of selectors) {
      const found = Array.from(popup.querySelectorAll(selector)).find((node) => {
        const value = "value" in node ? node.value : node.innerText;
        return normalizeWhitespace(value).length >= 3;
      });
      if (found) {
        const value = "value" in found ? found.value : found.innerText;
        return normalizeWhitespace(value);
      }
    }

    return stripVillageNoise(popup.innerText || "");
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
    const root = doc.querySelector("#content_value") || doc.querySelector("#info_content") || doc.body;
    const rawText = root?.innerText || doc.body?.innerText || "";
    const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const header = lines.find((line) => /\b\d{3}\|\d{3}\b/.test(line)) || "";

    return {
      villageName: extractVillageName(header),
      coords: extractCoords(header),
      owner: extractLabelValue(lines, /^Majit/i),
      tribeTag: extractTribeTag(extractLabelValue(lines, /^Kme/i)),
      noteText: extractDocumentNoteText(root, rawText),
      sharedNote: /zdie.*pozn.*dedin/i.test(rawText),
    };
  }

  function extractDocumentNoteText(root, rawText) {
    const textarea = Array.from(root.querySelectorAll("textarea"))
      .map((node) => normalizeWhitespace(node.value))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];

    if (textarea) {
      return textarea;
    }

    const noteLike = Array.from(root.querySelectorAll(".note, .notes, [class*='note'], [id*='note'], .text, .content, pre"))
      .map((node) => normalizeWhitespace(node.innerText))
      .filter((value) => value.length >= 3)
      .sort((a, b) => b.length - a.length)[0];

    if (noteLike) {
      return noteLike;
    }

    return stripVillageNoise(rawText);
  }

  function stripVillageNoise(rawText) {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^Body:/i.test(line))
      .filter((line) => !/^Majit/i.test(line))
      .filter((line) => !/^Kme/i.test(line))
      .filter((line) => !/^Moral/i.test(line))
      .filter((line) => !/^Vlastn/i.test(line))
      .filter((line) => !/zdie.*pozn.*dedin/i.test(line))
      .filter((line) => !/narok/i.test(line))
      .filter((line) => !/Nahlady|Mapa|Spravy|Kmen|Profil|Nastavenia|Forum|Pomocnik|Hromadna sprava/i.test(line))
      .filter((line) => !/\b\d{2}:\d{2}:\d{2}\b/.test(line))
      .filter((line) => !/^\d{1,3}([.]\d{3})*$/.test(line));

    const compact = normalizeWhitespace(lines.join(" | "));
    if (compact.length > 250 && compact.includes("|")) {
      return compact
        .split("|")
        .map((part) => part.trim())
        .filter((part) => part.length >= 3 && part.length <= 80)
        .slice(0, 4)
        .join(" | ");
    }
    return compact;
  }

  function extractLabelValue(lines, regex) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!regex.test(line)) {
        continue;
      }

      const parts = line.split(":");
      const value = normalizeWhitespace(parts.slice(1).join(":"));
      if (value) {
        return cleanupLabelValue(value);
      }

      return cleanupLabelValue(lines[index + 1] || "");
    }
    return "";
  }

  function cleanupLabelValue(value) {
    return normalizeWhitespace(
      String(value || "")
        .replace(/\(\d[\d.\s]*bodov.*?\)/i, "")
        .replace(/\|\s*\d+\s*dedin/i, "")
    );
  }

  function extractTribeTag(value) {
    const match = String(value || "").match(/\(([^()]+)\)$/);
    if (match) {
      return match[1].trim();
    }

    const exact = runtime.lookup.allies.find((ally) => normalizeText(ally.name) === normalizeText(value));
    return exact ? exact.tag : value;
  }

  function matchesFilters(result) {
    if (!result.noteText) {
      return false;
    }

    const haystack = normalizeText(result.noteText);
    const includeNeedles = splitTerms(state.filters.include).map(normalizeText);
    const type = state.filters.type;

    if (type !== "all") {
      const typeTerms = TYPE_TERMS[type] || [];
      if (!typeTerms.some((term) => haystack.includes(normalizeText(term)))) {
        return false;
      }
    }

    if (includeNeedles.length && !includeNeedles.some((needle) => haystack.includes(needle))) {
      return false;
    }

    return true;
  }

  function classifyResult(result) {
    const text = normalizeText(result.noteText);

    if ((TYPE_TERMS.mobilka || []).some((term) => text.includes(normalizeText(term)))) {
      return "mobilka";
    }
    if ((TYPE_TERMS.off || []).some((term) => text.includes(normalizeText(term)))) {
      return "off";
    }
    if ((TYPE_TERMS.def || []).some((term) => text.includes(normalizeText(term)))) {
      return "def";
    }
    return "other";
  }

  function pushResult(result) {
    const signature = `${result.sourceType}::${result.villageId}::${normalizeText(result.noteText)}`;
    if (state.results.some((item) => item.signature === signature)) {
      return false;
    }

    state.results.push({
      ...result,
      signature,
      group: classifyResult(result),
    });
    saveState();
    renderAll();
    return true;
  }

  function getFilteredResults() {
    const tribeFilter = parseListTokens(state.filters.tribe);
    const alliedFilter = parseListTokens(state.filters.allied);
    const playerFilter = parseListTokens(state.filters.player);
    const excludedTribes = new Set(
      [...alliedFilter]
        .filter(Boolean)
        .map((value) => normalizeText(value))
    );

    return state.results.filter((result) => {
      if (state.filters.source !== result.sourceType && !(state.filters.source === "all" && result.sourceType === "all")) {
        if (!(state.filters.source === "mine" && result.sourceType === "mine")) {
          return false;
        }
      }

      if (tribeFilter.length && !tribeFilter.some((needle) => normalizeText(result.tribeTag).includes(normalizeText(needle)))) {
        return false;
      }

      if (excludedTribes.has(normalizeText(result.tribeTag))) {
        return false;
      }

      if (playerFilter.length && !playerFilter.some((needle) => normalizeText(result.owner).includes(normalizeText(needle)))) {
        return false;
      }

      return matchesFilters(result);
    });
  }

  function renderAll() {
    renderSummary();
    renderCopyButtons();
    renderResults();
  }

  function renderSummary() {
    const filtered = getFilteredResults();
    const counts = countGroups(filtered);
    const node = runtime.panel?.querySelector("[data-role='summary']");
    if (!node) {
      return;
    }

    node.innerHTML = [
      `Nalezy: <strong>${filtered.length}</strong>`,
      `OFF: <strong>${counts.off}</strong>`,
      `DEF: <strong>${counts.def}</strong>`,
      `Mobilka: <strong>${counts.mobilka}</strong>`,
      `Ine: <strong>${counts.other}</strong>`,
    ].join(" | ");
  }

  function renderCopyButtons() {
    const filtered = getFilteredResults();
    const node = runtime.panel?.querySelector("[data-role='copy']");
    if (!node) {
      return;
    }

    if (!filtered.length) {
      node.innerHTML = "";
      return;
    }

    node.innerHTML = `
      <div class="dkns-copy-row">
        <button type="button" data-action="copy-all">Copy vsetko</button>
        <button type="button" data-action="copy-off">Copy OFF</button>
        <button type="button" data-action="copy-def">Copy DEF</button>
      </div>
      <div class="dkns-copy-row two">
        <button type="button" data-action="copy-mobilka">Copy mobilka</button>
        <button type="button" data-action="copy-other">Copy ine</button>
      </div>
    `;
  }

  function renderResults() {
    const filtered = getFilteredResults();
    const node = runtime.panel?.querySelector("[data-role='results']");
    if (!node) {
      return;
    }

    if (!filtered.length) {
      node.innerHTML = `<div class="dkns-row">Zatial nic.</div>`;
      return;
    }

    const grouped = {
      off: filtered.filter((item) => item.group === "off"),
      def: filtered.filter((item) => item.group === "def"),
      mobilka: filtered.filter((item) => item.group === "mobilka"),
      other: filtered.filter((item) => item.group === "other"),
    };

    node.innerHTML = ["off", "def", "mobilka", "other"]
      .map((group) => renderGroup(group, grouped[group]))
      .filter(Boolean)
      .join("");
  }

  function renderGroup(group, rows) {
    if (!rows.length) {
      return "";
    }

    const label = {
      off: "OFF",
      def: "DEF",
      mobilka: "Mobilka",
      other: "Ine",
    }[group];

    const preview = rows.slice(0, PREVIEW_LIMIT).map((item) => {
      const title = [item.coords || "???", item.owner || "?"].join(" | ");
      return `
        <div class="dkns-row">
          <strong>${escapeHtml(title)}</strong>
          <div class="dkns-note">${renderNoteMarkup(item.noteText)}</div>
        </div>
      `;
    }).join("");

    const rest = rows.length > PREVIEW_LIMIT
      ? `<div class="dkns-row">... dalsich ${rows.length - PREVIEW_LIMIT}</div>`
      : "";

    return `
      <div class="dkns-group">
        <div class="dkns-group-title">${label} (${rows.length})</div>
        ${preview}
        ${rest}
      </div>
    `;
  }

  function copyCoords(group) {
    const filtered = getFilteredResults();
    const rows = group === "all"
      ? filtered
      : filtered.filter((item) => item.group === group);

    const coords = uniqueSortedValues(rows.map((item) => item.coords).filter(Boolean));
    if (!coords.length) {
      setStatus("Nie su ziadne coords na kopirovanie.");
      return;
    }

    navigator.clipboard.writeText(coords.join(" "))
      .then(() => {
        const label = group === "all" ? "vsetko" : group;
        setStatus(`Skopirovane coords: ${label} (${coords.length})`);
      })
      .catch(() => {
        setStatus("Clipboard zlyhal.");
      });
  }

  function renderNoteMarkup(noteText) {
    const normalized = String(noteText || "")
      .replace(/^\s*\|\s*/, "")
      .replace(/\s*\|\s*$/, "")
      .trim();

    const spoilers = [];
    const withoutSpoilers = normalized.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, (_match, content) => {
      const index = spoilers.push(content) - 1;
      return `%%DK_SPOILER_${index}%%`;
    });

    const parts = withoutSpoilers
      .split(/\s+\|\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.map((part) => {
      const spoilerMatch = part.match(/^%%DK_SPOILER_(\d+)%%$/);
      if (spoilerMatch) {
        const spoilerContent = spoilers[Number(spoilerMatch[1])] || "";
        return renderSpoilerMarkup(spoilerContent);
      }
      return renderNoteChip(part);
    }).join("");
  }

  function sanitizeColor(color) {
    const value = String(color || "").trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
      return value;
    }
    if (/^[a-zA-Z]+$/.test(value)) {
      return value;
    }
    return "#fff8e8";
  }

  function renderSpoilerMarkup(content) {
    const stripped = String(content || "").replace(/\[report_export\][\s\S]*?\[\/report_export\]/gi, "").trim();
    const hiddenReport = /\[report_export\][\s\S]*?\[\/report_export\]/i.test(String(content || ""));
    const body = stripped ? renderNoteChip(stripped) : "";
    const reportLine = hiddenReport ? `<div class="dkns-report-export">Report export skryty</div>` : "";
    return `<details><summary>Spoiler</summary>${body}${reportLine}</details>`;
  }

  function renderNoteChip(rawPart) {
    const buildingMatch = rawPart.match(/\[building\]([\s\S]*?)\[\/building\]/i);
    const building = buildingMatch ? buildingMatch[1].trim() : "";
    const withoutExport = rawPart.replace(/\[report_export\][\s\S]*?\[\/report_export\]/gi, "").trim();
    const contentHtml = renderInlineMarkup(withoutExport.replace(/\[building\][\s\S]*?\[\/building\]/gi, "").trim());
    const plain = stripBbCode(withoutExport);
    const kind = classifyNotePart(plain, building);
    const buildingHtml = building ? `<span class="dkns-building">${escapeHtml(formatBuildingName(building))}</span>` : "";
    const reportLine = /\[report_export\][\s\S]*?\[\/report_export\]/i.test(rawPart)
      ? `<div class="dkns-report-export">Report export skryty</div>`
      : "";
    return `<span class="dkns-chip ${kind}">${buildingHtml}${contentHtml || escapeHtml(plain)}</span>${reportLine}`;
  }

  function renderInlineMarkup(text) {
    let html = escapeHtml(String(text || ""));
    html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, `<strong>$1</strong>`);
    html = html.replace(/\[color=([#a-zA-Z0-9]+)\]([\s\S]*?)\[\/color\]/gi, (_match, color, content) => {
      const safeColor = sanitizeColor(color);
      return `<span style="color:${safeColor}">${content}</span>`;
    });
    html = html.replace(/\r?\n/g, "<br>");
    return html;
  }

  function stripBbCode(text) {
    return normalizeWhitespace(
      String(text || "")
        .replace(/\[\/?(?:b|color(?:=[^\]]+)?|building|spoiler|report_export)\]/gi, " ")
    );
  }

  function classifyNotePart(text, building) {
    const value = normalizeText(text);
    if (building) {
      return "wall";
    }
    if (value.includes("beton") || value.includes("betón")) {
      return "beton";
    }
    if (value.includes("off")) {
      return "off";
    }
    if (value.includes("def")) {
      return "def";
    }
    if (value.includes("cas boja") || value.includes("čas boja")) {
      return "time";
    }
    return "misc";
  }

  function formatBuildingName(building) {
    const value = normalizeText(building);
    if (value === "wall") {
      return "WALL";
    }
    return String(building || "").toUpperCase();
  }

  function countGroups(rows) {
    return rows.reduce((acc, row) => {
      acc[row.group] += 1;
      return acc;
    }, { off: 0, def: 0, mobilka: 0, other: 0 });
  }

  function parseAllies(text) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const cols = line.split(",");
      return {
        id: cols[0] || "",
        name: safeDecode(cols[1] || ""),
        tag: safeDecode(cols[2] || ""),
      };
    }).filter((row) => row.id && row.tag);
  }

  function parsePlayers(text) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const cols = line.split(",");
      return {
        id: cols[0] || "",
        name: safeDecode(cols[1] || ""),
        allyId: cols[2] || "",
      };
    }).filter((row) => row.id && row.name);
  }

  function parseVillages(text) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const cols = line.split(",");
      const player = runtime.lookup.playersById.get(cols[4] || "");
      const ally = player ? runtime.lookup.alliesById.get(player.allyId) : null;

      return {
        id: cols[0] || "",
        name: safeDecode(cols[1] || ""),
        coords: `${String(cols[2] || "").padStart(3, "0")}|${String(cols[3] || "").padStart(3, "0")}`,
        playerId: cols[4] || "",
        playerName: player?.name || "",
        tribeTag: ally?.tag || "",
      };
    }).filter((row) => row.id && row.playerId);
  }

  function parseListTokens(input) {
    return String(input || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function normalizeTokenList(input) {
    return parseListTokens(input).join(", ");
  }

  function getLastToken(value) {
    const parts = String(value || "").split(",");
    return (parts[parts.length - 1] || "").trim();
  }

  function replaceLastToken(original, value) {
    const parts = String(original || "").split(",");
    if (!parts.length) {
      return value;
    }
    parts[parts.length - 1] = ` ${value}`.trimStart();
    return parts.map((part) => part.trim()).filter(Boolean).join(", ");
  }

  function uniqueById(items) {
    const byId = new Map();
    items.forEach((item) => {
      if (item?.id) {
        byId.set(item.id, item);
      }
    });
    return Array.from(byId.values());
  }

  function getOwnTribeTag() {
    const ownAllyId = String(window.game_data?.player?.ally || "");
    if (!ownAllyId) {
      return "";
    }
    return runtime.lookup.alliesById.get(ownAllyId)?.tag || "";
  }

  async function fetchText(path) {
    const response = await fetch(`${location.origin}${path}`, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`${path} HTTP ${response.status}`);
    }
    return response.text();
  }

  function readMapCache() {
    try {
      const raw = localStorage.getItem(MAP_CACHE_KEY) || localStorage.getItem(LEGACY_MAP_CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
        return null;
      }

      if (!localStorage.getItem(MAP_CACHE_KEY)) {
        localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeMapCache(payload) {
    try {
      localStorage.setItem(MAP_CACHE_KEY, JSON.stringify({
        ...payload,
        savedAt: Date.now(),
      }));
    } catch (error) {
      console.warn("[DK Notes Scanner] Map cache write failed", error);
    }
  }

  function safeDecode(value) {
    const text = String(value || "");
    try {
      return decodeURIComponent(text.replace(/\+/g, "%20"));
    } catch (error) {
      return text;
    }
  }

  function extractCoords(text) {
    const match = String(text || "").match(/\b\d{3}\|\d{3}\b/);
    return match ? match[0] : "";
  }

  function extractVillageName(text) {
    const cleaned = normalizeWhitespace(String(text || ""))
      .replace(/\(\d{3}\|\d{3}\)\s*K\d{2}/i, "")
      .replace(/\b\d{3}\|\d{3}\b/i, "")
      .trim();
    return cleaned;
  }

  function splitTerms(input) {
    return String(input || "")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
  }

  function normalizeText(value) {
    return normalizeWhitespace(String(value || "").toLowerCase());
  }

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function uniqueSortedValues(values) {
    return Array.from(new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "sk"));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getCurrentVillageId() {
    return new URLSearchParams(location.search).get("village") || "";
  }

  function goToMap() {
    const url = new URL(location.origin + location.pathname);
    const villageId = getCurrentVillageId() || String(window.game_data?.village?.id || "");
    if (villageId) {
      url.searchParams.set("village", villageId);
    }
    url.searchParams.set("screen", "map");
    location.href = url.toString();
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

  function safeClick(node) {
    if (!node) {
      return;
    }
    const clickable = node.matches("a, button") ? node : node.querySelector("a, button");
    (clickable || node).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
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
