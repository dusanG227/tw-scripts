// TW Fake Executor v3.6 - Dynamický budget podľa bodov cieľa + dvojitý filler prechod
// fakeScriptMain.js

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
    log('⚠️ getSpeedConstant nedostupný');
  }

  function randInt(min, max) {
    if (max <= 0) return 0;
    if (max < min) return max;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ============ DRUHÝ PRECHOD — doplní zostatok do budgetu lacnými jednotkami ============
  function fillRemainingPop(selected, availableUnits, usedPop, popBudget) {
    var fillOrder = ['spear', 'axe', 'archer', 'sword', 'spy', 'light', 'marcher', 'heavy'];
    for (var fi = 0; fi < fillOrder.length; fi++) {
      var fn = fillOrder[fi];
      if (excludedUnits[fn]) continue;
      var available = (availableUnits[fn] || 0) - (selected[fn] || 0);
      if (available <= 0) continue;
      var fp = unitPop[fn] || 1;
      var remaining = popBudget - usedPop;
      if (remaining < fp) continue;
      var canTake = Math.min(available, Math.floor(remaining / fp));
      if (canTake <= 0) continue;
      selected[fn] = (selected[fn] || 0) + canTake;
      usedPop += canTake * fp;
      if (usedPop >= popBudget) break;
    }
    return usedPop;
  }

  // ============ RANDOM MODE ============
  function selectRandomUnits(availableUnits, fakeLimitPct, targetPoints) {
    var hasSpy = (availableUnits.spy || 0) >= 1;
    var hasRam = (availableUnits.ram || 0) >= 1;
    var hasCat = (availableUnits.catapult || 0) >= 1;
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    var minRequired = unitPop.spy + (hasRam ? unitPop.ram : unitPop.catapult);
    var pointBased = (targetPoints > 0) ? Math.ceil(targetPoints * (fakeLimitPct / 100)) : 52;
    var popBudget = Math.max(minRequired, pointBased);

    var selected = {};
    var usedPop = 0;

    // 1. Povinný špeha
    var maxSpy = Math.min(4, availableUnits.spy || 0, Math.floor((popBudget - minRequired + unitPop.spy) / unitPop.spy));
    if (maxSpy < 1) return {};
    selected.spy = randInt(1, maxSpy);
    usedPop += selected.spy * unitPop.spy;

    // 2. Baran a/alebo katapult
    if (hasRam && hasCat) {
      var combo = randInt(0, 2);
      if (combo !== 1) {
        var maxRam = Math.min(availableUnits.ram, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.ram)));
        if (maxRam >= 1) { selected.ram = randInt(1, maxRam); usedPop += selected.ram * unitPop.ram; }
      }
      if (combo !== 0) {
        var maxCat = Math.min(availableUnits.catapult, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.catapult)));
        if (maxCat >= 1) { selected.catapult = randInt(1, maxCat); usedPop += selected.catapult * unitPop.catapult; }
      }
    } else if (hasRam) {
      var maxRam2 = Math.min(availableUnits.ram, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.ram)));
      if (maxRam2 < 1) return {};
      selected.ram = randInt(1, maxRam2);
      usedPop += selected.ram * unitPop.ram;
    } else {
      var maxCat2 = Math.min(availableUnits.catapult, Math.min(4, Math.floor((popBudget - usedPop) / unitPop.catapult)));
      if (maxCat2 < 1) return {};
      selected.catapult = randInt(1, maxCat2);
      usedPop += selected.catapult * unitPop.catapult;
    }

    if (!selected.ram && !selected.catapult) return {};

    // 3. Prvý prechod — náhodné fillery
    var fillers = [];
    for (var unitName in availableUnits) {
      if (excludedUnits[unitName]) continue;
      if (unitName === 'spy' || unitName === 'ram' || unitName === 'catapult') continue;
      if ((availableUnits[unitName] || 0) > 0) fillers.push(unitName);
    }
    for (var f = fillers.length - 1; f > 0; f--) {
      var swap = Math.floor(Math.random() * (f + 1));
      var tmp = fillers[f]; fillers[f] = fillers[swap]; fillers[swap] = tmp;
    }
    for (var fi2 = 0; fi2 < fillers.length; fi2++) {
      var fn2 = fillers[fi2];
      var fp2 = unitPop[fn2] || 1;
      var rem2 = popBudget - usedPop;
      if (rem2 < fp2) continue;
      var maxU = Math.min(10, availableUnits[fn2] || 0, Math.floor(rem2 / fp2));
      if (maxU <= 0) continue;
      var minC = Math.max(1, Math.floor(maxU / 2));
      selected[fn2] = randInt(minC, maxU);
      usedPop += selected[fn2] * fp2;
    }

    // 4. Druhý prechod — doplní zostatok
    if (usedPop < popBudget) {
      usedPop = fillRemainingPop(selected, availableUnits, usedPop, popBudget);
    }

    // Validácia
    for (var k in selected) {
      if (selected[k] > (availableUnits[k] || 0)) return {};
    }

    log('Random fake: ' + usedPop + '/' + popBudget + ' pop (cieľ: ' + targetPoints + ' bodov)');
    return selected;
  }

  // ============ MANUAL MODE ============
  var fakePriority = ['light', 'spear', 'axe', 'archer', 'marcher', 'heavy', 'sword'];

  function selectManualUnits(availableUnits, fakeLimitPct, targetPoints) {
    var hasSpy = (availableUnits.spy || 0) > 0;
    var hasRam = (availableUnits.ram || 0) > 0;
    var hasCat = (availableUnits.catapult || 0) > 0;
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    var requiredPop = unitPop.spy + (hasRam ? unitPop.ram : unitPop.catapult);
    var pointBased = (targetPoints > 0) ? Math.ceil(targetPoints * (fakeLimitPct / 100)) : 52;
    var maxPop = Math.max(requiredPop, pointBased);

    var selected = {};
    var usedPop = 0;

    selected.spy = 1; usedPop += unitPop.spy;
    if (hasRam) { selected.ram = 1; usedPop += unitPop.ram; }
    else { selected.catapult = 1; usedPop += unitPop.catapult; }

    // Prvý prechod podľa priority
    for (var i = 0; i < fakePriority.length && usedPop < maxPop; i++) {
      var un = fakePriority[i];
      var have = availableUnits[un] || 0;
      if (have <= 0) continue;
      var already = selected[un] || 0;
      var rem = have - already;
      if (rem <= 0) continue;
      var pop = unitPop[un] || 1;
      var canTake = Math.min(10, rem, Math.floor((maxPop - usedPop) / pop));
      if (canTake > 0) { selected[un] = already + canTake; usedPop += canTake * pop; }
    }

    // Druhý prechod — doplní zostatok
    if (usedPop < maxPop) {
      usedPop = fillRemainingPop(selected, availableUnits, usedPop, maxPop);
    }

    log('Manual fake: ' + usedPop + '/' + maxPop + ' pop (cieľ: ' + targetPoints + ' bodov)');
    return selected;
  }

  function selectUnitsForFake(availableUnits, fakeLimitPct, targetPoints) {
    if (unitMode === 'random') return selectRandomUnits(availableUnits, fakeLimitPct, targetPoints);
    return selectManualUnits(availableUnits, fakeLimitPct, targetPoints);
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

  showConfigPanel();

  function showConfigPanel() {
    var old = document.getElementById('tw-fake-config');
    if (old) old.remove();

    var p = document.createElement('div');
    p.id = 'tw-fake-config';
    p.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:440px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:12px;">';
    h += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake - Konfigurácia</h2>';
    h += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v3.6 — ' + targets.length + ' cieľov načítaných</p>';
    h += '</div>';

    h += '<div style="margin-bottom:10px;padding:8px;background:#e8d5a3;border-radius:4px;">';
    h += '<label style="font-weight:bold;">Režim jednotiek:</label><br/>';
    h += '<label style="cursor:pointer;margin-right:12px;"><input type="radio" name="tw-mode" value="random" checked /> 🎲 Random</label>';
    h += '<label style="cursor:pointer;"><input type="radio" name="tw-mode" value="manual" /> ✏️ Manuálny</label>';
    h += '</div>';

    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
    h += '<tr><td style="padding:3px;font-weight:bold;">Fake limit (%):</td>';
    h += '<td><input id="tw-cfg-fakelimit" type="number" value="0.5" step="0.1" min="0.1" max="100" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">% z bodov cieľovej dediny = max pop fejku</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Open tabs:</td>';
    h += '<td><input id="tw-cfg-opentabs" type="number" value="5" min="1" max="50" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov na cieľ:</td>';
    h += '<td><input id="tw-cfg-maxpertarget" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';

    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov z dediny:</td>';
    h += '<td><input id="tw-cfg-maxpervillage" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';
    h += '</table>';

    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-cfg-start" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Spustiť</button>';
    h += '<button id="tw-cfg-close" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    if (arrivalStart || arrivalEnd) {
      h += '<div style="margin-top:8px;font-size:10px;color:#8b7355;">';
      h += '🕐 ' + (arrivalStart ? arrivalStart.toLocaleString('sk-SK') : '?') + ' – ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk-SK') : '?');
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
    log('📋 Dedín: ' + villages.length);

    var attackQueue = buildAttackQueue(villages, targets, fakeLimit);
    log('⚔️ Naplánovaných: ' + attackQueue.length);

    if (!attackQueue.length) {
      alert('⚠️ Nevytvoril sa žiadny útok.');
      return;
    }

    window._twAttackQueue = attackQueue;
    window._twAttackIndex = 0;
    showControlPanel(attackQueue);
  }

  // ============ VILLAGE PARSING ============
  function parseVillagesFromCombined() {
    var result = [];
    var unitColumnOrder = [];
    var table = document.getElementById('combined_table');
    if (!table) {
      var tables = document.querySelectorAll('table');
      for (var t = 0; t < tables.length; t++) {
        if (tables[t].querySelector('td.unit-item')) { table = tables[t]; break; }
      }
    }

    if (table) {
      var allRows = table.querySelectorAll('tr');
      for (var ri = 0; ri < allRows.length; ri++) {
        if (allRows[ri].querySelectorAll('img[src*="unit_"]').length >= 3) {
          var hCells = allRows[ri].querySelectorAll('th, td');
          for (var hi = 0; hi < hCells.length; hi++) {
            var img = hCells[hi].querySelector('img[src*="unit_"]');
            if (img) {
              var m = (img.getAttribute('src') || '').match(/unit_(\w+)/);
              if (m) unitColumnOrder.push(m[1]);
            }
          }
          break;
        }
      }
    }

    if (unitColumnOrder.length === 0) {
      unitColumnOrder = allGameUnits.slice();
      log('ℹ️ Fallback poradie jednotiek');
    } else {
      log('✅ Poradie: ' + unitColumnOrder.join(', '));
    }

    var rows = table
      ? table.querySelectorAll('tr.row_a, tr.row_b')
      : document.querySelectorAll('tr.row_a, tr.row_b');

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var vLink = row.querySelector('.quickedit-content a[href*="village="]') || row.querySelector('a[href*="village="]');
      var cSrc = row.querySelector('.quickedit-label') || vLink;
      if (!vLink || !cSrc) continue;
      var idM = (vLink.href || '').match(/village=(\d+)/);
      if (!idM) continue;
      var cM = (cSrc.textContent || '').match(/(\d{3})\|(\d{3})/);
      if (!cM) continue;

      var unitCells = row.querySelectorAll('td.unit-item');
      if (!unitCells.length) continue;

      var units = {};
      for (var j = 0; j < unitCells.length && j < unitColumnOrder.length; j++) {
        var un = unitColumnOrder[j];
        if (excludedUnits[un]) continue;
        var val = parseInt((unitCells[j].textContent || '').trim().replace(/\D+/g, ''), 10) || 0;
        if (val > 0) units[un] = val;
      }

      var totalPop = 0;
      for (var u in units) totalPop += units[u] * (unitPop[u] || 1);
      if (totalPop > 0) {
        result.push({
          id: idM[1], x: parseInt(cM[1], 10), y: parseInt(cM[2], 10),
          name: (cSrc.textContent || '').trim(), units: units, totalPop: totalPop
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
    var slowest = 'ram', slowestVal = 0;
    for (var u in units) {
      if (!units[u] || units[u] <= 0) continue;
      var spd = unitSpeed[u] || 0;
      if (spd > slowestVal) { slowestVal = spd; slowest = u; }
    }
    return slowest;
  }
  function parseServerNow() {
    var timeEl = document.getElementById('serverTime');
    var dateEl = document.getElementById('serverDate');
    if (timeEl && dateEl) {
      var t = (timeEl.textContent || '').trim(), d = (dateEl.textContent || '').trim();
      var dp = d.split(/[.\/-]/), tp = t.split(':');
      if (dp.length === 3 && tp.length >= 2) {
        var dt = new Date(parseInt(dp[2], 10), parseInt(dp[1], 10) - 1, parseInt(dp[0], 10),
                          parseInt(tp[0], 10), parseInt(tp[1], 10), parseInt(tp[2] || '0', 10));
        if (!isNaN(dt.getTime())) return dt;
      }
    }
    return new Date();
  }
  function calcTravelTimeMs(fromX, fromY, toX, toY, slowestUnit) {
    return calcDistance(fromX, fromY, toX, toY) * (unitSpeed[slowestUnit] || 30) * 60000 / (worldSpeed * unitSpeedMod);
  }
  function isInArrivalWindow(village, target, selectedUnits) {
    if (!arrivalStart && !arrivalEnd) return true;
    var now = parseServerNow();
    var arrMs = now.getTime() + calcTravelTimeMs(village.x, village.y, target.x, target.y, getSlowestUnit(selectedUnits));
    if (arrivalStart && arrMs < arrivalStart.getTime()) return false;
    if (arrivalEnd && arrMs > arrivalEnd.getTime()) return false;
    return true;
  }

  // ============ BUILD QUEUE ============
  function buildAttackQueue(villageList, targetList, fakeLimitPct) {
    var queue = [];
    var preparedVillages = [];

    for (var i = 0; i < villageList.length; i++) {
      var v = villageList[i];
      if ((v.units.spy || 0) >= 1 && ((v.units.ram || 0) >= 1 || (v.units.catapult || 0) >= 1)) {
        preparedVillages.push({ village: v });
      }
    }
    if (!preparedVillages.length) return queue;

    var targetCap = maxFakesPerTarget > 0 ? maxFakesPerTarget : preparedVillages.length;
    var villageCap = maxFakesPerVillage > 0 ? maxFakesPerVillage : targetList.length;
    var targetCounts = {}, villageCounts = {}, targetCursor = 0;
    var maxTotal = targetList.length * targetCap;
    var safety = maxTotal * Math.max(1, preparedVillages.length) + 100;

    while (queue.length < maxTotal && safety-- > 0) {
      var progressed = false;
      for (var v2 = 0; v2 < preparedVillages.length; v2++) {
        var pv = preparedVillages[v2];
        var vKey = pv.village.id;
        if ((villageCounts[vKey] || 0) >= villageCap) continue;

        var tries = 0;
        while (tries < targetList.length) {
          var target = targetList[targetCursor % targetList.length];
          targetCursor++; tries++;

          var tKey = target.x + '|' + target.y;
          if ((targetCounts[tKey] || 0) >= targetCap) continue;

          var attackUnits = selectUnitsForFake(pv.village.units, fakeLimitPct, target.points || 0);
          if (!Object.keys(attackUnits).length) continue;
          if (!isInArrivalWindow(pv.village, target, attackUnits)) continue;

          var atkPop = 0;
          for (var au in attackUnits) atkPop += attackUnits[au] * (unitPop[au] || 1);

          queue.push({
            villageId: pv.village.id, villageName: pv.village.name,
            villageX: pv.village.x, villageY: pv.village.y,
            targetX: target.x, targetY: target.y,
            units: attackUnits, totalPop: atkPop
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
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:8px;"><h3 style="margin:0;color:#7d510f;">⚔️ Fake Attack Queue</h3></div>';
    h += '<div style="background:#fff3cd;padding:6px 10px;border-radius:4px;margin-bottom:8px;">';
    h += '<b>' + queue.length + '</b> útokov | <b>' + (unitMode === 'random' ? '🎲 Random' : '✏️ Manuálny') + '</b> | Limit: <b>' + fakeLimit + '%</b> | Tabs: <b>' + openTabs + '</b>';
    if (maxFakesPerTarget > 0) h += '<br/>Max/cieľ: <b>' + maxFakesPerTarget + '</b>';
    if (maxFakesPerVillage > 0) h += ' | Max/dedina: <b>' + maxFakesPerVillage + '</b>';
    if (arrivalStart || arrivalEnd) {
      h += '<br/>🕐 ' + (arrivalStart ? arrivalStart.toLocaleString('sk-SK') : '?') + ' – ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk-SK') : '?');
    }
    h += '</div>';

    h += '<div style="max-height:250px;overflow-y:auto;border:1px solid #d4a574;border-radius:4px;margin-bottom:8px;">';
    for (var i = 0; i < Math.min(queue.length, 30); i++) {
      var atk = queue[i];
      var uStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
      var bg = i % 2 === 0 ? '#fff8e7' : '#f4e4bc';
      h += '<div style="padding:4px 8px;background:' + bg + ';border-bottom:1px solid #e6d5b8;font-size:10px;">';
      h += '<b>' + atk.villageName.substring(0, 22) + '</b> → ' + atk.targetX + '|' + atk.targetY;
      h += ' <span style="color:#4a7c3f;font-weight:bold;">[' + atk.totalPop + ' pop]</span>';
      h += '<br/><span style="color:#8b7355;">' + uStr + '</span></div>';
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
    if (tabsToOpen <= 0) { alert('✅ Všetky útoky už boli otvorené.'); return; }

    for (var i = 0; i < tabsToOpen; i++) {
      var attack = queue[idx + i];
      if (!attack) break;
      var params = [
        'village=' + encodeURIComponent(attack.villageId), 'screen=place',
        'x=' + encodeURIComponent(attack.targetX), 'y=' + encodeURIComponent(attack.targetY)
      ];
      Object.keys(attack.units).forEach(function(un) {
        if (attack.units[un] > 0) params.push(encodeURIComponent(un) + '=' + encodeURIComponent(attack.units[un]));
      });
      window.open('/game.php?' + params.join('&'), '_blank');
    }

    window._twAttackIndex = idx + tabsToOpen;
    var btn = document.getElementById('tw-start-btn');
    var remaining = queue.length - window._twAttackIndex;
    if (btn) {
      if (remaining > 0) btn.textContent = '▶ Ďalších ' + Math.min(openTabs, remaining) + ' (zostáva ' + remaining + ')';
      else { btn.textContent = '✅ Hotovo!'; btn.disabled = true; btn.style.background = '#95a5a6'; }
    }
    log('📑 Otvorených ' + tabsToOpen + ', zostáva ' + remaining);
  }

})();
