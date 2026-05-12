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
    panelEl: null,
    styleEl: null,
    results: [],
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

  function buildVillageInfoUrl(villageId) {
    const url = new URL('/game.php', window.location.origin);
    url.searchParams.set('village', getCurrentVillageId());
    url.searchParams.set('screen', 'info_village');
    url.searchParams.set('id', villageId);
    return url.toString();
  }

  function parseFilterMode(rawValue) {
    const value = normalizeText(rawValue);
    if (['h', 'hrac', 'player'].includes(value)) {
      return 'player';
    }
    if (['k', 'kmen', 'kmen ', 'tribe', 'ally'].includes(value)) {
      return 'tribe';
    }
    return null;
  }

  function getPromptConfig() {
    const modeInput = window.prompt('Filter: hrac alebo kmen? (h/k)', 'h');
    if (modeInput === null) {
      return null;
    }

    const mode = parseFilterMode(modeInput);
    if (!mode) {
      throw new Error('Zadaj h pre hraca alebo k pre kmen.');
    }

    const label = mode === 'player' ? 'Zadaj meno hraca:' : 'Zadaj tag alebo nazov kmenu:';
    const queryInput = window.prompt(label, '');
    if (queryInput === null) {
      return null;
    }

    const query = String(queryInput).trim();
    if (!query) {
      throw new Error('Filter nemoze byt prazdny.');
    }

    return {
      mode,
      query,
      queryNormalized: normalizeText(query),
    };
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

  function createPanel() {
    const style = document.createElement('style');
    style.textContent = `
      .tw-lockscan-panel {
        position: fixed;
        top: 16px;
        right: 16px;
        width: 680px;
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
        <div class="tw-lockscan-title">TW Claim Lock Scanner</div>
        <button type="button" class="tw-lockscan-close" title="Zavriet">x</button>
      </div>
      <div class="tw-lockscan-body">
        <div class="tw-lockscan-status">Pripravujem skenovanie...</div>
        <div class="tw-lockscan-summary">Vysledky sa zobrazia po naskenovani.</div>
        <div class="tw-lockscan-actions">
          <button type="button" class="tw-lockscan-button" data-action="copy" disabled>Skopirovat vysledky</button>
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
            `${result.name} (${result.coords})\t${result.playerName}\t${result.tribeLabel}\t${result.rawEndText}`
        ),
      ];

      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        setStatus('Vysledky su v schranke.');
      } catch (error) {
        setStatus(`Schranka zlyhala: ${error.message}`);
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
            <td colspan="4" class="tw-lockscan-muted">Nenasiel som ziadny aktivny zamok.</td>
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
                <a class="tw-lockscan-link" href="${infoUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.name || result.coords)}</a>
                <div class="tw-lockscan-muted">${escapeHtml(result.coords)}</div>
              </td>
              <td>${escapeHtml(result.playerName || '-')}</td>
              <td>${escapeHtml(result.tribeLabel || '-')}</td>
              <td>${escapeHtml(result.rawEndText)}</td>
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
          name: name || '',
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
          name: name || '',
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
          name: name || '',
          tag: tag || '',
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

    return players.filter((player) => normalizeText(player.name).includes(queryNormalized));
  }

  function findTribeMatches(tribes, queryNormalized) {
    const exact = tribes.filter((tribe) => {
      return normalizeText(tribe.tag) === queryNormalized || normalizeText(tribe.name) === queryNormalized;
    });
    if (exact.length) {
      return exact;
    }

    return tribes.filter((tribe) => {
      return normalizeText(tribe.tag).includes(queryNormalized) || normalizeText(tribe.name).includes(queryNormalized);
    });
  }

  function requireSingleMatch(matches, label, formatter) {
    if (!matches.length) {
      throw new Error(`Nic som nenasiel pre filter "${label}".`);
    }

    if (matches.length > 1) {
      const preview = matches
        .slice(0, 10)
        .map((item) => formatter(item))
        .join(', ');
      throw new Error(`Nasiel som viac moznosti pre "${label}": ${preview}`);
    }

    return matches[0];
  }

  function buildCandidates(worldData, config) {
    const { villages, players, tribes, playersById, tribesById } = worldData;

    if (config.mode === 'player') {
      const player = requireSingleMatch(
        findPlayerMatches(players, config.queryNormalized),
        config.query,
        (item) => item.name
      );

      const tribe = tribesById.get(player.tribeId);
      const playerVillages = villages
        .filter((village) => village.playerId === player.id)
        .map((village) => ({
          ...village,
          playerName: player.name,
          tribeLabel: formatTribeLabel(tribe),
        }));

      return {
        candidates: playerVillages,
        summaryLabel: `hrac ${player.name}`,
      };
    }

    const tribe = requireSingleMatch(
      findTribeMatches(tribes, config.queryNormalized),
      config.query,
      (item) => formatTribeLabel(item)
    );

    const tribePlayers = players.filter((player) => player.tribeId === tribe.id);
    const tribePlayerIds = new Set(tribePlayers.map((player) => player.id));
    const tribeVillages = villages
      .filter((village) => tribePlayerIds.has(village.playerId))
      .map((village) => {
        const player = playersById.get(village.playerId);
        return {
          ...village,
          playerName: player?.name || '-',
          tribeLabel: formatTribeLabel(tribe),
        };
      });

    return {
      candidates: tribeVillages,
      summaryLabel: `kmen ${formatTribeLabel(tribe)}`,
    };
  }

  function findClaimRow(doc) {
    const rows = Array.from(doc.querySelectorAll('tr'));
    for (const row of rows) {
      const cells = row.querySelectorAll('th, td');
      if (cells.length < 2) {
        continue;
      }

      const label = normalizeText(cells[0].textContent);
      if (!CLAIM_LABEL_PATTERNS.some((pattern) => pattern.test(label))) {
        continue;
      }

      const value = cells[1].textContent.replace(/\s+/g, ' ').trim();
      return value || null;
    }

    return null;
  }

  function parseClaimEnd(rawValue) {
    const cleaned = String(rawValue || '').replace(/\s+/g, ' ').trim();
    const match = cleaned.match(/(\d{1,2})\.(\d{1,2})\.\s*(?:o\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
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
      throw new Error('Na tejto stranke nevidim parameter village. Spusti to v hre.');
    }

    const config = getPromptConfig();
    if (!config) {
      state.destroy();
      return;
    }

    const panel = createPanel();
    panel.setStatus('Nacitavam mapove data sveta...');

    const worldData = await loadWorldData();
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
