// Updated TW Fake Executor - fakeScriptMain.js
// Changes:
// 1. maxFakesPerTarget - limits how many fakes go to one enemy village
// 2. maxFakesPerVillage - limits how many fakes are sent from one own village
// 3. Fixed unit selection on rally point (uses 'input' event + React-compatible setNativeValue)

(function() {
 'use strict';

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
 var maxFakesPerTarget = config.maxFakesPerTarget || 0; // 0 = unlimited
 var maxFakesPerVillage = config.maxFakesPerVillage || 0; // 0 = unlimited
 var arrivalStart = config.arrivalStart ? new Date(config.arrivalStart) : null;
 var arrivalEnd = config.arrivalEnd ? new Date(config.arrivalEnd) : null;

 function log(msg) { console.log('[TW-Fake] ' + msg); }

 var unitPop = {
  spear: 1, sword: 1, axe: 1, archer: 1,
  spy: 2, light: 4, marcher: 5, heavy: 6,
  ram: 5, catapult: 8, knight: 10, snob: 100
 };

 var fakePriority = ['spy', 'light', 'spear', 'axe', 'archer', 'marcher', 'heavy', 'sword', 'ram', 'catapult'];

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

 log('🏠 Spúšťam na Kombinovanej stránke...');
 log('📊 Ciele: ' + targets.length + ' | Fake limit: ' + fakeLimit + '% | Tabs: ' + openTabs);
 log('📊 Max fejkov na cieľ: ' + (maxFakesPerTarget || '∞') + ' | Max fejkov z dediny: ' + (maxFakesPerVillage || '∞'));

 var villages = parseVillagesFromCombined();
 log('📋 Nájdených ' + villages.length + ' dedín s jednotkami');

 if (villages.length === 0) {
  alert('⚠️ Nenašli sa žiadne dediny na stránke Kombinované!');
  return;
 }

 var attackQueue = buildAttackQueue(villages, targets, fakeLimit);
 log('⚔️ Naplánovaných ' + attackQueue.length + ' útokov');

 if (attackQueue.length === 0) {
  alert('⚠️ Žiadne útoky sa nedajú naplánovať!');
  return;
 }

 window._twAttackQueue = attackQueue;
 window._twAttackIndex = 0;
 window._twFakeConfig = config;

 showControlPanel(attackQueue);

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

   var units = {};
   var unitNames = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

   var unitCells = row.querySelectorAll('td.unit-item, td[class*="unit"]');
   if (unitCells.length > 0) {
    for (var j = 0; j < unitCells.length && j < unitNames.length; j++) {
     var val = parseInt(unitCells[j].textContent.trim()) || 0;
     if (val > 0) units[unitNames[j]] = val;
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

 function selectUnitsForFake(availableUnits, fakeLimitPct) {
  var totalPop = 0;
  for (var u in availableUnits) {
   totalPop += availableUnits[u] * (unitPop[u] || 1);
  }
  var maxPop = Math.ceil(totalPop * (fakeLimitPct / 100));
  if (maxPop < 1) maxPop = 1;

  var selected = {};
  var usedPop = 0;

  for (var i = 0; i < fakePriority.length; i++) {
   var unitName = fakePriority[i];
   if (!availableUnits[unitName] || availableUnits[unitName] <= 0) continue;

   var pop = unitPop[unitName] || 1;
   var maxCount = Math.floor((maxPop - usedPop) / pop);
   var count = Math.min(maxCount, availableUnits[unitName]);

   if (count > 0) {
    selected[unitName] = count;
    usedPop += count * pop;
   }
   if (usedPop >= maxPop) break;
  }

  if (Object.keys(selected).length === 0) {
   for (var j = 0; j < fakePriority.length; j++) {
    if (availableUnits[fakePriority[j]] > 0) {
     selected[fakePriority[j]] = 1;
     break;
    }
   }
  }
  return selected;
 }

 function buildAttackQueue(villages, targetList, fakeLimitPct) {
  var queue = [];
  // Track counts per target and per village
  var targetCounts = {}; // "x|y" -> count
  var villageCounts = {}; // villageId -> count

  for (var t = 0; t < targetList.length; t++) {
   var target = targetList[t];
   var targetKey = target.x + '|' + target.y;

   // Check if this target already has max fakes
   if (maxFakesPerTarget > 0 && (targetCounts[targetKey] || 0) >= maxFakesPerTarget) {
    continue;
   }

   // Find a village that can still send
   var assigned = false;
   for (var v = 0; v < villages.length; v++) {
    var village = villages[v];

    // Check if this village already sent max fakes
    if (maxFakesPerVillage > 0 && (villageCounts[village.id] || 0) >= maxFakesPerVillage) {
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
    villageCounts[village.id] = (villageCounts[village.id] || 0) + 1;
    assigned = true;
    break;
   }

   // If no village could be assigned (all maxed out), try wrapping
   if (!assigned) {
    log('⚠️ Žiadna dedina nemôže poslať fake na ' + targetKey);
   }
  }

  return queue;
 }

 function showControlPanel(queue) {
  var old = document.getElementById('tw-fake-panel');
  if (old) old.remove();

  var panel = document.createElement('div');
  panel.id = 'tw-fake-panel';
  panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:350px;max-height:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

  var h = '<div>';
  h += '<h3 style="margin:0 0 10px;color:#7d510f;">⚔️ Fake Attack Queue</h3>';
  h += '<p style="margin:5px 0;">' + queue.length + ' útokov naplánovaných</p>';
  if (maxFakesPerTarget > 0) h += '<p style="margin:2px 0;font-size:10px;">Max na cieľ: ' + maxFakesPerTarget + '</p>';
  if (maxFakesPerVillage > 0) h += '<p style="margin:2px 0;font-size:10px;">Max z dediny: ' + maxFakesPerVillage + '</p>';
  if (arrivalStart) h += '<p style="margin:5px 0;font-size:10px;">Príchod: ' + arrivalStart.toLocaleString('sk') + ' - ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk') : '?') + '</p>';
  h += '<hr style="border-color:#7d510f;margin:8px 0;">';

  h += '<div style="max-height:300px;overflow-y:auto;">';
  for (var i = 0; i < Math.min(queue.length, 20); i++) {
   var atk = queue[i];
   var unitStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
   h += '<div style="padding:4px 0;border-bottom:1px solid #d4c4a0;">';
   h += '<b>' + atk.villageName.substring(0, 20) + '</b> → ' + atk.targetX + '|' + atk.targetY;
   h += '<br><span style="color:#666;font-size:10px;">' + unitStr + '</span>';
   h += '</div>';
  }
  if (queue.length > 20) h += '<p style="text-align:center;color:#999;">...a ďalších ' + (queue.length - 20) + '</p>';
  h += '</div>';

  h += '<div style="margin-top:10px;display:flex;gap:8px;">';
  h += '<button id="tw-start-btn" style="flex:1;background:#27ae60;color:#fff;border:none;padding:8px;border-radius:4px;cursor:pointer;font-weight:bold;">▶ Spustiť (' + openTabs + ' tabov)</button>';
  h += '<button id="tw-close-panel" style="background:#c0392b;color:#fff;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;">✕</button>';
  h += '</div>';

  panel.innerHTML = h;
  document.body.appendChild(panel);

  document.getElementById('tw-close-panel').onclick = function() { panel.remove(); };
  document.getElementById('tw-start-btn').onclick = function() { launchAttacks(); };
 }

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

 // FIXED: Rally point handler with proper input value setting
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

  // Helper to set value on input in a way that works with TW's JS framework
  function setInputValue(input, value) {
   // Try React-style native value setter first
   var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
   nativeInputValueSetter.call(input, value);

   // Fire all relevant events
   input.dispatchEvent(new Event('input', { bubbles: true }));
   input.dispatchEvent(new Event('change', { bubbles: true }));
   input.dispatchEvent(new Event('blur', { bubbles: true }));

   // Also try direct assignment as fallback
   input.value = value;
  }

  // Wait for page to fully load
  setTimeout(function() {
   // Set target coordinates
   var inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
   var inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');

   if (inputX && inputY) {
    setInputValue(inputX, attack.targetX);
    setInputValue(inputY, attack.targetY);
   }

   // Set units - with retry mechanism
   function setUnits() {
    var unitKeys = Object.keys(attack.units);
    var allSet = true;

    for (var i = 0; i < unitKeys.length; i++) {
     var unitName = unitKeys[i];
     var count = attack.units[unitName];

     // Try multiple selectors
     var input = document.getElementById('unit_input_' + unitName)
              || document.querySelector('input[name="' + unitName + '"]')
              || document.querySelector('#unit_input_' + unitName);

     if (input) {
      setInputValue(input, count);
      log('✅ Nastavená jednotka: ' + unitName + ' = ' + count);
     } else {
      log('⚠️ Nenájdený input pre: ' + unitName);
      allSet = false;
     }
    }
    return allSet;
   }

   // Try immediately, then retry after delays
   if (!setUnits()) {
    setTimeout(function() { setUnits(); }, 500);
    setTimeout(function() { setUnits(); }, 1500);
   }

   // Highlight attack button
   var attackBtn = document.getElementById('target_attack');
   if (attackBtn) {
    attackBtn.style.border = '3px solid #ff0000';
    attackBtn.style.boxShadow = '0 0 15px rgba(255,0,0,0.6)';
   }

   // Show info banner
   var info = document.createElement('div');
   info.style.cssText = 'position:fixed;top:5px;left:50%;transform:translateX(-50%);z-index:99999;background:#27ae60;color:#fff;padding:8px 20px;border-radius:20px;font-family:Verdana;font-size:12px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,0.3);';
   info.textContent = '⚔️ Fake → ' + attack.targetX + '|' + attack.targetY + ' | Klikni Útok!';
   document.body.appendChild(info);

   log('✅ Rally point vyplnený.');
  }, 800); // Increased delay for page load
 }

})();
