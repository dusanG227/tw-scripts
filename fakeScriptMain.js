// TW Fake Executor - Hlavný skript (v2)
// Nahraj na GitHub ako fakeScriptMain.js
// Zmeny: maxFakesPerTarget, maxFakesPerVillage, podmienka ram/catapult, fix unit input

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

 // Priorita: spy prvý (vždy chceme špeha), potom ram/catapult (podmienka fejku), potom zvyšok
 var fakePriority = ['spy', 'ram', 'catapult', 'light', 'spear', 'axe', 'archer', 'marcher', 'heavy', 'sword'];

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
 if (maxFakesPerTarget) log('🎯 Max fejkov na cieľ: ' + maxFakesPerTarget);
 if (maxFakesPerVillage) log('🏠 Max fejkov z dediny: ' + maxFakesPerVillage);

 var villages = parseVillagesFromCombined();
 log('📋 Nájdených ' + villages.length + ' dedín s jednotkami');

 if (villages.length === 0) {
   alert('⚠️ Nenašli sa žiadne dediny na stránke Kombinované!');
   return;
 }

 var attackQueue = buildAttackQueue(villages, targets, fakeLimit);
 log('⚔️ Naplánovaných ' + attackQueue.length + ' útokov');

 if (attackQueue.length === 0) {
   alert('⚠️ Žiadne útoky sa nedajú naplánovať! Skontroluj, či tvoje dediny majú barana alebo katapult.');
   return;
 }

 window._twAttackQueue = attackQueue;
 window._twAttackIndex = 0;
 window._twFakeConfig = config;

 showControlPanel(attackQueue);

 // ========== PARSE VILLAGES ==========
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

     // Podmienka: dedina musí mať ram ALEBO catapult (inak nemôže posielať fejky)
     var hasRamOrCata = (units.ram && units.ram > 0) || (units.catapult && units.catapult > 0);
     if (totalPop > 0 && hasRamOrCata) {
       result.push({
         id: villageId, x: vx, y: vy,
         name: villageLink.textContent.trim(),
         units: units, totalPop: totalPop
       });
     }
   }
   return result;
 }

 // ========== SELECT UNITS ==========
 function selectUnitsForFake(availableUnits, fakeLimitPct) {
   var totalPop = 0;
   for (var u in availableUnits) {
     totalPop += availableUnits[u] * (unitPop[u] || 1);
   }
   var maxPop = Math.ceil(totalPop * (fakeLimitPct / 100));
   if (maxPop < 1) maxPop = 1;

   var selected = {};
   var usedPop = 0;

   // Podmienka: musí obsahovať ram alebo catapult
   // Najprv pridáme 1 ram alebo 1 catapult
   if (availableUnits.ram && availableUnits.ram > 0) {
     selected.ram = 1;
     usedPop += unitPop.ram;
   } else if (availableUnits.catapult && availableUnits.catapult > 0) {
     selected.catapult = 1;
     usedPop += unitPop.catapult;
   } else {
     // Nemá ram ani catapult - nemôže posielať fejk
     return {};
   }

   // Pridáme špeha ak je dostupný
   if (availableUnits.spy && availableUnits.spy > 0) {
     selected.spy = 1;
     usedPop += unitPop.spy;
   }

   // Potom doplníme podľa priority do limitu
   for (var i = 0; i < fakePriority.length; i++) {
     var unitName = fakePriority[i];
     if (!availableUnits[unitName] || availableUnits[unitName] <= 0) continue;

     var alreadySelected = selected[unitName] || 0;
     var remaining = availableUnits[unitName] - alreadySelected;
     if (remaining <= 0) continue;

     var pop = unitPop[unitName] || 1;
     var maxCount = Math.floor((maxPop - usedPop) / pop);
     var count = Math.min(maxCount, remaining);

     if (count > 0) {
       selected[unitName] = (selected[unitName] || 0) + count;
       usedPop += count * pop;
     }
     if (usedPop >= maxPop) break;
   }

   return selected;
 }

 // ========== BUILD ATTACK QUEUE ==========
 function buildAttackQueue(villages, targetList, fakeLimitPct) {
   var queue = [];
   // Track counts per target and per village
   var targetCounts = {}; // targetKey -> count
   var villageCounts = {}; // villageId -> count

   for (var t = 0; t < targetList.length; t++) {
     var targetKey = targetList[t].x + '|' + targetList[t].y;
     targetCounts[targetKey] = 0;
   }

   // Round-robin: iterate targets, for each find a village that can attack
   for (var t = 0; t < targetList.length; t++) {
     var target = targetList[t];
     var targetKey = target.x + '|' + target.y;

     // How many fakes should go to this target?
     var maxForThisTarget = maxFakesPerTarget > 0 ? maxFakesPerTarget : villages.length;
     var sentToTarget = 0;

     for (var v = 0; v < villages.length && sentToTarget < maxForThisTarget; v++) {
       var village = villages[v];

       // Check village limit
       if (maxFakesPerVillage > 0) {
         var vCount = villageCounts[village.id] || 0;
         if (vCount >= maxFakesPerVillage) continue;
       }

       var selectedUnits = selectUnitsForFake(village.units, fakeLimitPct);
       if (Object.keys(selectedUnits).length === 0) continue;

       queue.push({
         villageId: village.id, villageName: village.name,
         villageX: village.x, villageY: village.y,
         targetX: target.x, targetY: target.y,
         units: selectedUnits
       });

       villageCounts[village.id] = (villageCounts[village.id] || 0) + 1;
       sentToTarget++;
     }
   }

   return queue;
 }

 // ========== CONTROL PANEL ==========
 function showControlPanel(queue) {
   var old = document.getElementById('tw-fake-panel');
   if (old) old.remove();

   var panel = document.createElement('div');
   panel.id = 'tw-fake-panel';
   panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:350px;max-height:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

   var h = '<div>';
   h += '<h3 style="text-align:center;margin:0 0 8px;color:#5c3a11;">⚔️ Fake Attack Queue</h3>';
   h += '<p style="text-align:center;margin:0 0 5px;">' + queue.length + ' útokov naplánovaných</p>';
   if (maxFakesPerTarget) h += '<p style="text-align:center;font-size:10px;color:#888;">Max na cieľ: ' + maxFakesPerTarget + '</p>';
   if (maxFakesPerVillage) h += '<p style="text-align:center;font-size:10px;color:#888;">Max z dediny: ' + maxFakesPerVillage + '</p>';
   if (arrivalStart) h += '<p style="text-align:center;font-size:10px;">Príchod: ' + arrivalStart.toLocaleString('sk') + ' - ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk') : '?') + '</p>';

   h += '<div style="border-top:1px solid #c9a96e;margin:8px 0;padding-top:8px;">';
   for (var i = 0; i < Math.min(queue.length, 20); i++) {
     var atk = queue[i];
     var unitStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
     h += '<div style="padding:3px 0;border-bottom:1px dotted #c9a96e;">';
     h += '<b>' + atk.villageName.substring(0, 20) + '</b> → ' + atk.targetX + '|' + atk.targetY;
     h += '<br><span style="font-size:10px;color:#666;">' + unitStr + '</span>';
     h += '</div>';
   }
   if (queue.length > 20) h += '<p style="text-align:center;font-size:10px;">...a ďalších ' + (queue.length - 20) + '</p>';
   h += '</div>';

   h += '<div style="display:flex;gap:8px;margin-top:8px;">';
   h += '<button id="tw-start-btn" style="flex:1;padding:8px;background:#27ae60;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;">▶ Spustiť (' + openTabs + ' tabov)</button>';
   h += '<button id="tw-close-panel" style="padding:8px 12px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>';
   h += '</div></div>';

   panel.innerHTML = h;
   document.body.appendChild(panel);

   document.getElementById('tw-close-panel').onclick = function() { panel.remove(); };
   document.getElementById('tw-start-btn').onclick = function() { launchAttacks(); };
 }

 // ========== LAUNCH ATTACKS ==========
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

 // ========== HANDLE RALLY POINT (fix unit inputs) ==========
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
   log('📦 Jednotky: ' + JSON.stringify(attack.units));

   // Čakáme kým sa stránka načíta
   function waitForElement(selector, callback, maxWait) {
     var elapsed = 0;
     var interval = setInterval(function() {
       var el = document.querySelector(selector);
       elapsed += 100;
       if (el) {
         clearInterval(interval);
         callback(el);
       } else if (elapsed >= (maxWait || 5000)) {
         clearInterval(interval);
         log('⚠️ Element ' + selector + ' sa nenašiel.');
       }
     }, 100);
   }

   // Funkcia na nastavenie hodnoty inputu - React/jQuery kompatibilná
   function setInputValue(input, value) {
     // Skúsime nativeInputValueSetter (funguje s React)
     var nativeSetter = Object.getOwnPropertyDescriptor(
       window.HTMLInputElement.prototype, 'value'
     );
     if (nativeSetter && nativeSetter.set) {
       nativeSetter.set.call(input, value);
     } else {
       input.value = value;
     }

     // Spustíme všetky potrebné eventy
     input.dispatchEvent(new Event('input', { bubbles: true }));
     input.dispatchEvent(new Event('change', { bubbles: true }));
     input.dispatchEvent(new Event('blur', { bubbles: true }));

     // Pre istotu aj KeyboardEvent
     try {
       input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
       input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
     } catch(e) {}

     log('  ✅ Input ' + (input.name || input.id) + ' = ' + value);
   }

   waitForElement('#unit_input_spy, input[name="spy"]', function() {
     // Najprv vyplníme cieľové súradnice
     var inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
     var inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');

     if (inputX && inputY) {
       setInputValue(inputX, attack.targetX);
       setInputValue(inputY, attack.targetY);
       log('📍 Súradnice vyplnené: ' + attack.targetX + '|' + attack.targetY);
     }

     // Vyplníme jednotky s malým oneskorením medzi každou
     var unitKeys = Object.keys(attack.units);
     var delay = 0;

     for (var i = 0; i < unitKeys.length; i++) {
       (function(unitName, count, d) {
         setTimeout(function() {
           // Skúsime rôzne selektory pre input
           var input = document.getElementById('unit_input_' + unitName)
                    || document.querySelector('input[name="' + unitName + '"]')
                    || document.querySelector('#unit_input_' + unitName);

           if (input) {
             // Klikneme na input pre focus
             input.click();
             input.focus();

             // Vyčistíme a nastavíme hodnotu
             setInputValue(input, '');
             setTimeout(function() {
               setInputValue(input, count);
             }, 50);
           } else {
             log('⚠️ Input pre ' + unitName + ' sa nenašiel!');
           }
         }, d);
       })(unitKeys[i], attack.units[unitKeys[i]], delay);
       delay += 150; // 150ms medzi každou jednotkou
     }

     // Po vyplnení všetkých jednotiek zvýrazníme tlačidlo útoku
     setTimeout(function() {
       var attackBtn = document.getElementById('target_attack');
       if (attackBtn) {
         attackBtn.style.border = '3px solid #ff0000';
         attackBtn.style.boxShadow = '0 0 15px rgba(255,0,0,0.6)';
       }

       // Info banner
       var unitStr = Object.keys(attack.units).map(function(k) {
         return k + ': ' + attack.units[k];
       }).join(' | ');

       var info = document.createElement('div');
       info.style.cssText = 'position:fixed;top:5px;left:50%;transform:translateX(-50%);z-index:99999;background:#27ae60;color:#fff;padding:8px 20px;border-radius:20px;font-family:Verdana;font-size:12px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,0.3);max-width:90%;text-align:center;';
       info.innerHTML = '⚔️ Fake → ' + attack.targetX + '|' + attack.targetY + '<br><span style="font-size:10px;font-weight:normal;">' + unitStr + '</span><br><span style="font-size:10px;">Klikni Útok!</span>';
       document.body.appendChild(info);

       log('✅ Rally point vyplnený. Klikni na tlačidlo Útok!');
     }, delay + 200);
   });
 }

})();
