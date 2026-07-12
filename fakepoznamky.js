(function() {
  'use strict';

  var STORAGE_KEY = 'twCourtyardFakeFill.v1';
  var PANEL_ID = 'tw-courtyard-fake-panel';
  var STATUS_ID = 'tw-courtyard-fake-status';
  var UNITS = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult'];
  var FILL_ORDER = ['spear', 'sword', 'axe', 'archer', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'spy'];
  var UNIT_POP = {
    spear: 1,
    sword: 1,
    axe: 1,
    archer: 1,
    spy: 2,
    light: 4,
    marcher: 5,
    heavy: 6,
    ram: 5,
    catapult: 8
  };

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

  function parseDigits(text) {
    return parseInt(String(text == null ? '' : text).replace(/\D+/g, ''), 10) || 0;
  }

  function safeStorageGet() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function safeStorageSet(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
  }

  function loadState() {
    var defaults = {
      fakeLimit: 1,
      fakeMinPop: 0,
      siege: 'ram'
    };

    var raw = safeStorageGet();
    if (!raw) return defaults;

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaults;

      defaults.fakeLimit = clampNumber(parsed.fakeLimit, 0, 100, defaults.fakeLimit);
      defaults.fakeMinPop = clampInt(parsed.fakeMinPop, 0, 100000, defaults.fakeMinPop);
      if (parsed.siege === 'ram' || parsed.siege === 'catapult') defaults.siege = parsed.siege;
    } catch (e) {}

    return defaults;
  }

  function saveState(state) {
    safeStorageSet(JSON.stringify({
      fakeLimit: clampNumber(state.fakeLimit, 0, 100, 1),
      fakeMinPop: clampInt(state.fakeMinPop, 0, 100000, 0),
      siege: state.siege === 'catapult' ? 'catapult' : 'ram'
    }));
  }

  function ensurePlacePage() {
    var url = new URL(window.location.href, window.location.origin);
    if (url.searchParams.get('screen') === 'place') return true;
    if (document.querySelector('input[name="x"]') && document.querySelector('input[name="spy"], input[name="ram"], input[name="catapult"]')) return true;
    alert('Tento script spusti na Nadvori / place.');
    return false;
  }

  function getVillagePoints() {
    try {
      if (window.game_data && window.game_data.village) {
        var points = parseInt(window.game_data.village.points, 10) || 0;
        if (points > 0) return points;
      }
    } catch (e) {}

    var info = document.body ? document.body.textContent : '';
    var match = info.match(/Body[:\s]*(\d[\d\s.]*)/i);
    if (match) return parseDigits(match[1]);
    return 0;
  }

  function getAvailableForUnit(unitName) {
    var direct = document.getElementById('units_entry_all_' + unitName) || document.querySelector('.units-entry-all[data-unit="' + unitName + '"]');
    if (direct) {
      var directCount = parseDigits(direct.textContent || direct.innerText || '');
      if (directCount > 0) return directCount;
    }

    var input = document.querySelector('input[name="' + unitName + '"]');
    if (!input) return 0;

    var candidates = [];
    if (input.parentElement) candidates.push(input.parentElement);
    if (input.closest) {
      var td = input.closest('td');
      var tr = input.closest('tr');
      if (td && candidates.indexOf(td) === -1) candidates.push(td);
      if (tr && candidates.indexOf(tr) === -1) candidates.push(tr);
    }

    for (var i = 0; i < candidates.length; i++) {
      var text = candidates[i].textContent || '';
      var parenMatches = text.match(/\((\d+)\)/g);
      if (parenMatches && parenMatches.length) {
        return parseDigits(parenMatches[parenMatches.length - 1]);
      }
      var fallbackCount = parseDigits(text);
      if (fallbackCount > 0) return fallbackCount;
    }

    return 0;
  }

  function getAvailableUnits() {
    var available = {};
    for (var i = 0; i < UNITS.length; i++) {
      available[UNITS[i]] = getAvailableForUnit(UNITS[i]);
    }
    return available;
  }

  function dispatchInputEvents(input) {
    var eventNames = ['input', 'change', 'keyup'];
    for (var i = 0; i < eventNames.length; i++) {
      try {
        input.dispatchEvent(new window.Event(eventNames[i], { bubbles: true }));
      } catch (e) {}
    }
  }

  function setUnitValue(unitName, value) {
    var input = document.querySelector('input[name="' + unitName + '"]');
    if (!input) return;
    input.value = value > 0 ? String(value) : '';
    dispatchInputEvents(input);
  }

  function chooseSiege(availableUnits, preferred) {
    var primary = preferred === 'catapult' ? 'catapult' : 'ram';
    var secondary = primary === 'ram' ? 'catapult' : 'ram';
    if ((availableUnits[primary] || 0) >= 2) return primary;
    if ((availableUnits[secondary] || 0) >= 2) return secondary;
    return '';
  }

  function fillToRequirement(selected, availableUnits, usedPop, requiredPop) {
    while (usedPop < requiredPop) {
      var bestUnit = '';
      var bestOvershoot = Infinity;
      var bestPop = Infinity;
      var filledExactly = false;

      for (var i = 0; i < FILL_ORDER.length; i++) {
        var unitName = FILL_ORDER[i];
        var pop = UNIT_POP[unitName] || 1;
        var already = selected[unitName] || 0;
        var available = (availableUnits[unitName] || 0) - already;
        if (available <= 0) continue;

        if (usedPop + pop <= requiredPop) {
          selected[unitName] = already + 1;
          usedPop += pop;
          filledExactly = true;
          break;
        }

        var overshoot = usedPop + pop - requiredPop;
        if (overshoot >= 0 && (overshoot < bestOvershoot || (overshoot === bestOvershoot && pop < bestPop))) {
          bestUnit = unitName;
          bestOvershoot = overshoot;
          bestPop = pop;
        }
      }

      if (filledExactly) continue;
      if (!bestUnit) break;

      selected[bestUnit] = (selected[bestUnit] || 0) + 1;
      usedPop += UNIT_POP[bestUnit] || 1;
    }

    return {
      selected: selected,
      usedPop: usedPop
    };
  }

  function formatSelection(selected) {
    var parts = [];
    for (var i = 0; i < UNITS.length; i++) {
      var unitName = UNITS[i];
      if ((selected[unitName] || 0) > 0) parts.push(unitName + ':' + selected[unitName]);
    }
    return parts.join(', ');
  }

  function fillFake(state) {
    var points = getVillagePoints();
    if (!points) {
      return { ok: false, message: 'Nepodarilo sa nacitat body dediny.' };
    }

    var availableUnits = getAvailableUnits();
    if ((availableUnits.spy || 0) < 1) {
      return { ok: false, message: 'Dedina nema spiona.' };
    }

    var siegeType = chooseSiege(availableUnits, state.siege);
    if (!siegeType) {
      return { ok: false, message: 'Dedina nema 2x ram ani 2x catapult.' };
    }

    var selected = { spy: 1 };
    selected[siegeType] = 2;

    var usedPop = UNIT_POP.spy + (UNIT_POP[siegeType] * 2);
    var requiredPop = Math.max(Math.ceil(points * (state.fakeLimit / 100)), state.fakeMinPop, usedPop);

    var result = fillToRequirement(selected, availableUnits, usedPop, requiredPop);
    selected = result.selected;
    usedPop = result.usedPop;

    if (usedPop < requiredPop) {
      return { ok: false, message: 'Nedostatok jednotiek na fake limit (' + requiredPop + ' pop).' };
    }

    for (var i = 0; i < UNITS.length; i++) {
      var unitName = UNITS[i];
      if ((selected[unitName] || 0) > (availableUnits[unitName] || 0)) {
        return { ok: false, message: 'Nepodarilo sa bezpecne vyskladat fake.' };
      }
    }

    for (var j = 0; j < UNITS.length; j++) {
      var nextUnit = UNITS[j];
      setUnitValue(nextUnit, selected[nextUnit] || 0);
    }

    return {
      ok: true,
      message: 'Vyplnene: ' + formatSelection(selected) + ' | pop ' + usedPop + ' / min ' + requiredPop + ' | body ' + points,
      selected: selected
    };
  }

  function readPanelState() {
    var current = loadState();
    var fakeLimitInput = document.getElementById('tw-courtyard-fake-limit');
    var fakeMinPopInput = document.getElementById('tw-courtyard-fake-min-pop');
    var siegeSelect = document.getElementById('tw-courtyard-fake-siege');

    return {
      fakeLimit: clampNumber(fakeLimitInput ? fakeLimitInput.value : current.fakeLimit, 0, 100, current.fakeLimit),
      fakeMinPop: clampInt(fakeMinPopInput ? fakeMinPopInput.value : current.fakeMinPop, 0, 100000, current.fakeMinPop),
      siege: siegeSelect && siegeSelect.value === 'catapult' ? 'catapult' : 'ram'
    };
  }

  function renderStatus(message, ok) {
    var status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.textContent = message;
    status.style.color = ok ? '#2d572c' : '#8b1e1e';
  }

  function showPanel(state) {
    var existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = 'position:fixed;top:40px;right:40px;width:360px;max-width:92vw;background:#f3e5ab;border:2px solid #7a5b2e;padding:14px;z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,.35);font:12px Arial;color:#6b4f1d;';
    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<b style="font-size:16px;">Fake Fill</b>' +
        '<button id="tw-courtyard-close" style="background:#c0392b;color:#fff;border:0;padding:5px 9px;cursor:pointer;">X</button>' +
      '</div>' +
      '<div style="font-size:11px;margin-bottom:8px;">Funguje priamo na Nadvori. Necha ciel tak, ako ho mas vybraty, doplni len jednotky.</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
        '<label style="flex:1;display:flex;flex-direction:column;gap:4px;">' +
          '<span>Fake limit %</span>' +
          '<input id="tw-courtyard-fake-limit" type="number" step="0.1" min="0" max="100" value="' + state.fakeLimit + '" style="padding:6px;">' +
        '</label>' +
        '<label style="flex:1;display:flex;flex-direction:column;gap:4px;">' +
          '<span>Min pop</span>' +
          '<input id="tw-courtyard-fake-min-pop" type="number" step="1" min="0" max="100000" value="' + state.fakeMinPop + '" style="padding:6px;">' +
        '</label>' +
      '</div>' +
      '<label style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">' +
        '<span>Preferovany siege</span>' +
        '<select id="tw-courtyard-fake-siege" style="padding:6px;">' +
          '<option value="ram"' + (state.siege === 'ram' ? ' selected' : '') + '>ram</option>' +
          '<option value="catapult"' + (state.siege === 'catapult' ? ' selected' : '') + '>catapult</option>' +
        '</select>' +
      '</label>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<button id="tw-courtyard-fill-now" style="flex:1;background:#4a7c3f;color:#fff;border:0;padding:9px 12px;cursor:pointer;font-weight:bold;">Vyplnit fake</button>' +
        '<button id="tw-courtyard-save" style="background:#8b6b3f;color:#fff;border:0;padding:9px 12px;cursor:pointer;">Ulozit</button>' +
      '</div>' +
      '<div id="' + STATUS_ID + '" style="font-size:11px;line-height:1.35;"></div>';

    document.body.appendChild(panel);

    document.getElementById('tw-courtyard-close').onclick = function() {
      panel.remove();
    };

    document.getElementById('tw-courtyard-save').onclick = function() {
      var nextState = readPanelState();
      saveState(nextState);
      renderStatus('Nastavenie ulozene.', true);
    };

    document.getElementById('tw-courtyard-fill-now').onclick = function() {
      var nextState = readPanelState();
      saveState(nextState);
      var result = fillFake(nextState);
      renderStatus(result.message, result.ok);
    };
  }

  if (!ensurePlacePage()) return;

  var state = loadState();
  showPanel(state);

  var autoResult = fillFake(state);
  renderStatus(autoResult.message, autoResult.ok);
})();

