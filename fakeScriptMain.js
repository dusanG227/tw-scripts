// TW Fake Executor v3.5
(function() {
  'use strict';

  if (typeof _twFakeData === 'undefined') {
    alert('⚠️ Chýba konfigurácia. Najprv vygeneruj bookmarklet cez launcher.');
    return;
  }

  var config;
  try {
    config = JSON.parse(decodeURIComponent(escape(atob(_twFakeData))));
  } catch (e) {
    alert('❌ Nepodarilo sa dekódovať konfiguráciu: ' + e.message);
    return;
  }

  var targets = Array.isArray(config.targets) ? config.targets : [];
  var arrivalStart = config.arrivalStart ? new Date(config.arrivalStart) : null;
  var arrivalEnd = config.arrivalEnd ? new Date(config.arrivalEnd) : null;
  var worldSpeed = Number(config.worldSpeed) || 1;
  var unitSpeedMod = Number(config.unitSpeedMod) || 1;

  var fakeLimit = 0.5;
  var openTabs = 5;
  var maxFakesPerTarget = 0;
  var maxFakesPerVillage = 0;
  var unitMode = 'random';

  function log(msg) { console.log('[TW-Fake] ' + msg); }

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

  function randInt(min, max) {
    if (max <= 0) return 0;
    if (max < min) return max;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ============ SMART FILLER ============
  function smartFill(selected, availableUnits, usedPop, popBudget) {
    var fillers = ['light', 'heavy', 'marcher', 'archer', 'axe', 'sword', 'spear'];
    var maxPerUnit = 10;
    var changed = true;
    while (changed && usedPop < popBudget) {
      changed = false;
      for (var i = 0; i < fillers.length; i++) {
        var u = fillers[i];
        var pop = unitPop[u] || 1;
        if (usedPop + pop > popBudget) continue;
        var already = selected[u] || 0;
        var avail = (availableUnits[u] || 0) - already;
        if (avail <= 0 || already >= maxPerUnit) continue;
        var take = (unitMode === 'random') ? (Math.random() < 0.7 ? 1 : 0) : 1;
        if (take < 1) continue;
        selected[u] = already + 1;
        usedPop += pop;
        changed = true;
        if (usedPop >= popBudget) break;
      }
    }
    return { selected: selected, usedPop: usedPop };
  }

  // ============ RANDOM MODE ============
  function selectRandomUnits(availableUnits, fakeLimitPct, villagePoints) {
    var hasSpy = (availableUnits.spy || 0) >= 1;
    var hasRam = (availableUnits.ram || 0) >= 2;
    var hasCat = (availableUnits.catapult || 0) >= 2;
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    var minRamCat = hasRam ? unitPop.ram * 2 : unitPop.catapult * 2;
    var minRequired = unitPop.spy + minRamCat;
    var pointBased = villagePoints > 0 ? Math.ceil(villagePoints * (fakeLimitPct / 100)) : 0;
    var popBudget = Math.max(minRequired, pointBased || 52);

    var selected = {};
    var usedPop = 0;

    var maxSpy = Math.min(2, availableUnits.spy || 0, Math.floor((popBudget - minRequired + unitPop.spy) / unitPop.spy));
    if (maxSpy < 1) return {};
    selected.spy = randInt(1, maxSpy);
    usedPop += selected.spy * unitPop.spy;

    if (hasRam && hasCat) {
      var combo = randInt(0, 2);
      if (combo !== 1) {
        var maxRam = Math.min(availableUnits.ram, 4, Math.floor((popBudget - usedPop - (combo !== 0 ? unitPop.catapult * 2 : 0)) / unitPop.ram));
        if (maxRam >= 2) { selected.ram = randInt(2, maxRam); usedPop += selected.ram * unitPop.ram; }
        else return {};
      }
      if (combo !== 0) {
        var maxCat = Math.min(availableUnits.catapult, 4, Math.floor((popBudget - usedPop) / unitPop.catapult));
        if (maxCat >= 2) { selected.catapult = randInt(2, maxCat); usedPop += selected.catapult * unitPop.catapult; }
        else if (!selected.ram) return {};
      }
    } else if (hasRam) {
      var maxRam2 = Math.min(availableUnits.ram, 4, Math.floor((popBudget - usedPop) / unitPop.ram));
      if (maxRam2 < 2) return {};
      selected.ram = randInt(2, maxRam2);
      usedPop += selected.ram * unitPop.ram;
    } else {
      var maxCat2 = Math.min(availableUnits.catapult, 4, Math.floor((popBudget - usedPop) / unitPop.catapult));
      if (maxCat2 < 2) return {};
      selected.catapult = randInt(2, maxCat2);
      usedPop += selected.catapult * unitPop.catapult;
    }

    if (!selected.ram && !selected.catapult) return {};

    var filled = smartFill(selected, availableUnits, usedPop, popBudget);
    selected = filled.selected;

    for (var k in selected) {
      if (selected[k] > (availableUnits[k] || 0)) return {};
    }
    return selected;
  }

  // ============ MANUAL MODE ============
  function selectManualUnits(availableUnits, fakeLimitPct, villagePoints) {
    var hasSpy = (availableUnits.spy || 0) >= 1;
    var hasRam = (availableUnits.ram || 0) >= 2;
    var hasCat = (availableUnits.catapult || 0) >= 2;
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    var minRequired = unitPop.spy + (hasRam ? unitPop.ram * 2 : unitPop.catapult * 2);
    var pointBased = villagePoints > 0 ? Math.ceil(villagePoints * (fakeLimitPct / 100)) : 0;
    var maxPop = Math.max(minRequired, pointBased || 52);

    var selected = {};
    var usedPop = 0;

    selected.spy = 1;
    usedPop += unitPop.spy;

    if (hasRam) {
      var ramCount = Math.min(4, availableUnits.ram, Math.floor((maxPop - usedPop) / unitPop.ram));
      if (ramCount < 2) return {};
      selected.ram = ramCount;
      usedPop += selected.ram * unitPop.ram;
    } else {
      var catCount = Math.min(4, availableUnits.catapult, Math.floor((maxPop - usedPop) / unitPop.catapult));
      if (catCount < 2) return {};
      selected.catapult = catCount;
      usedPop += selected.catapult * unitPop.catapult;
    }

    var filled = smartFill(selected, availableUnits, usedPop, maxPop);
    selected = filled.selected;
    return selected;
  }

  function selectUnitsForFake(availableUnits, fakeLimitPct, villagePoints) {
    if (unitMode === 'random') return selectRandomUnits(availableUnits, fakeLimitPct, villagePoints);
    return selectManualUnits(availableUnits, fakeLimitPct, villagePoints);
  }

  // ============ CHECK PAGE ============
  var isCombined = window.location.href.indexOf('screen=overview_villages') !== -1;
  if (!isCombined) {
    if (window.location.href.indexOf('screen=place') !== -1) {
      alert('ℹ️ Tento skript spúšťaj iba na Kombinovanej stránke.');
      return;
    }
    if (typeof game_data !== 'undefined' && game_data.village && game_data.village.id) {
      window.location.href = '/game.php?village=' + game_data.village.id + '&screen=overview_villages&mode=combined';
      return;
    }
    alert('⚠️ Otvor stránku Kombinované (overview_villages&mode=combined).');
    return;
  }

  showConfigPanel();

  // ============ HELPERS ============
  function toDatetimeLocal(date) {
    if (!date) return '';
    var d = new Date(date);
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) +
           'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function targetsToText(tArr) {
    return tArr.map(function(t) { return t.x + '|' + t.y; }).join('\n');
  }

  function parseCoords(text) {
    var result = [];
    var matches = text.match(/(\d{3})\|(\d{3})/g);
    if (matches) {
      for (var i = 0; i < matches.length; i++) {
        var parts = matches[i].split('|');
        result.push({ x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) });
      }
    }
    return result;
  }

  // ============ CONFIG PANEL ============
  function showConfigPanel() {
    var old = document.getElementById('tw-fake-config');
    if (old) old.remove();

    var p = document.createElement('div');
    p.id = 'tw-fake-config';
    p.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:12px;">';
    h += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake - Konfigurácia</h2>';
    h += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v3.5 | svet: ' + (config.worldId || '?') + ' | rýchlosť: ' + worldSpeed + 'x | jednotky: ' + unitSpeedMod + 'x</p>';
    h += '</div>';

    // Coords
    h += '<div style="margin-bottom:10px;">';
    h += '<label style="font-weight:bold;">🎯 Cieľové súradnice:</label>';
    h += '<textarea id="tw-cfg-coords" rows="4" placeholder="500|500&#10;501|501" style="width:100%;margin-top:3px;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;resize:vertical;font-family:monospace;box-sizing:border-box;">' + targetsToText(targets) + '</textarea>';
    h += '<div id="tw-cfg-coord-count" style="font-size:10px;color:#8b7355;margin-top:2px;">📍 ' + targets.length + ' súradníc</div>';
    h += '</div>';

    // Arrival
    h += '<div style="margin-bottom:10px;">';
    h += '<label style="font-weight:bold;">🕐 Okno príchodu (voliteľné):</label>';
    h += '<div style="display:flex;gap:8px;margin-top:3px;">';
    h += '<div style="flex:1;"><label style="font-size:10px;">Od:</label><input id="tw-cfg-arrival-start" type="datetime-local" value="' + toDatetimeLocal(arrivalStart) + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;box-sizing:border-box;" /></div>';
    h += '<div style="flex:1;"><label style="font-size:10px;">Do:</label><input id="tw-cfg-arrival-end" type="datetime-local" value="' + toDatetimeLocal(arrivalEnd) + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;box-sizing:border-box;" /></div>';
    h += '</div></div>';

    // Režim
    h += '<div style="margin-bottom:10px;padding:8px;background:#e8d5a3;border-radius:4px;">';
    h += '<label style="font-weight:bold;">Režim jednotiek:</label><br/>';
    h += '<label style="cursor:pointer;margin-right:12px;"><input type="radio" name="tw-mode" value="random" checked /> 🎲 Random</label>';
    h += '<label style="cursor:pointer;"><input type="radio" name="tw-mode" value="manual" /> ✏️ Manuálny</label>';
    h += '</div>';

    // Číselné polia
    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
    h += '<tr><td style="padding:3px;font-weight:bold;">Fake limit (%):</td>';
    h += '<td><input id="tw-cfg-fakelimit" type="number" value="0.5" step="0.1" min="0.1" max="100" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">% z bodov dediny = max veľkosť fake útoku</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Open tabs:</td>';
    h += '<td><input id="tw-cfg-opentabs" type="number" value="5" min="1" max="50" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov na cieľ:</td>';
    h += '<td><input id="tw-cfg-maxpertarget" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov z dediny:</td>';
    h += '<td><input id="tw-cfg-maxpervillage" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';
    h += '</table>';

    h += '<div style="background:#e8f4e8;padding:6px 10px;border-radius:4px;margin-bottom:10px;font-size:10px;color:#2d5a27;">';
    h += '🪖 Ram/Cat: <b>2–4 kusy</b> | 🔀 Smart filler: <b>mix, max 10/jednotka</b> | 🗺️ Auto-filter dedín';
    h += '</div>';

    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-cfg-start" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Spustiť</button>';
    h += '<button id="tw-cfg-close" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    p.innerHTML = h;
    document.body.appendChild(p);

    document.getElementById('tw-cfg-coords').addEventListener('input', function() {
      var matches = this.value.match(/\d{3}\|\d{3}/g);
      document.getElementById('tw-cfg-coord-count').textContent = '📍 ' + (matches ? matches.length : 0) + ' súradníc';
    });

    document.getElementById('tw-cfg-close').onclick = function() { p.remove(); };

    document.getElementById('tw-cfg-start').onclick = function() {
      var coordText = document.getElementById('tw-cfg-coords').value;
      var parsedTargets = parseCoords(coordText);
      if (!parsedTargets.length) {
        alert('⚠️ Zadaj aspoň jednu cieľovú súradnicu!');
        return;
      }
      targets = parsedTargets;

      var aStart = document.getElementById('tw-cfg-arrival-start').value;
      var aEnd = document.getElementById('tw-cfg-arrival-end').value;
      arrivalStart = aStart ? new Date(aStart) : null;
      arrivalEnd = aEnd ? new Date(aEnd) : null;

      fakeLimit = parseFloat(document.getElementById('tw-cfg-fakelimit').value) || 0.5;
      openTabs = parseInt(document.getElementById('tw-cfg-opentabs').value, 10) || 5;
      maxFakesPerTarget = parseInt(document.getElementById('tw-cfg-maxpertarget').value, 10) || 0;
      maxFakesPerVillage = parseInt(document.getElementById('tw-cfg-maxpervillage').value, 10) || 0;

      var modeRadios = document.querySelectorAll('input[name="tw-mode"]');
      for (var i = 0; i < modeRadios.length; i++) {
        if (modeRadios[i].checked) { unitMode = modeRadios[i].value; break; }
      }

      p.remove();
      runFakeAttacks();
    };
  }

  // ============ MAIN ============
  function runFakeAttacks() {
    var villages = parseVillagesFromCombined();
    if (!villages.length) {
      alert('⚠️ Nenašli sa žiadne dediny s jednotkami.');
      return;
    }

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
    showControlPanel(attackQueue);
  }

  // ============ VILLAGE PARSING ============
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
      for (var u in units) { totalPop += units[u] * (unitPop[u] || 1); }

      if (totalPop > 0) {
        result.push({
          id: villageId, x: vx, y: vy,
          name: (coordSource.textContent || '').trim(),
          units: units, totalPop: totalPop, points: villagePoints
        });
      }
    }
    return result;
  }

  // ============ FILTER & SORT ============
  function filterViableVillages(villages, targetList) {
    if (!arrivalStart && !arrivalEnd) return villages;

    var viable = [];
    var skipped = 0;

    for (var i = 0; i < villages.length; i++) {
      var v = villages[i];
      var testUnits = {};
      if ((v.units.ram || 0) >= 2) testUnits.ram = 2;
      else if ((v.units.catapult || 0) >= 2) testUnits.catapult = 2;
      else { skipped++; continue; }

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
      var reachA = 0, reachB = 0;
      var testA = (a.units.ram || 0) >= 2 ? { ram: 2 } : { catapult: 2 };
      var testB = (b.units.ram || 0) >= 2 ? { ram: 2 } : { catapult: 2 };
      for (var i = 0; i < targetList.length; i++) {
        if (isInArrivalWindow(a, targetList[i], testA)) reachA++;
        if (isInArrivalWindow(b, targetList[i], testB)) reachB++;
      }
      return reachB - reachA;
    });
  }

  // ============ TRAVEL HELPERS ============
  function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  function getSlowestUnit(units) {
    var slowest = 'ram';
    var slowestValue = 0;
    for (var u in units) {
      if (!units[u] || units[u] <= 0) continue;
      var spd = unitSpeed[u] || 0;
      if (spd > slowestValue) { slowestValue = spd; slowest = u; }
    }
    return slowest;
  }

  function parseServerNow() {
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
    var now = parseServerNow();
    var slowest = getSlowestUnit(selectedUnits);
    var arrivalMs = now.getTime() + calcTravelTimeMs(village.x, village.y, target.x, target.y, slowest);
    if (arrivalStart && arrivalMs < arrivalStart.getTime()) return false;
    if (arrivalEnd && arrivalMs > arrivalEnd.getTime()) return false;
    return true;
  }

  // ============ BUILD QUEUE ============
  function buildAttackQueue(villageList, targetList, fakeLimitPct) {
    var queue = [];
    var preparedVillages = [];

    for (var i = 0; i < villageList.length; i++) {
      var v = villageList[i];
      if (unitMode === 'random') {
        var hasSpy = (v.units.spy || 0) >= 1;
        var hasRam = (v.units.ram || 0) >= 2;
        var hasCat = (v.units.catapult || 0) >= 2;
        if (hasSpy && (hasRam || hasCat)) preparedVillages.push({ village: v, units: null });
      } else {
        var chosen = selectUnitsForFake(v.units, fakeLimitPct, v.points);
        if (Object.keys(chosen).length) preparedVillages.push({ village: v, units: chosen });
      }
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

        var tries = 0;
        while (tries < targetList.length) {
          var target = targetList[targetCursor % targetList.length];
          targetCursor++;
          tries++;

          var tKey = target.x + '|' + target.y;
          if ((targetCounts[tKey] || 0) >= targetCap) continue;

          var attackUnits;
          if (unitMode === 'random') {
            attackUnits = selectUnitsForFake(pv.village.units, fakeLimitPct, pv.village.points);
            if (!Object.keys(attackUnits).length) continue;
          } else {
            attackUnits = pv.units;
          }

          if (!isInArrivalWindow(pv.village, target, attackUnits)) continue;

          queue.push({
            villageId: pv.village.id,
            villageName: pv.village.name,
            villageX: pv.village.x,
            villageY: pv.village.y,
            targetX: target.x,
            targetY: target.y,
            units: attackUnits
          });

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

  // ============ CONTROL PANEL ============
  function showControlPanel(queue) {
    var old = document.getElementById('tw-fake-panel');
    if (old) old.remove();

    var panel = document.createElement('div');
    panel.id = 'tw-fake-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:400px;max-height:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:8px;">';
    h += '<h3 style="margin:0;color:#7d510f;">⚔️ Fake Attack Queue</h3>';
    h += '</div>';

    h += '<div style="background:#fff3cd;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:11px;">';
    h += '<b>' + queue.length + '</b> útokov | Režim: <b>' + (unitMode === 'random' ? '🎲 Random' : '✏️ Manuálny') + '</b><br/>';
    h += 'Fake limit: <b>' + fakeLimit + '%</b> | Tabs: <b>' + openTabs + '</b>';
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
      h += '<b>' + atk.villageName.substring(0, 22) + '</b> → ' + atk.targetX + '|' + atk.targetY;
      h += '<br/><span style="color:#8b7355;">' + unitStr + '</span>';
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

  function launchAttacks() {
    var queue = window._twAttackQueue || [];
    var idx = window._twAttackIndex || 0;
    var tabsToOpen = Math.min(openTabs, queue.length - idx);

    if (tabsToOpen <= 0) {
      alert('✅ Všetky útoky už boli otvorené.');
      return;
    }

    for (var i = 0; i < tabsToOpen; i++) {
      var attack = queue[idx + i];
      if (!attack) break;

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

      window.open('/game.php?' + params.join('&'), '_blank');
    }

    window._twAttackIndex = idx + tabsToOpen;

    var btn = document.getElementById('tw-start-btn');
    var remaining = queue.length - window._twAttackIndex;
    if (btn) {
      if (remaining > 0) {
        btn.textContent = '▶ Ďalších ' + Math.min(openTabs, remaining) + ' (zostáva ' + remaining + ')';
      } else {
        btn.textContent = '✅ Hotovo!';
        btn.disabled = true;
        btn.style.background = '#95a5a6';
      }
    }
    log('📑 Otvorených ' + tabsToOpen + ' tabov, zostáva ' + remaining);
  }

})();
