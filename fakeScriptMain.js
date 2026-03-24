// TW Fake Executor v3.4 - Opravený výbeh jednotiek + zlepšený algoritmus
// fakeScriptMain.js - načítava sa z GitHub cez bookmarklet

(funkcia() {
  "používajte prísne";

  if (typeof _twFakeData === 'nedefinované') {
    alert('✗ Chýba konfigurácia. Najprv vygeneruj bookmarklet cez launcher.');
    návrat;
  }

  var config;
  try {
    config = JSON.parse(decodeURIComponent(escape(atob(_twFakeData))));
  } catch (e) {
    alert('❌ Nepodarilo sa dekódovať konfiguráciu: ' + e.message);
    návrat;
  }

  var ciele = Array.isArray(config.targets) ? config.targets : [];
  var arrivalStart = config.arrivalStart ? nový dátum(config.arrivalStart) : null;
  var príchodKoniec = config.arrivalKoniec ? nový dátum(config.arrivalEnd) : null;

  var fakeLimit = 0.5;
  var openTabs = 5;
  var maxFakesPerTarget = 0;
  var maxFakesPerVillage = 0;
  var unitMode = 'náhodný';

  function log(msg) {
    console.log('[TW-Fake] ' + msg);
  }

  var unitPop = {
    kopija: 1, meč: 1, sekera: 1, lukostrelec: 1,
    špión: 2, ľahký: 4, pochodujúci: 5, ťažký: 6,
    baran: 5, katapult: 8, rytier: 10, snob: 100
  };

  var unitSpeed = {
    kopija: 18, meč: 22, sekera: 18, lukostrelec: 18,
    špión: 9, ľahký: 10, pochodujúci: 10, ťažký: 11,
    baran: 30, katapult: 30, rytier: 10, snob: 35
  };

  var exclusiveUnits = {militia: true, knight: true, snob: true};

  var worldSpeed = 1;
  var unitSpeedMod = 1;
  try {
    if (typeof getSpeedConstant === 'funkcia') {
      var speedData = getSpeedConstant();
      if (speedData) {
        worldSpeed = Number(speedData.worldSpeed) || 1;
        unitSpeedMod = Number(speedData.unitSpeed) || 1;
      }
    }
  } catch (e) {
    log('⚠️ getSpeedConstant nedostupný, používam default hodnoty');
  }

  function randInt(min, max) {
    if (max <= 0) return 0;
    if (max < min) return max;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Minimálny pop podľa bodov cieľa
  function getMinPopForFake(targetPoints) {
    if (!targetPoints || targetPoints <= 0) return 25;
    if (targetPoints < 500) return 15;
    if (targetPoints < 1500) return 20;
    if (targetPoints < 3000) return 25;
    if (targetPoints < 5000) return 30;
    if (targetPoints < 8000) return 35;
    if (targetPoints < 10000) return 40;
    return 50;
  }

  // ===== OPRAVENÝ NÁHODNÝ VÝBER =====
  function selectRandomUnits(availableUnits, fakeLimitPct, targetPoints) {
    var hasSpy = (availableUnits.spy || 0) >= 3;  // Minimálne 3 špehovia
    var hasRam = (availableUnits.ram || 0) >= 1;
    var hasCat = (availableUnits.catapult || 0) >= 1;
    
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    var totalPop = 0;
    for (var u in availableUnits) {
      if (availableUnits[u] > 0) {
        totalPop += availableUnits[u] * (unitPop[u] || 1);
      }
    }

    var selected = {};
    var usedPop = 0;

    // 1. Špión (3-6 náhodne)
    var spyCount = randInt(3, Math.min(6, availableUnits.spy || 0));
    if (spyCount > 0) {
      selected.spy = spyCount;
      usedPop += spyCount * unitPop.spy;
    }

    // 2. Ram alebo Katapult (náhodne, 1-3)
    if (hasRam && hasCat) {
      // 50% ram, 50% katapult
      if (Math.random() < 0.5) {
        var ramCount = randInt(1, Math.min(3, availableUnits.ram || 0));
        if (ramCount > 0) {
          selected.ram = ramCount;
          usedPop += ramCount * unitPop.ram;
        }
      } else {
        var catCount = randInt(1, Math.min(3, availableUnits.catapult || 0));
        if (catCount > 0) {
          selected.catapult = catCount;
          usedPop += catCount * unitPop.catapult;
        }
      }
    } else if (hasRam) {
      var ramCount2 = randInt(1, Math.min(3, availableUnits.ram || 0));
      if (ramCount2 > 0) {
        selected.ram = ramCount2;
        usedPop += ramCount2 * unitPop.ram;
      }
    } else if (hasCat) {
      var catCount2 = randInt(1, Math.min(3, availableUnits.catapult || 0));
      if (catCount2 > 0) {
        selected.catapult = catCount2;
        usedPop += catCount2 * unitPop.catapult;
      }
    }

    if (!selected.ram && !selected.catapult) return {};

    // 3. Vyplnenie - všetky dostupné jednotky
    // Rozpočet je AGRESÍVNEJŠÍ - až 5% populácie na fejk
    var budgetLimit = Math.ceil(totalPop * Math.min(5, fakeLimitPct * 10));  // Minimálne 5% alebo 10x límit
    budgetLimit = Math.max(budgetLimit, usedPop + 50);  // Minimálne 50 pop viac
    budgetLimit = Math.min(budgetLimit, totalPop);

    var fillers = [];
    for (var unitName in availableUnits) {
      if (exclusiveUnits[unitName]) continue;
      if (unitName === 'spy' || unitName === 'ram' || unitName === 'catapult') continue;
      if (availableUnits[unitName] > 0) fillers.push(unitName);
    }

    // Vyplnenie všetkými jednotkami - AGRESÍVNY VÝBER
    for (var fi = 0; fi < fillers.length && usedPop < budgetLimit; fi++) {
      var fn = fillers[fi];
      var available = availableUnits[fn] || 0;
      if (available <= 0) continue;

      var fp = unitPop[fn] || 1;
      var canAfford = Math.floor((budgetLimit - usedPop) / fp);
      var toAdd = Math.min(available, canAfford);

      if (toAdd > 0) {
        // AGRESÍVNY VÝBER: 40-100% dostupných jednotiek
        var minAmount = Math.max(1, Math.floor(toAdd * 0.4));
        var maxAmount = toAdd;
        var randomAmount = randInt(minAmount, maxAmount);
        selected[fn] = randomAmount;
        usedPop += randomAmount * fp;
      }
    }

    // Finálna validácia
    for (var k in selected) {
      if (selected[k] > (availableUnits[k] || 0)) return {};
      if (selected[k] <= 0) delete selected[k];
    }
    
    return selected;
  }

  // ===== ZLEPŠENÁ PRIORITA JEDNOTIEK =====
  var fakePriority = [
    'svetlo', 'pochodujúci', 'ľahký',    // Rýchle jednotky (4-5 pop)
    'kopija', 'meč', 'sekera',            // Základné jednotky (1 pop)
    'lukostrelec', 'ťažký',               // Stredné jednotky (5-6 pop)
    'baran'                               // Ram (5 pop)
  ];

  function selectManualUnits(availableUnits, fakeLimitPct, targetPoints) {
    var hasSpy = (availableUnits.spy || 0) >= 3;  // Minimálne 3 špehovia
    var hasRam = (availableUnits.ram || 0) >= 1;
    var hasCat = (availableUnits.catapult || 0) >= 1;
    
    if (!hasSpy || (!hasRam && !hasCat)) return {};

    var totalPop = 0;
    for (var u in availableUnits) {
      if (availableUnits[u] > 0) {
        totalPop += availableUnits[u] * (unitPop[u] || 1);
      }
    }

    var selected = {};
    var usedPop = 0;
    
    // 1. Povinná jednotka: 3-6 špionov
    var spyCount = randInt(3, Math.min(6, availableUnits.spy || 0));
    selected.spy = spyCount;
    usedPop += unitPop.spy * spyCount;
    
    // 2. Povinná jednotka: ram alebo katapult (1-3)
    if (hasRam && Math.random() < 0.5) {
      var ramCount = randInt(1, Math.min(3, availableUnits.ram || 0));
      selected.ram = ramCount;
      usedPop += unitPop.ram * ramCount;
    } else if (hasCat) {
      var catCount = randInt(1, Math.min(3, availableUnits.catapult || 0));
      selected.catapult = catCount;
      usedPop += unitPop.catapult * catCount;
    }

    var budgetLimit = Math.ceil(totalPop * Math.min(5, fakeLimitPct * 10));  // Minimálne 5% alebo 10x límit
    budgetLimit = Math.max(budgetLimit, usedPop + 50);
    budgetLimit = Math.min(budgetLimit, totalPop);

    // 3. Vyplnenie podľa priority - AGRESÍVNY VÝBER
    for (var i = 0; i < fakePriority.length && usedPop < budgetLimit; i++) {
      var un = fakePriority[i];
      var máš = availableUnits[un] || 0;
      if (máš <= 0) continue;
      
      // Ak už máme danú jednotku, preskočíme
      if (selected[un]) continue;
      
      var pop = unitPop[un] || 1;
      var canTake = Math.floor((budgetLimit - usedPop) / pop);
      var cnt = Math.min(máš, canTake);
      
      if (cnt > 0) {
        // AGRESÍVNY VÝBER: 40-100% dostupného množstva
        var minAmount = Math.max(1, Math.floor(cnt * 0.4));
        var maxAmount = cnt;
        var randomAmount = randInt(minAmount, maxAmount);
        selected[un] = randomAmount;
        usedPop += randomAmount * pop;
      }
    }

    return selected;
  }

  function selectUnitsForFake(availableUnits, fakeLimitPct, targetPoints) {
    if (unitMode === 'náhodný') {
      return selectRandomUnits(availableUnits, fakeLimitPct, targetPoints);
    }
    return selectManualUnits(availableUnits, fakeLimitPct, targetPoints);
  }

  // =========== KONTROLNÁ STRÁNKA ==========
  var isCombined = window.location.href.indexOf('screen=overview_villages') !== -1;
  if (!isCombined) {
    if (window.location.href.indexOf('screen=place') !== -1) {
      alert('⚠️ Tento skript spúšťaj iba na Kombinovanej strane.');
      návrat;
    }
    if (typeof game_data !== 'nedefinované' && game_data.village && game_data.village.id) {
      window.location.href = '/game.php?village=' + game_data.village.id + '&screen=overview_villages&mode=combined';
      návrat;
    }
    alert('❌ Otvor stránku Kombinované (overview_villages&mode=combined).');
    návrat;
  }

  if (!ciele.length) {
    alert('❌ Neboli zadané žiadne mestské úrady.');
    návrat;
  }

  showConfigPanel();

  function showConfigPanel() {
    var old = document.getElementById('tw-fake-config');
    if (old) old.remove();

    var p = document.createElement('div');
    p.id = 'tw-fake-config';
    p.style.cssText = 'pozícia:pevná;hore:50%;ľavý:50%;transformovať:preložiť(-50%,-50%);z-index:99999;pozadie:#f4e4bc;hranica:2px pevné #7d510f;hranica-polomer:8px;padding:20px;font-rodina:Verdana,sans-serif;font-veľkosť:12px;farba:#3e2b0d;šírka:440px;max-výška:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:12px;">';
    h += '<h2 style="margin:0;color:#7d510f;font-size:18px;">🎯 TW Fake - Konfigurácia</h2>';
    h += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v3.4 — ' + ciele.length + ' cieľov načítaných</p>';
    h += '</div>';

    h += '<div style="margin-bottom:10px;padding:8px;background:#e8d5a3;border-radius:4px;">';
    h += '<label style="font-weight:bold;">Režim jednotiek:</label><br/>';
    h += '<label style="cursor:pointer;margin-right:12px;"><input type="radio" name="tw-mode" value="náhodný" checked /> 🎲 Náhodný (odporúčané)</label>';
    h += '<label style="cursor:pointer;"><input type="radio" name="tw-mode" value="manuálny" /> ⚙️ Manuálny</label>';
    h += '</div>';

    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
    h += '<tr><td style="padding:3px;font-weight:bold;">Falošný limit (%):</td>';
    h += '<td><input id="tw-cfg-fakelimit" type="number" value="0.5" step="0.1" min="0.1" max="100" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">% z populácie dediny</div></td></tr>';
    
    h += '<tr><td style="padding:3px;font-weight:bold;">Otvoriť karty:</td>';
    h += '<td><input id="tw-cfg-opentabs" type="number" value="5" min="1" max="50" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;"/></td></tr>';
    
    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov na cieli:</td>';
    h += '<td><input id="tw-cfg-maxpertarget" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';
    
    h += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov z dediny:</td>';
    h += '<td><input id="tw-cfg-maxpervillage" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    h += '<div style="font-size:9px;color:#8b7355;">0 = bez limitu</div></td></tr>';
    h += '</table>';

    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-cfg-start" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">▶ Spusť</button>';
    h += '<button id="tw-cfg-close" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    if (arrivalStart || príchodKoniec) {
      h += '<div style="margin-top:8px;font-size:10px;color:#8b7355;">';
      h += '🕐 Príchod: ' + (arrivalStart ? arrivalStart.toLocaleString('sk-SK') : '?') + ' – ' + (príchodKoniec ? príchodKoniec.toLocaleString('sk-SK') : '?');
      h += '</div>';
    }

    p.innerHTML = h;
    document.body.appendChild(p);

    document.getElementById('tw-cfg-close').onclick = function() {
      p.remove();
    };
    
    document.getElementById('tw-cfg-start').onclick = function() {
      fakeLimit = parseFloat(document.getElementById('tw-cfg-fakelimit').value) || 0.5;
      openTabs = parseInt(document.getElementById('tw-cfg-opentabs').value, 10) || 5;
      maxFakesPerTarget = parseInt(document.getElementById('tw-cfg-maxpertarget').value, 10) || 0;
      maxFakesPerVillage = parseInt(document.getElementById('tw-cfg-maxpervillage').value, 10) || 0;
      
      var modeRadios = document.querySelectorAll('input[name="tw-mode"]');
      for (var i = 0; i < modeRadios.length; i++) {
        if (modeRadios[i].checked) {
          unitMode = modeRadios[i].value;
          break;
        }
      }
      p.remove();
      runFakeAttacks();
    };
  }

  function runFakeAttacks() {
    var dediny = parseVillagesFromCombined();
    if (!dediny.length) {
      alert('❌ Nenašli sa žiadne dediny s jednotkami.');
      návrat;
    }
    log('📋 Načítaných dedín: ' + dediny.length);
    for (var d = 0; d < Math.min(3, dediny.length); d++) {
      var dbg = dediny[d];
      var ul = [];
      for (var u in dbg.units) ul.push(u + ':' + dbg.units[u]);
      log('  ' + dbg.name + ' — ' + ul.join(', '));
    }
    
    var attackQueue = buildAttackQueue(dediny, ciele, fakeLimit);
    log('✅ Naplnených: ' + attackQueue.length);
    if (!attackQueue.length) {
      alert('❌ Nevytvoril sa žiadny útok. Skontroluj limity a jednotky.');
      návrat;
    }
    window._twAttackQueue = attackQueue;
    window._twAttackIndex = 0;
    showControlPanel(attackQueue);
  }

  // OPRAVENÉ PARSOVANIE
  function parseVillagesFromCombined() {
    var result = [];
    var tabuľka = document.getElementById('combined_table');
    if (!tabuľka) {
      var tabuľky = document.querySelectorAll('table');
      for (var t = 0; t < tabuľky.length; t++) {
        if (tabuľky[t].querySelector('td.unit-item')) {
          tabuľka = tabuľky[t];
          break;
        }
      }
    }
    if (!tabuľka) {
      log('❌ Tabuľka nenájdená');
      return result;
    }

    var unitColumnOrder = [];
    var headerRow = tabuľka.querySelector('tr.units_header') || tabuľka.querySelector('thead tr');
    if (!headerRow) {
      var allRows = tabuľka.querySelectorAll('tr');
      for (var ri = 0; ri < allRows.length; ri++) {
        if (allRows[ri].querySelectorAll('img[src*="unit_"]').length >= 3) {
          headerRow = allRows[ri];
          break;
        }
      }
    }
    
    if (headerRow) {
      var hCells = headerRow.querySelectorAll('th, td');
      for (var hi = 0; hi < hCells.length; hi++) {
        var img = hCells[hi].querySelector('img[src*="unit_"]');
        if (img) {
          var m = (img.getAttribute('src') || '').match(/unit_(\w+)/);
          if (m) unitColumnOrder.push(m[1]);
        }
      }
    }
    
    if (unitColumnOrder.length === 0) {
      if (typeof game_data !== 'undefined' && Array.isArray(game_data.units)) {
        unitColumnOrder = game_data.units.slice();
      } else {
        unitColumnOrder = ['kopija','meč','sekera','lukostrelec','špión','ľahký','pochodujúci','ťažký','baran','katapult','rytier','snob'];
      }
      log('ℹ️ Záložný radec: ' + unitColumnOrder.join(', '));
    } else {
      log('✅ Poradie z hlavičiek: ' + unitColumnOrder.join(', '));
    }

    var riadky = tabuľka.querySelectorAll('tr.row_a, tr.row_b');
    if (!riadky.length) riadky = document.querySelectorAll('tr.row_a, tr.row_b');

    for (var i = 0; i < riadky.length; i++) {
      var riadok = riadky[i];
      var vLink = riadok.querySelector('.quickedit-content a[href*="dedina="]') || riadok.querySelector('a[href*="dedina="]');
      var cSrc = riadok.querySelector('.quickedit-label') || vLink;
      if (!vLink || !cSrc) continue;
      
      var idM = (vLink.href || '').match(/dedina=(\d+)/);
      if (!idM) continue;
      
      var cM = (cSrc.textContent || '').match(/(\d{3})\|(\d{3})/);
      if (!cM) continue;

      var unitCells = riadok.querySelectorAll('td.unit-item');
      if (!unitCells.length) continue;

      var jednotky = {};
      for (var j = 0; j < unitCells.length && j < unitColumnOrder.length; j++) {
        var un = unitColumnOrder[j];
        if (exclusiveUnits[un]) continue;
        var val = parseInt((unitCells[j].textContent || '').trim().replace(/\D+/g, ''), 10) || 0;
        if (val > 0) jednotky[un] = val;
      }

      var totalPop = 0;
      for (var u in jednotky) totalPop += jednotky[u] * (unitPop[u] || 1);
      if (totalPop > 0) {
        result.push({
          id: idM[1],
          x: parseInt(cM[1], 10),
          y: parseInt(cM[2], 10),
          name: (cSrc.textContent || '').trim(),
          units: jednotky,
          totalPop: totalPop
        });
      }
    }
    return result;
  }

  function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  function getSlowestUnit(jednotky) {
    var slowest = 'baran';
    var slowestVal = 0;
    for (var u in jednotky) {
      if (!jednotky[u] || jednotky[u] <= 0) continue;
      var spd = unitSpeed[u] || 0;
      if (spd > slowestVal) {
        slowestVal = spd;
        slowest = u;
      }
    }
    return slowest;
  }

  function parseServerNow() {
    var timeEl = document.getElementById('serverTime');
    var dateEl = document.getElementById('serverDate');
    if (timeEl && dateEl) {
      var t = (timeEl.textContent || '').trim();
      var d = (dateEl.textContent || '').trim();
      var dp = d.split(/[.\/-]/);
      var tp = t.split(':');
      if (dp.length === 3 && tp.length >= 2) {
        var dt = nový dátum(parseInt(dp[2], 10), parseInt(dp[1], 10) - 1, parseInt(dp[0], 10),
          parseInt(tp[0], 10), parseInt(tp[1], 10), parseInt(tp[2] || '0', 10));
        if (!isNaN(dt.getTime())) return dt;
      }
    }
    return nový dátum();
  }

  function calcTravelTimeMs(fromX, fromY, toX, toY, slowestUnit) {
    var dist = calcDistance(fromX, fromY, toX, toY);
    return dist * (unitSpeed[slowestUnit] || 30) * 60 * 1000 / (worldSpeed * unitSpeedMod);
  }

  function isInArrivalWindow(village, target, selectedUnits) {
    if (!arrivalStart && !príchodKoniec) return true;
    var now = parseServerNow();
    var arrMs = now.getTime() + calcTravelTimeMs(village.x, village.y, target.x, target.y, getSlowestUnit(selectedUnits));
    if (arrivalStart && arrMs < arrivalStart.getTime()) return false;
    if (príchodKoniec && arrMs > príchodKoniec.getTime()) return false;
    return true;
  }

  function buildAttackQueue(villageList, targetList, fakeLimitPct) {
    var queue = [];
    var preparedVillages = [];

    for (var i = 0; i < villageList.length; i++) {
      var v = villageList[i];
      if (unitMode === 'náhodný') {
        // Kontrola: dedina má minimálne 3 špionov a aspoň ram alebo katapult
        if ((v.units.spy || 0) >= 3 && ((v.units.baran || 0) >= 1 || (v.units.katapult || 0) >= 1)) {
          preparedVillages.push({village: v, units: null});
        }
      } else {
        var avg = 0;
        for (var tp = 0; tp < targetList.length; tp++) avg += (targetList[tp].points || 0);
        avg = targetList.length > 0 ? avg / targetList.length : 0;
        var selected = selectUnitsForFake(v.units, fakeLimitPct, avg);
        if (Object.keys(selected).length) {
          preparedVillages.push({village: v, units: selected});
        }
      }
    }

    if (!preparedVillages.length) return queue;

    var targetCap = maxFakesPerTarget > 0 ? maxFakesPerTarget : preparedVillages.length;
    var villageCap = maxFakesPerVillage > 0 ? maxFakesPerVillage : targetList.length;
    var targetCounts = {}, villageCounts = {}, targetCursor = 0;
    var maxTotal = targetList.length * targetCap;
    var safety = maxTotal * Math.max(1, preparedVillages.length) + 100;

    while (queue.length < maxTotal && safety-- > 0) {
      var advanced = false;
      for (var v2 = 0; v2 < preparedVillages.length; v2++) {
        var pv = preparedVillages[v2];
        var vKey = pv.village.id;
        if ((villageCounts[vKey] || 0) >= villageCap) continue;
        
        var tries = 0;
        while (tries < targetList.length) {
          var target = targetList[targetCursor % targetList.length];
          targetCursor++;
          tries++;
          
          var tKey = target.x + '|' + target.y;
          if ((targetCounts[tKey] || 0) >= targetCap) continue;
          
          var targetPts = target.points || 0;
          var attackUnits;
          
          if (unitMode === 'náhodný') {
            var best = null, bestPop = 0;
            for (var att = 0; att < 5; att++) {
              var cand = selectUnitsForFake(pv.village.units, fakeLimitPct, targetPts);
              if (!Object.keys(cand).length) continue;
              var cp = 0;
              for (var cu in cand) cp += cand[cu] * (unitPop[cu] || 1);
              if (cp > bestPop) {
                bestPop = cp;
                best = cand;
              }
            }
            attackUnits = best || {};
            if (!Object.keys(attackUnits).length) continue;
          } else {
            attackUnits = pv.units;
          }
          
          if (!isInArrivalWindow(pv.village, target, attackUnits)) continue;
          
          var atkPop = 0;
          for (var au in attackUnits) atkPop += attackUnits[au] * (unitPop[au] || 1);
          
          queue.push({
            villageId: pv.village.id,
            villageName: pv.village.name,
            villageX: pv.village.x,
            villageY: pv.village.y,
            targetX: target.x,
            targetY: target.y,
            units: attackUnits,
            totalPop: atkPop
          });
          
          targetCounts[tKey] = (targetCounts[tKey] || 0) + 1;
          villageCounts[vKey] = (villageCounts[vKey] || 0) + 1;
          advanced = true;
          break;
        }
      }
      if (!advanced) break;
    }
    return queue;
  }

  function showControlPanel(queue) {
    var old = document.getElementById('tw-fake-panel');
    if (old) old.remove();
    
    var panel = document.createElement('div');
    panel.id = 'tw-fake-panel';
    panel.style.cssText = 'pozícia:pevná;hore:10px;vpravo:10px;z-index:99999;pozadie:#f4e4bc;hranica:2px pevné #7d510f;hranica-polomer:8px;vyplnenie:15px;font-rodina:Verdana,sans-serif;font-veľkosť:11px;farba:#3e2b0d;šírka:420px;max-výška:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';
    
    var h = '<div style="text-align:center;margin-bottom:8px;"><h3 style="margin:0;color:#7d510f;">🎯 Fake Attack Queue</h3></div>';
    h += '<div style="background:#fff3cd;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:11px;">';
    h += '<b>' + queue.length + '</b> útokov | <b>' + (unitMode === 'náhodný' ? '🎲 Náhodný' : '⚙️ Manuálny') + '</b><br/>';
    h += 'Falošný limit: <b>' + fakeLimit + '%</b> | Karty: <b>' + openTabs + '</b>';
    if (maxFakesPerTarget > 0) h += '<br/>Max/cieľ: <b>' + maxFakesPerTarget + '</b>';
    if (maxFakesPerVillage > 0) h += ' | Max/dedina: <b>' + maxFakesPerVillage + '</b>';
    if (arrivalStart || príchodKoniec) {
      h += '<br/>🕐 ' + (arrivalStart ? arrivalStart.toLocaleString('sk-SK') : '?') + ' – ' + (príchodKoniec ? príchodKoniec.toLocaleString('sk-SK') : '?');
    }
    h += '</div>';
    
    h += '<div style="max-výška:250px;overflow-y:auto;border:1px solid #d4a574;border-radius:4px;margin-bottom:8px;">';
    for (var i = 0; i < Math.min(queue.length, 30); i++) {
      var atk = queue[i];
      var uStr = Object.keys(atk.units).map(function(k) {
        return k + ':' + atk.units[k];
      }).join(', ');
      var bg = i % 2 === 0 ? '#fff8e7' : '#f4e4bc';
      h += '<div style="padding:4px 8px;background:' + bg + ';border-bottom:1px solid #e6d5b8;font-size:10px;">';
      h += '<b>' + atk.villageName.substring(0, 22) + '</b> → ' + atk.targetX + '|' + atk.targetY;
      h += '<span style="color:#4a7c3f;font-weight:bold;"> [' + atk.totalPop + ' pop]</span>';
      h += '<br/><span style="color:#8b7355;">' + uStr + '</span></div>';
    }
    if (queue.length > 30) {
      h += '<div style="padding:4px 8px;text-align:center;font-size:10px;color:#8b7355;">...a ďalších ' + (queue.length - 30) + '</div>';
    }
    h += '</div>';
    
    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-start-btn" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">▶ Spusť (' + openTabs + ' tabov)</button>';
    h += '<button id="tw-close-panel" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';
    
    panel.innerHTML = h;
    document.body.appendChild(panel);
    
    document.getElementById('tw-close-panel').onclick = function() {
      panel.remove();
    };
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
      
      Object.keys(attack.units).forEach(function(un) {
        if (attack.units[un] > 0) {
          params.push(encodeURIComponent(un) + '=' + encodeURIComponent(attack.units[un]));
        }
      });
      
      window.open('/game.php?' + params.join('&'), '_blank');
    }
    
    window._twAttackIndex = idx + tabsToOpen;
    var btn = document.getElementById('tw-start-btn');
    var remaining = queue.length - window._twAttackIndex;
    
    if (btn) {
      if (remaining > 0) {
        btn.textContent = '▶ Ďalších ' + Math.min(openTabs, remaining) + ' (zostáv ' + remaining + ')';
      } else {
        btn.textContent = '✅ Hotovo!';
        btn.disabled = true;
        btn.style.background = '#95a5a6';
      }
    }
    
    log('📑 Otvorených ' + tabsToOpen + ' tabov, zostáv ' + remaining);
  }

})();
