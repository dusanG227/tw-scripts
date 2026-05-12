(() => {
  'use strict';

  const APP_KEY = '__twClaimLockScanner';
  const existing = window[APP_KEY];
  if (existing && typeof existing.destroy === 'function') {
    existing.destroy();
  }

  const state = {
    aborted: false,
    abortController: new AbortController(),
    loadingEl: null,
    selectorEl: null,
    panelEl: null,
    styleEl: null,
    results: [],
  };
  window[APP_KEY] = state;

  const CLAIM_LABEL_PATTERNS = [
    /^slachticky\s+narok\s+skonci:?$/i,
    /^slechticky\s+narok\s+skonci:?$/i,
    /^noble\s+claim\s+(end|expires?):?$/i,
  ];
  const CLAIM_FROM_LABEL_PATTERNS = [
    /^slachticky\s+narok\s+od:?$/i,
    /^slechticky\s+narok\s+od:?$/i,
    /^noble\s+claim\s+from:?$/i,
  ];
  const CLAIM_URGENCY_THRESHOLDS = {
    criticalHours: 3,
    warningHours: 8,
    soonHours: 12,
  };

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeGameText(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return '';
    }

    try {
      return decodeURIComponent(rawValue.replace(/\+/g, '%20'));
    } catch (error) {
      try {
        return decodeURIComponent(rawValue);
      } catch (nestedError) {
        return rawValue.replace(/\+/g, ' ');
      }
    }
  }

  function getOwnCellText(cell) {
    const ownText = Array.from(cell.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return ownText || cell.textContent.replace(/\s+/g, ' ').trim();
  }

  function getCurrentVillageId() {
    return window.game_data?.village?.id || new URLSearchParams(window.location.search).get('village');
  }

  function buildVillageInfoUrl(villageId) {
    const url = new URL('/game.php', window.location.origin);
    url.searchParams.set('village', getCurrentVillageId());
    url.searchParams.set('screen', 'info_village');
    url.searchParams.set('id', villageId);
    return url.toString();
  }

  function buildVillageMapUrl(coords) {
    const url = new URL('/game.php', window.location.origin);
    url.searchParams.set('village', getCurrentVillageId());
    url.searchParams.set('screen', 'map');

    const match = String(coords || '').match(/(\d{1,3})\s*[|;]\s*(\d{1,3})/);
    if (match) {
      url.hash = `${match[1]};${match[2]}`;
    } else if (window.game_data?.village?.x && window.game_data?.village?.y) {
      url.hash = `${window.game_data.village.x};${window.game_data.village.y}`;
    }

    return url.toString();
  }

  function getUrgencyLabelText() {
    return {
      critical: `do ${CLAIM_URGENCY_THRESHOLDS.criticalHours}h`,
      warning: `do ${CLAIM_URGENCY_THRESHOLDS.warningHours}h`,
      soon: `do ${CLAIM_URGENCY_THRESHOLDS.soonHours}h`,
      safe: `nad ${CLAIM_URGENCY_THRESHOLDS.soonHours}h`,
    };
  }

  function ensureStyle() {
    if (state.styleEl) {
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
      .tw-lockscan-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(20, 12, 3, 0.5);
        z-index: 2147483647;
      }

      .tw-lockscan-selector,
      .tw-lockscan-panel {
        display: flex;
        flex-direction: column;
        background: #f5e7bf;
        color: #2c1b09;
        border: 2px solid #7a541f;
        border-radius: 10px;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        font: 13px/1.4 Verdana, Arial, sans-serif;
        overflow: hidden;
      }

      .tw-lockscan-selector {
        width: 640px;
        max-width: min(640px, calc(100vw - 32px));
      }

      .tw-lockscan-panel {
        position: fixed;
        top: 16px;
        right: 16px;
        width: 680px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        z-index: 2147483646;
      }

      .tw-lockscan-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        background: linear-gradient(180deg, #b9873d 0%, #8d5f23 100%);
        color: #fff9ea;
      }

      .tw-lockscan-title {
        font-size: 15px;
        font-weight: 700;
      }

      .tw-lockscan-close {
        background: transparent;
        border: 0;
        color: inherit;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
      }

      .tw-lockscan-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        overflow: hidden;
      }

      .tw-lockscan-status,
      .tw-lockscan-summary,
      .tw-lockscan-field,
      .tw-lockscan-help,
      .tw-lockscan-error {
        padding: 8px 10px;
        background: rgba(255, 251, 236, 0.92);
        border: 1px solid #d7bd87;
        border-radius: 8px;
      }

      .tw-lockscan-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tw-lockscan-label {
        font-weight: 700;
      }

      .tw-lockscan-mode {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tw-lockscan-mode-option {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        border: 1px solid #d7bd87;
        border-radius: 6px;
        background: #fff8e4;
        cursor: pointer;
      }

      .tw-lockscan-mode-option input {
        margin: 0;
      }

      .tw-lockscan-input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #b89453;
        border-radius: 6px;
        background: #fffdf5;
        color: #2c1b09;
        font: inherit;
        box-sizing: border-box;
      }

      .tw-lockscan-input:focus {
        outline: 2px solid rgba(141, 95, 35, 0.2);
        border-color: #8d5f23;
      }

      .tw-lockscan-help {
        color: #5c4527;
      }

      .tw-lockscan-error {
        color: #7e1010;
        display: none;
      }

      .tw-lockscan-error.is-visible {
        display: block;
      }

      .tw-lockscan-suggestions {
        max-height: 260px;
        overflow: auto;
        border: 1px solid #d7bd87;
        border-radius: 8px;
        background: rgba(255, 251, 236, 0.92);
      }

      .tw-lockscan-suggestion {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        text-align: left;
        border: 0;
        border-bottom: 1px solid #eadab5;
        background: transparent;
        color: #2c1b09;
        cursor: pointer;
        font: inherit;
      }

      .tw-lockscan-suggestion:last-child {
        border-bottom: 0;
      }

      .tw-lockscan-suggestion:hover,
      .tw-lockscan-suggestion.is-active {
        background: #efd7aa;
      }

      .tw-lockscan-suggestion-main {
        font-weight: 700;
      }

      .tw-lockscan-suggestion-meta,
      .tw-lockscan-muted {
        color: #7a6749;
      }

      .tw-lockscan-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tw-lockscan-legend {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tw-lockscan-button {
        padding: 7px 10px;
        background: #8d5f23;
        color: #fff9ea;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
      }

      .tw-lockscan-button.is-secondary {
        background: #bca16b;
        color: #2c1b09;
      }

      .tw-lockscan-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .tw-lockscan-tablewrap {
        border: 1px solid #d7bd87;
        border-radius: 8px;
        background: rgba(255, 251, 236, 0.92);
        overflow: auto;
      }

      .tw-lockscan-table {
        width: 100%;
        border-collapse: collapse;
      }

      .tw-lockscan-table th,
      .tw-lockscan-table td {
        padding: 7px 8px;
        text-align: left;
        border-bottom: 1px solid #eadab5;
        vertical-align: top;
      }

      .tw-lockscan-table th {
        position: sticky;
        top: 0;
        background: #ead0a0;
        z-index: 1;
      }

      .tw-lockscan-table tr:last-child td {
        border-bottom: 0;
      }

      .tw-lockscan-row--critical td {
        background: rgba(179, 31, 31, 0.14);
      }

      .tw-lockscan-row--warning td {
        background: rgba(214, 108, 24, 0.15);
      }

      .tw-lockscan-row--soon td {
        background: rgba(226, 177, 41, 0.18);
      }

      .tw-lockscan-row--safe td {
        background: rgba(42, 133, 75, 0.14);
      }

      .tw-lockscan-badge {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 999px;
        font-weight: 700;
      }

      .tw-lockscan-badge--critical {
        background: #b31f1f;
        color: #fff6f6;
      }

      .tw-lockscan-badge--warning {
        background: #d66c18;
        color: #fff8ef;
      }

      .tw-lockscan-badge--soon {
        background: #d7a722;
        color: #3c2a06;
      }

      .tw-lockscan-badge--safe {
        background: #2a854b;
        color: #f3fff8;
      }

      .tw-lockscan-badge--unknown {
        background: #8d5f23;
        color: #fff9ea;
      }

      .tw-lockscan-link {
        color: #6a4213;
        font-weight: 700;
        text-decoration: none;
      }

      .tw-lockscan-link:hover {
        text-decoration: underline;
      }
    `;

    document.head.appendChild(style);
    state.styleEl = style;
  }

  function createLoadingOverlay(message) {
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.className = 'tw-lockscan-overlay';
    overlay.innerHTML = `
      <div class="tw-lockscan-selector">
        <div class="tw-lockscan-header">
          <div class="tw-lockscan-title">TW Claim Lock Scanner</div>
        </div>
        <div class="tw-lockscan-body">
          <div class="tw-lockscan-status">${escapeHtml(message)}</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    state.loadingEl = overlay;

    return {
      setMessage(nextMessage) {
        const statusEl = overlay.querySelector('.tw-lockscan-status');
        if (statusEl) {
          statusEl.textContent = nextMessage;
        }
      },
      remove() {
        if (state.loadingEl === overlay) {
          state.loadingEl = null;
        }
        overlay.remove();
      },
    };
  }

  function createSelectorModal(worldData) {
    ensureStyle();

    const players = [...worldData.players].sort((left, right) => left.name.localeCompare(right.name, 'sk'));
    const tribes = [...worldData.tribes].sort((left, right) =>
      formatTribeLabel(left).localeCompare(formatTribeLabel(right), 'sk')
    );

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'tw-lockscan-overlay';
      overlay.innerHTML = `
        <div class="tw-lockscan-selector">
          <div class="tw-lockscan-header">
            <div class="tw-lockscan-title">Vyber hracov alebo kmene</div>
            <button type="button" class="tw-lockscan-close" title="Zavriet">x</button>
          </div>
          <div class="tw-lockscan-body">
            <div class="tw-lockscan-field">
              <div class="tw-lockscan-label">Filter</div>
              <div class="tw-lockscan-mode">
                <label class="tw-lockscan-mode-option">
                  <input type="radio" name="tw-lockscan-mode" value="player" checked>
                  <span>Hraci</span>
                </label>
                <label class="tw-lockscan-mode-option">
                  <input type="radio" name="tw-lockscan-mode" value="tribe">
                  <span>Kmene</span>
                </label>
              </div>
            </div>
            <div class="tw-lockscan-field">
              <div class="tw-lockscan-label">Vyber</div>
              <input class="tw-lockscan-input" type="text" autocomplete="off" spellcheck="false">
              <div class="tw-lockscan-help"></div>
            </div>
            <div class="tw-lockscan-error"></div>
            <div class="tw-lockscan-suggestions"></div>
            <div class="tw-lockscan-actions">
              <button type="button" class="tw-lockscan-button" data-action="start">Spustit sken</button>
              <button type="button" class="tw-lockscan-button is-secondary" data-action="cancel">Zrusit</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      state.selectorEl = overlay;

      const closeButton = overlay.querySelector('.tw-lockscan-close');
      const cancelButton = overlay.querySelector('[data-action="cancel"]');
      const startButton = overlay.querySelector('[data-action="start"]');
      const inputEl = overlay.querySelector('.tw-lockscan-input');
      const helpEl = overlay.querySelector('.tw-lockscan-help');
      const errorEl = overlay.querySelector('.tw-lockscan-error');
      const suggestionsEl = overlay.querySelector('.tw-lockscan-suggestions');
      const radioEls = Array.from(overlay.querySelectorAll('input[name="tw-lockscan-mode"]'));

      let mode = 'player';
      let suggestions = [];
      let activeIndex = 0;

      function cleanup() {
        if (state.selectorEl === overlay) {
          state.selectorEl = null;
        }
        overlay.remove();
      }

      function close(result) {
        cleanup();
        resolve(result);
      }

      function getPlaceholder() {
        return mode === 'player'
          ? 'Pis mena hracov oddelene ciarkou, napr. Miro, Mates'
          : 'Pis tagy alebo nazvy kmenov oddelene ciarkou, napr. HELL, GOOD';
      }

      function getHelpText() {
        return mode === 'player'
          ? 'Pis zaciatok mena. Enter vyberie aktivnu moznost, ciarka ti dovoli pridat dalsie meno.'
          : 'Pis zaciatok tagu alebo nazvu kmenu. Staci aj skratka kmenu.';
      }

      function getItems() {
        return mode === 'player' ? players : tribes;
      }

      function getQueryKeys(item) {
        if (mode === 'player') {
          return [item.name];
        }
        return [item.tag, item.name].filter(Boolean);
      }

      function getSuggestionValue(item) {
        if (mode === 'player') {
          return item.name;
        }
        return String(item.tag || '').trim() || String(item.name || '').trim();
      }

      function getSuggestionMain(item) {
        return mode === 'player' ? item.name : getSuggestionValue(item);
      }

      function getSuggestionMeta(item) {
        if (mode === 'player') {
          return formatTribeLabel(worldData.tribesById.get(item.tribeId));
        }

        const tag = String(item.tag || '').trim();
        const name = String(item.name || '').trim();
        if (tag && name && normalizeText(tag) !== normalizeText(name)) {
          return name;
        }

        return `${item.members || 0} hracov`;
      }

      function splitQueries(value) {
        return String(value || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }

      function getTokenInfo() {
        const rawValue = inputEl.value;
        const lastCommaIndex = rawValue.lastIndexOf(',');
        const committedValue = lastCommaIndex === -1 ? '' : rawValue.slice(0, lastCommaIndex);
        const currentToken = lastCommaIndex === -1 ? rawValue : rawValue.slice(lastCommaIndex + 1);

        return {
          rawValue,
          committedQueries: splitQueries(committedValue),
          currentToken: currentToken.trim(),
          lastCommaIndex,
        };
      }

      function setError(message) {
        if (message) {
          errorEl.textContent = message;
          errorEl.classList.add('is-visible');
        } else {
          errorEl.textContent = '';
          errorEl.classList.remove('is-visible');
        }
      }

      function applySuggestion(item) {
        const value = getSuggestionValue(item);
        const { rawValue, lastCommaIndex } = getTokenInfo();
        const prefix = lastCommaIndex === -1 ? '' : `${rawValue.slice(0, lastCommaIndex).trim()}, `;
        inputEl.value = `${prefix}${value}, `;
        inputEl.focus();
        setError('');
        updateSuggestions();
      }

      function renderSuggestions() {
        if (!suggestions.length) {
          suggestionsEl.innerHTML = '';
          return;
        }

        suggestionsEl.innerHTML = suggestions
          .map((item, index) => {
            const activeClass = index === activeIndex ? ' is-active' : '';
            return `
              <button type="button" class="tw-lockscan-suggestion${activeClass}" data-index="${index}">
                <span class="tw-lockscan-suggestion-main">${escapeHtml(getSuggestionMain(item))}</span>
                <span class="tw-lockscan-suggestion-meta">${escapeHtml(getSuggestionMeta(item))}</span>
              </button>
            `;
          })
          .join('');

        Array.from(suggestionsEl.querySelectorAll('.tw-lockscan-suggestion')).forEach((button) => {
          button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-index'));
            const item = suggestions[index];
            if (item) {
              applySuggestion(item);
            }
          });
        });
      }

      function updateSuggestions() {
        const { committedQueries, currentToken } = getTokenInfo();
        const tokenNormalized = normalizeText(currentToken);
        const alreadySelected = new Set(committedQueries.map((item) => normalizeText(item)));

        if (!tokenNormalized) {
          suggestions = [];
          activeIndex = 0;
          renderSuggestions();
          return;
        }

        const items = getItems()
          .filter((item) => {
            const keys = getQueryKeys(item).map((key) => normalizeText(key));
            const matches = keys.some((key) => key.startsWith(tokenNormalized));
            const alreadyUsed = keys.some((key) => alreadySelected.has(key));
            return matches && !alreadyUsed;
          })
          .slice(0, 12);

        suggestions = items;
        activeIndex = 0;
        renderSuggestions();
      }

      function submitSelection() {
        const queries = splitQueries(inputEl.value);
        if (!queries.length) {
          setError('Najprv vyber aspon jedno meno alebo kmen.');
          inputEl.focus();
          return;
        }

        close({
          mode,
          queries,
          queriesNormalized: queries.map((query) => normalizeText(query)),
        });
      }

      function updateMode(nextMode) {
        mode = nextMode;
        inputEl.value = '';
        inputEl.placeholder = getPlaceholder();
        helpEl.textContent = getHelpText();
        setError('');
        suggestions = [];
        activeIndex = 0;
        renderSuggestions();
        inputEl.focus();
      }

      closeButton.addEventListener('click', () => close(null));
      cancelButton.addEventListener('click', () => close(null));
      startButton.addEventListener('click', submitSelection);

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          close(null);
        }
      });

      radioEls.forEach((radio) => {
        radio.addEventListener('change', () => {
          if (radio.checked) {
            updateMode(radio.value);
          }
        });
      });

      inputEl.addEventListener('input', () => {
        setError('');
        updateSuggestions();
      });

      inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' && suggestions.length) {
          event.preventDefault();
          activeIndex = (activeIndex + 1) % suggestions.length;
          renderSuggestions();
          return;
        }

        if (event.key === 'ArrowUp' && suggestions.length) {
          event.preventDefault();
          activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
          renderSuggestions();
          return;
        }

        if ((event.key === 'Enter' || event.key === 'Tab') && suggestions.length) {
          event.preventDefault();
          applySuggestion(suggestions[activeIndex]);
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          submitSelection();
        }
      });

      updateMode('player');
    });
  }

  function createPanel() {
    ensureStyle();
    const urgencyLabels = getUrgencyLabelText();

    const panel = document.createElement('div');
    panel.className = 'tw-lockscan-panel';
    panel.innerHTML = `
      <div class="tw-lockscan-header">
        <div class="tw-lockscan-title">TW Claim Lock Scanner</div>
        <button type="button" class="tw-lockscan-close" title="Zavriet">x</button>
      </div>
      <div class="tw-lockscan-body">
        <div class="tw-lockscan-status">Pripravujem skenovanie...</div>
        <div class="tw-lockscan-summary">Vysledky sa zobrazia po naskenovani.</div>
        <div class="tw-lockscan-actions">
          <button type="button" class="tw-lockscan-button" data-action="copy" disabled>Skopirovat vysledky</button>
        </div>
        <div class="tw-lockscan-legend">
          <span class="tw-lockscan-badge tw-lockscan-badge--critical">${escapeHtml(urgencyLabels.critical)}</span>
          <span class="tw-lockscan-badge tw-lockscan-badge--warning">${escapeHtml(urgencyLabels.warning)}</span>
          <span class="tw-lockscan-badge tw-lockscan-badge--soon">${escapeHtml(urgencyLabels.soon)}</span>
          <span class="tw-lockscan-badge tw-lockscan-badge--safe">${escapeHtml(urgencyLabels.safe)}</span>
        </div>
        <div class="tw-lockscan-tablewrap">
          <table class="tw-lockscan-table">
            <thead>
              <tr>
                <th>Dedina</th>
                <th>Hrac</th>
                <th>Kmen</th>
                <th>Koniec zamku</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4" class="tw-lockscan-muted">Zatial bez vysledkov.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const statusEl = panel.querySelector('.tw-lockscan-status');
    const summaryEl = panel.querySelector('.tw-lockscan-summary');
    const tbodyEl = panel.querySelector('tbody');
    const copyButton = panel.querySelector('[data-action="copy"]');
    const closeButton = panel.querySelector('.tw-lockscan-close');

    closeButton.addEventListener('click', () => state.destroy());
    copyButton.addEventListener('click', async () => {
      if (!state.results.length) {
        return;
      }

      const lines = [
        'Dedina\tHrac\tKmen\tKoniec zamku',
        ...state.results.map(
          (result) =>
            `${result.name} (${result.coords})\t${result.playerName}\t${result.tribeLabel}\t${result.rawEndText}${result.claimedBy ? ` | ${result.claimedBy}` : ''}`
        ),
      ];

      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        setStatus('Vysledky su v schranke.');
      } catch (error) {
        setStatus(`Schranka zlyhala: ${error.message}`);
      }
    });

    document.body.appendChild(panel);
    state.panelEl = panel;

    function setStatus(message) {
      statusEl.textContent = message;
    }

    function setSummary(message) {
      summaryEl.textContent = message;
    }

    function setRows(results, errorCount) {
      state.results = sortResults(results);
      copyButton.disabled = state.results.length === 0;

      if (!state.results.length) {
        tbodyEl.innerHTML = `
          <tr>
            <td colspan="4" class="tw-lockscan-muted">Nenasiel som ziadny aktivny zamok.</td>
          </tr>
        `;
        return;
      }

      tbodyEl.innerHTML = state.results
        .map((result) => {
          const mapUrl = buildVillageMapUrl(result.coords);
          const endDate = getResultEndDate(result);
          const urgency = getClaimUrgency(endDate);
          const remainingText = formatRemainingTime(endDate);
          return `
            <tr class="tw-lockscan-row--${urgency.tier}">
              <td>
                <a class="tw-lockscan-link" href="${mapUrl}" target="_self">${escapeHtml(result.name || result.coords)}</a>
                <div class="tw-lockscan-muted">${escapeHtml(result.coords)}</div>
              </td>
              <td>${escapeHtml(result.playerName || '-')}</td>
              <td>${escapeHtml(result.tribeLabel || '-')}</td>
              <td>
                <div class="tw-lockscan-badge tw-lockscan-badge--${urgency.tier}">${escapeHtml(result.rawEndText)}</div>
                ${remainingText ? `<div class="tw-lockscan-muted">${escapeHtml(remainingText)}</div>` : ''}
                ${result.claimedBy ? `<div class="tw-lockscan-muted">${escapeHtml(result.claimedBy)}</div>` : ''}
              </td>
            </tr>
          `;
        })
        .join('');

      const extra = errorCount ? ` Chyby pri skene: ${errorCount}.` : '';
      setSummary(`Nasiel som ${state.results.length} aktivnych zamkov.${extra}`);
    }

    return {
      setStatus,
      setSummary,
      setRows,
    };
  }

  function sortResults(results) {
    return [...results].sort((left, right) => {
      const leftTime = getResultSortTime(left);
      const rightTime = getResultSortTime(right);
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.coords.localeCompare(right.coords, 'sk');
    });
  }

  function getResultEndDate(result) {
    if (result?.endsAt instanceof Date && Number.isFinite(result.endsAt.getTime())) {
      return result.endsAt;
    }

    return parseClaimEnd(result?.rawEndText);
  }

  function getResultSortTime(result) {
    const endDate = getResultEndDate(result);
    const timestamp = endDate?.getTime?.();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }

    return Number.POSITIVE_INFINITY;
  }

  function getClaimUrgency(endsAt) {
    const timestamp = endsAt?.getTime?.();
    if (!Number.isFinite(timestamp)) {
      return {
        tier: 'unknown',
        hoursRemaining: null,
      };
    }

    const hoursRemaining = (timestamp - Date.now()) / (60 * 60 * 1000);
    if (hoursRemaining <= CLAIM_URGENCY_THRESHOLDS.criticalHours) {
      return { tier: 'critical', hoursRemaining };
    }

    if (hoursRemaining <= CLAIM_URGENCY_THRESHOLDS.warningHours) {
      return { tier: 'warning', hoursRemaining };
    }

    if (hoursRemaining <= CLAIM_URGENCY_THRESHOLDS.soonHours) {
      return { tier: 'soon', hoursRemaining };
    }

    return { tier: 'safe', hoursRemaining };
  }

  function formatRemainingTime(endsAt) {
    const timestamp = endsAt?.getTime?.();
    if (!Number.isFinite(timestamp)) {
      return '';
    }

    const remainingMs = Math.max(0, timestamp - Date.now());
    const totalMinutes = Math.round(remainingMs / (60 * 1000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `Za ${days}d ${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `Za ${hours}h ${minutes}m`;
    }

    return `Za ${minutes}m`;
  }

  function destroy() {
    if (state.aborted) {
      return;
    }

    state.aborted = true;
    state.abortController.abort();
    state.loadingEl?.remove();
    state.selectorEl?.remove();
    state.panelEl?.remove();
    state.styleEl?.remove();
    delete window[APP_KEY];
  }

  state.destroy = destroy;

  async function fetchWorldDataFile(fileName) {
    const response = await fetch(`${window.location.origin}/map/${fileName}`, {
      credentials: 'same-origin',
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Nepodarilo sa nacitat ${fileName} (${response.status}).`);
    }

    return response.text();
  }

  function parseVillageMap(text) {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [id, name, x, y, playerId, points] = line.split(',');
        return {
          id: Number(id),
          name: decodeGameText(name),
          x: Number(x),
          y: Number(y),
          playerId: Number(playerId),
          points: Number(points),
          coords: `${Number(x)}|${Number(y)}`,
        };
      });
  }

  function parsePlayerMap(text) {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [id, name, tribeId, villages, points, rank] = line.split(',');
        return {
          id: Number(id),
          name: decodeGameText(name),
          tribeId: Number(tribeId) || 0,
          villages: Number(villages) || 0,
          points: Number(points) || 0,
          rank: Number(rank) || 0,
        };
      });
  }

  function parseTribeMap(text) {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [id, name, tag, members, villages, points, allPoints, rank] = line.split(',');
        return {
          id: Number(id),
          name: decodeGameText(name),
          tag: decodeGameText(tag),
          members: Number(members) || 0,
          villages: Number(villages) || 0,
          points: Number(points) || 0,
          allPoints: Number(allPoints) || 0,
          rank: Number(rank) || 0,
        };
      });
  }

  function formatTribeLabel(tribe) {
    if (!tribe) {
      return '-';
    }

    const tag = String(tribe.tag || '').trim();
    const name = String(tribe.name || '').trim();

    if (tag && name && normalizeText(tag) !== normalizeText(name)) {
      return `${tag} - ${name}`;
    }

    return tag || name || '-';
  }

  async function loadWorldData() {
    const [villagesText, playersText, tribesText] = await Promise.all([
      fetchWorldDataFile('village.txt'),
      fetchWorldDataFile('player.txt'),
      fetchWorldDataFile('ally.txt'),
    ]);

    const villages = parseVillageMap(villagesText);
    const players = parsePlayerMap(playersText);
    const tribes = parseTribeMap(tribesText);

    return {
      villages,
      players,
      tribes,
      playersById: new Map(players.map((player) => [player.id, player])),
      tribesById: new Map(tribes.map((tribe) => [tribe.id, tribe])),
    };
  }

  function findPlayerMatches(players, queryNormalized) {
    const exact = players.filter((player) => normalizeText(player.name) === queryNormalized);
    if (exact.length) {
      return exact;
    }

    return players.filter((player) => normalizeText(player.name).startsWith(queryNormalized));
  }

  function findTribeMatches(tribes, queryNormalized) {
    const exact = tribes.filter((tribe) => {
      return normalizeText(tribe.tag) === queryNormalized || normalizeText(tribe.name) === queryNormalized;
    });
    if (exact.length) {
      return exact;
    }

    return tribes.filter((tribe) => {
      return normalizeText(tribe.tag).startsWith(queryNormalized) || normalizeText(tribe.name).startsWith(queryNormalized);
    });
  }

  function resolveSelectionList(items, queries, queriesNormalized, findMatches, formatter) {
    const resolved = [];
    const seenIds = new Set();

    queriesNormalized.forEach((queryNormalized, index) => {
      const matches = findMatches(items, queryNormalized);
      const label = queries[index];

      if (!matches.length) {
        throw new Error(`Nic som nenasiel pre "${label}".`);
      }

      if (matches.length > 1) {
        const preview = matches
          .slice(0, 10)
          .map((item) => formatter(item))
          .join(', ');
        throw new Error(`Nasiel som viac moznosti pre "${label}": ${preview}`);
      }

      const match = matches[0];
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        resolved.push(match);
      }
    });

    return resolved;
  }

  function formatSummaryLabel(prefix, labels) {
    if (labels.length <= 3) {
      return `${prefix} ${labels.join(', ')}`;
    }

    return `${prefix} ${labels.slice(0, 3).join(', ')} +${labels.length - 3}`;
  }

  function buildCandidates(worldData, config) {
    const { villages, players, tribes, playersById, tribesById } = worldData;

    if (config.mode === 'player') {
      const selectedPlayers = resolveSelectionList(
        players,
        config.queries,
        config.queriesNormalized,
        findPlayerMatches,
        (item) => item.name
      );
      const playerIds = new Set(selectedPlayers.map((player) => player.id));
      const selectedPlayersById = new Map(selectedPlayers.map((player) => [player.id, player]));
      const playerVillages = villages
        .filter((village) => playerIds.has(village.playerId))
        .map((village) => {
          const player = selectedPlayersById.get(village.playerId);
          const tribe = tribesById.get(player?.tribeId || 0);
          return {
            ...village,
            playerName: player?.name || '-',
            tribeLabel: formatTribeLabel(tribe),
          };
        });

      return {
        candidates: playerVillages,
        summaryLabel: formatSummaryLabel(
          selectedPlayers.length === 1 ? 'hrac' : 'hraci',
          selectedPlayers.map((player) => player.name)
        ),
      };
    }

    const selectedTribes = resolveSelectionList(
      tribes,
      config.queries,
      config.queriesNormalized,
      findTribeMatches,
      (item) => formatTribeLabel(item)
    );
    const tribeIds = new Set(selectedTribes.map((tribe) => tribe.id));
    const tribeVillages = villages
      .filter((village) => {
        const player = playersById.get(village.playerId);
        return player && tribeIds.has(player.tribeId);
      })
      .map((village) => {
        const player = playersById.get(village.playerId);
        const tribe = tribesById.get(player?.tribeId || 0);
        return {
          ...village,
          playerName: player?.name || '-',
          tribeLabel: formatTribeLabel(tribe),
        };
      });

    return {
      candidates: tribeVillages,
      summaryLabel: formatSummaryLabel(
        selectedTribes.length === 1 ? 'kmen' : 'kmeny',
        selectedTribes.map((tribe) => formatTribeLabel(tribe))
      ),
    };
  }

  function findInfoValueByLabel(doc, labelPatterns) {
    const rows = Array.from((doc.querySelector('#content_value') || doc.body).querySelectorAll('tr'));
    for (const row of rows) {
      const cells = Array.from(row.children).filter((cell) => {
        return cell.tagName === 'TD' || cell.tagName === 'TH';
      });

      if (cells.length < 2) {
        continue;
      }

      const label = normalizeText(getOwnCellText(cells[0]));
      if (!labelPatterns.some((pattern) => pattern.test(label))) {
        continue;
      }

      const value = cells[1].textContent.replace(/\s+/g, ' ').trim();
      if (value) {
        return value;
      }
    }

    return null;
  }

  function extractClaimInfo(doc) {
    const rawEndText = findInfoValueByLabel(doc, CLAIM_LABEL_PATTERNS);
    const claimedBy = findInfoValueByLabel(doc, CLAIM_FROM_LABEL_PATTERNS);

    if (!rawEndText) {
      return null;
    }

    return {
      rawEndText,
      claimedBy,
      endsAt: parseClaimEnd(rawEndText),
    };
  }

  function parseClaimEnd(rawValue) {
    const cleaned = String(rawValue || '')
      .split('|')[0]
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const relativeMatch = cleaned.match(/\b(dnes|zajtra)\b.*?(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
    if (relativeMatch) {
      const keyword = normalizeText(relativeMatch[1]);
      const hour = Number(relativeMatch[2]);
      const minute = Number(relativeMatch[3]);
      const second = Number(relativeMatch[4] || 0);
      const date = new Date();

      date.setHours(hour, minute, second, 0);
      if (keyword === 'zajtra') {
        date.setDate(date.getDate() + 1);
      }

      return date;
    }

    const match = cleaned.match(/(?:d[nň]a\s+)?(\d{1,2})\.(\d{1,2})\.\s*(?:o\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
    if (!match) {
      return null;
    }

    const now = new Date();
    const day = Number(match[1]);
    const month = Number(match[2]);
    const hour = Number(match[3]);
    const minute = Number(match[4]);
    const second = Number(match[5] || 0);
    const date = new Date(now.getFullYear(), month - 1, day, hour, minute, second, 0);

    if (date.getTime() < now.getTime() - 48 * 60 * 60 * 1000) {
      date.setFullYear(date.getFullYear() + 1);
    }

    return date;
  }

  function extractClaimInfoFromText(doc) {
    const compactText = String(doc.body?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!compactText) {
      return null;
    }

    const claimedByMatch = compactText.match(
      /[ŠS]ľ?achtick[ýy]\s+n[áa]rok\s+od:\s*(.*?)\s*[ŠS]ľ?achtick[ýy]\s+n[áa]rok\s+skon[čc][íi]:/i
    );
    const endMatch = compactText.match(
      /[ŠS]ľ?achtick[ýy]\s+n[áa]rok\s+skon[čc][íi]:\s*(d[ňn]a\s+\d{1,2}\.\d{1,2}\.\s+o\s+\d{1,2}:\d{2}(?::\d{2})?)/i
    );

    if (!endMatch) {
      return null;
    }

    return {
      rawEndText: endMatch[1].trim(),
      claimedBy: claimedByMatch?.[1]?.trim() || null,
      endsAt: parseClaimEnd(endMatch[1]),
    };
  }

  function getScanConcurrency() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 2 : 6;
  }

  async function fetchClaimLock(village) {
    const response = await fetch(buildVillageInfoUrl(village.id), {
      credentials: 'same-origin',
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Dedina ${village.coords} vratila ${response.status}.`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return extractClaimInfo(doc) || extractClaimInfoFromText(doc);
  }

  async function asyncPool(limit, items, worker) {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (queue.length && !state.aborted) {
        const item = queue.shift();
        if (!item) {
          break;
        }
        await worker(item);
      }
    });

    await Promise.all(workers);
  }

  async function run() {
    if (!getCurrentVillageId()) {
      throw new Error('Na tejto stranke nevidim parameter village. Spusti to v hre.');
    }

    const currentScreen = new URLSearchParams(window.location.search).get('screen');
    if (currentScreen !== 'map') {
      window.location.assign(buildVillageMapUrl(window.location.hash.replace('#', '')));
      return;
    }

    const loading = createLoadingOverlay('Nacitavam zoznam hracov a kmenov...');
    const worldData = await loadWorldData();
    loading.remove();

    const config = await createSelectorModal(worldData);
    if (!config) {
      state.destroy();
      return;
    }

    const panel = createPanel();
    panel.setStatus('Pripravujem sken...');

    const { candidates, summaryLabel } = buildCandidates(worldData, config);
    if (!candidates.length) {
      panel.setStatus(`Pre filter ${summaryLabel} som nenasiel ziadne dediny.`);
      panel.setSummary('Skus iny nazov alebo iny filter.');
      return;
    }

    if (candidates.length > 450) {
      const shouldContinue = window.confirm(
        `Pre ${summaryLabel} som nasiel ${candidates.length} dedin. Pokracovat v skene?`
      );
      if (!shouldContinue) {
        state.destroy();
        return;
      }
    }

    let processed = 0;
    let errorCount = 0;
    const results = [];
    const startedAt = Date.now();

    panel.setSummary(`Nasiel som ${candidates.length} dedin pre ${summaryLabel}. Zacina sken...`);

    await asyncPool(getScanConcurrency(), candidates, async (village) => {
      try {
        const claim = await fetchClaimLock(village);
        if (claim) {
          results.push({
            ...village,
            ...claim,
          });
        }
      } catch (error) {
        errorCount += 1;
        console.warn('TW claim lock scanner:', error);
      } finally {
        processed += 1;
        panel.setStatus(`Skenujem ${processed}/${candidates.length}. Zamky: ${results.length}.`);
      }
    });

    if (state.aborted) {
      return;
    }

    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    panel.setStatus(`Hotovo za ${durationSeconds}s.`);
    panel.setRows(results, errorCount);

    if (!results.length) {
      panel.setSummary(`Pre ${summaryLabel} som po kontrole ${candidates.length} dedin nenasiel aktivny zamok.`);
      return;
    }

    panel.setSummary(
      `Pre ${summaryLabel}: ${results.length} zamkov z ${candidates.length} dedin. Hotovo za ${durationSeconds}s.`
    );
  }

  run().catch((error) => {
    console.error('TW claim lock scanner:', error);
    state.destroy();
    window.alert(`Skript spadol: ${error.message}`);
  });
})();
