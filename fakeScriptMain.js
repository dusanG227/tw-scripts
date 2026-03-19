// =============================================
// TW Fake Script Executor v2.0
// Načítaný cez bookmarklet vygenerovaný generátorom
// =============================================
(function() {
  'use strict';

  // Načítaj config z bookmarkletu alebo z window
  var config;
  if (typeof _twFakeData !== 'undefined') {
    try {
      config = JSON.parse(decodeURIComponent(escape(atob(_twFakeData))));
      window._twFakeConfig = config;
      console.log('[TW-Fake] Config načítaný z bookmarkletu');
    } catch(e) {
      alert('[TW-Fake] Chyba pri dekódovaní configu!');
      console.error(e);
      return;
    }
  } else if (window._twFakeConfig) {
    config = window._twFakeConfig;
    console.log('[TW-Fake] Config načítaný z window (pokračovanie)');
  } else {
    alert('[TW-Fake] Žiadny config! Najprv spusti generátor a použi vygenerovaný bookmarklet.');
    return;
  }

  // Kontrola či sme na rally point
  if (window.location.href.indexOf('screen=place') === -1) {
    var villageId = window.game_data ? window.game_data.village.id : '';
    alert('[TW-Fake] Otvor rally point (Zhromaždisko) a spusti bookmarklet znova.\n\nURL: game.php?village=' + villageId + '&screen=place');
    return;
  }

  var target = config.targets[config.currentIndex];
  if (!target) {
    alert('[TW-Fake] ✅ Všetky fake útoky dokončené! (' + config.targets.length + ' cieľov)');
    delete window._twFakeConfig;
    delete window._twFakeData;
    return;
  }

  // === Info panel ===
  var infoId = 'tw-fake-info';
  if (document.getElementById(infoId)) document.getElementById(infoId).remove();

  var info = document.createElement('div');
  info.id = infoId;
  info.style.cssText = 'position:fixed;top:10px;right:10px;background:#1a1a2e;color:#e0e0e0;border:2px solid #e94560;border-radius:8px;padding:12px;z-index:99999;font-family:Verdana,sans-serif;font-size:11px;min-width:220px;box-shadow:0 0 20px rgba(233,69,96,0.3);';
  info.innerHTML = '<div style="font-size:14px;font-weight:bold;color:#e94560;margin-bottom:8px;">⚔️ TW Fake Executor</div>' +
    '<div>🎯 Cieľ: <strong style="color:#e94560;">' + target.x + '|' + target.y + '</strong></div>' +
    '<div>📊 Progres: <strong>' + (config.currentIndex + 1) + '/' + config.targets.length + '</strong></div>' +
    '<div style="background:#16213e;border-radius:4px;height:6px;margin:6px 0;"><div style="background:#e94560;height:100%;border-radius:4px;width:' + Math.round((config.currentIndex + 1) / config.targets.length * 100) + '%;"></div></div>' +
    '<div style="font-size:9px;color:#888;">Tabs: ' + (config.openTabs || 1) + ' | Limit: ' + (config.fakeLimit || 0.5) + '%</div>' +
    '<button id="tw-fake-skip" style="margin-top:6px;padding:3px 10px;background:#0f3460;color:#e94560;border:1px solid #e94560;border-radius:3px;cursor:pointer;font-size:10px;">⏭ Skip</button>' +
    ' <button id="tw-fake-stop" style="margin-top:6px;padding:3px 10px;background:#e94560;color:white;border:none;border-radius:3px;cursor:pointer;font-size:10px;">⏹ Stop</button>';
  document.body.appendChild(info);

  // === Vyplnenie rally pointu ===
  function fillRallyPoint() {
    // Súradnice
    var inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
    var inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');

    if (inputX && inputY) {
      inputX.value = target.x;
      inputY.value = target.y;
      inputX.dispatchEvent(new Event('change', { bubbles: true }));
      inputY.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Jednotky
    var unitKeys = Object.keys(config.troops);
    for (var i = 0; i < unitKeys.length; i++) {
      var unitName = unitKeys[i];
      var count = config.troops[unitName];
      var input = document.getElementById('unit_input_' + unitName);
      if (input) {
        input.value = count;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Zvýrazni attack tlačidlo
    var attackBtn = document.getElementById('target_attack');
    if (attackBtn) {
      attackBtn.style.border = '3px solid #e94560';
      attackBtn.style.boxShadow = '0 0 15px rgba(233,69,96,0.5)';
    }

    console.log('[TW-Fake] 🎯 Cieľ ' + (config.currentIndex + 1) + '/' + config.targets.length + ': ' + target.x + '|' + target.y + ' - rally point vyplnený');
  }

  // === Otvoriť ďalšie taby ===
  function openNextTabs() {
    var tabsToOpen = Math.min((config.openTabs || 1) - 1, config.targets.length - config.currentIndex - 1);
    if (tabsToOpen <= 0) return;

    var villageId = window.game_data ? window.game_data.village.id : '';
    var baseUrl = window.location.origin + window.location.pathname;

    for (var i = 1; i <= tabsToOpen; i++) {
      var nextTarget = config.targets[config.currentIndex + i];
      if (nextTarget) {
        var url = baseUrl + '?village=' + villageId + '&screen=place&target_x=' + nextTarget.x + '&target_y=' + nextTarget.y;
        window.open(url, '_blank');
      }
    }
    console.log('[TW-Fake] 📑 Otvorených ' + tabsToOpen + ' ďalších tabov');
  }

  // === Posun na ďalší cieľ ===
  function nextTarget() {
    config.currentIndex++;
    window._twFakeConfig = config;
  }

  // === Akcie ===
  fillRallyPoint();
  if (config.openTabs > 1 && config.currentIndex === 0) {
    openNextTabs();
  }
  nextTarget();

  // Skip tlačidlo
  document.getElementById('tw-fake-skip').onclick = function() {
    document.getElementById(infoId).remove();
    // Reload s ďalším cieľom
    var villageId = window.game_data ? window.game_data.village.id : '';
    var next = config.targets[config.currentIndex];
    if (next) {
      window.location.href = window.location.pathname + '?village=' + villageId + '&screen=place&target_x=' + next.x + '&target_y=' + next.y;
    } else {
      alert('✅ Všetky ciele dokončené!');
    }
  };

  // Stop tlačidlo
  document.getElementById('tw-fake-stop').onclick = function() {
    delete window._twFakeConfig;
    document.getElementById(infoId).remove();
    console.log('[TW-Fake] ⏹ Zastavené.');
  };

})();
