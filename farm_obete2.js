/*
 * Local fixed variant of farm_obete.js
 * Fixes the invalid UNITS_TO_SEND block so the script can be evaluated.
 */

/*
 * Script Name: Clear Barbarian Walls
 * Version: v1.10.1-outgoing-info-only
 * Last Updated: 2026-07-16
 * Author: RedAlert
 * Author URL: https://twscripts.dev/
 * Mod: JawJaw
 * Local Fix: Codex (nearest source village by available units)
 */

var scriptData = {
    name: 'Clear Barbarian Walls',
    version: 'v1.10.1-outgoing-info-only',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/clear-barbarian-walls.286971/',
};

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false; // enable/disable debug mode
if (typeof UNITS_TO_SEND === 'undefined')
    UNITS_TO_SEND = {
        0: '&spy=1&light=6&ram=10&catapult=15',
        1: '&spy=1&light=6&ram=10&catapult=15',
        2: '&spy=1&light=6&ram=10&catapult=15',
        3: '&spy=1&light=6&ram=10&catapult=15',
        4: '&spy=1&light=6&ram=10&catapult=15',
        5: '&spy=1&light=6&ram=10&catapult=15',
        6: '&spy=1&light=6&ram=10&catapult=15',
        7: '&spy=1&light=6&ram=10&catapult=15',
        8: '&spy=1&light=6&ram=10&catapult=15',
        9: '&spy=1&light=6&ram=10&catapult=15',
        10: '&spy=1&light=6&ram=10&catapult=15',
        '?': '&spy=1&light=6&ram=10&catapult=15',
    };

// Globals
var ALLOWED_GAME_SCREENS = ['map']; // list of game screens where script can be executed
var COORDS_REGEX = /[0-9]{1,3}\|[0-9]{1,3}/g; // regex for coordinates

if (typeof TWMap === 'undefined') TWMap = {};
if ('TWMap' in window) mapOverlay = TWMap;

// Data Store Config
var STORAGE_KEY = 'RA_CBW_STORE'; // key for sessionStorage
var HIDDEN_TARGETS_STORAGE_PREFIX = 'RA_CBW_HIDDEN_TARGETS_V1';
var SOURCE_VILLAGES_CACHE_KEY = 'RA_CBW_SOURCE_VILLAGES_CACHE_V2';
var DEFAULT_STATE = {
    MAX_BARBARIANS: 100,
    MAX_FA_PAGES_TO_FETCH: 20,
};
var SOURCE_OVERVIEW_DELAY_MS = 800;
var SOURCE_OVERVIEW_CACHE_MS = 45000;
var SOURCE_OVERVIEW_REQUEST_RETRIES = 3;
var TARGET_SAFETY_REQUEST_DELAY_MS = 300;
var TARGET_SAFETY_REQUEST_RETRIES = 2;
var MAX_TARGETS_TO_OPEN_AT_ONCE = 10;
var OPEN_ALL_TARGETS_IN_PROGRESS = false;

// Translations
var translations = {
    en_DK: {
        'Clear Barbarian Walls': 'Clear Barbarian Walls',
        Help: 'Help',
        'This script requires PA and FA to be active!':
            'This script requires PA and FA to be active!',
        'Redirecting...': 'Redirecting...',
        'Fetching FA pages...': 'Fetching FA pages...',
        'Finished fetching FA pages!': 'Finished fetching FA pages!',
        Fetching: 'Fetching',
        'No barbarian villages found fitting the criteria!':
            'No barbarian villages found fitting the criteria!',
        Type: 'Type',
        Barbarian: 'Barbarian',
        Report: 'Report',
        Distance: 'Distance',
        'Source Village': 'Source Village',
        'Source Distance': 'Source Distance',
        'Planned Attacks': 'Planned Attacks',
        'Rams Left': 'Rams Left',
        'Cats Left': 'Cats Left',
        Wall: 'Wall',
        'Last Attack Time': 'Last Attack Time',
        Actions: 'Actions',
        Attack: 'Attack',
        'No source village': 'No source village',
        'No eligible source villages found!':
            'No eligible source villages found!',
        'Error preparing source villages!':
            'Error preparing source villages!',
        'Error loading farm pages!': 'Error loading farm pages!',
        'Error loading units overview!':
            'Error loading units overview!',
        'barbarian villages where found': 'barbarian villages where found',
        'Showing the first': 'Showing the first',
        'barbarian villages.': 'barbarian villages.',
        Settings: 'Settings',
        'Save Settings': 'Save Settings',
        'Maximum villages to show on the table':
            'Maximum villages to show on the table',
        'Maximum FA Pages to fetch': 'Maximum FA Pages to fetch',
        'Minimum Wall Level': 'Minimum Wall Level',
        'Settings saved!': 'Settings saved!',
        'Include reports with partial losses':
            'Include reports with partial losses',
        'Open all targets': 'Open all targets',
        'Opening targets...': 'Opening targets...',
        'Finished opening targets!': 'Finished opening targets!',
        Note: 'Note',
        'Outgoing attack': 'Outgoing attack',
        Yes: 'Yes',
        No: 'No',
        'Not verified': 'Not verified',
        Blocked: 'Blocked',
        'Blocked target': 'Blocked target',
        'Checking notes and outgoing attacks...':
            'Checking notes and outgoing attacks...',
        'Safety checks finished!': 'Safety checks finished!',
        'Skipped for safety': 'Skipped for safety',
        'Error loading outgoing attacks!':
            'Error loading outgoing attacks!',
        Hide: 'Hide',
        'Restore hidden': 'Restore hidden',
        'Hidden targets restored!': 'Hidden targets restored!',
        'Ready to attack': 'Ready to attack',
        'Attacks already going': 'Attacks already going',
        'Defense notes': 'Defense notes',
        Unverified: 'Unverified',
        Hidden: 'Hidden',
        'Open next 10': 'Open next 10',
        Remaining: 'remaining',
        'No targets left': 'No targets left',
        'Manage hidden': 'Manage hidden',
        Restore: 'Restore',
        'Restore all': 'Restore all',
        'No hidden targets': 'No hidden targets',
    },
    sk_SK: {
        Note: 'Poznámka',
        'Outgoing attack': 'Útok už ide',
        Yes: 'Áno',
        No: 'Nie',
        'Not verified': 'Neoverené',
        Blocked: 'Blokované',
        'Blocked target': 'Blokovaný cieľ',
        'Checking notes and outgoing attacks...':
            'Kontrolujem poznámky a odchádzajúce útoky...',
        'Safety checks finished!': 'Bezpečnostná kontrola dokončená!',
        'Skipped for safety': 'Vynechané kvôli bezpečnosti',
        'Error loading outgoing attacks!':
            'Nepodarilo sa načítať odchádzajúce útoky!',
        Hide: 'Skryť',
        'Restore hidden': 'Obnoviť skryté',
        'Hidden targets restored!': 'Skryté ciele boli obnovené!',
        'Ready to attack': 'Pripravené na útok',
        'Attacks already going': 'Už sa na ne útočí',
        'Defense notes': 'Označené deff',
        Unverified: 'Neoverené',
        Hidden: 'Ručne skryté',
        'Open next 10': 'Otvoriť ďalších 10',
        Remaining: 'zostáva',
        'No targets left': 'Žiadne ďalšie ciele',
        'Manage hidden': 'Spravovať skryté',
        Restore: 'Obnoviť',
        'Restore all': 'Obnoviť všetky',
        'No hidden targets': 'Žiadne skryté ciele',
    },
};

// Init Debug
initDebug();

// Initialize script logic
async function initClearBarbarianWalls(store) {
    try {
        const { MAX_BARBARIANS, MAX_FA_PAGES_TO_FETCH } = store;
        const faURLs = await fetchFAPages(MAX_FA_PAGES_TO_FETCH);
        const sourceVillages = await fetchOwnSourceVillages();

        if (!sourceVillages.length) {
            UI.ErrorMessage(tt('No eligible source villages found!'));
        }

        // Show progress bar and notify user
        startProgressBar(faURLs.length);
        UI.SuccessMessage(tt('Fetching FA pages...'));

        const faPages = [];
        jQuery.fetchAll(
            faURLs,
            function (index, data) {
                updateProgressBar(index, faURLs.length);
                const { plunder_list } = data;
                faPages.push(...plunder_list);
            },
            async function () {
                try {
                const faTableRows = getFATableRows(faPages);
                const maxBarbarians = Math.max(
                    0,
                    parseInt(MAX_BARBARIANS, 10) || 0
                );
                const allBarbarians = getFABarbarians(faTableRows);
                updateHiddenTargetCoords(allBarbarians);
                const hiddenTargetIds = readHiddenTargetIds();
                const rawBarbarians = allBarbarians
                    .filter(
                        (barbarian) =>
                            !hiddenTargetIds.has(String(barbarian.villageId))
                    )
                    .slice(0, maxBarbarians);

                UI.InfoMessage(tt('Checking notes and outgoing attacks...'));
                const safetyCheckedBarbarians =
                    await enrichBarbariansWithSafetyData(rawBarbarians);
                const barbarians = getSafetyAwareBarbarianAssignments(
                    safetyCheckedBarbarians,
                    sourceVillages
                );
                const visibleBarbarians = sortBarbariansForDisplay(barbarians);

                const content = prepareContent(
                    visibleBarbarians,
                    MAX_BARBARIANS
                );
                renderUI(content);
                jQuery('#barbVillagesCount').text(visibleBarbarians.length);
                UI.SuccessMessage(tt('Safety checks finished!'));

                updateMap(visibleBarbarians);

                // event handlers
                showSettingsPanel(store);
                bindOpenAllTargetsButton();
                bindAttackButtons();
                bindHiddenTargetButtons();
                bindManageHiddenTargetsButton();
                } catch (error) {
                    UI.ErrorMessage(
                        `${tt('Error preparing source villages!')} ${
                            error.message || error
                        }`
                    );
                    console.error(`${scriptInfo()} Safety check error:`, error);
                }
            },
            function (error) {
                UI.ErrorMessage('Error fetching FA pages!');
                console.error(`${scriptInfo()} Error:`, error);
            }
        );
    } catch (error) {
        UI.ErrorMessage(
            `${tt('Error preparing source villages!')} ${error.message || error}`
        );
        console.error(`${scriptInfo()} Error:`, error);
    }
}

function updateMap(barbarians) {
    const barbCoords = barbarians.map((barbarian) => barbarian.coord);
    if (mapOverlay.mapHandler._spawnSector) {
    } else {
        mapOverlay.mapHandler._spawnSector = mapOverlay.mapHandler.spawnSector;
    }

    TWMap.mapHandler.spawnSector = function (data, sector) {
        mapOverlay.mapHandler._spawnSector(data, sector);
        var beginX = sector.x - data.x;
        var endX = beginX + mapOverlay.mapSubSectorSize;
        var beginY = sector.y - data.y;
        var endY = beginY + mapOverlay.mapSubSectorSize;
        for (var x in data.tiles) {
            var x = parseInt(x, 10);
            if (x < beginX || x >= endX) continue;
            for (var y in data.tiles[x]) {
                var y = parseInt(y, 10);
                if (y < beginY || y >= endY) continue;
                var xCoord = data.x + x;
                var yCoord = data.y + y;
                var v = mapOverlay.villages[xCoord * 1000 + yCoord];
                if (v) {
                    var vXY = '' + v.xy;
                    var vCoords = vXY.slice(0, 3) + '|' + vXY.slice(3, 6);
                    if (barbCoords.includes(vCoords)) {
                        const currentBarbarian = barbarians.find(
                            (obj) => obj.villageId == v.id
                        );

                        const eleDIV = $('<div></div>')
                            .css({
                                border: '1px coral solid',
                                position: 'absolute',
                                backgroundColor: '#000',
                                color: '#fff',
                                width: '30px',
                                height: '15px',
                                marginTop: '20px',
                                marginLeft: '10px',
                                display: 'block',
                                zIndex: '10',
                                fontWeight: 'normal',
                                textAlign: 'center',
                            })
                            .attr('id', 'dsm' + v.id)
                            .html(currentBarbarian.wall);

                        sector.appendElement(
                            eleDIV[0],
                            data.x + x - sector.x,
                            data.y + y - sector.y
                        );
                    }
                }
            }
        }
    };

    mapOverlay.reload();
}

function prepareContent(villages, maxBarbsToShow) {
    const hiddenTargetsControls = buildHiddenTargetsControls();
    const safetySummary = buildSafetySummary(villages);
    const remainingTargets = villages.filter(
        (village) => !village.safetyBlocked && village.sourceVillage
    ).length;

    if (villages.length) {
        const barbsTable = buildBarbsTable(villages, maxBarbsToShow);
        var content = `
			<div>
				<p>
					<b><span id="barbVillagesCount"></span> ${tt(
                        'barbarian villages where found'
                    )}</b><br>
					<em>${tt('Showing the first')} ${maxBarbsToShow} ${tt(
            'barbarian villages.'
        )}</em>
				</p>
			</div>
            ${safetySummary}
            <div class="ra-table-container">
                ${barbsTable}
            </div>
            <div class="ra-open-targets-controls">
                <a href="javascript:void(0);" id="openAllTargetsBtn" class="btn">
                    ${formatOpenTargetsButtonText(remainingTargets)}
                </a>
                <span id="openAllTargetsStatus"></span>
            </div>
            ${hiddenTargetsControls}
        `;

        return content;
    } else {
        return `${safetySummary}<b>${tt(
            'No barbarian villages found fitting the criteria!'
        )}</b>${hiddenTargetsControls}`;
    }
}

function buildSafetySummary(villages) {
    const summary = {
        ready: villages.filter(
            (village) => !village.safetyBlocked && village.sourceVillage
        ).length,
        outgoing: villages.filter(
            (village) => village.outgoingAttackStatus === 'present'
        ).length,
        defense: villages.filter(
            (village) =>
                village.noteStatus === 'present' && isDefenseNote(village.note)
        ).length,
        unverified: villages.filter(
            (village) =>
                village.noteStatus === 'unknown' ||
                village.outgoingAttackStatus === 'unknown'
        ).length,
        hidden: readHiddenTargetIds().size,
    };

    return `
        <div class="ra-safety-summary">
            <span><b>${tt('Ready to attack')}:</b> <span id="summaryReadyCount">${summary.ready}</span></span>
            <span><b>${tt('Attacks already going')}:</b> <span id="summaryOutgoingCount">${summary.outgoing}</span></span>
            <span><b>${tt('Defense notes')}:</b> <span id="summaryDefenseCount">${summary.defense}</span></span>
            <span><b>${tt('Unverified')}:</b> <span id="summaryUnverifiedCount">${summary.unverified}</span></span>
            <span><b>${tt('Hidden')}:</b> <span id="summaryHiddenCount">${summary.hidden}</span></span>
        </div>
    `;
}

function formatOpenTargetsButtonText(remainingTargets) {
    if (!remainingTargets) return tt('No targets left');
    return `${tt('Open next 10')} (${tt('Remaining')}: ${remainingTargets})`;
}

function buildHiddenTargetsControls() {
    const hiddenTargetsCount = readHiddenTargetIds().size;
    const disabledClass = hiddenTargetsCount ? '' : ' btn-disabled';

    return `
        <div class="ra-hidden-targets-controls">
            <a href="javascript:void(0);" id="manageHiddenTargetsBtn" class="btn${disabledClass}">
                ${tt('Manage hidden')} (${hiddenTargetsCount})
            </a>
        </div>
    `;
}

function sortBarbariansForDisplay(barbarians) {
    return [...barbarians].sort((left, right) => {
        const getPriority = (barbarian) => {
            if (!barbarian.safetyBlocked && barbarian.sourceVillage) return 0;
            if (!barbarian.safetyBlocked) return 1;
            return 2;
        };

        return getPriority(left) - getPriority(right);
    });
}

function renderUI(body) {
    const content = `
        <div class="ra-clear-barbs-walls" id="raClearBarbWalls">
			<div class="ra-clear-barbs-walls-header">
				<h3>${tt(scriptData.name)}</h3>
				<a href="javascript:void(0);" id="showSettingsPanel" class="btn-show-settings">
					<span class="icon header settings"></span>
				</a>
			</div>
            <div class="ra-clear-barbs-walls-body">
                ${body}
            </div>
			<div class="ra-clear-barbs-walls-footer">
				<small>
					<strong>
						${tt(scriptData.name)} ${scriptData.version}
					</strong> -
					<a href="${scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">
						${scriptData.author}
					</a> -
					<a href="${scriptData.helpLink}" target="_blank" rel="noreferrer noopener">
						${tt('Help')}
					</a>
				</small>
			</div>
        </div>
        <style>
            .ra-clear-barbs-walls { position: relative; display: block; width: 100%; height: auto; clear: both; margin: 10px 0 15px; border: 1px solid #603000; box-sizing: border-box; background: #f4e4bc; }
            .ra-clear-barbs-walls * { box-sizing: border-box; }
			.ra-clear-barbs-walls > div { padding: 10px; }
            .ra-clear-barbs-walls .btn-confirm-yes { padding: 3px; }
			.ra-clear-barbs-walls-header { display: flex; align-items: center; justify-content: space-between; background-color: #c1a264 !important; background-image: url(/graphic/screen/tableheader_bg3.png); background-repeat: repeat-x; }
			.ra-clear-barbs-walls-header h3 { margin: 0; padding: 0; line-height: 1; }
			.ra-clear-barbs-walls-body p { font-size: 14px; }
            .ra-clear-barbs-walls-body label { display: block; font-weight: 600; margin-bottom: 6px; }
			.ra-table-container { overflow-y: auto; overflow-x: hidden; height: auto; max-height: 312px;border: 1px solid #bc6e1f; }
			.ra-table th { font-size: 14px; }
			.ra-table th,
            .ra-table td { padding: 3px; text-align: center; }
            .ra-table td a { word-break: break-all; }
			.ra-table a:focus { color: blue; }
			.ra-table a.btn:focus { color: #fff; }
			.ra-table tr:nth-of-type(2n) td { background-color: #f0e2be }
			.ra-table tr:nth-of-type(2n+1) td { background-color: #fff5da; }
			.ra-popup-content { width: 360px; }
			.ra-popup-content * { box-sizing: border-box; }
            .ra-popup-content input[type="text"] { padding: 3px; width: 100%; }
            .ra-mb15 { margin-bottom: 15px; }
            .ra-open-targets-controls { margin-top: 10px; display: flex; align-items: center; gap: 8px; }
            .ra-hidden-targets-controls { margin-top: 8px; }
            .ra-safety-summary { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 10px; padding: 7px; border: 1px solid #bc6e1f; background: #fff5da; }
            .ra-hidden-targets-table td, .ra-hidden-targets-table th { padding: 4px 8px; }
            .ra-hide-target-btn { display: inline-block; margin-top: 4px; color: #8b1a1a; font-size: 11px; }
            #openAllTargetsStatus { font-weight: 600; }
            .already-sent-command { opacity: 0.6; }
            .ra-safety-blocked td { background-color: #f3c6c0 !important; }
            .ra-safety-warning { display: inline-block; padding: 2px 5px; border-radius: 3px; background: #b92323; color: #fff; font-weight: 700; }
            .ra-safety-ok { color: #2b6b22; font-weight: 700; }
            .ra-safety-unknown { display: inline-block; padding: 2px 5px; border-radius: 3px; background: #d48600; color: #fff; font-weight: 700; }
            .ra-note-preview { display: block; max-width: 220px; margin-top: 3px; white-space: normal; overflow-wrap: anywhere; text-align: left; }
        </style>
    `;

    if (jQuery('#raClearBarbWalls').length < 1) {
        jQuery('#contentContainer').prepend(content);
    } else {
        jQuery('.ra-clear-barbs-walls-body').html(body);
    }
}

function showSettingsPanel(store) {
    jQuery('#showSettingsPanel').on('click', function (e) {
        e.preventDefault();

        const { MAX_BARBARIANS, MAX_FA_PAGES_TO_FETCH } = store;

        const content = `
			<div class="ra-popup-content">
				<div class="ra-popup-header">
					<h3>${tt('Settings')}</h3>
				</div>
				<div class="ra-popup-body ra-mb15">
					<table class="ra-settings-table" width=100%">
						<tbody>
							<tr>
								<td width="80%">
									<label for="maxBarbVillages">
										${tt('Maximum villages to show on the table')}
									</label>
								</td>
								<td width="30%">
									<input type="text" name="max_barb_villages" id="maxBarbVillages" value="${MAX_BARBARIANS}" />
								</td>
							</tr>
							<tr>
								<td width="80%">
									<label for="maxFApages">
										${tt('Maximum FA Pages to fetch')}
									</label>
								</td>
								<td width="30%">
									<input type="text" name="max_fa_pages" id="maxFApages" value="${MAX_FA_PAGES_TO_FETCH}" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="ra-popup-footer">
					<a href="javascript:void(0);" id="saveSettingsBtn" class="btn btn-confirm-yes">
						${tt('Save Settings')}
					</a>
				</div>
			</div>
		`;

        Dialog.show('SettingsPanel', content);

        saveSettings();
    });
}

function bindOpenAllTargetsButton() {
    jQuery('#openAllTargetsBtn').off('click').on('click', function (e) {
        e.preventDefault();
        openGeneratedTargets();
    });
}

function bindAttackButtons() {
    jQuery('.ra-clear-barb-wall-btn')
        .off('click')
        .on('click', function (e) {
            e.preventDefault();

            if (this.classList.contains('btn-already-sent')) {
                return;
            }

            highlightOpenedCommands(this);
            openCommandInCurrentTab(this.href);
        });
}

function bindHiddenTargetButtons() {
    jQuery('.ra-hide-target-btn')
        .off('click')
        .on('click', function (e) {
            e.preventDefault();

            const villageId = String(jQuery(this).data('village-id') || '');
            const coord = String(jQuery(this).data('coord') || '');
            if (!villageId) return;

            addHiddenTarget(villageId, coord);
            const row = this.closest('tr');
            if (row) row.remove();

            renumberBarbarianRows();
            updateVisibleBarbarianCount();
            updateManageHiddenTargetsButton();
            updateSafetySummaryFromTable();
            updateOpenTargetsButtonState();
        });
}

function bindManageHiddenTargetsButton() {
    jQuery('#manageHiddenTargetsBtn')
        .off('click')
        .on('click', function (e) {
            e.preventDefault();
            if (!readHiddenTargetIds().size) return;
            showHiddenTargetsDialog();
        });
}

function showHiddenTargetsDialog() {
    const hiddenTargets = readHiddenTargets();
    const rows = Array.from(hiddenTargets.values())
        .sort((left, right) => left.coord.localeCompare(right.coord))
        .map(
            (target) => `
                <tr data-hidden-village-id="${escapeHtml(target.id)}">
                    <td>${escapeHtml(target.coord || `ID ${target.id}`)}</td>
                    <td><a href="javascript:void(0);" class="btn ra-restore-one-target" data-village-id="${escapeHtml(
                        target.id
                    )}">${tt('Restore')}</a></td>
                </tr>
            `
        )
        .join('');

    const content = `
        <div class="ra-popup-content">
            <table class="vis ra-hidden-targets-table" width="100%">
                <thead><tr><th>${tt('Barbarian')}</th><th>${tt('Actions')}</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:10px;">
                <a href="javascript:void(0);" id="restoreAllHiddenTargetsBtn" class="btn">${tt(
                    'Restore all'
                )}</a>
            </div>
        </div>
    `;

    Dialog.show('HiddenTargets', content);

    jQuery('.ra-restore-one-target').on('click', function (e) {
        e.preventDefault();
        const villageId = String(jQuery(this).data('village-id') || '');
        if (!villageId) return;

        removeHiddenTargetId(villageId);
        const row = this.closest('tr');
        if (row) row.remove();
        updateManageHiddenTargetsButton();
        updateSafetySummaryFromTable();

        if (!readHiddenTargetIds().size) {
            jQuery('.ra-hidden-targets-table tbody').html(
                `<tr><td colspan="2">${tt('No hidden targets')}</td></tr>`
            );
        }
    });

    jQuery('#restoreAllHiddenTargetsBtn').on('click', function (e) {
        e.preventDefault();
        clearHiddenTargetIds();
        jQuery('.ra-hidden-targets-table tbody').html(
            `<tr><td colspan="2">${tt('No hidden targets')}</td></tr>`
        );
        updateManageHiddenTargetsButton();
        updateSafetySummaryFromTable();
        UI.SuccessMessage(tt('Hidden targets restored!'));
    });
}

function renumberBarbarianRows() {
    document.querySelectorAll('.ra-table tbody tr').forEach((row, index) => {
        const firstCell = row.querySelector('td');
        if (firstCell) firstCell.textContent = String(index + 1);
    });
}

function updateVisibleBarbarianCount() {
    const countElement = document.querySelector('#barbVillagesCount');
    if (!countElement) return;

    countElement.textContent = String(
        document.querySelectorAll('.ra-table tbody tr').length
    );
}

function updateManageHiddenTargetsButton() {
    const button = document.querySelector('#manageHiddenTargetsBtn');
    if (!button) return;

    const hiddenTargetsCount = readHiddenTargetIds().size;
    button.textContent = `${tt('Manage hidden')} (${hiddenTargetsCount})`;
    button.classList.toggle('btn-disabled', hiddenTargetsCount === 0);
}

function updateSafetySummaryFromTable() {
    const rows = Array.from(document.querySelectorAll('.ra-table tbody tr'));
    const setCount = (elementId, dataKey) => {
        const element = document.querySelector(`#${elementId}`);
        if (!element) return;
        element.textContent = String(
            rows.filter((row) => row.dataset[dataKey] === '1').length
        );
    };

    setCount('summaryReadyCount', 'ready');
    setCount('summaryOutgoingCount', 'outgoing');
    setCount('summaryDefenseCount', 'defense');
    setCount('summaryUnverifiedCount', 'unverified');

    const hiddenCountElement = document.querySelector('#summaryHiddenCount');
    if (hiddenCountElement) {
        hiddenCountElement.textContent = String(readHiddenTargetIds().size);
    }
}

function openGeneratedTargets() {
    if (OPEN_ALL_TARGETS_IN_PROGRESS) return;

    const links = getRemainingTargetLinks().slice(
        0,
        MAX_TARGETS_TO_OPEN_AT_ONCE
    );
    const button = document.querySelector('#openAllTargetsBtn');
    const status = document.querySelector('#openAllTargetsStatus');

    if (!links.length) {
        updateOpenTargetsButtonState();
        return;
    }

    if (button) {
        button.classList.add('btn-disabled');
        button.textContent = tt('Opening targets...');
    }
    OPEN_ALL_TARGETS_IN_PROGRESS = true;

    links.forEach((link, index) => {
        openCommandInNewTab(link.href, index);
        highlightOpenedCommands(link);

        if (status) {
            status.textContent = `${index + 1}/${links.length}`;
        }
    });

    OPEN_ALL_TARGETS_IN_PROGRESS = false;

    if (button) {
        button.classList.remove('btn-disabled');
    }
    updateOpenTargetsButtonState();
}

function getRemainingTargetLinks() {
    return Array.from(
        document.querySelectorAll('.ra-clear-barb-wall-btn')
    ).filter((link) => !link.classList.contains('btn-already-sent'));
}

function updateOpenTargetsButtonState() {
    const button = document.querySelector('#openAllTargetsBtn');
    if (!button) return;

    const remainingTargets = getRemainingTargetLinks().length;
    button.textContent = formatOpenTargetsButtonText(remainingTargets);
    button.classList.toggle('btn-disabled', remainingTargets === 0);
}

function saveSettings() {
    jQuery('#saveSettingsBtn').on('click', function (e) {
        e.preventDefault();

        const maxBarbVillages = jQuery('#maxBarbVillages').val();
        const maxFApages = jQuery('#maxFApages').val();

        const data = {
            MAX_BARBARIANS: maxBarbVillages,
            MAX_FA_PAGES_TO_FETCH: maxFApages,
        };

        writeStorage(data, readStorage(DEFAULT_STATE));
        UI.SuccessMessage(tt('Settings saved!'), 1000);
        initClearBarbarianWalls(data);
    });
}

function buildBarbsTable(villages, maxBarbsToShow) {
    villages = villages.slice(0, maxBarbsToShow);

    let barbsTable = `
		<table class="ra-table" width="100%">
			<thead>
				<tr>
					<th>#</th>
					<th>${tt('Type')}</th>
					<th>${tt('Barbarian')}</th>
					<th>${tt('Report')}</th>
					<th>${tt('Distance')}</th>
					<th>${tt('Source Village')}</th>
					<th>${tt('Note')}</th>
					<th>${tt('Outgoing attack')}</th>
					<th>${tt('Wall')}</th>
					<th>${tt('Last Attack Time')}</th>
					<th>${tt('Actions')}</th>
				</tr>
			</thead>
			<tbody>
	`;

    villages.forEach((village, index) => {
        index++;
        const {
            villageId,
            coord,
            wall,
            reportId,
            reportTime,
            type,
            distance,
            sourceVillage,
            sourceDistance,
            safetyBlocked,
            noteStatus,
            note,
            outgoingAttackStatus,
            outgoingAttacks,
        } = village;

        const unitsToSend = calculateUnitsToSend(wall);

        const villageUrl = `${game_data.link_base_pure}info_village&id=${villageId}`;
        const reportUrl = `${game_data.link_base_pure}report&mode=all&view=${reportId}`;
        const sourceVillageUrl = sourceVillage
            ? `${game_data.link_base_pure}info_village&id=${sourceVillage.id}`
            : null;
        const commandUrl = sourceVillage && !safetyBlocked
            ? buildCommandUrl(sourceVillage.id, villageId, unitsToSend, wall)
            : null;
        const sourceVillageHtml = safetyBlocked
            ? '<span aria-label="blocked">—</span>'
            : sourceVillage
            ? `<a href="${sourceVillageUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                  sourceVillage.name
              )} (${sourceVillage.coord})</a><br><small>${tt(
                  'Source Distance'
              )}: ${formatDistanceValue(sourceDistance)}</small><br><small>${tt(
                  'Planned Attacks'
              )}: ${sourceVillage.plannedCommands} | ${tt(
                  'Rams Left'
              )}: ${getVillageUnitAmount(sourceVillage.units, 'ram')} | ${tt(
                  'Cats Left'
              )}: ${getVillageUnitAmount(sourceVillage.units, 'catapult')}</small>`
            : `<span style="color:red;">${tt('No source village')}</span>`;
        const noteHtml = buildNoteSafetyHtml(noteStatus, note);
        const outgoingAttackHtml = buildOutgoingAttackSafetyHtml(
            outgoingAttackStatus,
            outgoingAttacks
        );
        const actionHtml = commandUrl
            ? `<a href="${commandUrl}" class="ra-clear-barb-wall-btn btn" target="_self" rel="noopener noreferrer">${tt(
                  'Attack'
              )}</a>`
            : safetyBlocked
            ? `<span class="btn btn-disabled" title="${tt(
                  'Blocked target'
              )}">${tt('Blocked')}</span>`
            : `<span class="btn btn-disabled">${tt('Attack')}</span>`;
        const hideTargetHtml = `<br><a href="javascript:void(0);" class="ra-hide-target-btn" data-village-id="${villageId}" data-coord="${escapeHtml(
            coord
        )}">${tt(
            'Hide'
        )}</a>`;

        const isUnverified =
            noteStatus === 'unknown' || outgoingAttackStatus === 'unknown';
        const hasDefenseNote =
            noteStatus === 'present' && isDefenseNote(note);

        barbsTable += `
			<tr class="${safetyBlocked ? 'ra-safety-blocked' : ''}" data-ready="${
            commandUrl ? '1' : '0'
        }" data-outgoing="${
            outgoingAttackStatus === 'present' ? '1' : '0'
        }" data-defense="${hasDefenseNote ? '1' : '0'}" data-unverified="${
            isUnverified ? '1' : '0'
        }">
				<td>${index}</td>
				<td><img src="${type}"></td>
				<td><a href="${villageUrl}" target="_blank" rel="noopener noreferrer">${coord}</a></td>
				<td><a href="${reportUrl}" target="_blank" rel="noopener noreferrer"><span class="icon header new_report"></span></a></td>
				<td>${distance}</td>
				<td>${sourceVillageHtml}</td>
				<td>${noteHtml}</td>
				<td>${outgoingAttackHtml}</td>
				<td>${wall !== '?' ? wall : '<b style="color:red;">?</b>'}</td>
				<td>${reportTime}</td>
				<td>${actionHtml}${hideTargetHtml}</td>
			</tr>
		`;
    });

    barbsTable += `
			</tbody>
		</table>
	`;

    return barbsTable;
}

function buildNoteSafetyHtml(noteStatus, note) {
    if (noteStatus === 'present') {
        const safeNote = escapeHtml(note);
        return `<span class="ra-safety-warning" title="${safeNote}">${tt(
            'Yes'
        )}</span><small class="ra-note-preview">${escapeHtml(
            truncateText(note, 120)
        )}</small>`;
    }

    if (noteStatus === 'none') {
        return `<span class="ra-safety-ok">${tt('No')}</span>`;
    }

    return `<span class="ra-safety-unknown">${tt('Not verified')}</span>`;
}

function buildOutgoingAttackSafetyHtml(status, outgoingAttacks) {
    if (status === 'present') {
        const attacks = Array.isArray(outgoingAttacks) ? outgoingAttacks : [];
        const title = escapeHtml(attacks.join('\n'));
        return `<span class="ra-safety-warning" title="${title}">${tt(
            'Yes'
        )} (${attacks.length})</span>`;
    }

    if (status === 'none') {
        return `<span class="ra-safety-ok">${tt('No')}</span>`;
    }

    return `<span class="ra-safety-unknown">${tt('Not verified')}</span>`;
}

function truncateText(value, maxLength) {
    const normalizedValue = String(value || '').replace(/\s+/g, ' ').trim();
    return normalizedValue.length > maxLength
        ? `${normalizedValue.slice(0, maxLength - 1)}…`
        : normalizedValue;
}

function highlightOpenedCommands(element) {
    element.classList.add('btn-confirm-yes');
    element.classList.add('btn-already-sent');
    element.parentElement.parentElement.classList.add('already-sent-command');
}

function openCommandInCurrentTab(url) {
    window.location.assign(url);
}

function openCommandInNewTab(url, index) {
    const windowName = `raClearBarbWall_${Date.now()}_${index}`;
    return window.open(url, windowName, 'noopener,noreferrer');
}

async function fetchFAPages(maxFAPagesToFetch) {
    try {
        const response = await jQuery.get(game_data.link_base_pure + 'am_farm');
        const htmlDoc = jQuery.parseHTML(response);
        const plunderListNav = jQuery(htmlDoc).find('#plunder_list_nav:eq(0) a');
        const firstFApage =
            game_data.link_base_pure +
            `am_farm&ajax=page_entries&Farm_page=0&class=&extended=1`;

        const faPageURLs = [firstFApage];
        jQuery(plunderListNav).each(function (index) {
            index++;
            if (index <= maxFAPagesToFetch - 1) {
                const currentPageNumber = parseInt(
                    getParameterByName(
                        'Farm_page',
                        window.location.origin + jQuery(this).attr('href')
                    ),
                    10
                );

                if (!Number.isNaN(currentPageNumber)) {
                    faPageURLs.push(
                        game_data.link_base_pure +
                            `am_farm&ajax=page_entries&Farm_page=${currentPageNumber}&class=&extended=1&order=distance&dir=asc`
                    );
                }
            }
        });

        if (!faPageURLs.length) {
            throw new Error(tt('Error loading farm pages!'));
        }

        return faPageURLs;
    } catch (error) {
        throw new Error(
            `${tt('Error loading farm pages!')} ${error.message || error}`
        );
    }
}

function getFATableRows(pages) {
    let barbariansText = '';
    pages.forEach((page) => {
        barbariansText += page;
    });
    return jQuery.parseHTML(barbariansText);
}

function getFABarbarians(rows) {
    let barbarians = [];

    rows.forEach((row) => {
        let shouldAdd = false;

        let villageId = parseInt(
            getParameterByName(
                'target',
                window.location.origin +
                    jQuery(row).find('td').last().find('a').attr('href')
            )
        );
        let coord = jQuery(row)
            .find('td:eq(3) a')
            .text()
            .match(COORDS_REGEX)[0];
        let wall = jQuery(row).find('td:eq(6)').text();
        let distance = jQuery(row).find('td:eq(7)').text().trim();
        let reportId = parseInt(
            getParameterByName(
                'view',
                window.location.origin +
                    jQuery(row).find('td:eq(3) a').attr('href')
            )
        );
        let reportTime = jQuery(row).find('td:eq(4)').text().trim();
        let type = jQuery(row).find('td:eq(1) img').attr('src');

        const isGreenReportWithUnknownWall =
            wall === '?' && type.includes('green.webp');

        if (parseInt(wall) > 0 || wall === '?') {
            shouldAdd = true;
            if (isGreenReportWithUnknownWall) {
                shouldAdd = false;
            }
        }

        if (shouldAdd) {
            barbarians.push({
                villageId: villageId,
                coord: coord,
                distance: distance,
                wall: wall,
                reportId: reportId,
                reportTime: reportTime,
                type: type,
            });
        }
    });

    return barbarians;
}

async function enrichBarbariansWithSafetyData(barbarians) {
    const [notesByVillageId, outgoingAttackResult] = await Promise.all([
        fetchVillageNotes(barbarians),
        fetchOutgoingAttackTargets(),
    ]);

    return barbarians.map((barbarian) => {
        const noteResult = notesByVillageId.get(barbarian.villageId) || {
            status: 'unknown',
            note: '',
        };
        const outgoingAttacks = outgoingAttackResult.verified
            ? outgoingAttackResult.targets.get(barbarian.coord) || []
            : [];
        const outgoingAttackStatus = outgoingAttackResult.verified
            ? outgoingAttacks.length
                ? 'present'
                : 'none'
            : 'unknown';
        const safetyBlocked = isSafetyBlocked(
            noteResult.status,
            noteResult.note
        );

        return {
            ...barbarian,
            noteStatus: noteResult.status,
            note: noteResult.note,
            outgoingAttackStatus: outgoingAttackStatus,
            outgoingAttacks: outgoingAttacks,
            safetyBlocked: safetyBlocked,
        };
    });
}

async function fetchVillageNotes(barbarians) {
    const notesByVillageId = new Map();

    for (let index = 0; index < barbarians.length; index++) {
        if (index > 0) {
            await waitForOverviewRequestSlot(TARGET_SAFETY_REQUEST_DELAY_MS);
        }

        const barbarian = barbarians[index];

        try {
            const villageInfoHtml = await fetchVillageInfoPage(
                barbarian.villageId
            );
            const note = extractVillageNoteFromHtml(villageInfoHtml);
            notesByVillageId.set(barbarian.villageId, {
                status: note ? 'present' : 'none',
                note: note,
            });
        } catch (error) {
            notesByVillageId.set(barbarian.villageId, {
                status: 'unknown',
                note: '',
            });
            console.error(
                `${scriptInfo()} Note check failed for ${barbarian.coord}:`,
                error
            );
        }
    }

    return notesByVillageId;
}

async function fetchVillageInfoPage(villageId) {
    const url = `${game_data.link_base_pure}info_village&id=${villageId}`;
    let lastError = null;

    for (
        let attemptIndex = 0;
        attemptIndex < TARGET_SAFETY_REQUEST_RETRIES;
        attemptIndex++
    ) {
        try {
            if (attemptIndex > 0) {
                await waitForOverviewRequestSlot(
                    TARGET_SAFETY_REQUEST_DELAY_MS * (attemptIndex + 1)
                );
            }

            return await jQuery.get(url);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Village info request failed');
}

function extractVillageNoteFromHtml(html) {
    const htmlDoc = parseHtml(html);
    const noteInputSelectors = [
        'textarea#message',
        'textarea[name="message"]',
        'textarea[name="note"]',
        'textarea[name="notes"]',
        'textarea[id="note"]',
        'textarea[id="notes"]',
        'textarea[id="village_note"]',
        'textarea[id="village_notes"]',
        '#edit_notes textarea',
        '#village_note textarea',
        '#village_notes textarea',
    ];

    for (let index = 0; index < noteInputSelectors.length; index++) {
        const noteInput = htmlDoc.querySelector(noteInputSelectors[index]);
        const note = normalizeNoteText(
            noteInput ? noteInput.value || noteInput.textContent : ''
        );

        if (note) {
            return note;
        }
    }

    const noteDisplaySelectors = [
        '#info_village_note',
        '#info_village_notes',
        '#notes',
    ];

    for (let index = 0; index < noteDisplaySelectors.length; index++) {
        const noteElement = htmlDoc.querySelector(noteDisplaySelectors[index]);
        if (!noteElement || noteElement.matches('textarea, input')) continue;

        const note = normalizeNoteText(noteElement.textContent);
        if (note) {
            return note;
        }
    }

    return '';
}

function normalizeNoteText(value) {
    return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function isDefenseNote(note) {
    return /deff/i.test(String(note || ''));
}

function isSafetyBlocked(noteStatus, note) {
    return (
        noteStatus === 'unknown' ||
        (noteStatus === 'present' && isDefenseNote(note))
    );
}

async function fetchOutgoingAttackTargets() {
    const url =
        game_data.link_base_pure +
        'overview_villages&mode=commands&type=attack&page=-1';

    try {
        const html = await jQuery.get(url);
        const htmlDoc = parseHtml(html);
        const targets = new Map();
        const commandRows = htmlDoc.querySelectorAll(
            '#commands_table tr.row_a, #commands_table tr.row_ax, #commands_table tr.row_b, #commands_table tr.row_bx'
        );

        commandRows.forEach((row) => {
            const targetLabel = row.querySelector('.quickedit-label');
            const coordMatch = String(
                targetLabel ? targetLabel.textContent : row.textContent
            ).match(COORDS_REGEX);

            if (!coordMatch || !coordMatch[0]) return;

            const coord = coordMatch[0];
            const cells = row.querySelectorAll('td');
            const arrivalText = cells.length > 2
                ? String(cells[2].textContent || '').trim()
                : '';
            const commandDescription = arrivalText
                ? `${coord} – ${arrivalText}`
                : coord;

            if (!targets.has(coord)) {
                targets.set(coord, []);
            }
            targets.get(coord).push(commandDescription);
        });

        return { verified: true, targets: targets };
    } catch (error) {
        UI.ErrorMessage(tt('Error loading outgoing attacks!'));
        console.error(`${scriptInfo()} Outgoing attack check failed:`, error);
        return { verified: false, targets: new Map() };
    }
}

function getSafetyAwareBarbarianAssignments(barbarians, sourceVillages) {
    const safeBarbarians = barbarians.filter(
        (barbarian) => !barbarian.safetyBlocked
    );
    const plannedSafeBarbarians = getBarbariansWithSourceVillages(
        safeBarbarians,
        sourceVillages
    );
    let safeIndex = 0;

    return barbarians.map((barbarian) => {
        if (barbarian.safetyBlocked) {
            return {
                ...barbarian,
                sourceVillage: null,
                sourceDistance: null,
            };
        }

        const plannedBarbarian = plannedSafeBarbarians[safeIndex++];
        return {
            ...plannedBarbarian,
            noteStatus: barbarian.noteStatus,
            note: barbarian.note,
            outgoingAttackStatus: barbarian.outgoingAttackStatus,
            outgoingAttacks: barbarian.outgoingAttacks,
            safetyBlocked: false,
        };
    });
}

function getBarbariansWithSourceVillages(barbarians, sourceVillages) {
    const pendingBarbarians = barbarians.map((barbarian, index) => {
        return {
            ...barbarian,
            originalIndex: index,
            commandUnits: parseCommandUnits(calculateUnitsToSend(barbarian.wall)),
        };
    });

    if (haveSameCommandUnits(pendingBarbarians)) {
        return assignBarbariansWithUniformCommandUnits(
            pendingBarbarians,
            sourceVillages
        );
    }

    return assignBarbariansWithGreedyPlanner(pendingBarbarians, sourceVillages);
}

function assignBarbariansWithGreedyPlanner(pendingBarbarians, sourceVillages) {
    // Plan against a mutable copy so one village cannot "spend" the same rams twice.
    const plannedSourceVillages = cloneSourceVillages(sourceVillages);
    const plannedAssignments = new Array(pendingBarbarians.length);

    while (pendingBarbarians.length) {
        const nextAssignment = chooseNextBarbarianAssignment(
            pendingBarbarians,
            plannedSourceVillages
        );
        const { pendingIndex, barbarian, sourceVillage, sourceDistance } =
            nextAssignment;

        if (sourceVillage) {
            consumeVillageUnits(sourceVillage.units, barbarian.commandUnits);
            sourceVillage.plannedCommands += 1;
        }

        plannedAssignments[barbarian.originalIndex] = buildBarbarianAssignment(
            barbarian,
            sourceVillage
                ? createSourceVillageSnapshot(sourceVillage)
                : null,
            sourceDistance
        );

        pendingBarbarians.splice(pendingIndex, 1);
    }

    return plannedAssignments.map(stripOriginalIndexFromAssignment);
}

function chooseNextBarbarianAssignment(pendingBarbarians, sourceVillages) {
    let bestAssignment = null;

    pendingBarbarians.forEach((barbarian, pendingIndex) => {
        const eligibleSources = getEligibleSourceVillages(
            barbarian.coord,
            sourceVillages,
            barbarian.commandUnits
        );
        const nearestSource = eligibleSources.length ? eligibleSources[0] : null;
        const currentAssignment = {
            pendingIndex: pendingIndex,
            barbarian: barbarian,
            eligibleCount: eligibleSources.length,
            sourceVillage: nearestSource ? nearestSource.sourceVillage : null,
            sourceDistance: nearestSource ? nearestSource.distance : null,
        };

        if (!bestAssignment) {
            bestAssignment = currentAssignment;
            return;
        }

        if (currentAssignment.eligibleCount < bestAssignment.eligibleCount) {
            bestAssignment = currentAssignment;
            return;
        }

        if (currentAssignment.eligibleCount > bestAssignment.eligibleCount) {
            return;
        }

        const currentDistance =
            currentAssignment.sourceDistance === null
                ? Number.POSITIVE_INFINITY
                : currentAssignment.sourceDistance;
        const bestDistance =
            bestAssignment.sourceDistance === null
                ? Number.POSITIVE_INFINITY
                : bestAssignment.sourceDistance;

        if (currentDistance > bestDistance) {
            bestAssignment = currentAssignment;
            return;
        }

        if (currentDistance < bestDistance) {
            return;
        }

        if (barbarian.originalIndex < bestAssignment.barbarian.originalIndex) {
            bestAssignment = currentAssignment;
        }
    });

    return bestAssignment;
}

function assignBarbariansWithUniformCommandUnits(
    pendingBarbarians,
    sourceVillages
) {
    const sharedCommandUnits = pendingBarbarians.length
        ? pendingBarbarians[0].commandUnits
        : {};
    const plannedSourceVillages = cloneSourceVillages(sourceVillages);
    const sourceVillageSlots = buildSourceVillageSlots(
        plannedSourceVillages,
        sharedCommandUnits,
        pendingBarbarians.length
    );

    if (!sourceVillageSlots.length) {
        return pendingBarbarians
            .map((barbarian) => buildBarbarianAssignment(barbarian, null, null))
            .sort((left, right) => left.originalIndex - right.originalIndex)
            .map(stripOriginalIndexFromAssignment);
    }

    const assignmentsByTargetIndex = solveUniformAssignment(
        pendingBarbarians,
        sourceVillageSlots
    );
    const finalSourceSnapshots = finalizeUniformAssignments(
        pendingBarbarians,
        plannedSourceVillages,
        assignmentsByTargetIndex
    );

    return pendingBarbarians
        .map((barbarian, targetIndex) => {
            const assignment = assignmentsByTargetIndex[targetIndex];
            const sourceVillage = assignment
                ? finalSourceSnapshots.get(assignment.sourceVillage.id) || null
                : null;

            return buildBarbarianAssignment(
                barbarian,
                sourceVillage,
                assignment ? assignment.distance : null
            );
        })
        .sort((left, right) => left.originalIndex - right.originalIndex)
        .map(stripOriginalIndexFromAssignment);
}

function haveSameCommandUnits(pendingBarbarians) {
    if (!pendingBarbarians.length) {
        return true;
    }

    const firstCommandUnitsSignature = serializeCommandUnits(
        pendingBarbarians[0].commandUnits
    );

    return pendingBarbarians.every((barbarian) => {
        return (
            serializeCommandUnits(barbarian.commandUnits) ===
            firstCommandUnitsSignature
        );
    });
}

function serializeCommandUnits(commandUnits) {
    return Object.keys(commandUnits)
        .sort()
        .map((unitName) => `${unitName}:${commandUnits[unitName]}`)
        .join('|');
}

function buildSourceVillageSlots(
    sourceVillages,
    commandUnits,
    maxAssignments
) {
    const slots = [];

    sourceVillages.forEach((sourceVillage) => {
        const commandCapacity = Math.min(
            getCommandCapacity(sourceVillage.units, commandUnits),
            maxAssignments
        );

        for (let slotIndex = 0; slotIndex < commandCapacity; slotIndex++) {
            slots.push({
                sourceVillageId: sourceVillage.id,
                sourceVillage: sourceVillage,
            });
        }
    });

    return slots;
}

function getCommandCapacity(availableUnits, commandUnits) {
    const requiredUnits = Object.entries(commandUnits);

    if (!requiredUnits.length) {
        return 0;
    }

    return requiredUnits.reduce((currentMin, [unitName, requiredAmount]) => {
        const availableAmount = getVillageUnitAmount(availableUnits, unitName);
        const unitCapacity = Math.floor(availableAmount / requiredAmount);
        return Math.min(currentMin, unitCapacity);
    }, Number.POSITIVE_INFINITY);
}

function solveUniformAssignment(pendingBarbarians, sourceVillageSlots) {
    const targetCount = pendingBarbarians.length;
    const slotCount = sourceVillageSlots.length;
    const matrixSize = Math.max(targetCount, slotCount);
    const costMatrix = Array.from({ length: matrixSize }, () =>
        new Array(matrixSize).fill(0)
    );
    const unassignedPenalty = 1000000;

    for (let rowIndex = 0; rowIndex < matrixSize; rowIndex++) {
        for (let columnIndex = 0; columnIndex < matrixSize; columnIndex++) {
            if (rowIndex < targetCount && columnIndex < slotCount) {
                costMatrix[rowIndex][columnIndex] = calculateDistanceBetweenCoords(
                    pendingBarbarians[rowIndex].coord,
                    sourceVillageSlots[columnIndex].sourceVillage.coord
                );
            } else if (rowIndex < targetCount) {
                costMatrix[rowIndex][columnIndex] = unassignedPenalty;
            }
        }
    }

    const selectedColumns = solveHungarian(costMatrix);

    return pendingBarbarians.map((barbarian, targetIndex) => {
        const selectedColumn = selectedColumns[targetIndex];

        if (
            typeof selectedColumn !== 'number' ||
            selectedColumn < 0 ||
            selectedColumn >= slotCount
        ) {
            return null;
        }

        const sourceVillage = sourceVillageSlots[selectedColumn].sourceVillage;

        return {
            sourceVillage: sourceVillage,
            distance: calculateDistanceBetweenCoords(
                barbarian.coord,
                sourceVillage.coord
            ),
        };
    });
}

function solveHungarian(costMatrix) {
    const size = costMatrix.length;
    const u = new Array(size + 1).fill(0);
    const v = new Array(size + 1).fill(0);
    const p = new Array(size + 1).fill(0);
    const way = new Array(size + 1).fill(0);

    for (let row = 1; row <= size; row++) {
        p[0] = row;
        let column0 = 0;
        const minv = new Array(size + 1).fill(Number.POSITIVE_INFINITY);
        const used = new Array(size + 1).fill(false);

        do {
            used[column0] = true;
            const row0 = p[column0];
            let delta = Number.POSITIVE_INFINITY;
            let column1 = 0;

            for (let column = 1; column <= size; column++) {
                if (used[column]) continue;

                const current =
                    costMatrix[row0 - 1][column - 1] - u[row0] - v[column];

                if (current < minv[column]) {
                    minv[column] = current;
                    way[column] = column0;
                }

                if (minv[column] < delta) {
                    delta = minv[column];
                    column1 = column;
                }
            }

            for (let column = 0; column <= size; column++) {
                if (used[column]) {
                    u[p[column]] += delta;
                    v[column] -= delta;
                } else {
                    minv[column] -= delta;
                }
            }

            column0 = column1;
        } while (p[column0] !== 0);

        do {
            const column1 = way[column0];
            p[column0] = p[column1];
            column0 = column1;
        } while (column0 !== 0);
    }

    const assignment = new Array(size).fill(-1);

    for (let column = 1; column <= size; column++) {
        if (p[column] > 0) {
            assignment[p[column] - 1] = column - 1;
        }
    }

    return assignment;
}

function finalizeUniformAssignments(
    pendingBarbarians,
    plannedSourceVillages,
    assignmentsByTargetIndex
) {
    const sourceAssignmentsCount = new Map();

    assignmentsByTargetIndex.forEach((assignment) => {
        if (!assignment || !assignment.sourceVillage) return;

        const sourceVillageId = assignment.sourceVillage.id;
        sourceAssignmentsCount.set(
            sourceVillageId,
            (sourceAssignmentsCount.get(sourceVillageId) || 0) + 1
        );
    });

    pendingBarbarians.forEach((barbarian, targetIndex) => {
        const assignment = assignmentsByTargetIndex[targetIndex];
        if (!assignment || !assignment.sourceVillage) return;

        const sourceVillage = plannedSourceVillages.find(
            (currentSourceVillage) =>
                currentSourceVillage.id === assignment.sourceVillage.id
        );

        if (!sourceVillage) return;

        consumeVillageUnits(sourceVillage.units, barbarian.commandUnits);
        sourceVillage.plannedCommands =
            sourceAssignmentsCount.get(sourceVillage.id) || 0;
    });

    return new Map(
        plannedSourceVillages.map((sourceVillage) => {
            return [sourceVillage.id, createSourceVillageSnapshot(sourceVillage)];
        })
    );
}

function buildBarbarianAssignment(barbarian, sourceVillage, sourceDistance) {
    return {
        villageId: barbarian.villageId,
        coord: barbarian.coord,
        wall: barbarian.wall,
        reportId: barbarian.reportId,
        reportTime: barbarian.reportTime,
        type: barbarian.type,
        distance: barbarian.distance,
        sourceVillage: sourceVillage,
        sourceDistance: sourceDistance,
        originalIndex: barbarian.originalIndex,
    };
}

function stripOriginalIndexFromAssignment(assignment) {
    const normalizedAssignment = { ...assignment };
    delete normalizedAssignment.originalIndex;
    return normalizedAssignment;
}

async function fetchOwnSourceVillages() {
    const cachedSourceVillages = readSourceVillagesCache();
    if (cachedSourceVillages.length) {
        return cachedSourceVillages;
    }

    const sourceVillages = dedupeSourceVillages(
        await fetchOwnSourceVillagesFromOverview()
    );
    writeSourceVillagesCache(sourceVillages);

    return sourceVillages;
}

async function fetchOwnSourceVillagesFromOverview() {
    const overviewUrls = [
        game_data.link_base_pure +
            'overview_villages&mode=units&type=own_home&page=-1',
        game_data.link_base_pure +
            'overview_villages&mode=units&type=own_home&group=0&page=-1',
    ];
    let lastError = null;

    for (let index = 0; index < overviewUrls.length; index++) {
        try {
            if (index > 0) {
                await waitForOverviewRequestSlot(SOURCE_OVERVIEW_DELAY_MS);
            }

            const overviewHtml = await fetchSourceOverviewPage(overviewUrls[index]);
            const sourceVillages = parseSourceVillagesFromOverviewHtml(
                overviewHtml
            );

            if (sourceVillages.length) {
                return sourceVillages;
            }
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) {
        throw lastError;
    }

    throw new Error(tt('No eligible source villages found!'));
}

async function fetchSourceOverviewPage(url) {
    let lastError = null;

    for (
        let attemptIndex = 0;
        attemptIndex < SOURCE_OVERVIEW_REQUEST_RETRIES;
        attemptIndex++
    ) {
        try {
            if (attemptIndex > 0) {
                await waitForOverviewRequestSlot(
                    SOURCE_OVERVIEW_DELAY_MS * (attemptIndex + 1)
                );
            }

            return await jQuery.get(url);
        } catch (error) {
            lastError = error;

            if (error && error.status !== 429) {
                break;
            }
        }
    }

    throw new Error(
        `${tt('Error loading units overview!')} ${
            lastError && lastError.status ? lastError.status : ''
        }`.trim()
    );
}

function parseSourceVillagesFromOverviewHtml(html) {
    const htmlDoc = parseHtml(html);
    const combinedTable = findCombinedOverviewTable(htmlDoc);

    if (!combinedTable) {
        throw new Error('Units overview table not found');
    }

    const unitColumnMap = getCombinedOverviewUnitColumnMap(combinedTable);

    if (!Object.keys(unitColumnMap).length) {
        throw new Error('No unit columns found in units overview');
    }

    return Array.from(combinedTable.querySelectorAll('tr'))
        .map((row) => parseSourceVillageFromOverviewRow(row, unitColumnMap))
        .filter(Boolean);
}

function findCombinedOverviewTable(htmlDoc) {
    const unitsTable = htmlDoc.querySelector('#units_table');

    if (unitsTable) {
        return unitsTable;
    }

    const tables = Array.from(htmlDoc.querySelectorAll('table'));

    for (let index = 0; index < tables.length; index++) {
        const table = tables[index];
        const hasVillageRows = !!table.querySelector('.quickedit-vn[data-id]');
        const hasUnitHeader = !!table.querySelector('th img[src*="unit_"]');

        if (hasVillageRows && hasUnitHeader) {
            return table;
        }
    }

    return htmlDoc.querySelector('#combined_table');
}

function getCombinedOverviewUnitColumnMap(combinedTable) {
    const headerRow = Array.from(combinedTable.querySelectorAll('tr')).find(
        (row) => row.querySelector('th img[src*="unit_"]')
    );
    const unitColumnMap = {};

    if (!headerRow) {
        return unitColumnMap;
    }

    // Match each unit icon in the combined overview header to the row cell index below it.
    Array.from(headerRow.children).forEach((cell, index) => {
        const unitName = extractUnitNameFromHeaderCell(cell);
        if (unitName) {
            unitColumnMap[index] = unitName;
        }
    });

    return unitColumnMap;
}

function extractUnitNameFromHeaderCell(cell) {
    const unitImage = cell.querySelector('img[src*="unit_"]');

    if (!unitImage) {
        return null;
    }

    return extractUnitName(
        [
            unitImage.getAttribute('src'),
            unitImage.getAttribute('title'),
            unitImage.getAttribute('alt'),
            unitImage.getAttribute('id'),
        ]
            .filter(Boolean)
            .join(' ')
    );
}

function extractUnitName(value) {
    const match = String(value || '').match(/unit_([a-z_]+)\.(png|webp|gif)/i);
    if (match) {
        return match[1];
    }

    const normalizedValue = String(value || '').toLowerCase();
    const knownUnits = [
        'spear',
        'sword',
        'axe',
        'archer',
        'spy',
        'light',
        'marcher',
        'heavy',
        'ram',
        'catapult',
        'knight',
        'snob',
        'militia',
    ];

    return knownUnits.find((unitName) => normalizedValue.includes(unitName)) || null;
}

function parseSourceVillageFromOverviewRow(row, unitColumnMap) {
    const villageNameElement = row.querySelector('.quickedit-vn[data-id]');
    const villageLabelElement = villageNameElement
        ? villageNameElement.querySelector('.quickedit-label') ||
          villageNameElement
        : null;

    if (!villageNameElement) {
        return null;
    }

    const villageId = parseInt(
        villageNameElement.getAttribute('data-id'),
        10
    );
    const villageCell = villageNameElement.closest('td');
    const villageText = villageCell
        ? villageCell.textContent
        : row
        ? row.textContent
        : '';
    const coordMatch = villageText.match(COORDS_REGEX);
    const coord = coordMatch ? coordMatch[0] : null;
    const villageName =
        String(villageLabelElement ? villageLabelElement.textContent : '').trim() ||
        villageText.replace(COORDS_REGEX, '').replace(/\s+/g, ' ').trim();
    const point = parseCoord(coord);
    const units = extractVillageUnitsFromRow(row, unitColumnMap);

    if (!villageId || !coord || !point) {
        return null;
    }

    return {
        id: villageId,
        name: villageName,
        x: point.x,
        y: point.y,
        coord: coord,
        units: units,
        plannedCommands: 0,
    };
}

function extractVillageUnitsFromRow(row, unitColumnMap) {
    const cells = Array.from(row.children);
    const units = {};

    Object.entries(unitColumnMap).forEach(([cellIndex, unitName]) => {
        const cell = cells[parseInt(cellIndex, 10)];
        units[unitName] = extractUnitAmountFromCell(cell);
    });

    return units;
}

function extractUnitAmountFromCell(cell) {
    if (!cell) return 0;

    const normalizedAmount = String(cell.textContent || '').replace(/[^\d]/g, '');
    return normalizedAmount ? parseInt(normalizedAmount, 10) : 0;
}

function dedupeSourceVillages(villages) {
    const villagesById = new Map();

    villages.forEach((village) => {
        if (!village || !village.id || villagesById.has(village.id)) return;
        villagesById.set(village.id, village);
    });

    return Array.from(villagesById.values());
}

function readSourceVillagesCache() {
    try {
        const cachedValue = sessionStorage.getItem(SOURCE_VILLAGES_CACHE_KEY);
        if (!cachedValue) {
            return [];
        }

        const cachedPayload = JSON.parse(cachedValue);
        if (
            !cachedPayload ||
            !Array.isArray(cachedPayload.villages) ||
            !cachedPayload.createdAt
        ) {
            return [];
        }

        if (Date.now() - cachedPayload.createdAt > SOURCE_OVERVIEW_CACHE_MS) {
            return [];
        }

        return cachedPayload.villages;
    } catch (error) {
        return [];
    }
}

function writeSourceVillagesCache(villages) {
    try {
        sessionStorage.setItem(
            SOURCE_VILLAGES_CACHE_KEY,
            JSON.stringify({
                createdAt: Date.now(),
                villages: villages,
            })
        );
    } catch (error) {}
}

function waitForOverviewRequestSlot(waitMs) {
    return new Promise((resolve) => setTimeout(resolve, waitMs));
}

function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

function cloneSourceVillages(sourceVillages) {
    return sourceVillages.map((sourceVillage) => {
        return {
            ...sourceVillage,
            units: { ...sourceVillage.units },
            plannedCommands: 0,
        };
    });
}

function parseCommandUnits(unitsToSend) {
    const commandParams = new URLSearchParams(
        String(unitsToSend || '').replace(/^&/, '')
    );
    const commandUnits = {};

    commandParams.forEach((amount, unitName) => {
        const parsedAmount = parseInt(amount, 10);

        if (!Number.isNaN(parsedAmount) && parsedAmount > 0) {
            commandUnits[unitName] = parsedAmount;
        }
    });

    return commandUnits;
}

function getNearestAvailableSourceVillage(
    targetCoord,
    sourceVillages,
    commandUnits
) {
    const eligibleSources = getEligibleSourceVillages(
        targetCoord,
        sourceVillages,
        commandUnits
    );
    return eligibleSources.length ? eligibleSources[0].sourceVillage : null;
}

function getEligibleSourceVillages(targetCoord, sourceVillages, commandUnits) {
    return sourceVillages
        .filter((sourceVillage) =>
            hasEnoughUnitsForCommand(sourceVillage.units, commandUnits)
        )
        .map((sourceVillage) => {
            return {
                sourceVillage: sourceVillage,
                distance: calculateDistanceBetweenCoords(
                    targetCoord,
                    sourceVillage.coord
                ),
            };
        })
        .sort((left, right) => left.distance - right.distance);
}

function hasEnoughUnitsForCommand(availableUnits, commandUnits) {
    return Object.entries(commandUnits).every(([unitName, requiredAmount]) => {
        return getVillageUnitAmount(availableUnits, unitName) >= requiredAmount;
    });
}

function consumeVillageUnits(availableUnits, commandUnits) {
    Object.entries(commandUnits).forEach(([unitName, requiredAmount]) => {
        availableUnits[unitName] =
            getVillageUnitAmount(availableUnits, unitName) - requiredAmount;
    });
}

function getVillageUnitAmount(availableUnits, unitName) {
    return parseInt(availableUnits[unitName] || 0, 10);
}

function createSourceVillageSnapshot(sourceVillage) {
    return {
        id: sourceVillage.id,
        name: sourceVillage.name,
        coord: sourceVillage.coord,
        x: sourceVillage.x,
        y: sourceVillage.y,
        plannedCommands: sourceVillage.plannedCommands,
        units: { ...sourceVillage.units },
    };
}

function calculateDistanceBetweenCoords(firstCoord, secondCoord) {
    const firstPoint = parseCoord(firstCoord);
    const secondPoint = parseCoord(secondCoord);

    if (!firstPoint || !secondPoint) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
}

function parseCoord(coord) {
    const [x, y] = String(coord || '')
        .split('|')
        .map((value) => parseInt(value, 10));

    if (Number.isNaN(x) || Number.isNaN(y)) {
        return null;
    }

    return { x, y };
}

function formatDistanceValue(distance) {
    return Number.isFinite(distance) ? distance.toFixed(2) : '?';
}

function buildCommandUrl(sourceVillageId, targetVillageId, unitsToSend, wall) {
    return `${buildVillageLinkBase(
        sourceVillageId
    )}place&target=${targetVillageId}${unitsToSend}&wall=${wall}`;
}

function buildVillageLinkBase(villageId) {
    const currentLinkBase = String(game_data.link_base_pure || '');

    if (/village=\d+/.test(currentLinkBase)) {
        return currentLinkBase.replace(/village=\d+/, `village=${villageId}`);
    }

    const sitterId = getParameterByName('t');
    const sitterParameter = sitterId ? `t=${sitterId}&` : '';

    return `${window.location.origin}/game.php?${sitterParameter}village=${villageId}&screen=`;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => {
        const escapedCharacters = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };

        return escapedCharacters[character];
    });
}

function calculateUnitsToSend(wall) {
    let wallToUnitAmounts = UNITS_TO_SEND;

    if (wallToUnitAmounts[wall] !== undefined) {
        return wallToUnitAmounts[wall];
    } else {
        return `&axe=500&ram=100&spy=1`;
    }
}

$.fetchAll = function (urls, onLoad, onDone, onError) {
    var numDone = 0;
    var lastRequestTime = 0;
    var minWaitTime = 250;
    loadNext();
    function loadNext() {
        if (numDone == urls.length) {
            onDone();
            return;
        }

        let now = Date.now();
        let timeElapsed = now - lastRequestTime;
        if (timeElapsed < minWaitTime) {
            let timeRemaining = minWaitTime - timeElapsed;
            setTimeout(loadNext, timeRemaining);
            return;
        }
        lastRequestTime = now;
        $.get(urls[numDone])
            .done((data) => {
                try {
                    onLoad(numDone, data);
                    ++numDone;
                    loadNext();
                } catch (e) {
                    onError(e);
                }
            })
            .fail((xhr) => {
                onError(xhr);
            });
    }
};

function startProgressBar(total) {
    const width = jQuery('#contentContainer')[0].clientWidth;
    const preloaderContent = `
		<div id="progressbar" class="progress-bar" style="margin-bottom:12px;">
        	<span class="count label">0/${total}</span>
        	<div id="progress">
				<span class="count label" style="width: ${width}px;">
					0/${total}
				</span>
			</div>
    	</div>
	`;
    $('#contentContainer').eq(0).prepend(preloaderContent);
}

function updateProgressBar(index, total) {
    jQuery('#progress').css('width', `${((index + 1) / total) * 100}%`);
    jQuery('.count').text(`${tt('Fetching')} ${index + 1}/${total}`);
    if (index + 1 == total) {
        UI.SuccessMessage(tt('Finished fetching FA pages!'));
        jQuery('#progressbar').fadeOut(1000);
    }
}

function getHiddenTargetsStorageKey() {
    const world = String(game_data.world || 'unknown');
    const playerId = String(
        game_data.player && game_data.player.id
            ? game_data.player.id
            : 'unknown'
    );
    return `${HIDDEN_TARGETS_STORAGE_PREFIX}_${world}_${playerId}`;
}

function readHiddenTargets() {
    try {
        const storedValue = localStorage.getItem(getHiddenTargetsStorageKey());
        if (!storedValue) return new Map();

        const parsedValue = JSON.parse(storedValue);
        if (!Array.isArray(parsedValue)) return new Map();

        const hiddenTargets = new Map();
        parsedValue.forEach((storedTarget) => {
            const isLegacyValue =
                typeof storedTarget === 'string' ||
                typeof storedTarget === 'number';
            const id = String(
                isLegacyValue
                    ? storedTarget
                    : storedTarget && storedTarget.id
                    ? storedTarget.id
                    : ''
            );
            if (!id) return;

            hiddenTargets.set(id, {
                id: id,
                coord: isLegacyValue
                    ? ''
                    : String(storedTarget.coord || ''),
            });
        });

        return hiddenTargets;
    } catch (error) {
        return new Map();
    }
}

function readHiddenTargetIds() {
    return new Set(readHiddenTargets().keys());
}

function writeHiddenTargets(hiddenTargets) {
    try {
        localStorage.setItem(
            getHiddenTargetsStorageKey(),
            JSON.stringify(Array.from(hiddenTargets.values()))
        );
    } catch (error) {}
}

function addHiddenTarget(villageId, coord) {
    const hiddenTargets = readHiddenTargets();
    const normalizedId = String(villageId || '');
    if (!normalizedId) return;

    hiddenTargets.set(normalizedId, {
        id: normalizedId,
        coord: String(coord || ''),
    });
    writeHiddenTargets(hiddenTargets);
}

function addHiddenTargetId(villageId) {
    addHiddenTarget(villageId, '');
}

function removeHiddenTargetId(villageId) {
    const hiddenTargets = readHiddenTargets();
    hiddenTargets.delete(String(villageId || ''));
    writeHiddenTargets(hiddenTargets);
}

function updateHiddenTargetCoords(barbarians) {
    const hiddenTargets = readHiddenTargets();
    let hasChanges = false;

    barbarians.forEach((barbarian) => {
        const villageId = String(barbarian.villageId || '');
        const storedTarget = hiddenTargets.get(villageId);
        if (!storedTarget || storedTarget.coord === barbarian.coord) return;

        storedTarget.coord = barbarian.coord;
        hiddenTargets.set(villageId, storedTarget);
        hasChanges = true;
    });

    if (hasChanges) writeHiddenTargets(hiddenTargets);
}

function clearHiddenTargetIds() {
    try {
        localStorage.removeItem(getHiddenTargetsStorageKey());
    } catch (error) {}
}

function readStorage(defaultState) {
    let storedState = sessionStorage.getItem(STORAGE_KEY);
    if (!storedState) return defaultState;
    if (typeof storedState === 'object') return defaultState;
    storedState = JSON.parse(storedState);
    return storedState;
}

function writeStorage(data, initialState) {
    const dataToBeSaved = {
        ...initialState,
        ...data,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataToBeSaved));
}

function getParameterByName(name, url = window.location.href) {
    return new URL(url).searchParams.get(name);
}

function scriptInfo() {
    return `[${scriptData.name} ${scriptData.version}]`;
}

function initDebug() {
    console.debug(`${scriptInfo()} It works!`);
    console.debug(`${scriptInfo()} HELP:`, scriptData.helpLink);
    if (DEBUG) {
        console.debug(`${scriptInfo()} Market:`, game_data.market);
        console.debug(`${scriptInfo()} World:`, game_data.world);
        console.debug(`${scriptInfo()} Screen:`, game_data.screen);
        console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
        console.debug(`${scriptInfo()} Game Build:`, game_data.version);
        console.debug(`${scriptInfo()} Locale:`, game_data.locale);
        console.debug(
            `${scriptInfo()} Premium:`,
            game_data.features.Premium.active
        );
    }
}

function tt(string) {
    var gameLocale = game_data.locale;

    if (
        translations[gameLocale] !== undefined &&
        translations[gameLocale][string] !== undefined
    ) {
        return translations[gameLocale][string];
    } else if (translations['en_DK'][string] !== undefined) {
        return translations['en_DK'][string];
    }

    return string;
}

(function () {
    if (
        game_data.features.FarmAssistent.active &&
        game_data.features.Premium.active
    ) {
        const gameScreen = getParameterByName('screen');
        if (ALLOWED_GAME_SCREENS.includes(gameScreen)) {
            const state = readStorage(DEFAULT_STATE);
            initClearBarbarianWalls(state);
        } else {
            UI.InfoMessage(tt('Redirecting...'));
            window.location.assign(game_data.link_base_pure + 'map');
        }
    } else {
        UI.ErrorMessage(tt('This script requires PA and FA to be active!'));
    }
})();
