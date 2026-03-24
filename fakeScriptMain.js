// TW Fake Executor v3.0 - Hlavný skript
// Nahraj na GitHub ako fakeScriptMain.js
// Spúšťa sa bookmarkletom z generátora

(function() {
  'use strict';

  // ========== SETUP DATA ==========
  var setup = {};
  if (typeof _twSetup !== 'undefined') {
    try { setup = JSON.parse(decodeURIComponent(escape(atob(_twSetup)))); } catch(e) {}
  }

  var STORAGE_KEY = 'twFakeConfig_' + (setup.worldId || 'default');
  var COORDS_KEY = 'twFakeCoords_' + (setup.worldId || 'default');

  function log(msg) { console.log('[TW-Fake] ' + msg); }
  function saveConfig(cfg) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch(e) {} }
  function loadConfig() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; } }
  function saveCoordTabs(tabs) { try { localStorage.setItem(COORDS_KEY, JSON.stringify(tabs)); } catch(e) {} }
  function loadCoordTabs() { try { return JSON.parse(localStorage.getItem(COORDS_KEY)) || [{ name: 'Kmeň 1', coords: '' }]; } catch(e) { return [{ name: 'Kmeň 1', coords: '' }]; } }

  // Random int from min to max (inclusive)
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  var unitPop = {
    spear: 1, sword: 1, axe: 1, archer: 1,
    spy: 2, light: 4, marcher: 5, heavy: 6,
    ram: 5, catapult: 8, knight: 10
  };

  var unitNames = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight'];
  var unitLabels = {
    spear: 'Kopijník', sword: 'Šermiar', axe: 'Sekerník', archer: 'Lukostrelec',
    spy: 'Zvěd', light: 'Ľahká kav.', marcher: 'Jazd. luk.', heavy: 'Ťažká kav.',
    ram: 'Baran', catapult: 'Katapult', knight: 'Paladin'
  };

  // ========== FAKE ATTACK TEMPLATES ==========
  // Každý template definuje povinné a voliteľné jednotky
  // spy je VŽDY povinný v každom fejku
  var fakeTemplates = [
    { name: 'Špeh + Baran', mandatory: { spy: [1,3], ram: [3,6] }, filler: ['spear','axe','light'] },
    { name: 'Špeh + Katapult', mandatory: { spy: [1,3], catapult: [3,6] }, filler: ['spear','sword','axe'] },
    { name: 'Špeh + Baran + Katapult', mandatory: { spy: [1,2], ram: [2,4], catapult: [2,4] }, filler: ['spear','axe'] },
    { name: 'Špeh + Baran + Ľahká', mandatory: { spy: [1,3], ram: [3,5], light: [2,5] }, filler: ['spear','axe'] },
    { name: 'Špeh + Katapult + Ťažká', mandatory: { spy: [1,2], catapult: [3,5], heavy: [1,3] }, filler: ['sword','spear'] },
    { name: 'Špeh + Baran + Sekerník', mandatory: { spy: [2,4], ram: [3,6], axe: [5,15] }, filler: ['spear'] },
    { name: 'Špeh + Katapult + Kopijník', mandatory: { spy: [1,3], catapult: [3,5], spear: [5,15] }, filler: ['sword'] },
    { name: 'Plný mix', mandatory: { spy: [1,2], ram: [2,3], catapult: [2,3], light: [1,3] }, filler: ['spear','axe','sword'] },
  ];

  // ========== DETECT PAGE ==========
  var isRallyPoint = window.location.href.indexOf('screen=place') !== -1;
  if (isRallyPoint) { handleRallyPoint(); return; }

  var isCombined = window.location.href.indexOf('screen=overview_villages') !== -1;
  if (!isCombined) {
    if (typeof game_data !== 'undefined') {
      window.location.href = '/game.php?village=' + game_data.village.id + '&screen=overview_villages&mode=combined';
      return;
    }
    alert('⚠️ Otvor stránku Kombinované!');
    return;
  }

  // ========== PARSE VILLAGES FROM COMBINED ==========
  var villages = parseVillagesFromCombined();
  log('📋 Nájdených ' + villages.length + ' dedín');

  if (villages.length === 0) {
    alert('⚠️ Nenašli sa žiadne dediny na Kombinovanej!');
    return;
  }

  // ========== SHOW MAIN UI ==========
  showMainPanel();

  function parseVillagesFromCombined() {
    var result = [];
    var rows = document.querySelectorAll('#combined_table tr.row_a, #combined_table tr.row_b, table.vis tr.row_a, table.vis tr.row_b');
    if (rows.length === 0) rows = document.querySelectorAll('tr[class*="row_"]');

    // Detect game units dynamically
    var gameUnits = [];
    var excludeUnits = ['militia', 'snob'];
    if (typeof game_data !== 'undefined' && game_data.units) {
      for (var gu = 0; gu < game_data.units.length; gu++) {
        if (excludeUnits.indexOf(game_data.units[gu]) === -1) gameUnits.push(game_data.units[gu]);
      }
    }
    if (gameUnits.length === 0) gameUnits = unitNames;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var villageLink = row.querySelector('a[href*="village="]');
      if (!villageLink) continue;

      var href = villageLink.href || '';
      var villageIdMatch = href.match(/village=(\\d+)/);
      if (!villageIdMatch) continue;
      var villageId = villageIdMatch[1];

      var coordMatch = villageLink.textContent.match(/(\\d{3})\\|(\\d{3})/);
      var vx = coordMatch ? parseInt(coordMatch[1]) : 0;
      var vy = coordMatch ? parseInt(coordMatch[2]) : 0;

      var units = {};
      var unitCells = row.querySelectorAll('td.unit-item, td[class*="unit"]');
      if (unitCells.length > 0) {
        for (var j = 0; j < unitCells.length && j < gameUnits.length; j++) {
          var val = parseInt(unitCells[j].textContent.trim()) || 0;
          if (val > 0) units[gameUnits[j]] = val;
        }
      }

      var totalPop = 0;
      for (var u in units) totalPop += units[u] * (unitPop[u] || 1);

      // Dedina musí mať špeha A (ram ALEBO katapult)
      var hasSpy = (units.spy || 0) > 0;
      var hasRamOrCat = (units.ram || 0) > 0 || (units.catapult || 0) > 0;
      if (totalPop > 0 && hasSpy && hasRamOrCat) {
        result.push({ id: villageId, x: vx, y: vy, name: villageLink.textContent.trim(), units: units, totalPop: totalPop });
      }
    }
    return result;
  }

  // ========== MAIN PANEL ==========
  function showMainPanel() {
    var old = document.getElementById('tw-fake-main');
    if (old) old.remove();

    var saved = loadConfig();
    var coordTabs = loadCoordTabs();

    var panel = document.createElement('div');
    panel.id = 'tw-fake-main';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:10px;">';
    h += '<h2 style="margin:0;font-size:15px;color:#7d510f;">⚔️ TW Fake Script v3.0</h2>';
    h += '<p style="margin:2px 0;font-size:10px;color:#8b7355;">Svet: ' + (setup.worldId || '?') + ' | Dediny: ' + villages.length + '</p>';
    h += '</div>';

    // === UNIT SELECTION MODE ===
    var unitMode = saved.unitMode || 'template';
    h += '<fieldset style="border:1px solid #c9a96e;padding:8px;margin-bottom:8px;border-radius:4px;">';
    h += '<legend style="font-weight:bold;font-size:11px;">🗡️ Výber jednotiek</legend>';

    h += '<div style="margin-bottom:6px;">';
    h += '<label style="margin-right:10px;"><input type="radio" name="tw-unit-mode" value="template" ' + (unitMode === 'template' ? 'checked' : '') + '> 🎲 Random šablóny</label>';
    h += '<label><input type="radio" name="tw-unit-mode" value="manual" ' + (unitMode === 'manual' ? 'checked' : '') + '> ✏️ Manuálny výber</label>';
    h += '</div>';

    // Template mode info
    h += '<div id="tw-template-info" style="' + (unitMode === 'template' ? '' : 'display:none;') + 'font-size:9px;color:#666;padding:4px;background:#fff8e7;border-radius:3px;">';
    h += '<b>Random šablóny:</b> Každý fejk dostane náhodnú kombináciu:<br>';
    h += '• <b>Vždy</b>: špeh (1-4) + baran (2-6) a/alebo katapult (2-6)<br>';
    h += '• <b>Plus</b>: random výplň (kopijníci, sekerníci, jazda...)<br>';
    h += '• Šablóna sa vyberie náhodne pre každý útok = rôzne kombinácie';
    h += '</div>';

    // Manual mode
    h += '<div id="tw-manual-units" style="' + (unitMode === 'manual' ? '' : 'display:none;') + '">';
    h += '<p style="font-size:9px;color:#888;margin:0 0 4px;">Zadaj počet (0=nič, 1,2,3...=presný) alebo <b>"min"</b> = auto podľa fake limitu. Spy je povinný!</p>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
    h += '<tr style="background:#e8d5a3;"><th style="padding:3px;">Jednotka</th><th style="padding:3px;">Pop</th><th style="padding:3px;width:80px;">Počet</th></tr>';

    for (var u = 0; u < unitNames.length; u++) {
      var un = unitNames[u];
      var savedVal = saved.units && saved.units[un] !== undefined ? saved.units[un] : (un === 'spy' ? '1' : (un === 'ram' ? '1' : (un === 'catapult' ? '1' : '0')));
      var bg = u % 2 === 0 ? '#fff8e7' : '#f4e4bc';
      var required = (un === 'spy' || un === 'ram' || un === 'catapult') ? ' <span style="color:red;">*</span>' : '';
      h += '<tr style="background:' + bg + ';">';
      h += '<td style="padding:3px;">' + unitLabels[un] + required + '</td>';
      h += '<td style="padding:3px;text-align:center;">' + unitPop[un] + '</td>';
      h += '<td style="padding:3px;"><input id="tw-unit-' + un + '" value="' + savedVal + '" style="width:100%;padding:2px;border:1px solid #c9a96e;border-radius:2px;text-align:center;font-size:10px;" placeholder="0/1/min"></td>';
      h += '</tr>';
    }
    h += '</table></div>';
    h += '</fieldset>';

    // === SETTINGS ===
    h += '<fieldset style="border:1px solid #c9a96e;padding:8px;margin-bottom:8px;border-radius:4px;">';
    h += '<legend style="font-weight:bold;font-size:11px;">⚙️ Nastavenia</legend>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
    h += '<tr><td style="padding:3px;">Fake limit (%):</td><td><input id="tw-fakelimit" type="number" step="0.1" min="0.1" value="' + (saved.fakeLimit || 0.5) + '" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:2px;"></td></tr>';
    h += '<tr><td style="padding:3px;">Open tabs:</td><td><input id="tw-opentabs" type="number" min="1" max="50" value="' + (saved.openTabs || 5) + '" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:2px;"></td></tr>';
    h += '<tr><td style="padding:3px;">Max fejkov na cieľ:</td><td><input id="tw-maxpertarget" type="number" min="0" value="' + (saved.maxFakesPerTarget || 0) + '" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:2px;"><span style="font-size:9px;color:#888;"> 0=∞</span></td></tr>';
    h += '<tr><td style="padding:3px;">Max fejkov z dediny:</td><td><input id="tw-maxpervillage" type="number" min="0" value="' + (saved.maxFakesPerVillage || 0) + '" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:2px;"><span style="font-size:9px;color:#888;"> 0=∞</span></td></tr>';
    h += '</table></fieldset>';

    // === ARRIVAL WINDOW ===
    h += '<fieldset style="border:1px solid #c9a96e;padding:8px;margin-bottom:8px;border-radius:4px;">';
    h += '<legend style="font-weight:bold;font-size:11px;">⏰ Okno príchodu</legend>';
    h += '<div style="display:flex;gap:6px;">';
    h += '<div style="flex:1;"><label style="font-size:9px;">Od:</label><input id="tw-arr-start" type="datetime-local" value="' + (saved.arrivalStart || '') + '" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:2px;font-size:10px;"></div>';
    h += '<div style="flex:1;"><label style="font-size:9px;">Do:</label><input id="tw-arr-end" type="datetime-local" value="' + (saved.arrivalEnd || '') + '" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:2px;font-size:10px;"></div>';
    h += '</div></fieldset>';

    // === COORDINATE TABS ===
    h += '<fieldset style="border:1px solid #c9a96e;padding:8px;margin-bottom:8px;border-radius:4px;">';
    h += '<legend style="font-weight:bold;font-size:11px;">🎯 Cieľové súradnice (podľa kmeňa)</legend>';

    // Tab buttons
    h += '<div id="tw-coord-tabs" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">';
    for (var t = 0; t < coordTabs.length; t++) {
      var active = t === 0 ? 'background:#7d510f;color:#fff;' : 'background:#e8d5a3;color:#3e2b0d;';
      h += '<button class="tw-tab-btn" data-idx="' + t + '" style="padding:4px 10px;border:1px solid #c9a96e;border-radius:3px;cursor:pointer;font-size:10px;font-weight:bold;' + active + '">' + coordTabs[t].name + '</button>';
    }
    h += '<button id="tw-add-tab" style="padding:4px 8px;border:1px dashed #c9a96e;border-radius:3px;cursor:pointer;font-size:10px;background:#fff8e7;color:#7d510f;">+ Pridať</button>';
    h += '</div>';

    // Tab content (show first tab)
    h += '<div id="tw-coord-content">';
    h += '<div style="display:flex;gap:4px;margin-bottom:4px;">';
    h += '<input id="tw-tab-name" value="' + (coordTabs[0] ? coordTabs[0].name : 'Kmeň 1') + '" placeholder="Názov kmeňa" style="flex:1;padding:3px;border:1px solid #c9a96e;border-radius:2px;font-size:10px;">';
    h += '<button id="tw-save-coords" style="padding:3px 8px;background:#2980b9;color:#fff;border:none;border-radius:2px;cursor:pointer;font-size:10px;">💾 Uložiť</button>';
    h += '<button id="tw-del-tab" style="padding:3px 8px;background:#c0392b;color:#fff;border:none;border-radius:2px;cursor:pointer;font-size:10px;">🗑️</button>';
    h += '</div>';
    h += '<textarea id="tw-coords" rows="4" placeholder="500|500 501|501 502|502..." style="width:100%;padding:4px;border:1px solid #c9a96e;border-radius:2px;font-family:monospace;font-size:10px;resize:vertical;">' + (coordTabs[0] ? coordTabs[0].coords : '') + '</textarea>';
    h += '<p id="tw-coord-count" style="margin:2px 0 0;font-size:9px;color:#888;">0 súradníc</p>';
    h += '<div style="margin-top:4px;font-size:9px;color:#888;">💡 Coordy sa automaticky ukladajú. Prepínaj taby pre rôzne kmene.</div>';
    h += '</div></fieldset>';

    // === BUTTONS ===
    h += '<div style="display:flex;gap:6px;">';
    h += '<button id="tw-start-btn" style="flex:1;padding:10px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;">⚔️ Spustiť fejky</button>';
    h += '<button id="tw-save-btn" style="padding:10px;background:#2980b9;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:11px;">💾 Uložiť</button>';
    h += '<button id="tw-close-btn" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    // === STATUS ===
    h += '<div id="tw-status" style="display:none;margin-top:8px;padding:8px;background:#fff8e7;border:1px solid #c9a96e;border-radius:4px;font-size:10px;"></div>';

    panel.innerHTML = h;
    document.body.appendChild(panel);

    // ===== EVENT HANDLERS =====
    var currentTabIdx = 0;

    // Unit mode toggle
    var modeRadios = document.querySelectorAll('input[name="tw-unit-mode"]');
    for (var mr = 0; mr < modeRadios.length; mr++) {
      modeRadios[mr].onchange = function() {
        var isTemplate = this.value === 'template';
        document.getElementById('tw-template-info').style.display = isTemplate ? '' : 'none';
        document.getElementById('tw-manual-units').style.display = isTemplate ? 'none' : '';
      };
    }

    // Count coords
    function updateCoordCount() {
      var val = document.getElementById('tw-coords').value;
      var matches = val.match(/(\\d{3})\\|(\\d{3})/g);
      document.getElementById('tw-coord-count').textContent = (matches ? matches.length : 0) + ' súradníc';
    }
    updateCoordCount();
    document.getElementById('tw-coords').addEventListener('input', updateCoordCount);

    // Save current tab coords
    function saveCurrentTab() {
      coordTabs[currentTabIdx] = {
        name: document.getElementById('tw-tab-name').value || ('Kmeň ' + (currentTabIdx + 1)),
        coords: document.getElementById('tw-coords').value
      };
      saveCoordTabs(coordTabs);
    }

    // Switch tab
    function switchTab(idx) {
      saveCurrentTab();
      currentTabIdx = idx;
      document.getElementById('tw-tab-name').value = coordTabs[idx].name;
      document.getElementById('tw-coords').value = coordTabs[idx].coords;
      updateCoordCount();
      var btns = document.querySelectorAll('.tw-tab-btn');
      for (var b = 0; b < btns.length; b++) {
        btns[b].style.background = parseInt(btns[b].getAttribute('data-idx')) === idx ? '#7d510f' : '#e8d5a3';
        btns[b].style.color = parseInt(btns[b].getAttribute('data-idx')) === idx ? '#fff' : '#3e2b0d';
      }
    }

    // Tab click handlers
    var tabBtns = document.querySelectorAll('.tw-tab-btn');
    for (var tb = 0; tb < tabBtns.length; tb++) {
      tabBtns[tb].onclick = (function(idx) { return function() { switchTab(idx); }; })(tb);
    }

    // Add tab
    document.getElementById('tw-add-tab').onclick = function() {
      saveCurrentTab();
      coordTabs.push({ name: 'Kmeň ' + (coordTabs.length + 1), coords: '' });
      saveCoordTabs(coordTabs);
      showMainPanel();
    };

    // Delete tab
    document.getElementById('tw-del-tab').onclick = function() {
      if (coordTabs.length <= 1) { alert('Musíš mať aspoň 1 tab!'); return; }
      coordTabs.splice(currentTabIdx, 1);
      saveCoordTabs(coordTabs);
      showMainPanel();
    };

    // Save coords button
    document.getElementById('tw-save-coords').onclick = function() {
      saveCurrentTab();
      alert('💾 Coordy uložené! (' + coordTabs[currentTabIdx].name + ')');
    };

    // Close
    document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

    // Save config
    document.getElementById('tw-save-btn').onclick = function() {
      saveCurrentTab();
      var cfg = getCurrentConfig();
      saveConfig(cfg);
      alert('💾 Celá konfigurácia uložená!');
    };

    // Get current config from UI
    function getCurrentConfig() {
      var unitConfig = {};
      for (var i = 0; i < unitNames.length; i++) {
        var inp = document.getElementById('tw-unit-' + unitNames[i]);
        if (inp) unitConfig[unitNames[i]] = inp.value.trim();
      }
      var selectedMode = document.querySelector('input[name="tw-unit-mode"]:checked');
      return {
        units: unitConfig,
        unitMode: selectedMode ? selectedMode.value : 'template',
        fakeLimit: parseFloat(document.getElementById('tw-fakelimit').value) || 0.5,
        openTabs: parseInt(document.getElementById('tw-opentabs').value) || 5,
        maxFakesPerTarget: parseInt(document.getElementById('tw-maxpertarget').value) || 0,
        maxFakesPerVillage: parseInt(document.getElementById('tw-maxpervillage').value) || 0,
        arrivalStart: document.getElementById('tw-arr-start').value || null,
        arrivalEnd: document.getElementById('tw-arr-end').value || null
      };
    }

    // START
    document.getElementById('tw-start-btn').onclick = function() {
      saveCurrentTab();
      var cfg = getCurrentConfig();
      saveConfig(cfg);

      // Collect coords from currently active tab only (user picks which tribe to attack)
      var activeCoords = [];
      var cText = coordTabs[currentTabIdx].coords;
      var cRegex = /(\\d{3})\\|(\\d{3})/g;
      var m;
      while ((m = cRegex.exec(cText)) !== null) {
        activeCoords.push({ x: parseInt(m[1]), y: parseInt(m[2]) });
      }

      if (activeCoords.length === 0) {
        alert('⚠️ Zadaj cieľové súradnice v aktívnom tabe!');
        return;
      }

      log('🎯 Aktívny tab: ' + coordTabs[currentTabIdx].name + ' (' + activeCoords.length + ' cieľov)');

      // Build attack queue
      var queue = buildAttackQueue(villages, activeCoords, cfg);
      log('⚔️ Naplánovaných ' + queue.length + ' útokov');

      if (queue.length === 0) {
        alert('⚠️ Žiadne útoky! Skontroluj dediny (treba spy + ram/katapult) a fake limit.');
        return;
      }

      window._twAttackQueue = queue;
      window._twAttackIndex = 0;

      // Show status
      var status = document.getElementById('tw-status');
      status.style.display = 'block';
      status.innerHTML = '<b>⚔️ ' + queue.length + ' útokov naplánovaných</b> (tab: ' + coordTabs[currentTabIdx].name + ')<br>';
      status.innerHTML += '<button id="tw-launch-btn" style="margin-top:6px;padding:8px 16px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">▶ Otvoriť ' + Math.min(cfg.openTabs, queue.length) + ' tabov</button>';
      status.innerHTML += '<div id="tw-queue-preview" style="margin-top:6px;max-height:200px;overflow-y:auto;font-size:9px;"></div>';

      // Preview queue
      var preview = document.getElementById('tw-queue-preview');
      var ph = '';
      for (var q = 0; q < Math.min(queue.length, 20); q++) {
        var atk = queue[q];
        var uStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
        ph += '<div style="padding:2px 4px;border-bottom:1px dotted #c9a96e;' + (q % 2 === 0 ? 'background:#fff8e7;' : '') + '">';
        ph += '<b>' + atk.villageName.substring(0, 18) + '</b> → ' + atk.targetX + '|' + atk.targetY;
        ph += ' <span style="color:#888;">[' + uStr + ']</span>';
        ph += '</div>';
      }
      if (queue.length > 20) ph += '<div style="text-align:center;padding:4px;">...a ďalších ' + (queue.length - 20) + '</div>';
      preview.innerHTML = ph;

      document.getElementById('tw-launch-btn').onclick = function() { launchBatch(cfg.openTabs); };
    };
  }

  // ========== SELECT UNITS: TEMPLATE MODE ==========
  function selectUnitsTemplate(availableUnits, fakeLimitPct) {
    var totalPop = 0;
    for (var u in availableUnits) totalPop += availableUnits[u] * (unitPop[u] || 1);
    var maxPop = Math.ceil(totalPop * (fakeLimitPct / 100));
    if (maxPop < 1) maxPop = 1;

    // Shuffle templates and try each until one fits
    var shuffled = fakeTemplates.slice().sort(function() { return Math.random() - 0.5; });

    for (var t = 0; t < shuffled.length; t++) {
      var tmpl = shuffled[t];
      var selected = {};
      var usedPop = 0;
      var valid = true;

      // Check mandatory units
      for (var unitName in tmpl.mandatory) {
        var range = tmpl.mandatory[unitName];
        var avail = availableUnits[unitName] || 0;
        if (avail <= 0) { valid = false; break; }

        var wantMin = range[0];
        var wantMax = range[1];
        var count = Math.min(randInt(wantMin, wantMax), avail);
        if (count <= 0) { valid = false; break; }

        var pop = unitPop[unitName] || 1;
        if (usedPop + count * pop > maxPop && unitName !== 'spy') {
          // Try to fit at least 1
          count = Math.min(1, avail);
        }
        selected[unitName] = count;
        usedPop += count * pop;
      }

      if (!valid) continue;

      // Ensure spy is always present
      if (!selected.spy) {
        var spyAvail = availableUnits.spy || 0;
        if (spyAvail > 0) {
          var spyCount = Math.min(randInt(1, 3), spyAvail);
          selected.spy = spyCount;
          usedPop += spyCount * unitPop.spy;
        }
      }

      // Ensure at least ram or catapult
      if (!selected.ram && !selected.catapult) {
        if ((availableUnits.ram || 0) > 0) {
          selected.ram = Math.min(randInt(1, 3), availableUnits.ram);
          usedPop += selected.ram * unitPop.ram;
        } else if ((availableUnits.catapult || 0) > 0) {
          selected.catapult = Math.min(randInt(1, 2), availableUnits.catapult);
          usedPop += selected.catapult * unitPop.catapult;
        }
      }

      // Fill remaining pop budget with filler units
      if (tmpl.filler && usedPop < maxPop) {
        var fillerShuffled = tmpl.filler.slice().sort(function() { return Math.random() - 0.5; });
        for (var f = 0; f < fillerShuffled.length && usedPop < maxPop; f++) {
          var fn = fillerShuffled[f];
          var fa = (availableUnits[fn] || 0) - (selected[fn] || 0);
          if (fa <= 0) continue;
          var fp = unitPop[fn] || 1;
          var fc = Math.min(Math.floor((maxPop - usedPop) / fp), fa);
          if (fc > 0) {
            selected[fn] = (selected[fn] || 0) + fc;
            usedPop += fc * fp;
          }
        }
      }

      if (Object.keys(selected).length >= 2) return selected;
    }

    // Fallback: basic spy + ram/cat
    var fallback = {};
    if ((availableUnits.spy || 0) > 0) {
      fallback.spy = Math.min(randInt(1, 3), availableUnits.spy);
    }
    if ((availableUnits.ram || 0) > 0) {
      fallback.ram = Math.min(randInt(1, 3), availableUnits.ram);
    } else if ((availableUnits.catapult || 0) > 0) {
      fallback.catapult = Math.min(randInt(1, 2), availableUnits.catapult);
    }
    return Object.keys(fallback).length > 0 ? fallback : {};
  }

  // ========== SELECT UNITS: MANUAL MODE ==========
  function selectUnitsManual(availableUnits, unitConfig, fakeLimitPct) {
    var totalPop = 0;
    for (var u in availableUnits) totalPop += availableUnits[u] * (unitPop[u] || 1);
    var maxPop = Math.ceil(totalPop * (fakeLimitPct / 100));
    if (maxPop < 1) maxPop = 1;

    var selected = {};
    var usedPop = 0;

    // First pass: specific counts
    for (var i = 0; i < unitNames.length; i++) {
      var un = unitNames[i];
      var cfgVal = unitConfig[un] || '0';
      if (cfgVal === 'min' || cfgVal === '0' || cfgVal === '') continue;

      var wantCount = parseInt(cfgVal);
      if (isNaN(wantCount) || wantCount <= 0) continue;

      var avail = availableUnits[un] || 0;
      var count = Math.min(wantCount, avail);
      if (count > 0) {
        selected[un] = count;
        usedPop += count * (unitPop[un] || 1);
      }
    }

    // Povinný spy
    if (!selected.spy && (availableUnits.spy || 0) > 0) {
      selected.spy = 1;
      usedPop += unitPop.spy;
    }

    // Povinný ram alebo catapult
    if (!selected.ram && !selected.catapult) {
      if ((availableUnits.ram || 0) > 0) {
        selected.ram = 1; usedPop += unitPop.ram;
      } else if ((availableUnits.catapult || 0) > 0) {
        selected.catapult = 1; usedPop += unitPop.catapult;
      } else {
        return {};
      }
    }

    // Second pass: "min" units fill to fake limit
    var minPriority = ['spy', 'light', 'spear', 'axe', 'archer', 'marcher', 'heavy', 'sword', 'ram', 'catapult', 'knight'];
    for (var j = 0; j < minPriority.length && usedPop < maxPop; j++) {
      var un2 = minPriority[j];
      if ((unitConfig[un2] || '0') !== 'min') continue;
      var avail2 = (availableUnits[un2] || 0) - (selected[un2] || 0);
      if (avail2 <= 0) continue;
      var pop2 = unitPop[un2] || 1;
      var cnt = Math.min(Math.floor((maxPop - usedPop) / pop2), avail2);
      if (cnt > 0) {
        selected[un2] = (selected[un2] || 0) + cnt;
        usedPop += cnt * pop2;
      }
    }

    return Object.keys(selected).length > 0 ? selected : {};
  }

  // ========== BUILD ATTACK QUEUE ==========
  function buildAttackQueue(villageList, targetList, cfg) {
    var queue = [];
    var targetCounts = {};
    var villageCounts = {};
    var maxPerTarget = cfg.maxFakesPerTarget || 0;
    var maxPerVillage = cfg.maxFakesPerVillage || 0;
    var isTemplate = cfg.unitMode === 'template';

    for (var t = 0; t < targetList.length; t++) {
      var target = targetList[t];
      var tKey = target.x + '|' + target.y;
      var sentToTarget = targetCounts[tKey] || 0;
      var maxForTarget = maxPerTarget > 0 ? maxPerTarget : villageList.length;

      for (var v = 0; v < villageList.length && sentToTarget < maxForTarget; v++) {
        var village = villageList[v];

        if (maxPerVillage > 0) {
          var vCount = villageCounts[village.id] || 0;
          if (vCount >= maxPerVillage) continue;
        }

        var selectedUnits;
        if (isTemplate) {
          selectedUnits = selectUnitsTemplate(village.units, cfg.fakeLimit);
        } else {
          selectedUnits = selectUnitsManual(village.units, cfg.units, cfg.fakeLimit);
        }
        if (Object.keys(selectedUnits).length === 0) continue;

        queue.push({
          villageId: village.id, villageName: village.name,
          villageX: village.x, villageY: village.y,
          targetX: target.x, targetY: target.y,
          units: selectedUnits
        });

        villageCounts[village.id] = (villageCounts[village.id] || 0) + 1;
        targetCounts[tKey] = (targetCounts[tKey] || 0) + 1;
        sentToTarget++;
      }
    }
    return queue;
  }

  // ========== LAUNCH TABS ==========
  function launchBatch(tabCount) {
    var queue = window._twAttackQueue;
    var idx = window._twAttackIndex || 0;
    var toOpen = Math.min(tabCount, queue.length - idx);

    if (toOpen <= 0) { alert('✅ Všetky útoky boli otvorené!'); return; }

    for (var i = 0; i < toOpen; i++) {
      var atk = queue[idx + i];
      if (!atk) break;
      var atkData = btoa(unescape(encodeURIComponent(JSON.stringify(atk))));
      var url = '/game.php?village=' + atk.villageId + '&screen=place&target=' + atk.targetX + '|' + atk.targetY + '#twfake=' + atkData;
      window.open(url, '_blank');
    }

    window._twAttackIndex = idx + toOpen;
    var remaining = queue.length - window._twAttackIndex;
    log('📑 Otvorených ' + toOpen + ' tabov. Zostáva: ' + remaining);

    var btn = document.getElementById('tw-launch-btn');
    if (btn) {
      if (remaining > 0) {
        btn.textContent = '▶ Ďalších ' + Math.min(tabCount, remaining) + ' (zostáva ' + remaining + ')';
      } else {
        btn.textContent = '✅ Hotovo!';
        btn.disabled = true;
        btn.style.background = '#95a5a6';
      }
    }
  }

  // ========== HANDLE RALLY POINT ==========
  function handleRallyPoint() {
    var hash = window.location.hash;
    var fakeMatch = hash.match(/twfake=(.+)/);
    if (!fakeMatch) return;

    var attack;
    try { attack = JSON.parse(decodeURIComponent(escape(atob(fakeMatch[1])))); } catch(e) { return; }

    log('🎯 Rally point: ' + attack.targetX + '|' + attack.targetY);
    log('📦 Jednotky: ' + JSON.stringify(attack.units));

    function setInputValue(input, value) {
      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(input, value);
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      try {
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      } catch(e) {}
    }

    function waitForElement(selector, callback, maxWait) {
      var elapsed = 0;
      var interval = setInterval(function() {
        var el = document.querySelector(selector);
        elapsed += 100;
        if (el) { clearInterval(interval); callback(el); }
        else if (elapsed >= (maxWait || 5000)) { clearInterval(interval); log('⚠️ ' + selector + ' nenájdený'); }
      }, 100);
    }

    waitForElement('#unit_input_spy, input[name="spy"]', function() {
      // Fill coordinates
      var inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
      var inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');
      if (inputX && inputY) {
        setInputValue(inputX, attack.targetX);
        setInputValue(inputY, attack.targetY);
      }

      // Fill units with delay
      var unitKeys = Object.keys(attack.units);
      var delay = 0;
      for (var i = 0; i < unitKeys.length; i++) {
        (function(unitName, count, d) {
          setTimeout(function() {
            var input = document.getElementById('unit_input_' + unitName)
                     || document.querySelector('input[name="' + unitName + '"]');
            if (input) {
              input.click(); input.focus();
              setInputValue(input, '');
              setTimeout(function() { setInputValue(input, count); }, 50);
            } else {
              log('⚠️ Input pre ' + unitName + ' nenájdený');
            }
          }, d);
        })(unitKeys[i], attack.units[unitKeys[i]], delay);
        delay += 200;
      }

      // Highlight attack button
      setTimeout(function() {
        var attackBtn = document.getElementById('target_attack');
        if (attackBtn) {
          attackBtn.style.border = '3px solid #ff0000';
          attackBtn.style.boxShadow = '0 0 15px rgba(255,0,0,0.6)';
        }
        var unitStr = Object.keys(attack.units).map(function(k) { return k + ':' + attack.units[k]; }).join(' | ');
        var info = document.createElement('div');
        info.style.cssText = 'position:fixed;top:5px;left:50%;transform:translateX(-50%);z-index:99999;background:#27ae60;color:#fff;padding:8px 20px;border-radius:20px;font-family:Verdana;font-size:11px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,0.3);max-width:90%;text-align:center;';
        info.innerHTML = '⚔️ → ' + attack.targetX + '|' + attack.targetY + '<br><span style="font-size:9px;font-weight:normal;">' + unitStr + '</span>';
        document.body.appendChild(info);
      }, delay + 300);
    });
  }

})();
