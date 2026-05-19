(function twBarbSpyLauncher() {
  "use strict";

  const APP_KEY = "__TW_BARB_SPY_LAUNCHER__";
  const PANEL_ID = "tw-barb-spy-panel";
  const STYLE_ID = "tw-barb-spy-style";
  const STORAGE_KEY = `tw-barb-spy-launcher-v1:${window.location.host}`;
  const CLOSE_MESSAGE_TYPE = "tw-barb-spy-close-tab";
  const WINDOW_NAME_PREFIX = "twBarbSpyClose:";
  const DEFAULT_BATCH_SIZE = 8;
  const DEFAULT_OPEN_DELAY_MS = 120;

  if (window[APP_KEY] && typeof window[APP_KEY].reopen === "function") {
    window[APP_KEY].reopen();
    return;
  }

  const app = window[APP_KEY] = {
    openedTabs: {},
    closeListenerBound: false,
    reopen,
    destroy,
  };

  const state = {
    targetsText: "",
    batchSize: DEFAULT_BATCH_SIZE,
    openDelayMs: DEFAULT_OPEN_DELAY_MS,
    villages: [],
    targets: [],
    queue: [],
    queueIndex: 0,
    duplicateTargets: 0,
    skippedTargets: 0,
    isLaunching: false,
    message: "Pripraveny.",
  };

  if (!isCombinedOverview()) {
    window.alert("Otvor Kombinovane dediny (overview_villages&mode=combined) a spusti bookmarklet znova.");
    return;
  }

  hydrateState();
  rebuildQueue();
  bindCloseListener();
  mount();
  render();

  function reopen() {
    if (!isCombinedOverview()) {
      window.alert("Otvor Kombinovane dediny (overview_villages&mode=combined) a spusti bookmarklet znova.");
      return;
    }

    hydrateState();
    rebuildQueue();
    mount();
    render();
  }

  function destroy() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.remove();
    }
  }

  function isCombinedOverview() {
    const url = new URL(window.location.href);
    return /\/game\.php$/i.test(url.pathname) &&
      url.searchParams.get("screen") === "overview_villages" &&
      url.searchParams.get("mode") === "combined";
  }

  function hydrateState() {
    const persisted = loadState();
    state.targetsText = persisted.targetsText || "";
    state.batchSize = clampInt(persisted.batchSize, 1, 50, DEFAULT_BATCH_SIZE);
    state.openDelayMs = clampInt(persisted.openDelayMs, 0, 5000, DEFAULT_OPEN_DELAY_MS);
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("[TW-BarbSpy] Nepodarilo sa nacitat ulozene nastavenia.", error);
      return {};
    }
  }

  function persistState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        targetsText: state.targetsText,
        batchSize: state.batchSize,
        openDelayMs: state.openDelayMs,
      }));
    } catch (error) {
      console.warn("[TW-BarbSpy] Nepodarilo sa ulozit nastavenia.", error);
    }
  }

  function clampInt(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }

    if (parsed < min) {
      return min;
    }

    if (parsed > max) {
      return max;
    }

    return parsed;
  }

  function parseTargets(text) {
    const matches = String(text || "").match(/\d{3}\|\d{3}/g) || [];
    const seen = new Set();
    const result = [];
    let duplicateTargets = 0;

    for (const item of matches) {
      if (seen.has(item)) {
        duplicateTargets += 1;
        continue;
      }

      seen.add(item);
      const [x, y] = item.split("|").map((value) => parseInt(value, 10));
      result.push({ x, y, key: item });
    }

    return {
      targets: result,
      duplicateTargets,
    };
  }

  function parseVillagesFromCombined() {
    const result = [];
    const allGameUnits = Array.isArray(window.game_data && window.game_data.units)
      ? window.game_data.units.slice()
      : ["spear", "sword", "axe", "spy", "light", "heavy", "ram", "catapult"];
    const spyIndex = allGameUnits.indexOf("spy");

    if (spyIndex === -1) {
      return result;
    }

    let rows = Array.from(document.querySelectorAll("#combined_table tr.row_a, #combined_table tr.row_b"));
    if (!rows.length) {
      rows = Array.from(document.querySelectorAll("tr.row_a, tr.row_b"));
    }

    for (const row of rows) {
      const villageLink = row.querySelector('.quickedit-content a[href*="village="]') || row.querySelector('a[href*="village="]');
      const coordSource = row.querySelector(".quickedit-label") || villageLink;
      const unitCells = Array.from(row.querySelectorAll("td.unit-item"));

      if (!villageLink || !coordSource || spyIndex >= unitCells.length) {
        continue;
      }

      const idMatch = String(villageLink.href || "").match(/village=(\d+)/);
      const coordMatch = String(coordSource.textContent || "").match(/(\d{3})\|(\d{3})/);

      if (!idMatch || !coordMatch) {
        continue;
      }

      const availableSpies = parseInt(String(unitCells[spyIndex].textContent || "").replace(/\D+/g, ""), 10) || 0;
      if (availableSpies <= 0) {
        continue;
      }

      result.push({
        id: idMatch[1],
        name: String(coordSource.textContent || "").trim(),
        x: parseInt(coordMatch[1], 10),
        y: parseInt(coordMatch[2], 10),
        availableSpies,
      });
    }

    return result;
  }

  function assignTargets(villages, targets) {
    const workingVillages = villages.map((village) => ({
      ...village,
      spiesLeft: village.availableSpies,
    }));
    const queue = [];
    let skippedTargets = 0;

    for (const target of targets) {
      let bestVillage = null;
      let bestDistance = Infinity;

      for (const village of workingVillages) {
        if (village.spiesLeft <= 0) {
          continue;
        }

        const distance = getDistanceScore(village.x, village.y, target.x, target.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestVillage = village;
          continue;
        }

        if (distance === bestDistance && bestVillage && village.spiesLeft > bestVillage.spiesLeft) {
          bestVillage = village;
        }
      }

      if (!bestVillage) {
        skippedTargets += 1;
        continue;
      }

      bestVillage.spiesLeft -= 1;
      queue.push({
        villageId: bestVillage.id,
        villageName: bestVillage.name,
        villageX: bestVillage.x,
        villageY: bestVillage.y,
        targetX: target.x,
        targetY: target.y,
        targetKey: target.key,
      });
    }

    return {
      queue,
      skippedTargets,
    };
  }

  function getDistanceScore(fromX, fromY, toX, toY) {
    const dx = fromX - toX;
    const dy = fromY - toY;
    return (dx * dx) + (dy * dy);
  }

  function rebuildQueue() {
    state.villages = parseVillagesFromCombined();
    const parsedTargets = parseTargets(state.targetsText);
    state.targets = parsedTargets.targets;
    state.queueIndex = 0;
    state.duplicateTargets = parsedTargets.duplicateTargets;
    state.skippedTargets = 0;

    if (!state.villages.length) {
      state.queue = [];
      state.message = "Nenasli sa dediny s volnym spehom.";
      return;
    }

    if (!state.targets.length) {
      state.queue = [];
      state.message = "Najprv vloz zoznam barbarov.";
      return;
    }

    const assignment = assignTargets(state.villages, state.targets);
    state.queue = assignment.queue;
    state.skippedTargets = assignment.skippedTargets;
    state.message = state.queue.length
      ? `Pripravena queue pre ${state.queue.length} utokov.`
      : "Nevytvorila sa ziadna queue.";
  }

  function promptForTargets() {
    const text = window.prompt(
      "Vloz coords barbarov. Format: 500|500, jedna na riadok alebo oddelene medzerou.",
      state.targetsText || ""
    );

    if (text === null) {
      return;
    }

    state.targetsText = text;
    persistState();
    rebuildQueue();
    render();
  }

  function promptForBatchSize() {
    const text = window.prompt("Kolko tabov sa ma otvorit na 1 klik?", String(state.batchSize || DEFAULT_BATCH_SIZE));
    if (text === null) {
      return;
    }

    state.batchSize = clampInt(text, 1, 50, DEFAULT_BATCH_SIZE);
    persistState();
    render();
  }

  function promptForDelay() {
    const text = window.prompt("Delay medzi otvorenim tabov v ms:", String(state.openDelayMs || DEFAULT_OPEN_DELAY_MS));
    if (text === null) {
      return;
    }

    state.openDelayMs = clampInt(text, 0, 5000, DEFAULT_OPEN_DELAY_MS);
    persistState();
    render();
  }

  function resetTargets() {
    state.targetsText = "";
    persistState();
    rebuildQueue();
    render();
  }

  function buildAttackUrl(attack) {
    const params = new URLSearchParams();
    params.set("village", attack.villageId);
    params.set("screen", "place");
    params.set("x", String(attack.targetX));
    params.set("y", String(attack.targetY));
    params.set("spy", "1");
    return `/game.php?${params.toString()}`;
  }

  function bindCloseListener() {
    if (app.closeListenerBound) {
      return;
    }

    window.addEventListener("message", function(event) {
      const data = event && event.data;
      const closeToken = data && data.token;
      const targetWindow = closeToken ? app.openedTabs[closeToken] : null;

      if (!data || data.type !== CLOSE_MESSAGE_TYPE || !closeToken) {
        return;
      }

      if (targetWindow && !targetWindow.closed) {
        try {
          targetWindow.close();
        } catch (error) {
          console.warn("[TW-BarbSpy] Nepodarilo sa zavriet child tab.", error);
        }
      }

      delete app.openedTabs[closeToken];
    });

    app.closeListenerBound = true;
  }

  function createCloseToken(index) {
    return [
      Date.now(),
      index,
      Math.random().toString(36).slice(2, 10)
    ].join("-");
  }

  function openNextBatch() {
    if (state.isLaunching) {
      return;
    }

    const remaining = getRemainingCount();
    if (!remaining) {
      state.message = "Queue je uz otvorena cela.";
      render();
      return;
    }

    const batch = state.queue.slice(state.queueIndex, state.queueIndex + state.batchSize);
    if (!batch.length) {
      state.message = "Nie je co otvorit.";
      render();
      return;
    }

    state.isLaunching = true;
    state.queueIndex += batch.length;
    state.message = `Otvram ${batch.length} tabov...`;
    render();

    const batchEntries = batch.map((attack, index) => ({
      attack,
      closeToken: createCloseToken(index)
    }));
    const openedWindows = batchEntries.map((entry) => {
      const childWindow = window.open("about:blank", "_blank");

      if (childWindow) {
        try {
          childWindow.name = WINDOW_NAME_PREFIX + entry.closeToken;
        } catch (error) {
          console.warn("[TW-BarbSpy] Nepodarilo sa nastavit meno tabu.", error);
        }

        app.openedTabs[entry.closeToken] = childWindow;
      }

      return childWindow;
    });
    if (openedWindows.every((entry) => !entry)) {
      state.isLaunching = false;
      state.queueIndex -= batch.length;
      state.message = "Browser zablokoval popupy. Povol vyskakovacie okna pre hru.";
      render();
      return;
    }

    batch.forEach((attack, index) => {
      window.setTimeout(() => {
        const batchEntry = batchEntries[index];
        const url = buildAttackUrl(batchEntry.attack);
        const targetWindow = openedWindows[index];

        if (targetWindow) {
          try {
            targetWindow.location.href = url;
          } catch (error) {
            window.open(url, "_blank");
          }
        } else {
          window.open(url, "_blank");
        }

        if (index === batch.length - 1) {
          state.isLaunching = false;
          const afterRemaining = getRemainingCount();
          state.message = afterRemaining
            ? `Otvorenych ${batch.length}. Zostava ${afterRemaining}.`
            : "Vsetky taby boli otvorene.";
          render();
        }
      }, state.openDelayMs * index);
    });
  }

  function getRemainingCount() {
    return Math.max(0, state.queue.length - state.queueIndex);
  }

  function getTotalSpies() {
    return state.villages.reduce((sum, village) => sum + village.availableSpies, 0);
  }

  function mount() {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
    }

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${PANEL_ID} {
          position: fixed;
          right: 16px;
          bottom: 16px;
          width: min(420px, calc(100vw - 24px));
          z-index: 2147483647;
          font-family: Verdana, Tahoma, sans-serif;
          color: #2b180a;
        }

        #${PANEL_ID} .tw-barb-spy-card {
          background: #fff7ea;
          border: 2px solid #8b5d33;
          border-radius: 14px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
          overflow: hidden;
        }

        #${PANEL_ID} .tw-barb-spy-head {
          padding: 14px 16px 10px;
          background: linear-gradient(180deg, #f5dfb6 0%, #fff7ea 100%);
          border-bottom: 1px solid rgba(139, 93, 51, 0.2);
        }

        #${PANEL_ID} .tw-barb-spy-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }

        #${PANEL_ID} .tw-barb-spy-subtitle {
          margin: 6px 0 0;
          font-size: 12px;
          color: #7a5a3d;
        }

        #${PANEL_ID} .tw-barb-spy-body {
          padding: 14px 16px 16px;
        }

        #${PANEL_ID} .tw-barb-spy-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        #${PANEL_ID} .tw-barb-spy-stat {
          padding: 9px 10px;
          border-radius: 10px;
          background: #f5ead3;
          border: 1px solid rgba(139, 93, 51, 0.16);
          font-size: 12px;
        }

        #${PANEL_ID} .tw-barb-spy-stat strong {
          display: block;
          font-size: 15px;
          margin-top: 3px;
        }

        #${PANEL_ID} .tw-barb-spy-message {
          margin: 0 0 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #fff0cd;
          color: #5d432c;
          font-size: 12px;
          line-height: 1.45;
        }

        #${PANEL_ID} .tw-barb-spy-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        #${PANEL_ID} button {
          appearance: none;
          border: 1px solid #8b5d33;
          border-radius: 10px;
          background: #fff9f0;
          color: #2b180a;
          cursor: pointer;
          font-weight: 700;
          padding: 9px 12px;
          font-size: 12px;
        }

        #${PANEL_ID} button:hover {
          background: #f0debd;
        }

        #${PANEL_ID} .tw-barb-spy-primary {
          background: #4d7c35;
          border-color: #3a6128;
          color: #fffef8;
          flex: 1 1 180px;
        }

        #${PANEL_ID} .tw-barb-spy-primary:hover {
          background: #416c2d;
        }

        #${PANEL_ID} .tw-barb-spy-primary[disabled] {
          background: #95a5a6;
          border-color: #95a5a6;
          cursor: default;
        }

        #${PANEL_ID} .tw-barb-spy-secondary {
          flex: 1 1 120px;
        }

        #${PANEL_ID} .tw-barb-spy-mini {
          flex: 1 1 90px;
        }
      `;
      document.head.appendChild(style);
    }
  }

  function render() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      return;
    }

    const villagesCount = state.villages.length;
    const spiesCount = getTotalSpies();
    const targetsCount = state.targets.length;
    const queueCount = state.queue.length;
    const remaining = getRemainingCount();
    const primaryLabel = state.isLaunching
      ? "Otvram..."
      : `Otvor dalsich ${Math.min(state.batchSize, remaining || state.batchSize)}`;

    panel.innerHTML = `
      <div class="tw-barb-spy-card">
        <div class="tw-barb-spy-head">
          <h3 class="tw-barb-spy-title">Barb Spy Launcher</h3>
          <p class="tw-barb-spy-subtitle">Bookmarklet launcher pre 1 speha na barbara. Otvara taby, Tampermonkey ich odosle.</p>
        </div>
        <div class="tw-barb-spy-body">
          <div class="tw-barb-spy-grid">
            <div class="tw-barb-spy-stat">Dediny so spehom<strong>${villagesCount}</strong></div>
            <div class="tw-barb-spy-stat">Volni spehovia<strong>${spiesCount}</strong></div>
            <div class="tw-barb-spy-stat">Ciele<strong>${targetsCount}</strong></div>
            <div class="tw-barb-spy-stat">Queue / zostava<strong>${queueCount} / ${remaining}</strong></div>
          </div>
          <p class="tw-barb-spy-message">${escapeHtml(state.message)}${state.duplicateTargets ? ` Duplicitnych coordov preskocenych: ${state.duplicateTargets}.` : ""}${state.skippedTargets ? ` Bez spehov ostalo ${state.skippedTargets} cielov.` : ""}</p>
          <div class="tw-barb-spy-actions">
            <button type="button" class="tw-barb-spy-primary" id="tw-barb-open-batch" ${state.isLaunching || !remaining ? "disabled" : ""}>${primaryLabel}</button>
            <button type="button" class="tw-barb-spy-secondary" id="tw-barb-set-targets">Vlozit ciele</button>
            <button type="button" class="tw-barb-spy-mini" id="tw-barb-rebuild">Prepocitat</button>
            <button type="button" class="tw-barb-spy-mini" id="tw-barb-batch-size">Batch ${state.batchSize}</button>
            <button type="button" class="tw-barb-spy-mini" id="tw-barb-delay">Delay ${state.openDelayMs} ms</button>
            <button type="button" class="tw-barb-spy-mini" id="tw-barb-reset">Reset</button>
            <button type="button" class="tw-barb-spy-mini" id="tw-barb-close">Zavriet</button>
          </div>
        </div>
      </div>
    `;

    panel.querySelector("#tw-barb-open-batch")?.addEventListener("click", openNextBatch);
    panel.querySelector("#tw-barb-set-targets")?.addEventListener("click", promptForTargets);
    panel.querySelector("#tw-barb-rebuild")?.addEventListener("click", () => {
      rebuildQueue();
      render();
    });
    panel.querySelector("#tw-barb-batch-size")?.addEventListener("click", promptForBatchSize);
    panel.querySelector("#tw-barb-delay")?.addEventListener("click", promptForDelay);
    panel.querySelector("#tw-barb-reset")?.addEventListener("click", resetTargets);
    panel.querySelector("#tw-barb-close")?.addEventListener("click", destroy);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
