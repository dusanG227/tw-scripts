// TW Fake Launcher v3 - Coord Tabs + localStorage
// Generuje bookmarklet s cieľmi, launcher len zbiera coordy

(function() {
  'use strict';

  var MAIN_SCRIPT_RAW = 'https://raw.githubusercontent.com/dusanG227/tw-scripts/main/fakeScriptMain.js';
  var LS_KEY = 'tw_fake_coord_tabs';
  var LS_KEY_ARRIVAL = 'tw_fake_arrival';
  var LS_KEY_CONFIG = 'tw_fake_config_latest';

  var old = document.getElementById('tw-fake-launcher');
  if (old) old.remove();

  var worldNum = '';
  if (typeof game_data !== 'undefined') {
    worldNum = game_data.world || '';
  }

  function loadTabs() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch(e) {}
    return [{ name: 'Kmeň 1', coords: '' }];
  }

  function saveTabs() {
    var tabs = [];
    for (var i = 0; i < coordTabs.length; i++) {
      tabs.push({ name: coordTabs[i].name, coords: coordTabs[i].coords });
    }
    localStorage.setItem(LS_KEY, JSON.stringify(tabs));
  }

  function loadArrival() {
    try {
      var raw = localStorage.getItem(LS_KEY_ARRIVAL);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { start: '', end: '' };
  }

  function saveArrival(start, end) {
    localStorage.setItem(LS_KEY_ARRIVAL, JSON.stringify({ start: start, end: end }));
  }

  var coordTabs = loadTabs();
  var savedArrival = loadArrival();
  var activeTab = 0;

  var panel = document.createElement('div');
  panel.id = 'tw-fake-launcher';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

  function render() {
    var html = '<div style="text-align:center;margin-bottom:12px;">';
    html += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake Generator</h2>';
    html += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v3.2 — coord tabs + slobodný random výber</p>';
    html += '</div>';

    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
    html += '<tr><td style="padding:3px;font-weight:bold;width:130px;">Číslo sveta:</td>';
    html += '<td><input id="tw-world" type="text" value="' + worldNum + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';
    html += '</table>';

    html += '<div style="margin-bottom:10px;">';
    html += '<label style="font-weight:bold;">🕐 Okno príchodu (voliteľné):</label>';
    html += '<div style="display:flex;gap:8px;margin-top:3px;">';
    html += '<div style="flex:1;"><label style="font-size:10px;">Od:</label><input id="tw-arrival-start" type="datetime-local" value="' + (savedArrival.start || '') + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></div>';
    html += '<div style="flex:1;"><label style="font-size:10px;">Do:</label><input id="tw-arrival-end" type="datetime-local" value="' + (savedArrival.end || '') + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></div>';
    html += '</div></div>';

    html += '<div style="margin-bottom:4px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">';
    for (var t = 0; t < coordTabs.length; t++) {
      var isActive = (t === activeTab);
      var tabBg = isActive ? '#7d510f' : '#d4a574';
      var tabColor = isActive ? '#fff' : '#3e2b0d';
      html += '<div style="display:inline-flex;align-items:center;background:' + tabBg + ';color:' + tabColor + ';padding:4px 8px;border-radius:4px 4px 0 0;cursor:pointer;font-size:11px;font-weight:bold;" data-tab="' + t + '">';
      html += '<span class="tw-tab-name" data-tab="' + t + '">' + coordTabs[t].name + '</span>';
      if (coordTabs.length > 1) {
        html += ' <span class="tw-tab-del" data-tab="' + t + '" style="margin-left:4px;cursor:pointer;color:' + (isActive ? '#ffaaaa' : '#c0392b') + ';font-size:13px;">×</span>';
      }
      html += '</div>';
    }
    html += '<button id="tw-tab-add" style="padding:3px 8px;background:#4a7c3f;color:#fff;border:none;border-radius:4px 4px 0 0;cursor:pointer;font-size:12px;font-weight:bold;">+</button>';
    html += '</div>';

    html += '<div style="margin-bottom:6px;">';
    html += '<textarea id="tw-targets" rows="6" placeholder="500|500 501|501&#10;Každá na novom riadku alebo oddelené medzerou" style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:0 3px 3px 3px;background:#fff8e7;resize:vertical;font-family:monospace;">' + (coordTabs[activeTab].coords || '') + '</textarea>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<span id="tw-coord-count" style="font-size:10px;color:#8b7355;">📍 0 súradníc</span>';
    html += '<button id="tw-save-coords" style="padding:3px 10px;background:#2980b9;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;font-weight:bold;">💾 Uložiť</button>';
    html += '</div>';
    html += '</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
    html += '<button id="tw-generate-btn" style="flex:1;padding:8px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Vygenerovať bookmarklet</button>';
    html += '<button id="tw-close-btn" style="padding:8px 12px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    html += '</div>';

    html += '<div id="tw-output" style="display:none;">';
    html += '<label style="font-weight:bold;">📋 Vygenerovaný bookmarklet:</label>';
    html += '<textarea id="tw-result" rows="5" readonly style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;margin-top:3px;font-family:monospace;font-size:10px;"></textarea>';
    html += '<button id="tw-copy-btn" style="width:100%;padding:6px;margin-top:5px;background:#2980b9;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">📋 Kopírovať</button>';
    html += '</div>';

    html += '<div style="margin-top:8px;padding:8px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;font-size:10px;">';
    html += '<p style="margin:0;">✅ Konfigurácia (fake limit, tabs, max/cieľ...) sa nastavuje v <b>hlavnom paneli</b> po spustení.</p>';
    html += '<p style="margin:2px 0 0;">🎲 Slobodný random výber jednotiek — paladín a šľachtic sú vylúčení.</p>';
    html += '</div>';

    panel.innerHTML = html;
    bindEvents();
    updateCoordCount();
  }

  function updateCoordCount() {
    var textarea = document.getElementById('tw-targets');
    if (!textarea) return;
    var matches = textarea.value.match(/\d{3}\|\d{3}/g);
    var el = document.getElementById('tw-coord-count');
    if (el) el.textContent = '📍 ' + (matches ? matches.length : 0) + ' súradníc';
  }

  function bindEvents() {
    var tabNames = panel.querySelectorAll('.tw-tab-name');
    for (var i = 0; i < tabNames.length; i++) {
      tabNames[i].addEventListener('click', function() {
        saveCurrentCoords();
        activeTab = parseInt(this.getAttribute('data-tab'), 10);
        render();
      });
    }

    var tabDels = panel.querySelectorAll('.tw-tab-del');
    for (var i = 0; i < tabDels.length; i++) {
      tabDels[i].addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-tab'), 10);
        if (coordTabs.length <= 1) return;
        if (!confirm('Zmazať tab "' + coordTabs[idx].name + '"?')) return;
        coordTabs.splice(idx, 1);
        if (activeTab >= coordTabs.length) activeTab = coordTabs.length - 1;
        saveTabs();
        render();
      });
    }

    document.getElementById('tw-tab-add').onclick = function() {
      saveCurrentCoords();
      var name = prompt('Názov nového tabu:', 'Kmeň ' + (coordTabs.length + 1));
      if (!name) return;
      coordTabs.push({ name: name, coords: '' });
      activeTab = coordTabs.length - 1;
      saveTabs();
      render();
    };

    var activeTabEl = panel.querySelector('.tw-tab-name[data-tab="' + activeTab + '"]');
    if (activeTabEl) {
      activeTabEl.addEventListener('dblclick', function() {
        var idx = parseInt(this.getAttribute('data-tab'), 10);
        var newName = prompt('Nový názov tabu:', coordTabs[idx].name);
        if (newName) {
          coordTabs[idx].name = newName;
          saveTabs();
          render();
        }
      });
    }

    document.getElementById('tw-targets').addEventListener('input', function() {
      updateCoordCount();
    });

    document.getElementById('tw-save-coords').onclick = function() {
      saveCurrentCoords();
      saveTabs();
      alert('💾 Coordy uložené!');
    };

    document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

    document.getElementById('tw-generate-btn').onclick = function() {
      saveCurrentCoords();
      saveTabs();

      var arrStart = document.getElementById('tw-arrival-start').value;
      var arrEnd = document.getElementById('tw-arrival-end').value;
      saveArrival(arrStart, arrEnd);
      savedArrival = { start: arrStart, end: arrEnd };

      var coordRegex = /(\d{3})\|(\d{3})/g;
      var allCoords = [];
      var m;
      while ((m = coordRegex.exec(coordTabs[activeTab].coords)) !== null) {
        allCoords.push({ x: parseInt(m[1], 10), y: parseInt(m[2], 10) });
      }

      if (allCoords.length === 0) { alert('Zadaj cieľové súradnice!'); return; }

      var worldId = document.getElementById('tw-world').value.trim();

      var configObj = {
        targets: allCoords,
        worldId: worldId,
        arrivalStart: arrStart || null,
        arrivalEnd: arrEnd || null
      };

      var bookmarklet = makeBookmarklet(configObj);

      document.getElementById('tw-output').style.display = 'block';
      document.getElementById('tw-result').value = bookmarklet;

      alert('✅ Vygenerované pre ' + allCoords.length + ' cieľov z tabu "' + coordTabs[activeTab].name + '".');
    };

    var copyBtn = document.getElementById('tw-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = function() {
        var result = document.getElementById('tw-result');
        result.select();
        document.execCommand('copy');
        alert('📋 Skopírované!');
      };
    }
  }

  function saveCurrentCoords() {
    var textarea = document.getElementById('tw-targets');
    if (textarea) {
      coordTabs[activeTab].coords = textarea.value;
    }
  }

  function makeBookmarklet(configObj) {
    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(configObj))));
    localStorage.setItem('tw_fake_config_latest', encoded);

    var loader = "(function(){" +
      "var d=localStorage.getItem('tw_fake_config_latest');" +
      "if(!d){alert('\u274c Config nenájdený. Vygeneruj bookmarklet znova.');return;}" +
      "window._twFakeData=d;" +
      "fetch('https://raw.githubusercontent.com/dusanG227/tw-scripts/main/fakeScriptMain.js?v='+Date.now())" +
      ".then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})" +
      ".then(function(code){(0,eval)(code);})" +
      ".catch(function(e){alert('\u274c Nepodarilo sa načítať fakeScriptMain.js: '+e.message);});" +
    "})();";

    return 'javascript:' + loader + 'void(0);';
  }

  document.body.appendChild(panel);
  render();
})();
