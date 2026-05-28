// ==UserScript==
// @name         TW Shared Attacks Color Split
// @namespace    codex.tw.shared.attacks
// @version      1.0.0
// @description  Splits one shared attack badge into multiple colored attack badges.
// @author       Codex
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function twSharedAttacksColorSplit() {
  "use strict";

  const SCRIPT_FLAG = "twSharedAttackSplitReady";
  const HOST_FLAG = "twSharedAttackSplitHost";
  const STYLE_ID = "tw-shared-attack-split-style";

  const CONFIG = {
    allowedScreens: new Set(["map", "info_village", "overview_villages"]),
    minCountToSplit: 2,
    hostSearchDepth: 5,
    maxHostChildren: 6,
    maxHostImages: 2,
    maxHostTextLength: 6,
    scanDebounceMs: 120,
    iconPatterns: [
      /unit_axe/i,
      /command\/attack/i,
      /graphic\/att\.png/i
    ],
    groups: [
      {
        key: "green",
        label: "Zelena",
        background: "linear-gradient(180deg, #eff8ea 0%, #d9ebcf 100%)",
        border: "#3e7a34",
        iconColor: "#3e7a34",
        textColor: "#295120"
      },
      {
        key: "brown",
        label: "Hneda",
        background: "linear-gradient(180deg, #f5ede4 0%, #e4d2bf 100%)",
        border: "#8a5a2b",
        iconColor: "#8a5a2b",
        textColor: "#5f3c1b"
      },
      {
        key: "red",
        label: "Cervena",
        background: "linear-gradient(180deg, #faecea 0%, #efd1cc 100%)",
        border: "#b23b31",
        iconColor: "#b23b31",
        textColor: "#7a231d"
      }
    ]
  };

  if (window[SCRIPT_FLAG]) {
    return;
  }
  window[SCRIPT_FLAG] = true;

  if (!isSupportedScreen()) {
    return;
  }

  injectStyles();
  scanDocument();
  observePage();

  function isSupportedScreen() {
    if (!window.game_data) {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    const screen = params.get("screen");
    return CONFIG.allowedScreens.has(screen);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .tw-shared-attack-split {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        flex-wrap: wrap;
        vertical-align: middle;
      }

      .tw-shared-attack-split__chip {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 5px 1px 4px;
        border-radius: 999px;
        border: 1px solid var(--tw-chip-border);
        background: var(--tw-chip-background);
        color: var(--tw-chip-text);
        line-height: 1;
        font-size: 11px;
        font-weight: 700;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
      }

      .tw-shared-attack-split__icon {
        width: 14px;
        height: 14px;
        display: inline-block;
        background-color: var(--tw-icon-color);
      }

      .tw-shared-attack-split__icon--mask {
        -webkit-mask-image: var(--tw-icon-url);
        mask-image: var(--tw-icon-url);
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-size: contain;
        mask-size: contain;
      }

      .tw-shared-attack-split__icon--img {
        width: 14px;
        height: 14px;
        object-fit: contain;
        display: inline-block;
      }

      .tw-shared-attack-split__count {
        display: inline-block;
        min-width: 7px;
        text-align: center;
      }
    `;

    document.head.appendChild(style);
  }

  function observePage() {
    let timerId = 0;
    const observer = new MutationObserver(() => {
      if (timerId) {
        window.clearTimeout(timerId);
      }
      timerId = window.setTimeout(() => {
        scanDocument();
      }, CONFIG.scanDebounceMs);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function scanDocument() {
    const icons = Array.from(document.querySelectorAll("img")).filter(isAttackIcon);

    icons.forEach((icon) => {
      const badge = resolveBadge(icon);
      if (!badge) {
        return;
      }

      if (badge.host.dataset[HOST_FLAG] === String(badge.totalCount)) {
        return;
      }

      renderSplitBadge(badge);
    });
  }

  function isAttackIcon(icon) {
    if (!icon || !icon.isConnected) {
      return false;
    }

    if (icon.closest(".tw-shared-attack-split")) {
      return false;
    }

    const src = icon.currentSrc || icon.getAttribute("src") || "";
    return CONFIG.iconPatterns.some((pattern) => pattern.test(src));
  }

  function resolveBadge(icon) {
    const iconUrl = icon.currentSrc || icon.getAttribute("src") || "";

    let current = icon.parentElement;
    let depth = 0;

    while (current && depth < CONFIG.hostSearchDepth) {
      if (isCompactHost(current)) {
        const totalCount = extractCount(current);
        if (totalCount >= CONFIG.minCountToSplit) {
          return {
            host: current,
            iconUrl,
            totalCount
          };
        }
      }

      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  function isCompactHost(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    if (element.closest(".tw-shared-attack-split")) {
      return false;
    }

    if (element.querySelector("table, input, textarea, button, select")) {
      return false;
    }

    const text = compactText(element.textContent || "");
    if (!text || text.length > CONFIG.maxHostTextLength) {
      return false;
    }

    const numberMatches = text.match(/\d+/g) || [];
    if (numberMatches.length !== 1) {
      return false;
    }

    const scrubbed = text.replace(/\d+/g, "");
    if (scrubbed && !/^[x:+\-()./]*$/i.test(scrubbed)) {
      return false;
    }

    const imageCount = element.querySelectorAll("img").length;
    if (imageCount < 1 || imageCount > CONFIG.maxHostImages) {
      return false;
    }

    if (element.children.length > CONFIG.maxHostChildren) {
      return false;
    }

    const rect = safeRect(element);
    if (rect && (rect.width > 200 || rect.height > 50)) {
      return false;
    }

    return true;
  }

  function extractCount(element) {
    const text = compactText(element.textContent || "");
    const match = text.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function compactText(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .trim();
  }

  function safeRect(element) {
    try {
      return element.getBoundingClientRect();
    } catch (error) {
      return null;
    }
  }

  function splitEvenly(total, groupCount) {
    const base = Math.floor(total / groupCount);
    const remainder = total % groupCount;
    const chunks = [];

    for (let index = 0; index < groupCount; index += 1) {
      chunks.push(base + (index < remainder ? 1 : 0));
    }

    return chunks;
  }

  function renderSplitBadge(badge) {
    const counts = splitEvenly(badge.totalCount, CONFIG.groups.length);
    const wrapper = document.createElement("span");
    wrapper.className = "tw-shared-attack-split";
    wrapper.title = `Povodny pocet: ${badge.totalCount}`;

    counts.forEach((count, index) => {
      if (!count) {
        return;
      }

      const group = CONFIG.groups[index];
      const chip = document.createElement("span");
      chip.className = "tw-shared-attack-split__chip";
      chip.style.setProperty("--tw-chip-background", group.background);
      chip.style.setProperty("--tw-chip-border", group.border);
      chip.style.setProperty("--tw-chip-text", group.textColor);
      chip.style.setProperty("--tw-icon-color", group.iconColor);
      chip.title = `${group.label}: ${count}`;

      chip.appendChild(createIcon(badge.iconUrl));

      const countNode = document.createElement("span");
      countNode.className = "tw-shared-attack-split__count";
      countNode.textContent = String(count);
      chip.appendChild(countNode);

      wrapper.appendChild(chip);
    });

    badge.host.textContent = "";
    badge.host.appendChild(wrapper);
    badge.host.dataset[HOST_FLAG] = String(badge.totalCount);
  }

  function createIcon(iconUrl) {
    const supportsMask = Boolean(
      window.CSS &&
      (window.CSS.supports("mask-image", "url(\"data:image/gif;base64,R0lGODlhAQABAAAAACw=\")") ||
        window.CSS.supports("-webkit-mask-image", "url(\"data:image/gif;base64,R0lGODlhAQABAAAAACw=\")"))
    );

    if (supportsMask) {
      const icon = document.createElement("span");
      icon.className = "tw-shared-attack-split__icon tw-shared-attack-split__icon--mask";
      icon.style.setProperty("--tw-icon-url", `url("${iconUrl}")`);
      return icon;
    }

    const image = document.createElement("img");
    image.className = "tw-shared-attack-split__icon--img";
    image.src = iconUrl;
    image.alt = "";
    return image;
  }
})();
