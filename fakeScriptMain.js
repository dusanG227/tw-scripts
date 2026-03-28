// TW Fake Executor v3.2 - Slobodný random výber + fake limit pop budget
// fakeScriptMain.js - načítava sa z GitHub cez bookmarklet

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

  // Defaults - user can change in UI
  var fakeLimit = 0.5;
  var openTabs = 5;
  var maxFakesPerTarget = 0;
  var maxFakesPerVillage = 0;
  var unitMode = 'random'; // 'random' or 'manual'

  function log(msg) { console.log('[TW-Fake] ' + msg); }

  // ============ UNIT DATA ============
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

  // Paladín (knight) a šľachtic (snob) sú vylúčení
  var excludedUnits = { militia: true, knight: true, snob: true };

  var allGameUnits = (typeof game_data !== 'undefined' && Array.isArray(game_data.units))
    ? game_data.units.slice()
    : ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult'];

  var worldSpeed = 1;
  var unitSpeedMod = 1;
  try {
    if (typeof getSpeedConstant === 'function') {
      var speedData = getSpeedConstant();
      if (speedData) {
        worldSpeed = Number(speedData.worldSpeed) || 1;
        unitSpeedMod = Number(speedData.unitSpeed) || 1;
      }
    }
  } catch (e) {
    log('⚠️ getSpeedConstant nedostupný, používam default hodnoty');
  }

  // ============ RANDOM INT ============
  function randInt(min, max) {
    if (max <= 0) return 0;
    if (max < min) return max;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ============ SLOBODNÝ RANDOM VÝBER ============
  // Vyberá jednotky slobodne podľa pop budgetu z fake limitu.
  // Povinné: aspoň 1 špeha + aspoň 1 baran ALEBO katapult (alebo oboje).
  // Zvyšok budgetu sa náhodne rozdeľuje medzi dostupné jednotky.
  function selectRandomUnits(availableUnits, fakeLimitPct) {
    var hasSpy = (availableUnits.spy || 0) >= 1;
    var hasRam = (availableUnits.ram || 0) >= 1;
    var hasCat = (availableUnits.catapult || 0) >= 1;
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    // Pop budget podľa fake limitu
    var totalPop = 0;
    for (var u in availableUnits) {
      totalPop += availableUnits[u] * (unitPop[u] || 1);
    }
    var minRequired = unitPop.spy + (hasRam ? unitPop.ram : unitPop.catapult);
    var popBudget = Math.min(51, Math.max(Math.ceil(totalPop * (fakeLimitPct / 100)), minRequired));

    var selected = {};
    var usedPop = 0;

    // 1. Povinný špeha — prísne v rámci budgetu
    var maxSpy = Math.min(4, availableUnits.spy || 0, Math.floor((popBudget - minRequired + unitPop.spy) / unitPop.spy));
    if (maxSpy < 1) return {};
    selected.spy = randInt(1, maxSpy);
    usedPop += selected.spy * unitPop.spy;

    // 2. Baran a/alebo katapult — prísne v rámci zostatkového budgetu
    if (hasRam && hasCat) {
      var combo = randInt(0, 2);
      if (combo !== 1) { // baran
        var maxRam = Math.min(availableUnits.ram, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.ram)));
        if (maxRam >= 1) { selected.ram = randInt(1, maxRam); usedPop += selected.ram * unitPop.ram; }
      }
      if (combo !== 0) { // katapult
        var maxCat = Math.min(availableUnits.catapult, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.catapult)));
        if (maxCat >= 1) { selected.catapult = randInt(1, maxCat); usedPop += selected.catapult * unitPop.catapult; }
      }
    } else if (hasRam) {
      var maxRam = Math.min(availableUnits.ram, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.ram)));
      if (maxRam < 1) return {};
      selected.ram = randInt(1, maxRam);
      usedPop += selected.ram * unitPop.ram;
    } else {
      var maxCat = Math.min(availableUnits.catapult, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.catapult)));
      if (maxCat < 1) return {};
      selected.catapult = randInt(1, maxCat);
      usedPop += selected.catapult * unitPop.catapult;
    }

    // Overenie: musíme mať aspoň ram alebo catapult
    if (!selected.ram && !selected.catapult) return {};

    // Zostavíme zoznam kandidátov (okrem spy, ram, catapult, knight, snob, militia)
    var fillers = [];
    for (var unitName in availableUnits) {
      if (excludedUnits[unitName]) continue;
      if (unitName === 'spy' || unitName === 'ram' || unitName === 'catapult') continue;
      if ((availableUnits[unitName] || 0) > 0) fillers.push(unitName);
    }

    // Zamieš fillery náhodne
    for (var f = fillers.length - 1; f > 0; f--) {
      var swap = Math.floor(Math.random() * (f + 1));
      var tmp = fillers[f]; fillers[f] = fillers[swap]; fillers[swap] = tmp;
    }

    // Rozdeľ zostatok budgetu — každý filler dostane čo zostalo, max 10 jednotiek jedného typu
    for (var fi = 0; fi < fillers.length; fi++) {
      var fn = fillers[fi];
      var fp = unitPop[fn] || 1;
      var remaining = popBudget - usedPop;
      if (remaining < fp) break;
      var maxUnits = Math.min(10, availableUnits[fn] || 0, Math.floor(remaining / fp));
      if (maxUnits <= 0) continue;
      // Vyber náhodne ale aspoň polovicu maxima, aby sa budget naplnil
      var minCount = Math.max(1, Math.floor(maxUnits / 2));
      var count = randInt(minCount, maxUnits);
      selected[fn] = count;
      usedPop += count * fp;
    }

    // Validácia: žiadna jednotka nesmie presiahnuť dostupné množstvo
    for (var k in selected) {
      if (selected[k] > (availableUnits[k] || 0)) return {};
    }

    return selected;
  }

  // ============ MANUAL MODE (pôvodná logika, fake limit pop budget) ============
  var fakePriority = ['light', 'spear', 'axe', 'archer', 'marcher', 'heavy', 'sword'];

  function selectManualUnits(availableUnits, fakeLimitPct) {
    var hasSpy = (availableUnits.spy || 0) > 0;
    var hasRam = (availableUnits.ram || 0) > 0;
    var hasCat = (availableUnits.catapult || 0) > 0;
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    var totalPop = 0;
    for (var u in availableUnits) {
      totalPop += availableUnits[u] * (unitPop[u] || 1);
    }

    var requiredPop = unitPop.spy + (hasRam ? unitPop.ram : unitPop.catapult);
    var maxPop = Math.min(51, Math.max(Math.ceil(totalPop * (fakeLimitPct / 100)), requiredPop));

    var selected = {};
    var usedPop = 0;

    selected.spy = 1;
    usedPop += unitPop.spy;

    if (hasRam) {
      selected.ram = 1;
      usedPop += unitPop.ram;
    } else {
      selected.catapult = 1;
      usedPop += unitPop.catapult;
    }

    for (var i = 0; i < fakePriority.length && usedPop < maxPop; i++) {
      var unitName = fakePriority[i];
      var have = availableUnits[unitName] || 0;
      if (have <= 0) continue;
      var already = selected[unitName] || 0;
      var remaining = have - already;
      if (remaining <= 0) continue;
      var pop = unitPop[unitName] || 1;
      var canTake = Math.floor((maxPop - usedPop) / pop);
      var count = Math.min(remaining, canTake);
      if (count > 0) {
        selected[unitName] = already + count;
        usedPop += count * pop;
      }
    }
    return selected;
  }

  function selectUnitsForFake(availableUnits, fakeLimitPct) {
    if (unitMode === 'random') {
      return selectRandomUnits(availableUnits, fakeLimitPct);
    }
    return selectManualUnits(availableUnits, fakeLimitPct);
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

  if (!targets.length) {
    alert('⚠️ Neboli zadané žiadne cieľové súradnice.');
    return;
  }

  // ============ SHOW CONFIG UI ============
  showConfigPanel();

  function showConfigPanel() {
    var old = document.getElementById('tw-fake-config');
    if (old) old.remove();

    var p = document.createElement('div');
    p.id = 'tw-fake-config';
    p.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:440px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:12px;">';
    h += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake - Konfigurácia</h2>';
    h += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v3.2 — ' + targets.length + ' cieľov načítaných</p>';
    h += '</div>';

    // Mode toggle
    h += '<div style="margin-bottom:10px;padding:8px;background:#e8d5a3;border-radius:4px;">';
    h += '<label style="font-weight:bold;">Režim jednotiek:</label><br/>';
    h += '<label style="cursor:pointer;margin-right:12px;"><input type="radio" name="tw-mode" value="random" checked /> 🎲 Random (odporúčané)</label>';
    h += '<label style="cursor:pointer;"><input type="radio" name="tw-mode" value="manual" /> ✏️ Manuálny</label>';
    h += '</div>';

    // Config fields
    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
    h += '<tr><td style="padding:3px;font-weight:bold;">Fake limit (%):</td>';
    h += '<td><input id="tw-cfg-fakelimit" type="number" value="0.5" step="0.1" min="0.1" max="100" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">% z populácie dediny = max veľkosť fake útoku</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Open tabs:</td>';
    h += '<td><input id="tw-cfg-opentabs" type="number" value="5" min="1" max="50" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov na cieľ:</td>';
    h += '<td><input id="tw-cfg-maxpertarget" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov z dediny:</td>';
    h += '<td><input id="tw-cfg-maxpervillage" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';
    h += '</table>';

    // Buttons
    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-cfg-start" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Spustiť</button>';
    h += '<button id="tw-cfg-close" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    if (arrivalStart || arrivalEnd) {
      h += '<div style="margin-top:8px;font-size:10px;color:#8b7355;">';
      h += '🕐 Arrival: ' + (arrivalStart ? arrivalStart.toLocaleString('sk-SK') : '?') + ' – ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk-SK') : '?');
      h += '</div>';
    }

    p.innerHTML = h;
    document.body.appendChild(p);

    document.getElementById('tw-cfg-close').onclick = function() { p.remove(); };
    document.getElementById('tw-cfg-start').onclick = function() {
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

  function runFakeAttacks() {
    var villages = parseVillagesFromCombined();
    if (!villages.length) {
      alert('⚠️ Nenašli sa žiadne dediny s jednotkami.');
      return;
    }

    var attackQueue = buildAttackQueue(villages, targets, fakeLimit);
    log('⚔️ Naplánovaných útokov: ' + attackQueue.length + ' (režim: ' + unitMode + ')');

    if (!attackQueue.length) {
      alert('⚠️ Nevytvoril sa žiadny útok. Skontroluj limity a jednotky.');
      return;
    }

    window._twAttackQueue = attackQueue;
    window._twAttackIndex = 0;
    showControlPanel(attackQueue);
  }

  // ============ VILLAGE PARSING (z Kombinovanej stránky) ============
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
      for (var u in units) {
        totalPop += units[u] * (unitPop[u] || 1);
      }

      if (totalPop > 0) {
        result.push({
          id: villageId, x: vx, y: vy,
          name: (coordSource.textContent || '').trim(),
          units: units, totalPop: totalPop
        });
      }
    }
    return result;
  }

  // ============ HELPERS ============
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

    // Pre random mode: filtrujeme dediny ktoré majú špion + baran/katapult
    // Pre manual mode: predpočítame jednotky
    var preparedVillages = [];
    for (var i = 0; i < villageList.length; i++) {
      var v = villageList[i];
      if (unitMode === 'random') {
        var hasSpy = (v.units.spy || 0) >= 1;
        var hasRam = (v.units.ram || 0) >= 1;
        var hasCat = (v.units.catapult || 0) >= 1;
        if (hasSpy && (hasRam || hasCat)) {
          preparedVillages.push({ village: v, units: null });
        }
      } else {
        var chosen = selectUnitsForFake(v.units, fakeLimitPct);
        if (Object.keys(chosen).length) {
          preparedVillages.push({ village: v, units: chosen });
        }
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

      for (var v = 0; v < preparedVillages.length; v++) {
        var pv = preparedVillages[v];
        var vKey = pv.village.id;
        if ((villageCounts[vKey] || 0) >= villageCap) continue;

        var tries = 0;
        while (tries < targetList.length) {
          var target = targetList[targetCursor % targetList.length];
          targetCursor++;
          tries++;

          var tKey = target.x + '|' + target.y;
          if ((targetCounts[tKey] || 0) >= targetCap) continue;

          // V random mode generujeme jednotky čerstvo pre každý útok
          var attackUnits;
          if (unitMode === 'random') {
            attackUnits = selectUnitsForFake(pv.village.units, fakeLimitPct);
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
        var count = attack.units[unitName];
        if (count > 0) {
          params.push(encodeURIComponent(unitName) + '=' + encodeURIComponent(count));
        }
      });

      var url = '/game.php?' + params.join('&');
      window.open(url, '_blank');
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
