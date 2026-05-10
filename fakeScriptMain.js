// TW Fake Executor v4.2
(function() {
  'use strict';

  function decodeBase64Utf8(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);

    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }

    var escaped = '';
    for (var j = 0; j < bytes.length; j++) {
      var hex = bytes[j].toString(16).toUpperCase();
      escaped += '%' + (hex.length < 2 ? '0' + hex : hex);
    }
    return decodeURIComponent(escaped);
  }

  if (typeof _twFakeData === 'undefined') {
    alert('⚠️ Chýba konfigurácia. Najprv vygeneruj bookmarklet cez launcher.');
    return;
  }

  var config;
  try {
    config = JSON.parse(decodeBase64Utf8(_twFakeData));
  } catch (e) {
    alert('❌ Nepodarilo sa dekódovať konfiguráciu: ' + e.message);
    return;
  }

  var STORAGE_NAMESPACE = 'twFakeExecutor.v4';
  var worldProfileId = String(
    config.worldId ||
    ((typeof game_data !== 'undefined' && game_data.world) ? game_data.world : 'default')
  );
  var STORAGE_KEY = STORAGE_NAMESPACE + '.' + worldProfileId;
  var LEGACY_STORAGE_KEY = STORAGE_NAMESPACE;
  var fakeLimit = clampNumber(config.fakeLimit, 0, 100, 0.5);
  var fakeMinPop = clampInt(config.fakeMinPop, 0, 100000, 0);
  var openTabs = 5;
  var openTabDelayMs = 0;
  var maxFakesPerTarget = 0;
  var maxFakesPerVillage = 0;
  var unitMode = 'random';
  var fakeLimitRounding = 'ceil';
  var villagePointsSource = 'combined';
  var planningServerNow = null;

  var arrivalStart = config.arrivalStart ? new Date(config.arrivalStart) : null;
  var arrivalEnd = config.arrivalEnd ? new Date(config.arrivalEnd) : null;
  var worldSpeed = Number(config.worldSpeed) || 1;
  var unitSpeedMod = Number(config.unitSpeedMod) || 1;

  var targets = Array.isArray(config.targets) ? normalizeTargets(config.targets) : [];
  var persistedState = loadState();
  var coordTables = ensureCoordTables(persistedState.coordTables, targets);
  var activeTableId = getInitialActiveTableId(coordTables, persistedState.activeTableId);
  targets = getTargetsForActiveTable();

  if (persistedState.arrivalStart) arrivalStart = parseStoredDate(persistedState.arrivalStart);
  if (persistedState.arrivalEnd) arrivalEnd = parseStoredDate(persistedState.arrivalEnd);
  if (persistedState.fakeLimit != null) fakeLimit = clampNumber(persistedState.fakeLimit, 0, 100, 0.5);
  if (persistedState.fakeMinPop != null) fakeMinPop = clampInt(persistedState.fakeMinPop, 0, 100000, 0);
  if (persistedState.openTabs != null) openTabs = clampInt(persistedState.openTabs, 1, 50, 5);
  if (persistedState.openTabDelayMs != null) openTabDelayMs = clampInt(persistedState.openTabDelayMs, 0, 60000, 0);
  if (persistedState.maxFakesPerTarget != null) maxFakesPerTarget = Math.max(0, parseInt(persistedState.maxFakesPerTarget, 10) || 0);
  if (persistedState.maxFakesPerVillage != null) maxFakesPerVillage = Math.max(0, parseInt(persistedState.maxFakesPerVillage, 10) || 0);
  if (persistedState.unitMode === 'manual' || persistedState.unitMode === 'random') unitMode = persistedState.unitMode;
  if (persistedState.fakeLimitRounding === 'ceil' || persistedState.fakeLimitRounding === 'round' || persistedState.fakeLimitRounding === 'floor') {
    fakeLimitRounding = persistedState.fakeLimitRounding;
  }
  if (fakeLimit > 0 && fakeLimitRounding === 'floor') fakeLimitRounding = 'ceil';

  function log(msg) { console.log('[TW-Fake] ' + msg); }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  var unitPop = {
    spear: 1, sword: 1, axe: 1, archer: 1,
    spy: 2, light: 4, marcher: 5, heavy: 6,
    ram: 5, catapult: 8, knight: 10, snob: 100
  };

  var unitSpeed = {
    spear: 18, sword: 22, axe: 18, archer: 18,
    spy: 9, light: 10, marcher: 10, heavy: 11,
    ram: 30, catapult: 30, knight: 10, snob: 35
  };

  var excludedUnits = { militia: true, knight: true, snob: true };

  var allGameUnits = (typeof game_data !== 'undefined' && Array.isArray(game_data.units))
    ? game_data.units.slice()
    : ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult'];

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (isNaN(num)) return fallback;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  }

  function clampInt(value, min, max, fallback) {
    var num = parseInt(value, 10);
    if (isNaN(num)) return fallback;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  }

  function safeLocalStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeLocalStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { log('⚠️ Nepodarilo sa uložiť nastavenia: ' + e.message); }
  }

  function parseStateRaw(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      log('⚠️ Poškodené uložené nastavenia, používam default.');
      return {};
    }
  }

  function loadState() {
    var raw = safeLocalStorageGet(STORAGE_KEY);
    if (raw) return parseStateRaw(raw);

    if (STORAGE_KEY !== LEGACY_STORAGE_KEY) {
      var legacyRaw = safeLocalStorageGet(LEGACY_STORAGE_KEY);
      if (legacyRaw) return parseStateRaw(legacyRaw);
    }

    return {};
  }

  function saveState(extra) {
    var current = loadState();
    var next = {};
    for (var key in current) {
      if (hasOwn(current, key)) next[key] = current[key];
    }
    for (var extraKey in extra) {
      if (hasOwn(extra, extraKey)) next[extraKey] = extra[extraKey];
    }
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(next));
  }

  function parseStoredDate(value) {
    if (!value) return null;
    var dt = new Date(value);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function normalizeTargets(input) {
    var seen = {};
    var normalized = [];
    if (!Array.isArray(input)) return normalized;

    for (var i = 0; i < input.length; i++) {
      var item = input[i];
      if (!item) continue;
      var x = parseInt(item.x, 10);
      var y = parseInt(item.y, 10);
      if (isNaN(x) || isNaN(y)) continue;
      var key = x + '|' + y;
      if (seen[key]) continue;
      seen[key] = true;
      normalized.push({ x: x, y: y });
    }
    return normalized;
  }

  function cloneUnits(units) {
    var cloned = {};
    for (var unitName in units) {
      if (!hasOwn(units, unitName)) continue;
      if ((units[unitName] || 0) > 0) cloned[unitName] = units[unitName];
    }
    return cloned;
  }

  function hasAnyUnits(units) {
    for (var unitName in units) {
      if (!hasOwn(units, unitName)) continue;
      if ((units[unitName] || 0) > 0) return true;
    }
    return false;
  }

  function getUnitsPopulation(units) {
    var total = 0;
    for (var unitName in units) {
      if (!hasOwn(units, unitName)) continue;
      total += (units[unitName] || 0) * (unitPop[unitName] || 1);
    }
    return total;
  }

  function consumeUnits(availableUnits, usedUnits) {
    for (var unitName in usedUnits) {
      if (!hasOwn(usedUnits, unitName)) continue;
      var remaining = (availableUnits[unitName] || 0) - usedUnits[unitName];
      if (remaining > 0) {
        availableUnits[unitName] = remaining;
      } else {
        delete availableUnits[unitName];
      }
    }
  }

  function canStartFakeFromUnits(availableUnits) {
    return (availableUnits.spy || 0) >= 1 &&
      (((availableUnits.ram || 0) >= 2) || ((availableUnits.catapult || 0) >= 2));
  }

  function getFakeCoreRequiredPop(units) {
    if ((units.spy || 0) < 1) return 0;
    if ((units.ram || 0) >= 2) return unitPop.spy + (unitPop.ram * 2);
    if ((units.catapult || 0) >= 2) return unitPop.spy + (unitPop.catapult * 2);
    return 0;
  }

  function getPointBasedFakePop(villagePoints, fakeLimitPct) {
    var raw = villagePoints > 0 ? villagePoints * (fakeLimitPct / 100) : 0;
    if (!raw) return 0;
    if (fakeLimitRounding === 'ceil') return Math.ceil(raw);
    if (fakeLimitRounding === 'round') return Math.round(raw);
    return Math.floor(raw);
  }

  function getFakePopBudget(fakeLimitPct, villagePoints, minRequired) {
    var pointBased = getPointBasedFakePop(villagePoints, fakeLimitPct);
    return Math.max(minRequired, pointBased, fakeMinPop);
  }

  function createTable(name, tableTargets) {
    return {
      id: 'tbl_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
      name: name || 'Hlavná tabuľka',
      targets: normalizeTargets(tableTargets || [])
    };
  }

  function ensureCoordTables(storedTables, fallbackTargets) {
    var tables = [];
    if (Array.isArray(storedTables)) {
      for (var i = 0; i < storedTables.length; i++) {
        var table = storedTables[i];
        if (!table) continue;
        var name = (table.name || '').trim() || ('Tabuľka ' + (tables.length + 1));
        var normalizedTargets = normalizeTargets(table.targets || []);
        tables.push({ id: table.id || createTable(name, normalizedTargets).id, name: name, targets: normalizedTargets });
      }
    }

    if (!tables.length) {
      tables.push(createTable('Hlavná tabuľka', fallbackTargets || []));
    }
    return tables;
  }

  function getInitialActiveTableId(tables, storedId) {
    for (var i = 0; i < tables.length; i++) {
      if (tables[i].id === storedId) return storedId;
    }
    return tables[0].id;
  }

  function getActiveTable() {
    for (var i = 0; i < coordTables.length; i++) {
      if (coordTables[i].id === activeTableId) return coordTables[i];
    }
    activeTableId = coordTables[0].id;
    return coordTables[0];
  }

  function getTargetsForActiveTable() {
    return normalizeTargets(getActiveTable().targets);
  }

  function persistTables() {
    saveState({
      coordTables: coordTables,
      activeTableId: activeTableId
    });
  }

  function randInt(min, max) {
    if (max <= 0) return 0;
    if (max < min) return max;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffleArray(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var swapIndex = randInt(0, i);
      var tmp = copy[i];
      copy[i] = copy[swapIndex];
      copy[swapIndex] = tmp;
    }
    return copy;
  }

  function getFillOrder() {
    var cheap = ['spear', 'sword', 'axe', 'archer'];
    var medium = ['spy', 'light', 'ram', 'marcher', 'heavy', 'catapult'];

    if (unitMode === 'random') {
      cheap = shuffleArray(cheap);
      medium = shuffleArray(medium);
    }

    return cheap.concat(medium);
  }

  function fillCloseToRequired(selected, availableUnits, usedPop, requiredPop, fillOrder) {
    var changed = true;

    while (changed && usedPop < requiredPop) {
      changed = false;
      var remaining = requiredPop - usedPop;

      for (var i = 0; i < fillOrder.length; i++) {
        var unitName = fillOrder[i];
        var pop = unitPop[unitName] || 1;
        var already = selected[unitName] || 0;
        var available = (availableUnits[unitName] || 0) - already;

        if (available <= 0) continue;
        if (pop > remaining) continue;

        selected[unitName] = already + 1;
        usedPop += pop;
        changed = true;

        if (usedPop >= requiredPop) break;
      }
    }

    return { selected: selected, usedPop: usedPop };
  }

  function topOffToRequired(selected, availableUnits, usedPop, requiredPop, fillOrder) {
    while (usedPop < requiredPop) {
      var bestUnit = null;
      var bestOvershoot = Infinity;
      var bestPop = Infinity;

      for (var i = 0; i < fillOrder.length; i++) {
        var unitName = fillOrder[i];
        var pop = unitPop[unitName] || 1;
        var already = selected[unitName] || 0;
        var available = (availableUnits[unitName] || 0) - already;
        if (available <= 0) continue;

        var overshoot = usedPop + pop - requiredPop;
        if (overshoot < 0) continue;

        if (overshoot < bestOvershoot || (overshoot === bestOvershoot && pop < bestPop)) {
          bestUnit = unitName;
          bestOvershoot = overshoot;
          bestPop = pop;
        }
      }

      if (!bestUnit) break;

      selected[bestUnit] = (selected[bestUnit] || 0) + 1;
      usedPop += unitPop[bestUnit] || 1;
    }

    return { selected: selected, usedPop: usedPop };
  }

  function buildFakeCoreSelection(availableUnits, preferRandomSiege) {
    if (!canStartFakeFromUnits(availableUnits)) return null;

    var selected = { spy: 1 };
    var usedPop = unitPop.spy;
    var hasRam = (availableUnits.ram || 0) >= 2;
    var hasCat = (availableUnits.catapult || 0) >= 2;
    var siegeType = hasRam ? 'ram' : 'catapult';

    if (hasRam && hasCat && preferRandomSiege) {
      siegeType = Math.random() < 0.5 ? 'ram' : 'catapult';
    }

    selected[siegeType] = 2;
    usedPop += (unitPop[siegeType] || 1) * 2;

    return {
      selected: selected,
      usedPop: usedPop
    };
  }

  function finalizeSelectedUnits(selected, availableUnits, requiredPop, usedPop) {
    if (getUnitsPopulation(availableUnits) < requiredPop) return {};

    var fillOrder = getFillOrder();
    var filled = fillCloseToRequired(selected, availableUnits, usedPop, requiredPop, fillOrder);
    selected = filled.selected;
    usedPop = filled.usedPop;

    if (usedPop < requiredPop) {
      filled = topOffToRequired(selected, availableUnits, usedPop, requiredPop, fillOrder);
      selected = filled.selected;
      usedPop = filled.usedPop;
    }

    if (usedPop < requiredPop) return {};

    for (var unitName in selected) {
      if (!hasOwn(selected, unitName)) continue;
      if (selected[unitName] > (availableUnits[unitName] || 0)) return {};
    }

    return selected;
  }

  function selectRandomUnits(availableUnits, fakeLimitPct, villagePoints) {
    var core = buildFakeCoreSelection(availableUnits, true);
    if (!core) return {};

    var requiredPop = getFakePopBudget(fakeLimitPct, villagePoints, core.usedPop);
    return finalizeSelectedUnits(core.selected, availableUnits, requiredPop, core.usedPop);
  }

  function selectManualUnits(availableUnits, fakeLimitPct, villagePoints) {
    var core = buildFakeCoreSelection(availableUnits, false);
    if (!core) return {};

    var requiredPop = getFakePopBudget(fakeLimitPct, villagePoints, core.usedPop);
    return finalizeSelectedUnits(core.selected, availableUnits, requiredPop, core.usedPop);
  }

  function selectUnitsForFake(availableUnits, fakeLimitPct, villagePoints) {
    if (unitMode === 'random') return selectRandomUnits(availableUnits, fakeLimitPct, villagePoints);
    return selectManualUnits(availableUnits, fakeLimitPct, villagePoints);
  }

  function isCombinedOverviewPage() {
    var url = new URL(window.location.href, window.location.origin);
    return url.searchParams.get('screen') === 'overview_villages' &&
      url.searchParams.get('mode') === 'combined';
  }

  var isCombined = isCombinedOverviewPage();
  if (!isCombined) {
    var currentUrl = new URL(window.location.href, window.location.origin);
    if (currentUrl.searchParams.get('screen') === 'place') {
      alert('ℹ️ Tento skript spúšťaj iba na Kombinovanej stránke.');
      return;
    }
    if (typeof game_data !== 'undefined' && game_data.village && game_data.village.id) {
      currentUrl.searchParams.set('village', game_data.village.id);
      currentUrl.searchParams.set('screen', 'overview_villages');
      currentUrl.searchParams.set('mode', 'combined');
      window.location.href = currentUrl.toString();
      return;
    }
    alert('⚠️ Otvor stránku Kombinované (overview_villages&mode=combined).');
    return;
  }

  showConfigPanel();

  function toDatetimeLocal(date) {
    if (!date) return '';
    var d = new Date(date);
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function targetsToText(tArr) {
    return normalizeTargets(tArr).map(function(t) { return t.x + '|' + t.y; }).join('\n');
  }

  function parseCoords(text) {
    var result = [];
    var seen = {};
    var matches = String(text || '').match(/(\d{3})\|(\d{3})/g);
    if (matches) {
      for (var i = 0; i < matches.length; i++) {
        var parts = matches[i].split('|');
        var x = parseInt(parts[0], 10);
        var y = parseInt(parts[1], 10);
        var key = x + '|' + y;
        if (seen[key]) continue;
        seen[key] = true;
        result.push({ x: x, y: y });
      }
    }
    return result;
  }

  function updateCoordCount(textarea) {
    var parsed = parseCoords(textarea.value);
    document.getElementById('tw-cfg-coord-count').textContent = '📍 ' + parsed.length + ' unikátnych súradníc';
  }

  function renderTableOptions() {
    var select = document.getElementById('tw-cfg-table-select');
    if (!select) return;

    var html = '';
    for (var i = 0; i < coordTables.length; i++) {
      var table = coordTables[i];
      html += '<option value="' + escapeHtml(table.id) + '"' + (table.id === activeTableId ? ' selected' : '') + '>' +
        escapeHtml(table.name) + ' (' + table.targets.length + ')' +
        '</option>';
    }
    select.innerHTML = html;
  }

  function loadActiveTableIntoForm() {
    var table = getActiveTable();
    var nameInput = document.getElementById('tw-cfg-table-name');
    var coordsInput = document.getElementById('tw-cfg-coords');
    if (!nameInput || !coordsInput) return;

    nameInput.value = table.name;
    coordsInput.value = targetsToText(table.targets);
    updateCoordCount(coordsInput);
    renderTableOptions();
  }

  function saveCurrentTableFromForm() {
    var nameInput = document.getElementById('tw-cfg-table-name');
    var coordsInput = document.getElementById('tw-cfg-coords');
    var table = getActiveTable();
    var tableName = (nameInput.value || '').trim() || 'Tabuľka ' + (coordTables.indexOf(table) + 1);
    var parsedTargets = parseCoords(coordsInput.value);

    table.name = tableName;
    table.targets = parsedTargets;
    targets = parsedTargets;
    persistTables();
    renderTableOptions();
    updateCoordCount(coordsInput);
  }

  function createNewTableFromForm() {
    var nameInput = document.getElementById('tw-cfg-table-name');
    var coordsInput = document.getElementById('tw-cfg-coords');
    var newName = (nameInput.value || '').trim() || ('Tabuľka ' + (coordTables.length + 1));
    var newTargets = parseCoords(coordsInput.value);

    var newTable = createTable(newName, newTargets);
    coordTables.push(newTable);
    activeTableId = newTable.id;
    targets = newTargets;
    persistTables();
    loadActiveTableIntoForm();
  }

  function deleteCurrentTable() {
    if (coordTables.length <= 1) {
      var onlyTable = getActiveTable();
      onlyTable.name = 'Hlavná tabuľka';
      onlyTable.targets = [];
      targets = [];
      persistTables();
      loadActiveTableIntoForm();
      return;
    }

    coordTables = coordTables.filter(function(table) { return table.id !== activeTableId; });
    activeTableId = coordTables[0].id;
    targets = getTargetsForActiveTable();
    persistTables();
    loadActiveTableIntoForm();
  }

  function showConfigPanel() {
    var old = document.getElementById('tw-fake-config');
    if (old) old.remove();

    var p = document.createElement('div');
    p.id = 'tw-fake-config';
    p.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:12px;">';
    h += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake - Konfigurácia</h2>';
    h += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v4.2 | svet: ' + escapeHtml(config.worldId || '?') + ' | rýchlosť: ' + worldSpeed + 'x | jednotky: ' + unitSpeedMod + 'x</p>';
    h += '</div>';

    h += '<div style="margin-bottom:10px;padding:10px;background:#e8d5a3;border-radius:4px;">';
    h += '<label style="font-weight:bold;display:block;margin-bottom:4px;">🗂️ Tabuľky cieľov:</label>';
    h += '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;">';
    h += '<div style="flex:1;min-width:190px;"><label style="font-size:10px;">Vyber tabuľku:</label><select id="tw-cfg-table-select" style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;box-sizing:border-box;"></select></div>';
    h += '<div style="flex:1;min-width:190px;"><label style="font-size:10px;">Názov tabuľky:</label><input id="tw-cfg-table-name" type="text" value="" placeholder="Napr. Offka sever" style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;box-sizing:border-box;" /></div>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;margin-top:8px;">';
    h += '<button id="tw-cfg-table-save" style="flex:1;padding:7px;background:#7d510f;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">💾 Uložiť aktuálnu</button>';
    h += '<button id="tw-cfg-table-new" style="flex:1;padding:7px;background:#4a7c3f;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">➕ Nová z obsahu</button>';
    h += '<button id="tw-cfg-table-delete" style="padding:7px 12px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">🗑️</button>';
    h += '</div>';
    h += '</div>';

    h += '<div style="margin-bottom:10px;">';
    h += '<label style="font-weight:bold;">🎯 Cieľové súradnice:</label>';
    h += '<textarea id="tw-cfg-coords" rows="5" placeholder="500|500&#10;501|501" style="width:100%;margin-top:3px;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;resize:vertical;font-family:monospace;box-sizing:border-box;"></textarea>';
    h += '<div id="tw-cfg-coord-count" style="font-size:10px;color:#8b7355;margin-top:2px;">📍 0 unikátnych súradníc</div>';
    h += '</div>';

    h += '<div style="margin-bottom:10px;">';
    h += '<label style="font-weight:bold;">🕐 Okno príchodu (pamätá si poslednú hodnotu):</label>';
    h += '<div style="display:flex;gap:8px;margin-top:3px;">';
    h += '<div style="flex:1;"><label style="font-size:10px;">Od:</label><input id="tw-cfg-arrival-start" type="datetime-local" value="' + toDatetimeLocal(arrivalStart) + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;box-sizing:border-box;" /></div>';
    h += '<div style="flex:1;"><label style="font-size:10px;">Do:</label><input id="tw-cfg-arrival-end" type="datetime-local" value="' + toDatetimeLocal(arrivalEnd) + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;box-sizing:border-box;" /></div>';
    h += '</div></div>';

    h += '<div style="margin-bottom:10px;padding:8px;background:#e8d5a3;border-radius:4px;">';
    h += '<label style="font-weight:bold;">Režim jednotiek:</label><br/>';
    h += '<label style="cursor:pointer;margin-right:12px;"><input type="radio" name="tw-mode" value="random"' + (unitMode === 'random' ? ' checked' : '') + ' /> 🎲 Random</label>';
    h += '<label style="cursor:pointer;"><input type="radio" name="tw-mode" value="manual"' + (unitMode === 'manual' ? ' checked' : '') + ' /> ✏️ Manuálny</label>';
    h += '</div>';

    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
    h += '<tr><td style="padding:3px;font-weight:bold;">Fake limit (% z bodov):</td>';
    h += '<td><input id="tw-cfg-fakelimit" type="number" value="' + fakeLimit + '" step="0.1" min="0" max="100" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = percento sa nepoužije, napr. 1 = 1% bodov dediny</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Pevné minimum fake pop:</td>';
    h += '<td><input id="tw-cfg-fakeminpop" type="number" value="' + fakeMinPop + '" min="0" max="100000" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">Neurčuje sa z bodov dediny. 0 = vypnuté. Použi len ak svet vyžaduje fixné minimum pre každý fake, napr. 100 pop.</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Zaokrúhlenie fake:</td>';
    h += '<td><select id="tw-cfg-rounding" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;">';
    h += '<option value="floor"' + (fakeLimitRounding === 'floor' ? ' selected' : '') + '>floor (51.75 → 51)</option>';
    h += '<option value="ceil"' + (fakeLimitRounding === 'ceil' ? ' selected' : '') + '>ceil (51.75 → 52)</option>';
    h += '<option value="round"' + (fakeLimitRounding === 'round' ? ' selected' : '') + '>round (51.75 → 52)</option>';
    h += '</select><div style="font-size:9px;color:#8b7355;">Pre fake limit je zvyčajne najbezpečnejšie ceil. Body berie z Produkcie, ak sa ju podarí načítať.</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Open tabs:</td>';
    h += '<td><input id="tw-cfg-opentabs" type="number" value="' + openTabs + '" min="1" max="50" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Delay medzi tabmi (ms):</td>';
    h += '<td><input id="tw-cfg-tabdelay" type="number" value="' + openTabDelayMs + '" min="0" max="60000" step="50" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = otvorí všetky hneď, inak ich pustí postupne</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov na cieľ:</td>';
    h += '<td><input id="tw-cfg-maxpertarget" type="number" value="' + maxFakesPerTarget + '" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov z dediny:</td>';
    h += '<td><input id="tw-cfg-maxpervillage" type="number" value="' + maxFakesPerVillage + '" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';
    h += '</table>';

    h += '<div style="background:#e8f4e8;padding:6px 10px;border-radius:4px;margin-bottom:10px;font-size:10px;color:#2d5a27;">';
    h += '🪖 Základ fake: <b>1 spy + 2 ram/cat</b> | 🔀 Dorovná na <b>aspoň required pop</b> | 💾 Pamätá si posledné nastavenia aj tabuľky coordov';
    h += '<br/>Pri percentovom svete sa required pop ráta osobitne z bodov každej dediny. Príklad: svet s <b>0,5%</b> nastavíš ako <b>0.5</b> + <b>0</b>.';
    h += '<br/>Pevné minimum používaj len ak svet vyžaduje napríklad <b>100 pop</b> na každý fake bez ohľadu na body dediny.';
    h += '</div>';

    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-cfg-start" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Spustiť</button>';
    h += '<button id="tw-cfg-close" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    p.innerHTML = h;
    document.body.appendChild(p);

    renderTableOptions();
    loadActiveTableIntoForm();

    var coordInput = document.getElementById('tw-cfg-coords');
    var tableSelect = document.getElementById('tw-cfg-table-select');

    coordInput.addEventListener('input', function() {
      updateCoordCount(coordInput);
    });

    tableSelect.addEventListener('change', function() {
      activeTableId = this.value;
      targets = getTargetsForActiveTable();
      persistTables();
      loadActiveTableIntoForm();
    });

    document.getElementById('tw-cfg-table-save').onclick = function() {
      saveCurrentTableFromForm();
      alert('💾 Aktuálna tabuľka bola uložená.');
    };

    document.getElementById('tw-cfg-table-new').onclick = function() {
      createNewTableFromForm();
      alert('➕ Vytvorená nová tabuľka cieľov.');
    };

    document.getElementById('tw-cfg-table-delete').onclick = function() {
      if (!window.confirm('Naozaj chceš zmazať aktuálnu tabuľku cieľov?')) return;
      deleteCurrentTable();
    };

    document.getElementById('tw-cfg-close').onclick = function() { p.remove(); };

    document.getElementById('tw-cfg-start').onclick = function() {
      saveCurrentTableFromForm();

      targets = getTargetsForActiveTable();
      if (!targets.length) {
        alert('⚠️ Zadaj aspoň jednu cieľovú súradnicu!');
        return;
      }

      var aStart = document.getElementById('tw-cfg-arrival-start').value;
      var aEnd = document.getElementById('tw-cfg-arrival-end').value;
      arrivalStart = aStart ? new Date(aStart) : null;
      arrivalEnd = aEnd ? new Date(aEnd) : null;

      fakeLimit = clampNumber(document.getElementById('tw-cfg-fakelimit').value, 0, 100, 0.5);
      fakeMinPop = clampInt(document.getElementById('tw-cfg-fakeminpop').value, 0, 100000, 0);
      fakeLimitRounding = document.getElementById('tw-cfg-rounding').value || 'floor';
      if (fakeLimit > 0 && fakeLimitRounding === 'floor') fakeLimitRounding = 'ceil';
      openTabs = clampInt(document.getElementById('tw-cfg-opentabs').value, 1, 50, 5);
      openTabDelayMs = clampInt(document.getElementById('tw-cfg-tabdelay').value, 0, 60000, 0);
      maxFakesPerTarget = Math.max(0, parseInt(document.getElementById('tw-cfg-maxpertarget').value, 10) || 0);
      maxFakesPerVillage = Math.max(0, parseInt(document.getElementById('tw-cfg-maxpervillage').value, 10) || 0);

      if (arrivalStart && arrivalEnd && arrivalStart.getTime() > arrivalEnd.getTime()) {
        alert('⚠️ Čas "Od" musí byť menší alebo rovný času "Do".');
        return;
      }

      var modeRadios = document.querySelectorAll('input[name="tw-mode"]');
      for (var i = 0; i < modeRadios.length; i++) {
        if (modeRadios[i].checked) {
          unitMode = modeRadios[i].value;
          break;
        }
      }

      saveState({
        arrivalStart: arrivalStart ? arrivalStart.toISOString() : '',
        arrivalEnd: arrivalEnd ? arrivalEnd.toISOString() : '',
        fakeLimit: fakeLimit,
        fakeMinPop: fakeMinPop,
        openTabs: openTabs,
        openTabDelayMs: openTabDelayMs,
        fakeLimitRounding: fakeLimitRounding,
        maxFakesPerTarget: maxFakesPerTarget,
        maxFakesPerVillage: maxFakesPerVillage,
        unitMode: unitMode,
        coordTables: coordTables,
        activeTableId: activeTableId
      });

      p.remove();
      runFakeAttacks();
    };
  }

  async function runFakeAttacks() {
    var villages = parseVillagesFromCombined();
    if (!villages.length) {
      alert('⚠️ Nenašli sa žiadne dediny s jednotkami.');
      return;
    }

    await enrichVillagesWithProductionPoints(villages);
    planningServerNow = parseServerNow();

    var viableVillages = filterViableVillages(villages, targets);
    if (!viableVillages.length) {
      alert('⚠️ Žiadna dedina nedosahuje cieľ v zadanom časovom okne.');
      return;
    }

    var sortedVillages = sortVillagesByReach(viableVillages, targets);
    var attackQueue = buildAttackQueue(sortedVillages, targets, fakeLimit);
    log('⚔️ Naplánovaných útokov: ' + attackQueue.length + ' (režim: ' + unitMode + ')');

    if (!attackQueue.length) {
      alert('⚠️ Nevytvoril sa žiadny útok. Skontroluj limity a jednotky.');
      return;
    }

    window._twAttackQueue = attackQueue;
    window._twAttackIndex = 0;
    window._twLaunchInProgress = false;
    showControlPanel(attackQueue);
  }

  function getVillageKeyByCoords(village) {
    return village.x + '|' + village.y;
  }

  function getProductionOverviewUrl() {
    var link = document.querySelector('a[href*="screen=overview_villages"][href*="mode=prod"]');
    if (link && link.href) return link.href;

    var url = new URL(window.location.href, window.location.origin);
    url.searchParams.set('screen', 'overview_villages');
    url.searchParams.set('mode', 'prod');
    return url.toString();
  }

  function parseVillagePointsFromDocument(doc) {
    var result = {};
    var rows = doc.querySelectorAll('#production_table tr.row_a, #production_table tr.row_b, #combined_table tr.row_a, #combined_table tr.row_b, tr.row_a, tr.row_b');

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var villageLink = row.querySelector('.quickedit-content a[href*="village="]') || row.querySelector('a[href*="village="]');
      var coordSource = row.querySelector('.quickedit-label') || villageLink;
      if (!villageLink || !coordSource) continue;

      var idMatch = (villageLink.href || '').match(/village=(\d+)/);
      var coordMatch = (coordSource.textContent || '').match(/(\d{3})\|(\d{3})/);
      if (!coordMatch) continue;

      var pointsEl = row.querySelector('.points') || row.querySelector('td[class*="point"]');
      if (!pointsEl) continue;

      var points = parseInt((pointsEl.textContent || '').replace(/\D+/g, ''), 10) || 0;
      var entry = {
        id: idMatch ? idMatch[1] : null,
        key: coordMatch[1] + '|' + coordMatch[2],
        points: points
      };

      if (entry.id) result['id:' + entry.id] = entry.points;
      result['coord:' + entry.key] = entry.points;
    }

    return result;
  }

  async function fetchProductionPointsMap() {
    var url = getProductionOverviewUrl();
    var response = await window.fetch(url, {
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    var html = await response.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    return parseVillagePointsFromDocument(doc);
  }

  async function enrichVillagesWithProductionPoints(villages) {
    villagePointsSource = 'combined';
    try {
      var pointsMap = await fetchProductionPointsMap();
      var updated = 0;

      for (var i = 0; i < villages.length; i++) {
        var village = villages[i];
        var byId = pointsMap['id:' + village.id];
        var byCoord = pointsMap['coord:' + getVillageKeyByCoords(village)];
        var points = typeof byId === 'number' ? byId : byCoord;
        if (typeof points === 'number' && points > 0) {
          village.points = points;
          updated++;
        }
      }

      if (updated > 0) {
        villagePointsSource = 'production';
        log('📊 Body načítané z Produkcie pre ' + updated + ' dedín.');
      } else {
        log('ℹ️ Produkcia sa načítala, ale body sa nepodarilo spárovať. Používam body z Kombinované.');
      }
    } catch (e) {
      log('⚠️ Produkciu sa nepodarilo načítať: ' + e.message + '. Používam body z Kombinované.');
    }
  }

  function parseVillagesFromCombined() {
    var result = [];
    var rows = document.querySelectorAll('#combined_table tr.row_a, #combined_table tr.row_b');
    if (!rows.length) rows = document.querySelectorAll('tr.row_a, tr.row_b');

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var villageLink = row.querySelector('.quickedit-content a[href*="village="]') || row.querySelector('a[href*="village="]');
      var coordSource = row.querySelector('.quickedit-label') || villageLink;
      if (!villageLink || !coordSource) continue;

      var idMatch = (villageLink.href || '').match(/village=(\d+)/);
      if (!idMatch) continue;

      var coordMatch = (coordSource.textContent || '').match(/(\d{3})\|(\d{3})/);
      if (!coordMatch) continue;

      var villageId = idMatch[1];
      var vx = parseInt(coordMatch[1], 10);
      var vy = parseInt(coordMatch[2], 10);

      var pointsEl = row.querySelector('.points') || row.querySelector('td[class*="point"]');
      var villagePoints = 0;
      if (pointsEl) {
        villagePoints = parseInt((pointsEl.textContent || '').replace(/\D+/g, ''), 10) || 0;
      }

      var unitCells = row.querySelectorAll('td.unit-item');
      if (!unitCells.length) continue;

      var units = {};
      for (var j = 0; j < unitCells.length && j < allGameUnits.length; j++) {
        var unitName = allGameUnits[j];
        if (excludedUnits[unitName]) continue;
        var val = parseInt((unitCells[j].textContent || '').replace(/\D+/g, ''), 10) || 0;
        if (val > 0) units[unitName] = val;
      }

      var totalPop = 0;
      totalPop = getUnitsPopulation(units);

      if (totalPop > 0) {
        result.push({
          id: villageId,
          x: vx,
          y: vy,
          name: (coordSource.textContent || '').trim(),
          units: units,
          totalPop: totalPop,
          points: villagePoints
        });
      }
    }
    return result;
  }

  function filterViableVillages(villages, targetList) {
    if (!arrivalStart && !arrivalEnd) return villages;

    var viable = [];
    var skipped = 0;

    for (var i = 0; i < villages.length; i++) {
      var v = villages[i];
      var testUnits = {};
      if ((v.units.ram || 0) >= 2) testUnits.ram = 2;
      else if ((v.units.catapult || 0) >= 2) testUnits.catapult = 2;
      else {
        skipped++;
        continue;
      }

      var canReach = false;
      for (var j = 0; j < targetList.length; j++) {
        if (isInArrivalWindow(v, targetList[j], testUnits)) {
          canReach = true;
          break;
        }
      }

      if (canReach) {
        viable.push(v);
      } else {
        skipped++;
        log('⏭️ Preskočená: ' + v.name + ' — žiadny cieľ v čas. okne');
      }
    }

    log('✅ Viabilných: ' + viable.length + ' | Preskočených: ' + skipped);
    return viable;
  }

  function sortVillagesByReach(villages, targetList) {
    if (!arrivalStart && !arrivalEnd) return villages;

    return villages.slice().sort(function(a, b) {
      var reachA = 0;
      var reachB = 0;
      var testA = (a.units.ram || 0) >= 2 ? { ram: 2 } : { catapult: 2 };
      var testB = (b.units.ram || 0) >= 2 ? { ram: 2 } : { catapult: 2 };
      for (var i = 0; i < targetList.length; i++) {
        if (isInArrivalWindow(a, targetList[i], testA)) reachA++;
        if (isInArrivalWindow(b, targetList[i], testB)) reachB++;
      }
      return reachB - reachA;
    });
  }

  function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  function getSlowestUnit(units) {
    var slowest = 'ram';
    var slowestValue = 0;
    for (var u in units) {
      if (!units[u] || units[u] <= 0) continue;
      var spd = unitSpeed[u] || 0;
      if (spd > slowestValue) {
        slowestValue = spd;
        slowest = u;
      }
    }
    return slowest;
  }

  function parseServerNow() {
    if (window.Timing && typeof window.Timing.getCurrentServerTime === 'function') {
      var serverTimestamp = Number(window.Timing.getCurrentServerTime());
      if (serverTimestamp > 0 && serverTimestamp < 1000000000000) {
        serverTimestamp *= 1000;
      }
      var timingDate = new Date(serverTimestamp);
      if (!isNaN(timingDate.getTime())) return timingDate;
    }

    var timeEl = document.getElementById('serverTime');
    var dateEl = document.getElementById('serverDate');
    if (timeEl && dateEl) {
      var t = (timeEl.textContent || '').trim();
      var d = (dateEl.textContent || '').trim();
      var dateParts = d.split(/[.\/-]/);
      var timeParts = t.split(':');
      if (dateParts.length === 3 && timeParts.length >= 2) {
        var dd = parseInt(dateParts[0], 10);
        var mm = parseInt(dateParts[1], 10) - 1;
        var yy = parseInt(dateParts[2], 10);
        var hh = parseInt(timeParts[0], 10);
        var mi = parseInt(timeParts[1], 10);
        var ss = parseInt(timeParts[2] || '0', 10);
        var dt = new Date(yy, mm, dd, hh, mi, ss);
        if (!isNaN(dt.getTime())) return dt;
      }
    }
    return new Date();
  }

  function calcTravelTimeMs(fromX, fromY, toX, toY, slowestUnit) {
    var dist = calcDistance(fromX, fromY, toX, toY);
    var minutesPerField = unitSpeed[slowestUnit] || 30;
    var msPerField = minutesPerField * 60 * 1000 / (worldSpeed * unitSpeedMod);
    return dist * msPerField;
  }

  function isInArrivalWindow(village, target, selectedUnits) {
    if (!arrivalStart && !arrivalEnd) return true;
    var now = planningServerNow || parseServerNow();
    var slowest = getSlowestUnit(selectedUnits);
    var arrivalMs = now.getTime() + calcTravelTimeMs(village.x, village.y, target.x, target.y, slowest);
    if (arrivalStart && arrivalMs < arrivalStart.getTime()) return false;
    if (arrivalEnd && arrivalMs > arrivalEnd.getTime()) return false;
    return true;
  }

  function buildAttackQueue(villageList, targetList, fakeLimitPct) {
    var queue = [];
    var preparedVillages = [];

    for (var i = 0; i < villageList.length; i++) {
      var v = villageList[i];
      if (!canStartFakeFromUnits(v.units)) continue;
      preparedVillages.push({
        village: v,
        remainingUnits: cloneUnits(v.units)
      });
    }

    if (!preparedVillages.length) return queue;

    var targetCap = maxFakesPerTarget > 0 ? maxFakesPerTarget : preparedVillages.length;
    var villageCap = maxFakesPerVillage > 0 ? maxFakesPerVillage : targetList.length;

    var targetCounts = {};
    var villageCounts = {};
    var targetCursor = 0;
    var maxTotal = targetList.length * targetCap;
    var safety = maxTotal * Math.max(1, preparedVillages.length) + 100;

    while (queue.length < maxTotal && safety-- > 0) {
      var progressed = false;

      for (var vi = 0; vi < preparedVillages.length; vi++) {
        var pv = preparedVillages[vi];
        var vKey = pv.village.id;
        if ((villageCounts[vKey] || 0) >= villageCap) continue;
        if (!canStartFakeFromUnits(pv.remainingUnits)) continue;

        var tries = 0;
        while (tries < targetList.length) {
          var target = targetList[targetCursor % targetList.length];
          targetCursor++;
          tries++;

          var tKey = target.x + '|' + target.y;
          if ((targetCounts[tKey] || 0) >= targetCap) continue;

          var attackUnits = selectUnitsForFake(pv.remainingUnits, fakeLimitPct, pv.village.points);
          if (!hasAnyUnits(attackUnits)) continue;

          if (!isInArrivalWindow(pv.village, target, attackUnits)) continue;

          var requiredPop = getFakePopBudget(fakeLimitPct, pv.village.points, getFakeCoreRequiredPop(attackUnits));

          queue.push({
            villageId: pv.village.id,
            villageName: pv.village.name,
            villageX: pv.village.x,
            villageY: pv.village.y,
            targetX: target.x,
            targetY: target.y,
            units: attackUnits,
            population: getUnitsPopulation(attackUnits),
            requiredPop: requiredPop,
            villagePoints: pv.village.points || 0
          });

          consumeUnits(pv.remainingUnits, attackUnits);
          targetCounts[tKey] = (targetCounts[tKey] || 0) + 1;
          villageCounts[vKey] = (villageCounts[vKey] || 0) + 1;
          progressed = true;
          break;
        }
      }
      if (!progressed) break;
    }
    return queue;
  }

  function showControlPanel(queue) {
    var old = document.getElementById('tw-fake-panel');
    if (old) old.remove();

    var panel = document.createElement('div');
    panel.id = 'tw-fake-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var activeTable = getActiveTable();
    var h = '<div style="text-align:center;margin-bottom:8px;">';
    h += '<h3 style="margin:0;color:#7d510f;">⚔️ Fake Attack Queue</h3>';
    h += '</div>';

    h += '<div style="background:#fff3cd;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:11px;">';
    h += '<b>' + queue.length + '</b> útokov | Režim: <b>' + (unitMode === 'random' ? '🎲 Random' : '✏️ Manuálny') + '</b><br/>';
    h += 'Tabuľka: <b>' + escapeHtml(activeTable.name) + '</b> | Percento: <b>' + fakeLimit + '%</b> | Min pop: <b>' + fakeMinPop + '</b><br/>';
    h += 'Tabs: <b>' + openTabs + '</b> | Delay: <b>' + openTabDelayMs + ' ms</b><br/>';
    h += 'Body: <b>' + (villagePointsSource === 'production' ? 'Produkcia' : 'Kombinované') + '</b> | Zaokrúhlenie: <b>' + fakeLimitRounding + '</b>';
    if (maxFakesPerTarget > 0) h += '<br/>Max/cieľ: <b>' + maxFakesPerTarget + '</b>';
    if (maxFakesPerVillage > 0) h += ' | Max/dedina: <b>' + maxFakesPerVillage + '</b>';
    if (arrivalStart || arrivalEnd) {
      h += '<br/>🕐 ' + (arrivalStart ? arrivalStart.toLocaleString('sk-SK') : '?') + ' – ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk-SK') : '?');
    }
    h += '</div>';

    h += '<div style="max-height:250px;overflow-y:auto;border:1px solid #d4a574;border-radius:4px;margin-bottom:8px;">';
    for (var i = 0; i < Math.min(queue.length, 30); i++) {
      var atk = queue[i];
      var unitStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
      var bg = i % 2 === 0 ? '#fff8e7' : '#f4e4bc';
      h += '<div style="padding:4px 8px;background:' + bg + ';border-bottom:1px solid #e6d5b8;font-size:10px;">';
      h += '<b>' + escapeHtml(atk.villageName.substring(0, 22)) + '</b> → ' + atk.targetX + '|' + atk.targetY;
      h += '<br/><span style="color:#8b7355;">' + escapeHtml(unitStr) + ' | pop:' + atk.population + ' | min:' + atk.requiredPop + ' | body:' + atk.villagePoints + '</span>';
      h += '</div>';
    }
    if (queue.length > 30) {
      h += '<div style="padding:4px 8px;text-align:center;font-size:10px;color:#8b7355;">...a ďalších ' + (queue.length - 30) + '</div>';
    }
    h += '</div>';

    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-start-btn" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">▶ Spustiť (' + openTabs + ' tabov)</button>';
    h += '<button id="tw-close-panel" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    panel.innerHTML = h;
    document.body.appendChild(panel);

    document.getElementById('tw-close-panel').onclick = function() { panel.remove(); };
    document.getElementById('tw-start-btn').onclick = launchAttacks;
  }

  function buildAttackUrl(attack) {
    var params = [
      'village=' + encodeURIComponent(attack.villageId),
      'screen=place',
      'x=' + encodeURIComponent(attack.targetX),
      'y=' + encodeURIComponent(attack.targetY)
    ];

    Object.keys(attack.units).forEach(function(unitName) {
      if (attack.units[unitName] > 0) {
        params.push(encodeURIComponent(unitName) + '=' + encodeURIComponent(attack.units[unitName]));
      }
    });

    return '/game.php?' + params.join('&');
  }

  function updateLaunchButtonState() {
    var btn = document.getElementById('tw-start-btn');
    var queue = window._twAttackQueue || [];
    var remaining = queue.length - (window._twAttackIndex || 0);
    if (!btn) return;

    if (window._twLaunchInProgress) {
      btn.textContent = '⏳ Otváram...';
      btn.disabled = true;
      btn.style.background = '#95a5a6';
      return;
    }

    if (remaining > 0) {
      btn.textContent = '▶ Ďalších ' + Math.min(openTabs, remaining) + ' (zostáva ' + remaining + ')';
      btn.disabled = false;
      btn.style.background = '#4a7c3f';
    } else {
      btn.textContent = '✅ Hotovo!';
      btn.disabled = true;
      btn.style.background = '#95a5a6';
    }
  }

  function launchAttacks() {
    if (window._twLaunchInProgress) return;

    var queue = window._twAttackQueue || [];
    var idx = window._twAttackIndex || 0;
    var tabsToOpen = Math.min(openTabs, queue.length - idx);

    if (tabsToOpen <= 0) {
      alert('✅ Všetky útoky už boli otvorené.');
      return;
    }

    var reserved = [];
    for (var i = 0; i < tabsToOpen; i++) {
      reserved.push(queue[idx + i]);
    }

    window._twAttackIndex = idx + tabsToOpen;
    window._twLaunchInProgress = true;
    updateLaunchButtonState();

    var openedWindows = [];
    for (var j = 0; j < reserved.length; j++) {
      openedWindows[j] = window.open('about:blank', '_blank');
    }

    for (var k = 0; k < reserved.length; k++) {
      (function(order) {
        window.setTimeout(function() {
          var attack = reserved[order];
          var targetWindow = openedWindows[order];
          var url = buildAttackUrl(attack);

          if (targetWindow) {
            try {
              targetWindow.location.href = url;
            } catch (e) {
              window.open(url, '_blank');
            }
          } else {
            window.open(url, '_blank');
          }

          if (order === reserved.length - 1) {
            window._twLaunchInProgress = false;
            updateLaunchButtonState();
          }
        }, openTabDelayMs * order);
      })(k);
    }

    if (!reserved.length) {
      window._twLaunchInProgress = false;
      updateLaunchButtonState();
    }

    var remaining = queue.length - window._twAttackIndex;
    log('📑 Naplánované otvorenie ' + tabsToOpen + ' tabov, zostáva ' + remaining + ', delay ' + openTabDelayMs + ' ms');
  }

})();
