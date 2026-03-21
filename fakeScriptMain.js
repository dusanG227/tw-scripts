// TW Fake Executor - Hlavný skript
// Nahraj na GitHub ako fakeScriptMain.js
// Spúšťa sa vygenerovaným bookmarkletom z launchera

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

  function buildAttackQueue(villages, targetList, fakeLimitPct) {
    var queue = [];
    var targetIdx = 0;

    for (var v = 0; v < villages.length && targetIdx < targetList.length; v++) {
      var village = villages[v];
      var selectedUnits = selectUnitsForFake(village.units, fakeLimitPct);
      if (Object.keys(selectedUnits).length === 0) continue;

      queue.push({
        villageId: village.id, villageName: village.name,
        villageX: village.x, villageY: village.y,
        targetX: targetList[targetIdx].x, targetY: targetList[targetIdx].y,
        units: selectedUnits
      });
      targetIdx++;
    }

    while (targetIdx < targetList.length) {
      for (var w = 0; w < villages.length && targetIdx < targetList.length; w++) {
        var vil = villages[w];
        var selUnits = selectUnitsForFake(vil.units, fakeLimitPct);
        if (Object.keys(selUnits).length === 0) continue;

        queue.push({
          villageId: vil.id, villageName: vil.name,
          villageX: vil.x, villageY: vil.y,
          targetX: targetList[targetIdx].x, targetY: targetList[targetIdx].y,
          units: selUnits
        });
        targetIdx++;
      }
      if (villages.every(function(v) { return Object.keys(selectUnitsForFake(v.units, fakeLimitPct)).length === 0; })) break;
    }
    return queue;
  }

  function showControlPanel(queue) {
    var old = document.getElementById('tw-fake-panel');
    if (old) old.remove();

    var panel = document.createElement('div');
    panel.id = 'tw-fake-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:15px;font-family:Verdana,sans-serif;font-size:11px;color:#3e2b0d;width:350px;max-height:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style="text-align:center;margin-bottom:10px;">';
    h += '<h3 style="margin:0;color:#7d510f;">⚔️ Fake Attack Queue</h3>';
    h += '<p style="margin:2px 0;font-size:10px;">' + queue.length + ' útokov naplánovaných</p>';
    if (arrivalStart) h += '<p style="font-size:9px;color:#8b7355;">Príchod: ' + arrivalStart.toLocaleString('sk') + ' - ' + (arrivalEnd ? arrivalEnd.toLocaleString('sk') : '?') + '</p>';
    h += '</div>';

    h += '<div id="tw-queue-list" style="max-height:200px;overflow-y:auto;margin-bottom:10px;">';
    for (var i = 0; i < Math.min(queue.length, 20); i++) {
      var atk = queue[i];
      var unitStr = Object.keys(atk.units).map(function(k) { return k + ':' + atk.units[k]; }).join(', ');
      h += '<div style="padding:3px 5px;margin:2px 0;background:' + (i % 2 === 0 ? '#fff8e7' : '#f4e4bc') + ';border-radius:3px;font-size:9px;">';
      h += '<b>' + atk.villageName.substring(0, 20) + '</b> → ' + atk.targetX + '|' + atk.targetY;
      h += '<br><span style="color:#8b7355;">' + unitStr + '</span>';
      h += '</div>';
    }
    if (queue.length > 20) h += '<p style="text-align:center;font-size:9px;color:#8b7355;">...a ďalších ' + (queue.length - 20) + '</p>';
    h += '</div>';

    h += '<div style="display:flex;gap:6px;">';
    h += '<button id="tw-start-btn" style="flex:1;padding:8px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">▶ Spustiť (' + openTabs + ' tabov)</button>';
    h += '<button id="tw-close-panel" style="padding:8px 12px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;">✕</button>';
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
      var inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
      var inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');

      if (inputX && inputY) {
        inputX.focus(); inputX.value = attack.targetX;
        inputX.dispatchEvent(new Event('change', { bubbles: true }));
        inputY.focus(); inputY.value = attack.targetY;
        inputY.dispatchEvent(new Event('change', { bubbles: true }));
      }

      var unitKeys = Object.keys(attack.units);
      for (var i = 0; i < unitKeys.length; i++) {
        var unitName = unitKeys[i];
        var count = attack.units[unitName];
        var input = document.getElementById('unit_input_' + unitName);
        if (input) {
          input.focus(); input.value = count;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

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
    }, 500);
  }

})();
