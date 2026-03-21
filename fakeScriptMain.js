// TW Fake Executor - Hlavný skript (UPRAVENÝ)
// Podporuje: maxFakesPerTarget, maxFakesPerVillage
// Nahraj na GitHub ako fakeScriptMain.js

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
 var maxFakesPerTarget = config.maxFakesPerTarget || 0;  // 0 = neobmedzené
 var maxFakesPerVillage = config.maxFakesPerVillage || 0; // 0 = neobmedzené
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

   var cells = row.querySelectorAll('td');
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

 // UPRAVENÁ FUNKCIA - podporuje maxFakesPerTarget a maxFakesPerVillage
 function buildAttackQueue(villages, targetList, fakeLimitPct) {
  var queue = [];

  // Počítadlá
  var targetFakeCount = {};  // koľko fejkov už ide na daný cieľ
  var villageFakeCount = {}; // koľko fejkov už ide z danej dediny

  // Inicializácia počítadiel
  for (var t = 0; t < targetList.length; t++) {
   var key = targetList[t].x + '|' + targetList[t].y;
   targetFakeCount[key] = 0;
  }
  for (var v = 0; v < villages.length; v++) {
   villageFakeCount[villages[v].id] = 0;
  }

  // Rozdeľuj fejky rovnomerne
  var allAssigned = false;
  var maxIterations = targetList.length * villages.length; // bezpečnostný limit
  var iteration = 0;

  while (!allAssigned && iteration < maxIterations) {
   allAssigned = true;
   iteration++;

   for (var ti = 0; ti < targetList.length; ti++) {
    var targetKey = targetList[ti].x + '|' + targetList[ti].y;

    // Skontroluj limit na cieľ
    if (maxFakesPerTarget > 0 && targetFakeCount[targetKey] >= maxFakesPerTarget) {
     continue;
    }

    // Nájdi dedinu, ktorá ešte môže posielať
    var assigned = false;
    for (var vi = 0; vi < villages.length; vi++) {
     var village = villages[vi];

     // Skontroluj limit z dediny
     if (maxFakesPerVillage > 0 && villageFakeCount[village.id] >= maxFakesPerVillage) {
      continue;
     }

     var selectedUnits = selectUnitsForFake(village.units, fakeLimitPct);
     if (Object.keys(selectedUnits).length === 0) continue;

     queue.push({
      villageId: village.id, villageName: village.name,
      villageX: village.x, villageY: village.y,
      targetX: targetList[ti].x, targetY: targetList[ti].y,
      units: selectedUnits
     });

     targetFakeCount[targetKey]++;
     villageFakeCount[village.id]++;
     assigned = true;
     allAssigned = false;
     break; // prejdi na ďalší cieľ
    }

    // Ak sa nepodarilo priradiť žiadnu dedinu tomuto cieľu, pokračuj
    if (!assigned) continue;
   }

   // Skontroluj či ešte existujú ciele, ktoré potrebujú fejky a dediny, ktoré môžu posielať
   var hasAvailableTargets = false;
   var hasAvailableVillages = false;

   for (var tc = 0; tc < targetList.length; tc++) {
    var tk = targetList[tc].x + '|' + targetList[tc].y;
    if (maxFakesPerTarget === 0 || targetFakeCount[tk] < maxFakesPerTarget) {
     hasAvailableTargets = true;
     break;
    }
   }

   for (var vc = 0; vc < villages.length; vc++) {
    if (maxFakesPerVillage === 0 || villageFakeCount[villages[vc].id] < maxFakesPerVillage) {
     if (Object.keys(selectUnitsForFake(villages[vc].units, fakeLimitPct)).length > 0) {
      hasAvailableVillages = true;
      break;
     }
    }
   }

   if (!hasAvailableTargets || !hasAvailableVillages) break;
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
  h += '<h3 style="margin:0 0 10px;text-align:center;">⚔️ Fake Attack Queue</h3>';
  h += '<div style="text-align:center;margin-bottom:8px;">' + queue.length + ' útokov naplánovaných</div>';
  if (maxFakesPerTarget > 0) h += '<div style="text-align:center;font-size:10px;color:#666;">Max na cieľ: ' + maxFakesPerTarget + '</div>';
  if (maxFakesPerVillage > 0) h += '<div style="text-align:center;font-size:10px;color:#666;">Max z dediny: ' + maxFakesPerVillage + '</div>';
  if (arrivalStart) h += '<div style="text-align:center;font-size:10px;color:#666;">Príchod: ' + arrivalStart.toLocaleString('sk') + ' - ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk') : '?') + '</div>';
  h += '<hr style="border-color:#7d510f;margin:8px 0;">';

  h += '<div style="max-height:300px;overflow-y:auto;">';
  for (var i = 0; i < Math.min(queue.length, 20); i++) {
   var atk = queue[i];
   var unitStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
   h += '<div style="padding:4px 0;border-bottom:1px solid #ddd;">';
   h += ' <b>' + atk.villageName.substring(0, 20) + '</b> → ' + atk.targetX + '|' + atk.targetY;
   h += '<br><span style="font-size:10px;color:#666;">' + unitStr + '</span>';
   h += '</div>';
  }
  if (queue.length > 20) h += '<div style="text-align:center;padding:5px;color:#666;">...a ďalších ' + (queue.length - 20) + '</div>';
  h += '</div>';

  h += '<div style="margin-top:10px;text-align:center;">';
  h += '<button id="tw-start-btn" style="background:#27ae60;color:#fff;border:none;padding:8px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">▶ Spustiť (' + openTabs + ' tabov)</button>';
  h += ' <button id="tw-close-panel" style="background:#e74c3c;color:#fff;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;">✕</button>';
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

  setTimeout(function() {
   // Vyplň súradnice
   var inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
   var inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');

   if (inputX && inputY) {
    inputX.focus(); inputX.value = attack.targetX;
    inputX.dispatchEvent(new Event('change', { bubbles: true }));
    inputX.dispatchEvent(new Event('input', { bubbles: true }));
    inputY.focus(); inputY.value = attack.targetY;
    inputY.dispatchEvent(new Event('change', { bubbles: true }));
    inputY.dispatchEvent(new Event('input', { bubbles: true }));
   }

   // Vyplň jednotky - OPRAVENÉ: pridaný input event + delay
   var unitKeys = Object.keys(attack.units);
   for (var i = 0; i < unitKeys.length; i++) {
    (function(unitName, count) {
     setTimeout(function() {
      var input = document.getElementById('unit_input_' + unitName);
      if (!input) {
       // Skús alternatívne selektory
       input = document.querySelector('input[name="' + unitName + '"]');
      }
      if (input) {
       // Vyčisti pole
       input.value = '';
       input.focus();
       
       // Nastav hodnotu
       var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
       nativeInputValueSetter.call(input, count);
       
       // Dispatchuj všetky relevantné eventy
       input.dispatchEvent(new Event('input', { bubbles: true }));
       input.dispatchEvent(new Event('change', { bubbles: true }));
       input.dispatchEvent(new Event('blur', { bubbles: true }));
       input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
       
       log('✅ Jednotka ' + unitName + ' = ' + count);
      } else {
       log('⚠️ Nenašiel sa input pre: ' + unitName);
      }
     }, i * 100); // Malý delay medzi jednotkami
    })(unitKeys[i], attack.units[unitKeys[i]]);
   }

   // Zvýrazni tlačidlo útoku s oneskorením (počkaj kým sa vyplnia jednotky)
   setTimeout(function() {
    var attackBtn = document.getElementById('target_attack');
    if (attackBtn) {
     attackBtn.style.border = '3px solid #ff0000';
     attackBtn.style.boxShadow = '0 0 15px rgba(255,0,0,0.6)';
    }

    var info = document.createElement('div');
    info.style.cssText = 'position:fixed;top:5px;left:50%;transform:translateX(-50%);z-index:99999;background:#27ae60;color:#fff;padding:8px 20px;border-radius:20px;font-family:Verdana;font-size:12px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,0.3);';
    info.textContent = '⚔️ Fake → ' + attack.targetX + '|' + attack.targetY + ' | Klikni Útok!';
    document.body.appendChild(info);

    log('✅ Rally point vyplnený.');
   }, unitKeys.length * 100 + 200);

  }, 500);
 }

})();
