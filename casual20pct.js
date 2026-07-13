(async function () {
    'use strict';

    const SCRIPT_KEY = '__twCasual20PercentCoords';
    const ROOT_ID = 'tw-casual-20pct-root';
    const CACHE_TTL_MS = 60 * 60 * 1000;
    const CASINO_URL = 'https://500casino.com/';

    if (window[SCRIPT_KEY] && typeof window[SCRIPT_KEY].destroy === 'function') {
        window[SCRIPT_KEY].destroy();
    }

    function cleanString(value) {
        const source = String(value || '').trim();
        if (!source.length) return '';

        try {
            return decodeURIComponent(source.replace(/\+/g, '%20')).trim();
        } catch (error) {
            return source.replace(/\+/g, ' ').trim();
        }
    }

    function normalize(value) {
        return cleanString(value).replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function parseCsvRows(strData, delimiter = ',') {
        const pattern = new RegExp(
            '(\\' +
                delimiter +
                '|\\r?\\n|\\r|^)' +
                '(?:"([^"]*(?:""[^"]*)*)"|' +
                '([^"\\' +
                delimiter +
                '\\r\\n]*))',
            'gi'
        );

        const rows = [[]];
        let matches = null;

        while ((matches = pattern.exec(strData))) {
            const matchedDelimiter = matches[1];
            if (matchedDelimiter.length && matchedDelimiter !== delimiter) {
                rows.push([]);
            }

            const matchedValue = matches[2]
                ? matches[2].replace(/""/g, '"')
                : matches[3];

            rows[rows.length - 1].push(matchedValue);
        }

        return rows;
    }

    function splitInput(value) {
        return String(value || '')
            .split(',')
            .map((item) => cleanString(item))
            .filter(Boolean);
    }

    function uniq(values) {
        return [...new Set(values)];
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('sk-SK');
    }

    function waitForNextPaint() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => resolve());
        });
    }

    function showMessage(type, message) {
        if (window.UI) {
            if (type === 'error' && typeof UI.ErrorMessage === 'function') {
                UI.ErrorMessage(message);
                return;
            }

            if (type !== 'error' && typeof UI.SuccessMessage === 'function') {
                UI.SuccessMessage(message);
                return;
            }

            if (typeof UI.InfoMessage === 'function') {
                UI.InfoMessage(message);
                return;
            }
        }

        console[type === 'error' ? 'error' : 'log'](message);
    }

    async function fetchTextWithCache(cacheName, url) {
        const cacheKey = `${SCRIPT_KEY}:${location.host}:${cacheName}`;
        const timeKey = `${cacheKey}:time`;

        try {
            const cachedText = localStorage.getItem(cacheKey);
            const cachedTime = Number(localStorage.getItem(timeKey) || '0');

            if (cachedText && cachedTime && Date.now() - cachedTime < CACHE_TTL_MS) {
                return cachedText;
            }
        } catch (error) {
            console.warn(`${SCRIPT_KEY}: cache read failed`, error);
        }

        const responseText = await jQuery.ajax({
            url: url,
            method: 'GET',
            cache: true,
        });

        try {
            localStorage.setItem(cacheKey, responseText);
            localStorage.setItem(timeKey, String(Date.now()));
        } catch (error) {
            console.warn(`${SCRIPT_KEY}: cache write failed`, error);
        }

        return responseText;
    }

    function parsePlayers(rows) {
        return rows
            .filter((row) => row && row[0])
            .map((row) => ({
                id: Number(row[0]),
                name: cleanString(row[1]),
                tribeId: Number(row[2] || 0),
                villages: Number(row[3] || 0),
                points: Number(row[4] || 0),
                rank: Number(row[5] || 0),
            }));
    }

    function parseTribes(rows) {
        return rows
            .filter((row) => row && row[0])
            .map((row) => ({
                id: Number(row[0]),
                name: cleanString(row[1]),
                tag: cleanString(row[2]),
                members: Number(row[3] || 0),
                villages: Number(row[4] || 0),
                points: Number(row[5] || 0),
                rank: Number(row[7] || 0),
            }));
    }

    function parseVillages(rows) {
        return rows
            .filter((row) => row && row[0])
            .map((row) => ({
                id: Number(row[0]),
                name: cleanString(row[1]),
                x: Number(row[2]),
                y: Number(row[3]),
                playerId: Number(row[4] || 0),
                points: Number(row[5] || 0),
            }));
    }

    async function loadWorldData() {
        const [playersText, tribesText, villagesText] = await Promise.all([
            fetchTextWithCache('players', '/map/player.txt'),
            fetchTextWithCache('tribes', '/map/ally.txt'),
            fetchTextWithCache('villages', '/map/village.txt'),
        ]);

        const players = parsePlayers(parseCsvRows(playersText));
        const tribes = parseTribes(parseCsvRows(tribesText));
        const villages = parseVillages(parseCsvRows(villagesText));

        return { players, tribes, villages };
    }

    function buildIndexes(worldData) {
        const playersById = new Map();
        const playerNameToId = new Map();
        const tribesById = new Map();
        const tribeLookup = new Map();
        const tribeMembers = new Map();

        worldData.players.forEach((player) => {
            playersById.set(player.id, player);
            playerNameToId.set(normalize(player.name), player.id);

            if (!tribeMembers.has(player.tribeId)) {
                tribeMembers.set(player.tribeId, []);
            }

            tribeMembers.get(player.tribeId).push(player.id);
        });

        worldData.tribes.forEach((tribe) => {
            tribesById.set(tribe.id, tribe);

            const nameKey = normalize(tribe.name);
            const tagKey = normalize(tribe.tag);

            if (nameKey) {
                if (!tribeLookup.has(nameKey)) tribeLookup.set(nameKey, []);
                tribeLookup.get(nameKey).push(tribe.id);
            }

            if (tagKey) {
                if (!tribeLookup.has(tagKey)) tribeLookup.set(tagKey, []);
                tribeLookup.get(tagKey).push(tribe.id);
            }
        });

        return { playersById, playerNameToId, tribesById, tribeLookup, tribeMembers };
    }

    function createRoot() {
        const existing = document.getElementById(ROOT_ID);
        if (existing) existing.remove();

        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.innerHTML = `
            <style>
                #${ROOT_ID} {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.45);
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    box-sizing: border-box;
                }
                #${ROOT_ID} * {
                    box-sizing: border-box;
                    font-family: Verdana, Arial, sans-serif;
                }
                #${ROOT_ID} .tw-casual-modal {
                    width: min(860px, 100%);
                    max-height: 90vh;
                    overflow: auto;
                    background: #f4e4bc;
                    border: 1px solid #6e4f1f;
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
                    border-radius: 8px;
                    color: #2e2011;
                }
                #${ROOT_ID} .tw-casual-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    border-bottom: 1px solid #c9ad76;
                    background: linear-gradient(180deg, #f7edcf 0%, #ead4a5 100%);
                }
                #${ROOT_ID} .tw-casual-title {
                    font-size: 18px;
                    font-weight: 700;
                    margin: 0;
                }
                #${ROOT_ID} .tw-casual-subtitle {
                    margin: 4px 0 0;
                    font-size: 12px;
                    color: #5d4730;
                }
                #${ROOT_ID} .tw-casual-close {
                    border: 1px solid #7d5d28;
                    background: #fff5de;
                    color: #4b3519;
                    border-radius: 6px;
                    padding: 8px 12px;
                    cursor: pointer;
                    font-weight: 700;
                }
                #${ROOT_ID} .tw-casual-head-right {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                #${ROOT_ID} .tw-casual-body {
                    padding: 16px;
                }
                #${ROOT_ID} .tw-casual-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                }
                #${ROOT_ID} .tw-casual-card {
                    background: rgba(255, 249, 235, 0.72);
                    border: 1px solid #d4b37a;
                    border-radius: 6px;
                    padding: 12px;
                }
                #${ROOT_ID} .tw-casual-label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 12px;
                    font-weight: 700;
                }
                #${ROOT_ID} .tw-casual-input,
                #${ROOT_ID} .tw-casual-output {
                    width: 100%;
                    border: 1px solid #a4824d;
                    background: #fffdfa;
                    color: #2e2011;
                    border-radius: 6px;
                    padding: 10px;
                    font-size: 13px;
                }
                #${ROOT_ID} .tw-casual-output {
                    min-height: 180px;
                    resize: vertical;
                }
                #${ROOT_ID} .tw-casual-hint {
                    margin-top: 6px;
                    font-size: 12px;
                    color: #6a5133;
                    line-height: 1.45;
                }
                #${ROOT_ID} .tw-casual-actions {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-top: 14px;
                }
                #${ROOT_ID} .tw-casual-btn {
                    border: 1px solid #7d5d28;
                    background: linear-gradient(180deg, #fff1c9 0%, #e6bf70 100%);
                    color: #3f2b12;
                    border-radius: 6px;
                    padding: 10px 14px;
                    cursor: pointer;
                    font-weight: 700;
                }
                #${ROOT_ID} .tw-casual-btn[disabled] {
                    cursor: wait;
                    opacity: 0.7;
                }
                #${ROOT_ID} .tw-casual-casino-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    border-radius: 999px;
                    border: 1px solid #0f8f5c;
                    background: linear-gradient(135deg, #031d15 0%, #0b3f2e 55%, #0f5e45 100%);
                    color: #ecfff6;
                    text-decoration: none;
                    box-shadow: 0 0 0 rgba(23, 255, 166, 0);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                #${ROOT_ID} .tw-casual-casino-link:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 0 18px rgba(23, 255, 166, 0.32);
                }
                #${ROOT_ID} .tw-casual-casino-orb {
                    width: 12px;
                    height: 12px;
                    flex: 0 0 12px;
                    border-radius: 50%;
                    background: radial-gradient(circle at 35% 35%, #f4ffb3 0%, #4dffbf 42%, #00b87a 100%);
                    box-shadow: 0 0 8px rgba(77, 255, 191, 0.6);
                }
                #${ROOT_ID} .tw-casual-casino-copy {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.1;
                }
                #${ROOT_ID} .tw-casual-casino-title {
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }
                #${ROOT_ID} .tw-casual-casino-state {
                    font-size: 11px;
                    color: #baf8df;
                    min-height: 12px;
                }
                #${ROOT_ID}[data-loading="1"] .tw-casual-casino-link {
                    box-shadow: 0 0 24px rgba(23, 255, 166, 0.55);
                    animation: twCasinoPulse 1.1s ease-in-out infinite;
                }
                #${ROOT_ID}[data-loading="1"] .tw-casual-casino-orb {
                    animation: twCasinoSpin 1s linear infinite, twCasinoGlow 0.9s ease-in-out infinite alternate;
                }
                #${ROOT_ID} .tw-casual-status {
                    margin-top: 14px;
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid #d4b37a;
                    background: rgba(255, 250, 240, 0.84);
                    font-size: 12px;
                    line-height: 1.55;
                }
                #${ROOT_ID} .tw-casual-status strong {
                    color: #4d3212;
                }
                #${ROOT_ID} .tw-casual-status span {
                    display: block;
                }
                @keyframes twCasinoSpin {
                    from { transform: rotate(0deg) scale(1); }
                    to { transform: rotate(360deg) scale(1.08); }
                }
                @keyframes twCasinoGlow {
                    from { box-shadow: 0 0 8px rgba(77, 255, 191, 0.5); }
                    to { box-shadow: 0 0 18px rgba(180, 255, 110, 0.95); }
                }
                @keyframes twCasinoPulse {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(-1px) scale(1.01); }
                    100% { transform: translateY(0); }
                }
                @media (max-width: 720px) {
                    #${ROOT_ID} .tw-casual-grid {
                        grid-template-columns: 1fr;
                    }
                    #${ROOT_ID} .tw-casual-head {
                        align-items: flex-start;
                    }
                    #${ROOT_ID} .tw-casual-head-right {
                        width: 100%;
                        justify-content: space-between;
                    }
                }
            </style>
            <div class="tw-casual-modal">
                <div class="tw-casual-head">
                    <div>
                        <h2 class="tw-casual-title">Casual 20% Coords</h2>
                        <p class="tw-casual-subtitle">
                            Vyber hracov alebo kmene. Script vrati len coordy hracov v rozsahu tvojich bodov -20% az +20%.
                        </p>
                    </div>
                    <div class="tw-casual-head-right">
                        <a
                            href="${CASINO_URL}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="tw-casual-casino-link"
                            id="tw-casual-casino-link"
                        >
                            <span class="tw-casual-casino-orb"></span>
                            <span class="tw-casual-casino-copy">
                                <span class="tw-casual-casino-title">500casino.com</span>
                                <span class="tw-casual-casino-state" id="tw-casual-casino-state">Loading beacon ready</span>
                            </span>
                        </a>
                        <button type="button" class="tw-casual-close" data-action="close">Zavriet</button>
                    </div>
                </div>
                <div class="tw-casual-body">
                    <div class="tw-casual-grid">
                        <div class="tw-casual-card">
                            <label class="tw-casual-label" for="tw-casual-players">Hrac (oddel ciarkou)</label>
                            <input id="tw-casual-players" class="tw-casual-input" list="tw-casual-player-list" placeholder="PlayerOne, PlayerTwo">
                            <datalist id="tw-casual-player-list"></datalist>
                            <div class="tw-casual-hint">
                                Zadaj presne meno hraca. Viac mien mozes oddelit ciarkou.
                            </div>
                        </div>
                        <div class="tw-casual-card">
                            <label class="tw-casual-label" for="tw-casual-tribes">Kmen alebo tag (oddel ciarkou)</label>
                            <input id="tw-casual-tribes" class="tw-casual-input" list="tw-casual-tribe-list" placeholder="TAG, Nazov kmena">
                            <datalist id="tw-casual-tribe-list"></datalist>
                            <div class="tw-casual-hint">
                                Funguje podla tagu aj podla nazvu kmena. Zo zvoleneho kmena vezme vsetkych clenov.
                            </div>
                        </div>
                    </div>
                    <div class="tw-casual-card" style="margin-top: 14px;">
                        <label class="tw-casual-label" for="tw-casual-output">Coords</label>
                        <textarea id="tw-casual-output" class="tw-casual-output" readonly placeholder="Po kliknuti na Generovat sa tu zobrazi zoznam coordov oddelenych medzerou."></textarea>
                        <div class="tw-casual-actions">
                            <button type="button" class="tw-casual-btn" data-action="generate" disabled>Generovat coordy</button>
                            <button type="button" class="tw-casual-btn" data-action="copy" disabled>Kopirovat</button>
                        </div>
                        <div id="tw-casual-status" class="tw-casual-status">
                            Nacitavam data sveta...
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(root);
        return root;
    }

    function populateDatalists(root, worldData) {
        const playerList = root.querySelector('#tw-casual-player-list');
        const tribeList = root.querySelector('#tw-casual-tribe-list');

        playerList.innerHTML = worldData.players
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((player) => `<option value="${escapeAttribute(player.name)}"></option>`)
            .join('');

        const seenTribeOptions = new Set();
        const tribeOptions = [];

        worldData.tribes
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .forEach((tribe) => {
                [tribe.tag, tribe.name].forEach((label) => {
                    const value = cleanString(label);
                    if (!value) return;

                    const key = normalize(value);
                    if (seenTribeOptions.has(key)) return;

                    seenTribeOptions.add(key);
                    tribeOptions.push(
                        `<option value="${escapeAttribute(value)}"></option>`
                    );
                });
            });

        tribeList.innerHTML = tribeOptions.join('');
    }

    function renderStatus(root, lines) {
        root.querySelector('#tw-casual-status').innerHTML = lines
            .map((line) => `<span>${line}</span>`)
            .join('');
    }

    function setLoading(root, isLoading, message) {
        root.setAttribute('data-loading', isLoading ? '1' : '0');

        const generateBtn = root.querySelector('[data-action="generate"]');
        const copyBtn = root.querySelector('[data-action="copy"]');
        const stateLabel = root.querySelector('#tw-casual-casino-state');
        const hasOutput = root.querySelector('#tw-casual-output').value.trim().length > 0;

        if (generateBtn) generateBtn.disabled = isLoading;
        if (copyBtn) copyBtn.disabled = isLoading || !hasOutput;
        if (stateLabel) {
            stateLabel.textContent = message || (isLoading ? 'Loading...' : 'Click to visit');
        }
    }

    function escapeAttribute(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function copyOutput(root) {
        const output = root.querySelector('#tw-casual-output').value.trim();
        if (!output) {
            showMessage('error', 'Zatial nie su ziadne coordy na kopirovanie.');
            return;
        }

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(output);
        } else {
            const textarea = root.querySelector('#tw-casual-output');
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
        }

        showMessage('success', 'Coords boli skopirovane.');
    }

    async function generateCoordinates(root, worldData, indexes) {
        const playerTokens = splitInput(root.querySelector('#tw-casual-players').value);
        const tribeTokens = splitInput(root.querySelector('#tw-casual-tribes').value);

        if (!playerTokens.length && !tribeTokens.length) {
            showMessage('error', 'Zadaj aspon jedneho hraca alebo jeden kmen.');
            return;
        }

        setLoading(root, true, 'Loading coords...');
        await waitForNextPaint();

        const currentPlayerPoints = Number(game_data.player.points || 0);
        const currentPlayerId = Number(game_data.player.id || 0);
        const minPoints = Math.floor(currentPlayerPoints * 0.8);
        const maxPoints = Math.ceil(currentPlayerPoints * 1.2);

        const matchedPlayerIds = [];
        const matchedTribeIds = [];
        const missingPlayers = [];
        const missingTribes = [];

        playerTokens.forEach((token) => {
            const playerId = indexes.playerNameToId.get(normalize(token));
            if (playerId) {
                matchedPlayerIds.push(playerId);
            } else {
                missingPlayers.push(token);
            }
        });

        tribeTokens.forEach((token) => {
            const tribeIds = indexes.tribeLookup.get(normalize(token));
            if (tribeIds && tribeIds.length) {
                matchedTribeIds.push(...tribeIds);
            } else {
                missingTribes.push(token);
            }
        });

        const selectedPlayerIds = new Set(matchedPlayerIds);
        uniq(matchedTribeIds).forEach((tribeId) => {
            const members = indexes.tribeMembers.get(tribeId) || [];
            members.forEach((playerId) => selectedPlayerIds.add(playerId));
        });

        selectedPlayerIds.delete(currentPlayerId);

        const eligiblePlayerIds = new Set();
        const outOfRangePlayers = [];

        [...selectedPlayerIds].forEach((playerId) => {
            const player = indexes.playersById.get(playerId);
            if (!player) return;

            if (player.points >= minPoints && player.points <= maxPoints) {
                eligiblePlayerIds.add(playerId);
            } else {
                outOfRangePlayers.push(player);
            }
        });

        const coordinates = worldData.villages
            .filter((village) => eligiblePlayerIds.has(village.playerId))
            .map((village) => `${village.x}|${village.y}`);

        root.querySelector('#tw-casual-output').value = coordinates.join(' ');

        const eligiblePlayers = [...eligiblePlayerIds]
            .map((playerId) => indexes.playersById.get(playerId))
            .filter(Boolean)
            .sort((a, b) => a.rank - b.rank);

        const statusLines = [
            `<strong>Tvoje body:</strong> ${formatNumber(currentPlayerPoints)}`,
            `<strong>Povoleny rozsah:</strong> ${formatNumber(minPoints)} - ${formatNumber(maxPoints)}`,
            `<strong>Najdene priame mena:</strong> ${matchedPlayerIds.length}`,
            `<strong>Najdene kmene:</strong> ${uniq(matchedTribeIds).length}`,
            `<strong>Vhodni hraci:</strong> ${eligiblePlayers.length}`,
            `<strong>Vysledne coordy:</strong> ${coordinates.length}`,
        ];

        if (missingPlayers.length) {
            statusLines.push(
                `<strong>Nenajdeni hraci:</strong> ${escapeHtml(missingPlayers.join(', '))}`
            );
        }

        if (missingTribes.length) {
            statusLines.push(
                `<strong>Nenajdene kmene:</strong> ${escapeHtml(missingTribes.join(', '))}`
            );
        }

        if (outOfRangePlayers.length) {
            statusLines.push(
                `<strong>Mimo 20% rozsahu:</strong> ${escapeHtml(
                    outOfRangePlayers
                        .sort((a, b) => a.rank - b.rank)
                        .map((player) => `${player.name} (${formatNumber(player.points)})`)
                        .join(', ')
                )}`
            );
        }

        if (eligiblePlayers.length) {
            statusLines.push(
                `<strong>Pouziti hraci:</strong> ${escapeHtml(
                    eligiblePlayers
                        .map((player) => `${player.name} (${formatNumber(player.points)})`)
                        .join(', ')
                )}`
            );
        }

        renderStatus(root, statusLines);
        setLoading(root, false, coordinates.length ? 'Coords ready' : 'No coords found');

        if (coordinates.length) {
            showMessage('success', `Hotovo. Naslo sa ${coordinates.length} coordov.`);
        } else {
            showMessage(
                'error',
                'Nenasli sa ziadne coordy. Skontroluj mena, kmene alebo 20% bodovy rozsah.'
            );
        }
    }

    function bindEvents(root, worldData, indexes) {
        const onKeyDown = function (event) {
            if (event.key === 'Escape') {
                destroy();
            }
        };

        window[SCRIPT_KEY].onKeyDown = onKeyDown;
        document.addEventListener('keydown', onKeyDown);

        root.addEventListener('click', async (event) => {
            const action = event.target && event.target.getAttribute('data-action');
            if (!action) return;

            if (action === 'close') {
                destroy();
                return;
            }

            if (action === 'generate') {
                try {
                    await generateCoordinates(root, worldData, indexes);
                } catch (error) {
                    console.error(error);
                    setLoading(root, false, 'Generate failed');
                    showMessage('error', 'Generovanie coordov zlyhalo.');
                }
                return;
            }

            if (action === 'copy') {
                try {
                    await copyOutput(root);
                } catch (error) {
                    console.error(error);
                    showMessage('error', 'Kopirovanie zlyhalo.');
                }
            }
        });

        root.addEventListener('click', (event) => {
            if (event.target.id === ROOT_ID) {
                destroy();
            }
        });
    }

    function destroy() {
        const root = document.getElementById(ROOT_ID);
        if (root) root.remove();

        if (window[SCRIPT_KEY] && window[SCRIPT_KEY].onKeyDown) {
            document.removeEventListener('keydown', window[SCRIPT_KEY].onKeyDown);
        }

        delete window[SCRIPT_KEY];
    }

    const root = createRoot();
    setLoading(root, true, 'Loading world data...');

    window[SCRIPT_KEY] = {
        destroy: destroy,
    };

    try {
        const worldData = await loadWorldData();
        const indexes = buildIndexes(worldData);

        populateDatalists(root, worldData);
        setLoading(root, false, 'Click to visit');
        renderStatus(root, [
            `<strong>Tvoje body:</strong> ${formatNumber(game_data.player.points)}`,
            `<strong>Povoleny rozsah:</strong> ${formatNumber(
                Math.floor(Number(game_data.player.points || 0) * 0.8)
            )} - ${formatNumber(Math.ceil(Number(game_data.player.points || 0) * 1.2))}`,
            'Data sveta su nacitane. Zadaj hracov alebo kmene a klikni na Generovat coordy.',
        ]);
        bindEvents(root, worldData, indexes);
    } catch (error) {
        console.error(`${SCRIPT_KEY}:`, error);
        setLoading(root, false, 'Load failed');
        renderStatus(root, [
            '<strong>Chyba:</strong> Nepodarilo sa nacitat data sveta.',
            escapeHtml(error && error.message ? error.message : String(error)),
        ]);
        showMessage('error', 'Nepodarilo sa nacitat data sveta pre script.');
    }
})();
