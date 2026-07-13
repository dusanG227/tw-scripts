(async function () {
    'use strict';

    const SCRIPT_KEY = '__twCasual20PercentCoords';
    const ROOT_ID = 'tw-casual-20pct-root';
    const CASINO_URL = 'https://500casino.com/';
    const AUTOCOMPLETE_LIMIT = 12;

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

    async function fetchTextFresh(url) {
        const separator = url.indexOf('?') === -1 ? '?' : '&';

        return jQuery.ajax({
            url: `${url}${separator}_=${Date.now()}`,
            method: 'GET',
            cache: false,
        });
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
            fetchTextFresh('/map/player.txt'),
            fetchTextFresh('/map/ally.txt'),
            fetchTextFresh('/map/village.txt'),
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
                #${ROOT_ID} .tw-casual-autocomplete {
                    position: relative;
                }
                #${ROOT_ID} .tw-casual-suggestions {
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: calc(100% + 4px);
                    z-index: 20;
                    display: none;
                    max-height: 220px;
                    overflow-y: auto;
                    border: 1px solid #a4824d;
                    border-radius: 8px;
                    background: #fffdfa;
                    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
                }
                #${ROOT_ID} .tw-casual-suggestions.is-open {
                    display: block;
                }
                #${ROOT_ID} .tw-casual-suggestion {
                    display: block;
                    width: 100%;
                    border: 0;
                    border-bottom: 1px solid #efdfbf;
                    background: transparent;
                    color: #2e2011;
                    text-align: left;
                    padding: 8px 10px;
                    cursor: pointer;
                    font-size: 13px;
                }
                #${ROOT_ID} .tw-casual-suggestion:last-child {
                    border-bottom: 0;
                }
                #${ROOT_ID} .tw-casual-suggestion:hover,
                #${ROOT_ID} .tw-casual-suggestion:focus {
                    outline: none;
                    background: #fff1d0;
                }
                #${ROOT_ID} .tw-casual-suggestions-empty {
                    padding: 8px 10px;
                    font-size: 12px;
                    color: #6a5133;
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
                            <div class="tw-casual-autocomplete">
                                <input id="tw-casual-players" class="tw-casual-input" autocomplete="off" placeholder="PlayerOne, PlayerTwo">
                                <div id="tw-casual-player-suggestions" class="tw-casual-suggestions"></div>
                            </div>
                            <div class="tw-casual-hint">
                                Zadaj presne meno hraca. Viac mien mozes oddelit ciarkou.
                            </div>
                        </div>
                        <div class="tw-casual-card">
                            <label class="tw-casual-label" for="tw-casual-tribes">Kmen alebo tag (oddel ciarkou)</label>
                            <div class="tw-casual-autocomplete">
                                <input id="tw-casual-tribes" class="tw-casual-input" autocomplete="off" placeholder="TAG, Nazov kmena">
                                <div id="tw-casual-tribe-suggestions" class="tw-casual-suggestions"></div>
                            </div>
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

    function buildAutocompleteOptions(worldData) {
        const seenPlayers = new Set();
        const playerOptions = worldData.players
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((player) => cleanString(player.name))
            .filter((name) => {
                const key = normalize(name);
                if (!key || seenPlayers.has(key)) return false;
                seenPlayers.add(key);
                return true;
            });

        const seenTribes = new Set();
        const tribeOptions = [];

        worldData.tribes
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .forEach((tribe) => {
                [tribe.tag, tribe.name].forEach((label) => {
                    const value = cleanString(label);
                    const key = normalize(value);

                    if (!key || seenTribes.has(key)) return;

                    seenTribes.add(key);
                    tribeOptions.push(value);
                });
            });

        return {
            players: playerOptions,
            tribes: tribeOptions,
        };
    }

    function getAutocompleteMeta(type) {
        if (type === 'players') {
            return {
                inputSelector: '#tw-casual-players',
                suggestionsSelector: '#tw-casual-player-suggestions',
            };
        }

        return {
            inputSelector: '#tw-casual-tribes',
            suggestionsSelector: '#tw-casual-tribe-suggestions',
        };
    }

    function getAutocompleteState(value) {
        const currentValue = String(value || '');
        const lastCommaIndex = currentValue.lastIndexOf(',');

        if (lastCommaIndex === -1) {
            return {
                prefix: '',
                token: currentValue,
            };
        }

        return {
            prefix: currentValue.slice(0, lastCommaIndex),
            token: currentValue.slice(lastCommaIndex + 1),
        };
    }

    function buildCommaSeparatedValue(currentValue, pickedValue) {
        const { prefix } = getAutocompleteState(currentValue);
        const normalizedPrefix = prefix
            .split(',')
            .map((item) => cleanString(item))
            .filter(Boolean)
            .join(', ');

        return normalizedPrefix
            ? `${normalizedPrefix}, ${pickedValue}, `
            : `${pickedValue}, `;
    }

    function filterAutocompleteOptions(options, value) {
        const { token } = getAutocompleteState(value);
        const needle = normalize(token);

        if (!needle) {
            return options.slice(0, AUTOCOMPLETE_LIMIT);
        }

        const startsWithMatches = [];
        const containsMatches = [];

        options.forEach((option) => {
            const normalizedOption = normalize(option);

            if (normalizedOption.startsWith(needle)) {
                startsWithMatches.push(option);
            } else if (normalizedOption.includes(needle)) {
                containsMatches.push(option);
            }
        });

        return startsWithMatches
            .concat(containsMatches)
            .slice(0, AUTOCOMPLETE_LIMIT);
    }

    function closeAutocomplete(root, type) {
        const meta = getAutocompleteMeta(type);
        const suggestions = root.querySelector(meta.suggestionsSelector);

        if (!suggestions) return;

        suggestions.classList.remove('is-open');
        suggestions.innerHTML = '';
    }

    function closeAllAutocompletes(root) {
        closeAutocomplete(root, 'players');
        closeAutocomplete(root, 'tribes');
    }

    function renderAutocomplete(root, type, options, value) {
        const meta = getAutocompleteMeta(type);
        const suggestions = root.querySelector(meta.suggestionsSelector);
        const filteredOptions = filterAutocompleteOptions(options, value);

        if (!suggestions) return;

        if (!filteredOptions.length) {
            suggestions.innerHTML = '';
            suggestions.classList.remove('is-open');
            return;
        }

        suggestions.innerHTML = filteredOptions
            .map((option) => {
                return `
                    <button
                        type="button"
                        class="tw-casual-suggestion"
                        data-action="pick-suggestion"
                        data-target="${type}"
                        data-value="${escapeAttribute(option)}"
                    >${escapeHtml(option)}</button>
                `;
            })
            .join('');

        suggestions.classList.add('is-open');
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

    function bindEvents(root, worldData, indexes, autocompleteOptions) {
        const onKeyDown = function (event) {
            if (event.key === 'Escape') {
                destroy();
            }
        };

        window[SCRIPT_KEY].onKeyDown = onKeyDown;
        document.addEventListener('keydown', onKeyDown);

        root.addEventListener('input', (event) => {
            if (event.target && event.target.id === 'tw-casual-players') {
                renderAutocomplete(
                    root,
                    'players',
                    autocompleteOptions.players,
                    event.target.value
                );
                return;
            }

            if (event.target && event.target.id === 'tw-casual-tribes') {
                renderAutocomplete(
                    root,
                    'tribes',
                    autocompleteOptions.tribes,
                    event.target.value
                );
            }
        });

        root.addEventListener('focusin', (event) => {
            if (event.target && event.target.id === 'tw-casual-players') {
                renderAutocomplete(
                    root,
                    'players',
                    autocompleteOptions.players,
                    event.target.value
                );
                return;
            }

            if (event.target && event.target.id === 'tw-casual-tribes') {
                renderAutocomplete(
                    root,
                    'tribes',
                    autocompleteOptions.tribes,
                    event.target.value
                );
            }
        });

        root.addEventListener('click', async (event) => {
            const action = event.target && event.target.getAttribute('data-action');

            if (action === 'pick-suggestion') {
                const targetType = event.target.getAttribute('data-target');
                const pickedValue = cleanString(event.target.getAttribute('data-value'));
                const meta = getAutocompleteMeta(targetType);
                const input = root.querySelector(meta.inputSelector);

                if (input) {
                    input.value = buildCommaSeparatedValue(input.value, pickedValue);
                    renderAutocomplete(
                        root,
                        targetType,
                        autocompleteOptions[targetType],
                        input.value
                    );
                    input.focus();
                }

                return;
            }

            if (!event.target.closest('.tw-casual-autocomplete')) {
                closeAllAutocompletes(root);
            }

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
                closeAllAutocompletes(root);
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
        const autocompleteOptions = buildAutocompleteOptions(worldData);

        setLoading(root, false, 'Click to visit');
        renderStatus(root, [
            `<strong>Tvoje body:</strong> ${formatNumber(game_data.player.points)}`,
            `<strong>Povoleny rozsah:</strong> ${formatNumber(
                Math.floor(Number(game_data.player.points || 0) * 0.8)
            )} - ${formatNumber(Math.ceil(Number(game_data.player.points || 0) * 1.2))}`,
            'Data sveta su nacitane. Zadaj hracov alebo kmene a klikni na Generovat coordy.',
        ]);
        bindEvents(root, worldData, indexes, autocompleteOptions);
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
