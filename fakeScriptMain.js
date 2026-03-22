// TW Fake Executor - Hlavný skript v2.0
// Spúšťa sa vygenerovaným bookmarkletom z generateFakeScript.js
// Opravy: nativeInputValueSetter, game_data.units, ram/cat/spy podmienka,
//         maxFakesPerTarget, maxFakesPerVillage, výpočet rýchlosti

(function() {
  'use strict';

  // ===================== DECODE CONFIG =====================
  if (typeof _twFakeData === 'undefined') {
    alert('⚠️ Chýba konfigurácia! Najprv spusti generátor (launcher).');
    return;
  }

  var config;
  try {
    config = JSON.parse(decodeURIComponent(escape(atob(_twFakeData))));
  } catch(e) {
    alert('❌ Nepodarilo sa dekódovať konfiguráciu: ' + e.message);
    return;
  }

  var targets = config.targets || [];
  var fakeLimit = config.fakeLimit || 0.5;
  var openTabs = config.openTabs || 5;
  var maxFakesPerTarget = config.maxFakesPerTarget || 0;
  var maxFakesPerVillage = config.maxFakesPerVillage || 0;
  var arrivalStart = config.arrivalStart ? new Date(config.arrivalStart) : null;
  var arrivalEnd = config.arrivalEnd ? new Date(config.arrivalEnd) : null;

  function log(msg) { console.log('[TW-Fake] ' + msg); }

  // ===================== UNIT DATA =====================
  var unitPop = {
    spear: 1, sword: 1, axe: 1, archer: 1,
    spy: 2, light: 4, marcher: 5, heavy: 6,
    ram: 5, catapult: 8, knight: 10, snob: 100
  };

  // Unit speeds in minutes per field (base, before world/unit speed modifiers)
  var unitSpeed = {
    spear: 18, sword: 22, axe: 18, archer: 18,
    spy: 9, light: 10, marcher: 10, heavy: 11,
    ram: 30, catapult: 30, knight: 10, snob: 35
  };

  // Priority: spy first, then ram/catapult (mandatory), then cheap troops
  var fakePriority = ['spy', 'ram', 'catapult', 'light', 'spear', 'axe', 'archer', 'marcher', 'heavy', 'sword'];

  // Dynamic units from game_data (filter out militia, knight, snob)
  var gameUnits = [];
  var excludeUnits = ['militia', 'knight', 'snob'];
  if (typeof game_data !== 'undefined' && game_data.units) {
    for (var i = 0; i < game_data.units.length; i++) {
      if (excludeUnits.indexOf(game_data.units[i]) === -1) {
        gameUnits.push(game_data.units[i]);
      }
    }
  }
  if (gameUnits.length === 0) {
    gameUnits = ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult'];
  }

  // Speed constants
  var worldSpeed = 1;
  var unitSpeedMod = 1;
  if (typeof game_data !== 'undefined' && game_data.village) {
    try {
      var speedData = getSpeedConstant ? getSpeedConstant() : null;
      if (speedData) {
        worldSpeed = speedData.worldSpeed || 1;
        unitSpeedMod = speedData.unitSpeed || 1;
      }
    } catch(e) {
      log('⚠️ getSpeedConstant nie je dostupný, používam default rýchlosť');
    }
  }

  // ===================== PAGE DETECTION =====================
  var isCombined = window.location.href.indexOf('screen=overview_villages') !== -1;
  var isRallyPoint = window.location.href.indexOf('screen=place') !== -1;

  if (isRallyPoint) {
    handleRallyPoint();
    return;
  }

  if (!isCombined) {
    if (typeof game_data !== 'undefined') {
      window.location.href = '/game.php?village=' + game_data.village.id + '&screen=overview_villages&mode=combined';
      return;
    }
    alert('⚠️ Otvor stránku Kombinované (Prehľad dedín → Kombinované)');
    return;
  }

  // ===================== COMBINED PAGE LOGIC =====================
  log('🏠 Spúšťam na Kombinovanej stránke...');
  log('📊 Ciele: ' + targets.length + ' | Fake limit: ' + fakeLimit + '% | Tabs: ' + openTabs);
  if (maxFakesPerTarget > 0) log('📊 Max fejkov na cieľ: ' + maxFakesPerTarget);
  if (maxFakesPerVillage > 0) log('🏠 Max fejkov z dediny: ' + maxFakesPerVillage);

  var villages = parseVillagesFromCombined();
  log('📋 Nájdených ' + villages.length + ' dedín s jednotkami');

  if (villages.length === 0) {
    alert('⚠️ Nenašli sa žiadne dediny na stránke Kombinované!');
    return;
  }

  var attackQueue = buildAttackQueue(villages, targets, fakeLimit);
  log('⚔️ Naplánovaných ' + attackQueue.length + ' útokov');

  if (attackQueue.length === 0) {
    alert('⚠️ Žiadne útoky sa nedajú naplánovať! (Skontroluj či máš barana, katapult alebo špeha)');
    return;
  }

  window._twAttackQueue = attackQueue;
  window._twAttackIndex = 0;
  window._twFakeConfig = config;

  showControlPanel(attackQueue);

  // ===================== PARSE VILLAGES =====================
  function parseVillagesFromCombined() {
    var result = [];
    var rows = document.querySelectorAll('#combined_table tr.row_a, #combined_table tr.row_b, table.vis tr.row_a, table.vis tr.row_b');
    if (rows.length === 0) rows = document.querySelectorAll('tr[class*="row_"]');

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var villageLink = row.querySelector('a[href*="village="]');
      if (!villageLink) continue;

      var href = villageLink.href || '';
      var villageIdMatch = href.match(/village=(\d+)/);
      if (!villageIdMatch) continue;
      var villageId = villageIdMatch[1];

      var coordMatch = villageLink.textContent.match(/(\d{3})\|(\d{3})/);
      var vx = coordMatch ? parseInt(coordMatch[1]) : 0;
      var vy = coordMatch ? parseInt(coordMatch[2]) : 0;

      // Use dynamic unit list from game_data
      var units = {};
      var unitCells = row.querySelectorAll('td.unit-item, td[class*="unit"]');
      if (unitCells.length > 0) {
        for (var j = 0; j < unitCells.length && j < gameUnits.length; j++) {
          var val = parseInt(unitCells[j].textContent.trim()) || 0;
          if (val > 0) units[gameUnits[j]] = val;
        }
      }

      var totalPop = 0;
      for (var u in units) {
        totalPop += units[u] * (unitPop[u] || 1);
      }

      if (totalPop > 0) {
        result.push({
          id: villageId, x: vx, y: vy,
          name: villageLink.textContent.trim(),
          units: units, totalPop: totalPop
        });
      }
    }
    return result;
  }

  // ===================== SELECT UNITS FOR FAKE =====================
  function selectUnitsForFake(availableUnits, fakeLimitPct) {
    // Mandatory condition: must have ram, catapult, OR spy
    var hasRam = (availableUnits.ram || 0) > 0;
    var hasCat = (availableUnits.catapult || 0) > 0;
    var hasSpy = (availableUnits.spy || 0) > 0;

    if (!hasRam && !hasCat && !hasSpy) {
      return {}; // Can't fake without ram/catapult/spy
    }

    var totalPop = 0;
    for (var u in availableUnits) {
      totalPop += availableUnits[u] * (unitPop[u] || 1);
    }
    var maxPop = Math.ceil(totalPop * (fakeLimitPct / 100));
    if (maxPop < 1) maxPop = 1;

    var selected = {};
    var usedPop = 0;

    // Always include at least 1 spy if available
    if (hasSpy) {
      selected.spy = 1;
      usedPop += unitPop.spy;
    }

    // Always include at least 1 ram or catapult if available
    if (hasRam && usedPop < maxPop) {
      selected.ram = 1;
      usedPop += unitPop.ram;
    } else if (hasCat && usedPop < maxPop) {
      selected.catapult = 1;
      usedPop += unitPop.catapult;
    }

    // Fill rest by priority
    for (var i = 0; i < fakePriority.length && usedPop < maxPop; i++) {
      var unitName = fakePriority[i];
      if (!availableUnits[unitName] || availableUnits[unitName] <= 0) continue;

      var alreadyUsed = selected[unitName] || 0;
      var remaining = availableUnits[unitName] - alreadyUsed;
      if (remaining <= 0) continue;

      var pop = unitPop[unitName] || 1;
      var maxCount = Math.floor((maxPop - usedPop) / pop);
      var count = Math.min(maxCount, remaining);

      if (count > 0) {
        selected[unitName] = (selected[unitName] || 0) + count;
        usedPop += count * pop;
      }
    }

    return selected;
  }

  // ===================== BUILD ATTACK QUEUE =====================
  function buildAttackQueue(villages, targetList, fakeLimitPct) {
    var queue = [];
    var targetCounts = {}; // targetKey -> count of attacks
    var villageCounts = {}; // villageId -> count of attacks

    // Round-robin: distribute targets across villages
    var targetIdx = 0;
    var maxIterations = targetList.length * villages.length * 2; // safety limit
    var iterations = 0;

    while (targetIdx < targetList.length && iterations < maxIterations) {
      iterations++;
      var assigned = false;

      for (var v = 0; v < villages.length && targetIdx < targetList.length; v++) {
        var village = villages[v];
        var villageKey = village.id;
        var target = targetList[targetIdx];
        var targetKey = target.x + '|' + target.y;

        // Check per-target limit
        if (maxFakesPerTarget > 0 && (targetCounts[targetKey] || 0) >= maxFakesPerTarget) {
          targetIdx++;
          continue;
        }

        // Check per-village limit
        if (maxFakesPerVillage > 0 && (villageCounts[villageKey] || 0) >= maxFakesPerVillage) {
          continue;
        }

        var selectedUnits = selectUnitsForFake(village.units, fakeLimitPct);
        if (Object.keys(selectedUnits).length === 0) continue;

        queue.push({
          villageId: village.id, villageName: village.name,
          villageX: village.x, villageY: village.y,
          targetX: target.x, targetY: target.y,
          units: selectedUnits
        });

        targetCounts[targetKey] = (targetCounts[targetKey] || 0) + 1;
        villageCounts[villageKey] = (villageCounts[villageKey] || 0) + 1;
        assigned = true;
        targetIdx++;
      }

      // If no village could be assigned in this round, break
      if (!assigned) break;
    }

    return queue;
  }

  // ===================== DISTANCE CALCULATION =====================
  function calcDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  function calcTravelTime(fromX, fromY, toX, toY, slowestUnit) {
    var dist = calcDistance(fromX, fromY, toX, toY);
    var baseSpeed = unitSpeed[slowestUnit] || 30; // minutes per field
    var speedMs = baseSpeed * 60 * 1000 / (worldSpeed * unitSpeedMod); // ms per field
    return dist * speedMs;
  }

  // ===================== CONTROL PANEL =====================
  function showControlPanel(queue) {
    var old = document.getElementById('tw-fake-panel');
    if (old) old.remove();

    var panel = document.createElement('div');
    panel.id = 'tw-fake-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:380px;max-height:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:8px;">';
    h += '<h3 style="margin:0;color:#7d510f;">⚔️ Fake Attack Queue</h3>';
    h += '</div>';

    h += '<div style="background:#fff3cd;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:11px;">';
    h += '<b>' + queue.length + '</b> útokov naplánovaných<br/>';
    h += 'Fake limit: <b>' + fakeLimit + '%</b> | Tabs: <b>' + openTabs + '</b>';
    if (maxFakesPerTarget > 0) h += '<br/>Max/cieľ: <b>' + maxFakesPerTarget + '</b>';
    if (maxFakesPerVillage > 0) h += ' | Max/dedina: <b>' + maxFakesPerVillage + '</b>';
    if (arrivalStart) h += '<br/>Príchod: ' + arrivalStart.toLocaleString('sk') + ' - ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk') : '?');
    h += '</div>';

    // Attack list
    h += '<div style="max-height:250px;overflow-y:auto;border:1px solid #d4a574;border-radius:4px;margin-bottom:8px;">';
    for (var i = 0; i < Math.min(queue.length, 30); i++) {
      var atk = queue[i];
      var unitStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
      var bg = i % 2 === 0 ? '#fff8e7' : '#f4e4bc';
      h += '<div style="padding:4px 8px;background:' + bg + ';border-bottom:1px solid #e6d5b8;font-size:10px;">';
      h += '<b>' + atk.villageName.substring(0, 20) + '</b> → ' + atk.targetX + '|' + atk.targetY;
      h += '<br/><span style="color:#8b7355;">' + unitStr + '</span>';
      h += '</div>';
    }
    if (queue.length > 30) h += '<div style="padding:4px 8px;text-align:center;font-size:10px;color:#8b7355;">...a ďalších ' + (queue.length - 30) + '</div>';
    h += '</div>';

    h += '<div style="display:flex;gap:8px;">';
    h += '<button id="tw-start-btn" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">▶ Spustiť (' + openTabs + ' tabov)</button>';
    h += '<button id="tw-close-panel" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    h += '</div>';

    panel.innerHTML = h;
    document.body.appendChild(panel);

    document.getElementById('tw-close-panel').onclick = function() { panel.remove(); };
    document.getElementById('tw-start-btn').onclick = function() { launchAttacks(); };
  }

  // ===================== LAUNCH ATTACKS =====================
  function launchAttacks() {
    var queue = window._twAttackQueue;
    var idx = window._twAttackIndex || 0;
    var tabsToOpen = Math.min(openTabs, queue.length - idx);

    if (tabsToOpen <= 0) {
      alert('✅ Všetky útoky boli otvorené!');
      return;
    }

    for (var i = 0; i < tabsToOpen; i++) {
      var attack = queue[idx + i];
      if (!attack) break;

      var atkData = btoa(unescape(encodeURIComponent(JSON.stringify(attack))));
      var url = '/game.php?village=' + attack.villageId + '&screen=place&target=' + attack.targetX + '|' + attack.targetY + '#twfake=' + atkData;
      window.open(url, '_blank');
    }

    window._twAttackIndex = idx + tabsToOpen;
    log('📑 Otvorených ' + tabsToOpen + ' tabov. Zostáva: ' + (queue.length - window._twAttackIndex));

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
  }

  // ===================== RALLY POINT HANDLER =====================
  function handleRallyPoint() {
    var hash = window.location.hash;
    var fakeMatch = hash.match(/twfake=(.+)/);

    if (!fakeMatch) {
      log('⚠️ Žiadne fake dáta v URL.');
      return;
    }

    var attack;
    try {
      attack = JSON.parse(decodeURIComponent(escape(atob(fakeMatch[1]))));
    } catch(e) {
      log('❌ Chyba dekódovania: ' + e.message);
      return;
    }

    log('🎯 Vyplňujem rally point: ' + attack.targetX + '|' + attack.targetY);
    log('📋 Jednotky: ' + JSON.stringify(attack.units));

    // Wait for page to load
    setTimeout(function() {
      fillRallyPoint(attack);
    }, 800);
  }

  function fillRallyPoint(attack) {
    // Fill target coordinates
    var inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
    var inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');

    if (inputX && inputY) {
      setNativeValue(inputX, attack.targetX);
      setNativeValue(inputY, attack.targetY);
      log('✅ Súradnice vyplnené: ' + attack.targetX + '|' + attack.targetY);
    }

    // Fill units with proper native setter and delays
    var unitKeys = Object.keys(attack.units);
    var delay = 0;

    for (var i = 0; i < unitKeys.length; i++) {
      (function(unitName, count, d) {
        setTimeout(function() {
          var input = document.getElementById('unit_input_' + unitName);
          if (!input) {
            log('⚠️ Input pre ' + unitName + ' nenájdený');
            return;
          }

          setNativeValue(input, count);
          log('✅ ' + unitName + ': ' + count);
        }, d);
      })(unitKeys[i], attack.units[unitKeys[i]], delay);
      delay += 150;
    }

    // After all units filled, highlight attack button
    setTimeout(function() {
      var attackBtn = document.getElementById('target_attack');
      if (attackBtn) {
        attackBtn.style.border = '3px solid #ff0000';
        attackBtn.style.boxShadow = '0 0 20px rgba(255,0,0,0.7)';
        attackBtn.style.animation = 'pulse 1s infinite';
      }

      // Add info banner
      var info = document.createElement('div');
      info.style.cssText = 'position:fixed;top:5px;left:50%;transform:translateX(-50%);z-index:99999;background:#27ae60;color:#fff;padding:10px 25px;border-radius:25px;font-family:Verdana;font-size:12px;font-weight:bold;box-shadow:0 3px 15px rgba(0,0,0,0.3);';

      var unitSummary = Object.keys(attack.units).map(function(k) { return k + ':' + attack.units[k]; }).join(' | ');
      info.textContent = '⚔️ Fake → ' + attack.targetX + '|' + attack.targetY + ' | ' + unitSummary + ' | Klikni Útok!';
      document.body.appendChild(info);

      log('✅ Rally point vyplnený. Klikni na Útok!');
    }, delay + 200);
  }

  // ===================== NATIVE INPUT VALUE SETTER =====================
  // This is critical for TW to register the values properly
  function setNativeValue(input, value) {
    // Use React/native input value setter to bypass framework interception
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;

    nativeInputValueSetter.call(input, value);

    // Dispatch full event sequence that TW UI expects
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
  }

})();
