// =============================================
// TW Fake Script Generator v2.0
// Spúšťač: javascript:void($.getScript('https://raw.githubusercontent.com/dusanG227/tw-scripts/main/generateFakeScript.js'))
// =============================================
(function() {
  'use strict';

  // Ak už beží, zavri predošlé okno
  if (document.getElementById('tw-fake-generator')) {
    document.getElementById('tw-fake-generator').remove();
    return;
  }

  var TROOP_TYPES = [
    { id: 'spear', name: 'Kopijník', pop: 1, speed: 1080, icon: '🛡️', off: false },
    { id: 'sword', name: 'Šermiar', pop: 1, speed: 1320, icon: '⚔️', off: false },
    { id: 'axe', name: 'Sekerník', pop: 1, speed: 1080, icon: '🪓', off: true },
    { id: 'archer', name: 'Lukostrelec', pop: 1, speed: 1080, icon: '🏹', off: false },
    { id: 'spy', name: 'Zvěd', pop: 2, speed: 540, icon: '👁️', off: true },
    { id: 'light', name: 'Ľahká kav.', pop: 4, speed: 600, icon: '🐴', off: true },
    { id: 'marcher', name: 'Jazd. luk.', pop: 5, speed: 600, icon: '🏇', off: true },
    { id: 'heavy', name: 'Ťažká kav.', pop: 6, speed: 660, icon: '🐎', off: true },
    { id: 'ram', name: 'Baran', pop: 5, speed: 1800, icon: '🔨', off: true },
    { id: 'catapult', name: 'Katapult', pop: 8, speed: 1800, icon: '💥', off: true },
    { id: 'snob', name: 'Šľachtic', pop: 100, speed: 2100, icon: '👑', off: true }
  ];

  // Hlavný URL pre executor skript
  var EXECUTOR_URL = 'https://raw.githubusercontent.com/dusanG227/tw-scripts/main/fakeScriptMain.js';

  // --- UI ---
  var overlay = document.createElement('div');
  overlay.id = 'tw-fake-generator';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Verdana,sans-serif;';

  var panel = document.createElement('div');
  panel.style.cssText = 'background:#1a1a2e;color:#e0e0e0;border:2px solid #e94560;border-radius:12px;padding:20px;width:750px;max-height:85vh;overflow-y:auto;box-shadow:0 0 30px rgba(233,69,96,0.3);';

  // Header
  panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid #333;padding-bottom:10px;">' +
    '<div><span style="font-size:24px;">⚔️</span> <strong style="font-size:18px;color:#e94560;">TW Fake Generator</strong> <span style="color:#666;font-size:11px;">v2.0</span></div>' +
    '<button id="tw-fg-close" style="background:#e94560;color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px;">✕</button>' +
    '</div>';

  // Nastavenia sveta
  panel.innerHTML += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">' +
    '<div><label style="font-size:11px;color:#888;">Rýchlosť sveta:</label><br><input id="tw-fg-wspeed" type="number" value="1" min="1" style="width:100%;padding:5px;background:#16213e;color:#e0e0e0;border:1px solid #333;border-radius:4px;"></div>' +
    '<div><label style="font-size:11px;color:#888;">Rýchlosť jednotiek:</label><br><input id="tw-fg-uspeed" type="number" value="1" min="1" style="width:100%;padding:5px;background:#16213e;color:#e0e0e0;border:1px solid #333;border-radius:4px;"></div>' +
    '<div><label style="font-size:11px;color:#888;">Open tabs (naraz):</label><br><input id="tw-fg-tabs" type="number" value="5" min="1" max="50" style="width:100%;padding:5px;background:#16213e;color:#e0e0e0;border:1px solid #333;border-radius:4px;"></div>' +
    '<div><label style="font-size:11px;color:#888;">Fake limit (%):</label><br><input id="tw-fg-limit" type="number" value="0.5" min="0" step="0.1" style="width:100%;padding:5px;background:#16213e;color:#e0e0e0;border:1px solid #333;border-radius:4px;"></div>' +
    '</div>';

  // Jednotky
  var troopHTML = '<div style="margin-bottom:15px;"><label style="font-size:12px;color:#e94560;font-weight:bold;">Jednotky:</label>' +
    '<div id="tw-fg-totalpop" style="font-size:10px;color:#888;margin:3px 0;">Pop: 0</div>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">';
  for (var i = 0; i < TROOP_TYPES.length; i++) {
    var t = TROOP_TYPES[i];
    troopHTML += '<div style="background:#16213e;padding:6px;border-radius:6px;border:1px solid #333;">' +
      '<div style="font-size:11px;">' + t.icon + ' ' + t.name + '</div>' +
      '<input id="tw-fg-troop-' + t.id + '" type="number" min="0" value="0" data-pop="' + t.pop + '" ' +
      'style="width:100%;padding:3px;background:#0f3460;color:#e0e0e0;border:1px solid #333;border-radius:3px;margin-top:3px;font-size:11px;" ' +
      'oninput="(function(){var total=0;document.querySelectorAll(\'[id^=tw-fg-troop-]\').forEach(function(el){total+=parseInt(el.value||0)*parseInt(el.dataset.pop);});document.getElementById(\'tw-fg-totalpop\').textContent=\'Pop: \'+total;})()">' +
      '<div style="font-size:9px;color:#666;margin-top:2px;">pop:' + t.pop + ' ' + (t.off ? '⚔️OFF' : '🛡DEF') + '</div>' +
      '</div>';
  }
  troopHTML += '</div></div>';
  panel.innerHTML += troopHTML;

  // Ciele
  panel.innerHTML += '<div style="margin-bottom:15px;">' +
    '<label style="font-size:12px;color:#e94560;font-weight:bold;">Cieľové súradnice:</label>' +
    '<div style="font-size:10px;color:#888;margin:3px 0;">Formát: 500|500 501|501 alebo každú na nový riadok</div>' +
    '<textarea id="tw-fg-targets" rows="5" style="width:100%;padding:8px;background:#16213e;color:#e0e0e0;border:1px solid #333;border-radius:6px;font-family:monospace;font-size:11px;resize:vertical;"></textarea>' +
    '<div id="tw-fg-targetcount" style="font-size:10px;color:#888;margin-top:3px;">0 cieľov</div>' +
    '</div>';

  // Tlačidlá
  panel.innerHTML += '<div style="display:flex;gap:10px;">' +
    '<button id="tw-fg-generate" style="flex:1;padding:10px;background:#e94560;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;">⚡ Vygenerovať bookmarklet</button>' +
    '</div>';

  // Výstup
  panel.innerHTML += '<div id="tw-fg-output" style="display:none;margin-top:15px;padding:12px;background:#16213e;border:1px solid #e94560;border-radius:6px;">' +
    '<label style="font-size:12px;color:#e94560;font-weight:bold;">📋 Výsledný bookmarklet:</label>' +
    '<textarea id="tw-fg-result" rows="4" readonly style="width:100%;padding:8px;background:#0f3460;color:#e0e0e0;border:1px solid #333;border-radius:4px;font-family:monospace;font-size:10px;margin-top:8px;resize:vertical;"></textarea>' +
    '<button id="tw-fg-copy" style="margin-top:8px;padding:6px 16px;background:#0f3460;color:#e94560;border:1px solid #e94560;border-radius:4px;cursor:pointer;font-size:12px;">📋 Kopírovať</button>' +
    '<div style="font-size:10px;color:#888;margin-top:8px;">💡 Vytvor novú záložku v prehliadači → vlož bookmarklet ako URL → otvor rally point → klikni záložku</div>' +
    '</div>';

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Event: zavrieť
  document.getElementById('tw-fg-close').onclick = function() { overlay.remove(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  // Event: počítanie cieľov
  document.getElementById('tw-fg-targets').oninput = function() {
    var coords = this.value.match(/\d{3}\|\d{3}/g) || [];
    document.getElementById('tw-fg-targetcount').textContent = coords.length + ' cieľov';
  };

  // Event: generovanie
  document.getElementById('tw-fg-generate').onclick = function() {
    var targets = document.getElementById('tw-fg-targets').value.match(/(\d{3})\|(\d{3})/g);
    if (!targets || targets.length === 0) {
      alert('Zadaj aspoň jeden cieľ (formát: 500|500)');
      return;
    }

    var troops = {};
    var hasTroops = false;
    TROOP_TYPES.forEach(function(t) {
      var val = parseInt(document.getElementById('tw-fg-troop-' + t.id).value) || 0;
      if (val > 0) { troops[t.id] = val; hasTroops = true; }
    });
    if (!hasTroops) {
      alert('Zadaj aspoň jednu jednotku!');
      return;
    }

    var config = {
      troops: troops,
      targets: targets.map(function(c) {
        var parts = c.split('|');
        return { x: parseInt(parts[0]), y: parseInt(parts[1]) };
      }),
      worldSpeed: parseFloat(document.getElementById('tw-fg-wspeed').value) || 1,
      unitSpeed: parseFloat(document.getElementById('tw-fg-uspeed').value) || 1,
      openTabs: parseInt(document.getElementById('tw-fg-tabs').value) || 5,
      fakeLimit: parseFloat(document.getElementById('tw-fg-limit').value) || 0.5,
      currentIndex: 0
    };

    // Zakóduj config do base64
    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));

    // Vygeneruj bookmarklet
    var bookmarklet = "javascript:var _twFakeData='" + encoded + "';void($.getScript('" + EXECUTOR_URL + "'))";

    document.getElementById('tw-fg-output').style.display = 'block';
    document.getElementById('tw-fg-result').value = bookmarklet;

    console.log('[TW-FakeGen] Vygenerované pre ' + targets.length + ' cieľov, ' + Object.keys(troops).length + ' typov jednotiek');
  };

  // Event: kopírovanie
  document.getElementById('tw-fg-copy').onclick = function() {
    var el = document.getElementById('tw-fg-result');
    el.select();
    document.execCommand('copy');
    this.textContent = '✅ Skopírované!';
    var btn = this;
    setTimeout(function() { btn.textContent = '📋 Kopírovať'; }, 2000);
  };

  console.log('[TW-FakeGen] Generator UI načítaný.');
})();
