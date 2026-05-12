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
    results: [],
    styleEl: null,
    panelEl: null,
  };
  window[APP_KEY] = state;

  const CLAIM_LABEL_PATTERNS = [
    /slachticky\s+narok.*skonc/i,
    /slechticky\s+narok.*skonc/i,
    /noble.*claim.*(end|expir)/i,
  ];

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

  function getCurrentVillageId() {
    return window.game_data?.village?.id || new URLSearchParams(window.location.search).get('village');
  }

  function detectDefaultCoords() {
    const hashMatch = window.location.hash.match(/#(\d{1,3});(\d{1,3})/);
    if (hashMatch) {
      return `${hashMatch[1]}|${hashMatch[2]}`;
    }

    const dataVillage = window.game_data?.village;
    if (dataVillage?.x && dataVillage?.y) {
      return `${dataVillage.x}|${dataVillage.y}`;
    }

    const headingText = document.querySelector('#content_value h2, #content_value h3, h2, h3')?.textContent || '';
    const headingMatch = headingText.match(/(\d{1,3})\|(\d{1,3})/);
    if (headingMatch) {
      return `${headingMatch[1]}|${headingMatch[2]}`;
    }

    return '';
  }

  function parseCoords(value) {
    const match = String(value || '').match(/^\s*(\d{1,3})\s*[|;,:xX ]\s*(\d{1,3})\s*$/);
    if (!match) {
      return null;
    }

    return {
      x: Number(match[1]),
      y: Number(match[2]),
      text: `${Number(match[1])}|${Number(match[2])}`,
    };
  }

  function getPromptConfig() {
    const defaultCoords = detectDefaultCoords() || '500|500';
    const coordsInput = window.prompt('Zadaj stredove suradnice (napr. 495|490):', defaultCoords);
    if (coordsInput === null) {
      return null;
    }

    const center = parseCoords(coordsInput);
    if (!center) {
      throw new Error('Súradnice musia byť vo formáte 000|000.');
    }

    const radiusInput = window.prompt('Zadaj radius v poliach:', '10');
    if (radiusInput === null) {
      return null;
    }

    const radius = Number.parseInt(radiusInput, 10);
    if (!Number.isFinite(radius) || radius < 0) {
      throw new Error('Radius musí byť celé číslo 0 alebo viac.');
    }

    return { center, radius };
  }

  function getDistance(from, to) {
    return Math.hypot(to.x - from.x, to.y - from.y);
  }

  function sortResults(results) {
    return [...results].sort((left, right) => {
      const leftTime = left.endsAt?.getTime?.() ?? Number.POSITIVE_INFINITY;
      const rightTime = right.endsAt?.getTime?.() ?? Number.POSITIVE_INFINITY;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.coords.localeCompare(right.coords, 'sk');
    });
  }

  function buildVillageInfoUrl(villageId) {
    const url = new URL('/game.php', window.location.origin);
    url.searchParams.set('village', getCurrentVillageId());
    url.searchParams.set('screen', 'info_village');
    url.searchParams.set('id', villageId);
    return url.toString();
  }

  function createPanel() {
    const style = document.createElement('style');
    style.textContent = `
      .tw-lockscan-panel {
        position: fixed;
        top: 16px;
        right: 16px;
        width: 520px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        display: flex;
        flex-direction: column;
        background: #f5e7bf;
        color: #2c1b09;
        border: 2px solid #7a541f;
        border-radius: 10px;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
        font: 13px/1.4 Verdana, Arial, sans-serif;
        z-index: 2147483647;
        overflow: hidden;
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
      .tw-lockscan-summary {
        padding: 8px 10px;
        background: rgba(255, 251, 236, 0.9);
        border: 1px solid #d7bd87;
        border-radius: 8px;
      }

      .tw-lockscan-actions {
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

      .tw-lockscan-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .tw-lockscan-tablewrap {
        border: 1px solid #d7bd87;
        border-radius: 8px;
        background: rgba(255, 251, 236, 0.9);
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

      .tw-lockscan-link {
        color: #6a4213;
        font-weight: 700;
        text-decoration: none;
      }

      .tw-lockscan-link:hover {
        text-decoration: underline;
      }

      .tw-lockscan-muted {
        color: #7a6749;
      }
    `;

    const panel = document.createElement('div');
    panel.className = 'tw-lockscan-panel';
    panel.innerHTML = `
      <div class="tw-lockscan-header">
        <div class="tw-lockscan-title">Sken zámkov dedín</div>
        <button type="button" class="tw-lockscan-close" title="Zavrieť">×</button>
      </div>
      <div class="tw-lockscan-body">
        <div class="tw-lockscan-status">Pripravujem skenovanie...</div>
        <div class="tw-lockscan-summary">Výsledky sa zobrazia po naskenovaní.</div>
        <div class="tw-lockscan-actions">
          <button type="button" class="tw-lockscan-button" data-action="copy" disabled>Skopírovať výsledky</button>
        </div>
        <div class="tw-lockscan-tablewrap">
          <table class="tw-lockscan-table">
            <thead>
              <tr>
                <th>Dedina</th>
                <th>Vzdialenosť</th>
                <th>Koniec zámku</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="3" class="tw-lockscan-muted">Zatiaľ bez výsledkov.</td>
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
        'Dedina\tVzdialenosť\tKoniec zámku',
        ...state.results.map((result) => `${result.coords}\t${result.distance.toFixed(2)}\t${result.rawEndText}`),
      ];

      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        setStatus('Výsledky som skopíroval do schránky.');
      } catch (error) {
        setStatus(`Schránku sa nepodarilo zapísať: ${error.message}`);
      }
    });

    document.head.appendChild(style);
    document.body.appendChild(panel);

    state.styleEl = style;
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
            <td colspan="3" class="tw-lockscan-muted">V zadanom okruhu som nenašiel žiadny aktívny šľachtický nárok.</td>
          </tr>
        `;
        return;
      }

      tbodyEl.innerHTML = state.results
        .map((result) => {
          const infoUrl = buildVillageInfoUrl(result.id);
          return `
            <tr>
              <td>
                <a class="tw-lockscan-link" href="${infoUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.name || 'Dedina')}</a>
                <div class="tw-lockscan-muted">${escapeHtml(result.coords)}</div>
              </td>
              <td>${escapeHtml(result.distance.toFixed(2))}</td>
              <td>${escapeHtml(result.rawEndText)}</td>
            </tr>
          `;
        })
        .join('');

      const extra = errorCount ? ` Počas skenu zlyhalo ${errorCount} dedín.` : '';
      setSummary(`Našiel som ${state.results.length} aktívnych zámkov.${extra}`);
    }

    return {
      setStatus,
      setSummary,
      setRows,
    };
  }

  function destroy() {
    if (state.aborted) {
      return;
    }

    state.aborted = true;
    state.abortController.abort();
    state.styleEl?.remove();
    state.panelEl?.remove();
    delete window[APP_KEY];
  }

  state.destroy = destroy;

  async function loadVillageMap() {
    const response = await fetch(`${window.location.origin}/map/village.txt`, {
      credentials: 'same-origin',
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Nepodarilo sa načítať mapu dedín (${response.status}).`);
    }

    const text = await response.text();
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [id, name, x, y, playerId, points] = line.split(',');
        return {
          id: Number(id),
          name: name || '',
          x: Number(x),
          y: Number(y),
          playerId: Number(playerId),
          points: Number(points),
          coords: `${Number(x)}|${Number(y)}`,
        };
      });
  }

  function findClaimRow(doc) {
    const rows = Array.from(doc.querySelectorAll('tr'));
    for (const row of rows) {
      const cells = row.querySelectorAll('th, td');
      if (cells.length < 2) {
        continue;
      }

      const label = normalizeText(cells[0].textContent);
      const matches = CLAIM_LABEL_PATTERNS.some((pattern) => pattern.test(label));
      if (!matches) {
        continue;
      }

      const value = cells[1].textContent.replace(/\s+/g, ' ').trim();
      return value || null;
    }

    return null;
  }

  function parseClaimEnd(rawValue) {
    const cleaned = String(rawValue || '').replace(/\s+/g, ' ').trim();
    const withTimeMatch = cleaned.match(/(\d{1,2})\.(\d{1,2})\.\s*(?:o\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
    if (!withTimeMatch) {
      return null;
    }

    const now = new Date();
    const day = Number(withTimeMatch[1]);
    const month = Number(withTimeMatch[2]);
    const hour = Number(withTimeMatch[3]);
    const minute = Number(withTimeMatch[4]);
    const second = Number(withTimeMatch[5] || 0);

    const date = new Date(now.getFullYear(), month - 1, day, hour, minute, second, 0);
    if (date.getTime() < now.getTime() - 48 * 60 * 60 * 1000) {
      date.setFullYear(date.getFullYear() + 1);
    }

    return date;
  }

  async function fetchClaimLock(village) {
    const response = await fetch(buildVillageInfoUrl(village.id), {
      credentials: 'same-origin',
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Dedina ${village.coords} vrátila ${response.status}.`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rawEndText = findClaimRow(doc);
    if (!rawEndText) {
      return null;
    }

    return {
      rawEndText,
      endsAt: parseClaimEnd(rawEndText),
    };
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
      throw new Error('Na tejto stránke nevidím parameter village. Spusti bookmarklet v hre.');
    }

    const config = getPromptConfig();
    if (!config) {
      state.destroy();
      return;
    }

    const panel = createPanel();
    const { center, radius } = config;

    panel.setStatus(`Načítavam mapu sveta pre okruh ${radius} od ${center.text}...`);

    const villages = await loadVillageMap();
    const candidates = villages
      .filter((village) => village.playerId > 0)
      .filter((village) => getDistance(center, village) <= radius)
      .map((village) => ({
        ...village,
        distance: getDistance(center, village),
      }))
      .sort((left, right) => left.distance - right.distance);

    if (!candidates.length) {
      panel.setStatus('V zadanom okruhu som nenašiel žiadne obsadené dediny.');
      panel.setSummary('Skús iné súradnice alebo väčší radius.');
      return;
    }

    if (candidates.length > 450) {
      const shouldContinue = window.confirm(
        `Našiel som ${candidates.length} dedín. To už znamená dosť requestov na detail dediny. Chceš pokračovať?`
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

    panel.setSummary(`Našiel som ${candidates.length} dedín v okruhu. Začínam skenovať...`);

    await asyncPool(6, candidates, async (village) => {
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
        panel.setStatus(
          `Skenujem dediny ${processed}/${candidates.length}. Nájdené zámky: ${results.length}.`
        );
      }
    });

    if (state.aborted) {
      return;
    }

    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    panel.setStatus(`Hotovo za ${durationSeconds}s. Zoradzujem výsledky...`);
    panel.setRows(results, errorCount);

    if (!results.length) {
      panel.setSummary(`Prešlo sa ${candidates.length} dedín. Aktívny zámok som nenašiel.`);
      return;
    }

    panel.setSummary(
      `Prešlo sa ${candidates.length} dedín, našlo sa ${results.length} zámkov. Hotovo za ${durationSeconds}s.`
    );
  }

  run().catch((error) => {
    console.error('TW claim lock scanner:', error);
    state.destroy();
    window.alert(`Skript spadol: ${error.message}`);
  });
})();
