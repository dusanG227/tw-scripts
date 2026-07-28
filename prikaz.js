// ==UserScript==
// @name         DK Command Planner
// @namespace    https://github.com/dusanG227/tw-scripts
// @version      1.1.0
// @description  Vypocita cas odoslania, upozorni na rucne potvrdenie a otvara prikazy z rychleho nahladu v novej karte.
// @author       dusanG227
// @match        https://*.divokekmene.sk/game.php*
// @match        https://*.tribalwars.net/game.php*
// @updateURL    https://raw.githubusercontent.com/dusanG227/tw-scripts/refs/heads/main/tw-command-planner.user.js
// @downloadURL  https://raw.githubusercontent.com/dusanG227/tw-scripts/refs/heads/main/tw-command-planner.user.js
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const STORAGE_KEY = "dk-command-planner-settings-v1";
  const PANEL_ID = "dk-command-planner";
  const TICK_MS = 40;

  enableQuickPreviewNewTab();

  if (document.getElementById(PANEL_ID)) return;

  const sendButton = findSendButton();
  const travelMs = findTravelDurationMs();
  if (!sendButton || travelMs === null) return;

  const settings = loadSettings();
  let plan = null;
  let timerId = null;
  let notified = false;

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="dkcp-title">Plánovač príkazu</div>
    <div class="dkcp-grid">
      <label for="dkcp-arrival">Čas príchodu</label>
      <input id="dkcp-arrival" type="datetime-local" step="1">
      <label for="dkcp-ms">Milisekundy</label>
      <input id="dkcp-ms" type="number" min="0" max="999" step="1" value="${settings.milliseconds}">
      <label>Trvanie príkazu</label>
      <output id="dkcp-duration">${formatDuration(travelMs)}</output>
    </div>
    <div class="dkcp-actions">
      <button id="dkcp-plan" type="button" class="btn">Pripraviť plán</button>
      <button id="dkcp-cancel" type="button" class="btn" disabled>Zrušiť</button>
    </div>
    <div id="dkcp-status" class="dkcp-status" aria-live="polite">
      Zadaj požadovaný čas príchodu.
    </div>
    <table class="vis dkcp-table">
      <thead>
        <tr>
          <th>Čas príchodu</th>
          <th>Čas odoslania</th>
          <th>Odoslať o</th>
          <th>Stav</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td id="dkcp-arrival-view">—</td>
          <td id="dkcp-send-view">—</td>
          <td id="dkcp-countdown">—</td>
          <td id="dkcp-state">Čaká na plán</td>
        </tr>
      </tbody>
    </table>
    <p class="dkcp-note">
      Príkaz sa neodošle automaticky. Po skončení odpočtu ho musíš potvrdiť ručne.
    </p>
  `;

  addStyles();
  insertPanel(panel, sendButton);

  const arrivalInput = panel.querySelector("#dkcp-arrival");
  const msInput = panel.querySelector("#dkcp-ms");
  const planButton = panel.querySelector("#dkcp-plan");
  const cancelButton = panel.querySelector("#dkcp-cancel");
  const status = panel.querySelector("#dkcp-status");
  const arrivalView = panel.querySelector("#dkcp-arrival-view");
  const sendView = panel.querySelector("#dkcp-send-view");
  const countdown = panel.querySelector("#dkcp-countdown");
  const state = panel.querySelector("#dkcp-state");

  arrivalInput.value = toDateTimeLocalValue(new Date(Date.now() + travelMs + 5 * 60_000));

  planButton.addEventListener("click", () => {
    const milliseconds = clamp(Number.parseInt(msInput.value, 10) || 0, 0, 999);
    const arrivalAt = parseLocalDateTime(arrivalInput.value, milliseconds);

    if (!arrivalAt) {
      setStatus("Neplatný čas príchodu.", "error");
      arrivalInput.focus();
      return;
    }

    const sendAt = new Date(arrivalAt.getTime() - travelMs);
    if (sendAt.getTime() <= Date.now()) {
      setStatus("Vypočítaný čas odoslania je už v minulosti.", "error");
      return;
    }

    plan = { arrivalAt, sendAt };
    notified = false;
    saveSettings({ milliseconds });
    cancelButton.disabled = false;
    arrivalInput.disabled = true;
    msInput.disabled = true;
    planButton.disabled = true;
    arrivalView.textContent = formatDateTime(arrivalAt, true);
    sendView.textContent = formatDateTime(sendAt, true);
    state.textContent = "Pripravený";
    state.className = "dkcp-waiting";
    setStatus("Plán je pripravený. Túto kartu nechaj otvorenú.", "ok");

    clearInterval(timerId);
    timerId = window.setInterval(tick, TICK_MS);
    tick();
  });

  cancelButton.addEventListener("click", resetPlan);

  function tick() {
    if (!plan) return;

    const remaining = plan.sendAt.getTime() - Date.now();
    if (remaining > 0) {
      countdown.textContent = formatCountdown(remaining);
      if (remaining <= 10_000) {
        state.textContent = "Priprav sa";
        state.className = "dkcp-soon";
        panel.classList.add("dkcp-pulse");
      }
      return;
    }

    countdown.textContent = "TERAZ";
    state.textContent = "Ručne odošli";
    state.className = "dkcp-due";
    panel.classList.remove("dkcp-pulse");
    panel.classList.add("dkcp-ready");
    sendButton.classList.add("dkcp-send-ready");
    sendButton.scrollIntoView({ behavior: "smooth", block: "center" });
    setStatus("Čas nastal — skontroluj údaje a klikni na pôvodné tlačidlo odoslania.", "due");

    clearInterval(timerId);
    timerId = null;
    notify();
  }

  function resetPlan() {
    clearInterval(timerId);
    timerId = null;
    plan = null;
    notified = false;
    arrivalInput.disabled = false;
    msInput.disabled = false;
    planButton.disabled = false;
    cancelButton.disabled = true;
    arrivalView.textContent = "—";
    sendView.textContent = "—";
    countdown.textContent = "—";
    state.textContent = "Čaká na plán";
    state.className = "";
    panel.classList.remove("dkcp-pulse", "dkcp-ready");
    sendButton.classList.remove("dkcp-send-ready");
    setStatus("Plán bol zrušený.", "neutral");
  }

  function notify() {
    if (notified) return;
    notified = true;
    playAlert();

    if (typeof GM_notification === "function") {
      GM_notification({
        title: "Divoké kmene — čas odoslať príkaz",
        text: "Skontroluj príkaz a potvrď ho ručne.",
        timeout: 15_000,
        onclick: () => window.focus(),
      });
    } else if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Čas odoslať príkaz", {
        body: "Skontroluj príkaz a potvrď ho ručne.",
      });
    }
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function enableQuickPreviewNewTab() {
    document.addEventListener(
      "click",
      (event) => {
        if (event.defaultPrevented || event.button !== 0) return;

        const link = event.target.closest("a[href]");
        if (!link || !isQuickPreviewCommandLink(link)) return;

        link.target = "_blank";
        link.rel = "noopener noreferrer";
      },
      true,
    );
  }

  function isQuickPreviewCommandLink(link) {
    const href = link.href || "";
    const isCommandLink =
      href.includes("screen=info_command") ||
      (href.includes("screen=place") &&
        (href.includes("mode=command") || href.includes("target=") || href.includes("try=confirm")));

    if (!isCommandLink) return false;

    return Boolean(
      link.closest(
        [
          ".popup_box",
          ".popup_box_content",
          ".quickedit-content",
          ".quick-command",
          ".command-row",
          "#commands_outgoings",
          "#commands_incomings",
          "[id*='quick_preview']",
          "[class*='quick-preview']",
        ].join(","),
      ),
    );
  }

  function findSendButton() {
    const selectors = [
      "#troop_confirm_submit",
      "#command-data-form input[type='submit']",
      "#command-data-form button[type='submit']",
      "form[action*='command'] input[type='submit']",
      "form[action*='command'] button[type='submit']",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function findTravelDurationMs() {
    const candidates = [
      document.querySelector("#command-data-form"),
      document.querySelector("#content_value"),
      document.body,
    ].filter(Boolean);

    const labelPattern = /(trvanie|duration|dĺžka|dlzka)[^0-9]{0,30}(\d{1,3}):([0-5]\d):([0-5]\d)/i;
    for (const candidate of candidates) {
      const match = candidate.innerText.match(labelPattern);
      if (match) {
        return (
          Number.parseInt(match[2], 10) * 3_600_000 +
          Number.parseInt(match[3], 10) * 60_000 +
          Number.parseInt(match[4], 10) * 1_000
        );
      }
    }
    return null;
  }

  function insertPanel(element, button) {
    const form = button.closest("form");
    const anchor = form || button.parentElement;
    anchor.parentElement.insertBefore(element, anchor);
  }

  function parseLocalDateTime(value, milliseconds) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
      milliseconds,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toDateTimeLocalValue(date) {
    const parts = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0"),
    ];
    return `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:${parts[4]}:${parts[5]}`;
  }

  function formatDateTime(date, includeMs = false) {
    const base = new Intl.DateTimeFormat("sk-SK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
    return includeMs ? `${base}.${String(date.getMilliseconds()).padStart(3, "0")}` : base;
  }

  function formatDuration(durationMs) {
    const totalSeconds = Math.floor(durationMs / 1_000);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  }

  function formatCountdown(durationMs) {
    const safe = Math.max(0, durationMs);
    const hours = Math.floor(safe / 3_600_000);
    const minutes = Math.floor((safe % 3_600_000) / 60_000);
    const seconds = Math.floor((safe % 60_000) / 1_000);
    const milliseconds = Math.floor(safe % 1_000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  function playAlert() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.8);
    } catch {
      // Zvuk môže prehliadač zablokovať bez predchádzajúcej interakcie.
    }
  }

  function loadSettings() {
    try {
      return { milliseconds: 0, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { milliseconds: 0 };
    }
  }

  function saveSettings(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #${PANEL_ID} {
        box-sizing: border-box;
        max-width: 760px;
        margin: 12px 0;
        padding: 10px;
        border: 1px solid #7d510f;
        border-radius: 3px;
        color: #2f210f;
        background: linear-gradient(#f5e5b9, #e7c980);
        box-shadow: 0 1px 4px #0003;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .dkcp-title {
        margin: -10px -10px 10px;
        padding: 7px 10px;
        color: #fff4d1;
        font-weight: 700;
        background: linear-gradient(#8e611e, #68420e);
      }
      #${PANEL_ID} .dkcp-grid {
        display: grid;
        grid-template-columns: 150px minmax(190px, 300px);
        gap: 7px 10px;
        align-items: center;
      }
      #${PANEL_ID} input,
      #${PANEL_ID} output {
        min-height: 28px;
        padding: 4px 6px;
      }
      #${PANEL_ID} .dkcp-actions { margin: 10px 0; display: flex; gap: 7px; }
      #${PANEL_ID} .dkcp-status { padding: 8px; border-left: 4px solid #8c6a2d; background: #fff8df; }
      #${PANEL_ID} .dkcp-status[data-kind="error"] { border-color: #b71919; color: #8d1010; }
      #${PANEL_ID} .dkcp-status[data-kind="ok"] { border-color: #357b21; }
      #${PANEL_ID} .dkcp-status[data-kind="due"] { border-color: #d32121; font-weight: 700; }
      #${PANEL_ID} .dkcp-table { width: 100%; margin-top: 10px; }
      #${PANEL_ID} .dkcp-table th,
      #${PANEL_ID} .dkcp-table td { padding: 5px 7px; text-align: left; }
      #${PANEL_ID} .dkcp-note { margin: 8px 0 0; font-size: 11px; }
      #${PANEL_ID} .dkcp-waiting { color: #315a1f; }
      #${PANEL_ID} .dkcp-soon { color: #9a5a00; font-weight: 700; }
      #${PANEL_ID} .dkcp-due { color: #b00000; font-weight: 700; }
      #${PANEL_ID}.dkcp-ready { border: 3px solid #d71919; }
      .dkcp-send-ready {
        outline: 4px solid #e11919 !important;
        outline-offset: 3px !important;
        animation: dkcp-button-pulse 0.7s infinite alternate;
      }
      @keyframes dkcp-button-pulse {
        from { filter: brightness(1); transform: scale(1); }
        to { filter: brightness(1.25); transform: scale(1.04); }
      }
      @media (max-width: 600px) {
        #${PANEL_ID} .dkcp-grid { grid-template-columns: 1fr; gap: 3px; }
      }
    `;
    document.head.appendChild(style);
  }
})();
