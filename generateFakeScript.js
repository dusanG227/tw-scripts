// TW Fake Launcher v4 - Minimálny launcher
(function() {
  'use strict';

  var old = document.getElementById('tw-fake-launcher');
  if (old) old.remove();

  var detectedWorld = '';
  var detectedSpeed = '';
  var detectedUnitSpeed = '';

  if (typeof game_data !== 'undefined') {
    detectedWorld = game_data.world || '';
  }

  var panel = document.createElement('div');
  panel.id = 'tw-fake-launcher';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

  function render(speedInfo) {
    var speedVal = speedInfo ? speedInfo.speed : '';
    var unitSpeedVal = speedInfo ? speedInfo.unit_speed : '';
    var statusMsg = speedInfo ? speedInfo.msg : '';

    var html = '<div style="text-align:center;margin-bottom:16px;">';
    html += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake Generator</h2>';
    html += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v4.0</p>';
    html += '</div>';

    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">';

    html += '<tr><td style="padding:5px;font-weight:bold;width:130px;">Číslo sveta:</td>';
    html += '<td style="padding:5px;">';
    html += '<div style="display:flex;gap:6px;align-items:center;">';
    html += '<input id="tw-world" type="text" value="' + detectedWorld + '" placeholder="napr. sk10" style="flex:1;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    html += '<button id="tw-fetch-speed" style="padding:4px 10px;background:#2980b9;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;white-space:nowrap;">🔄 Načítať</button>';
    html += '</div>';
    if (statusMsg) html += '<div style="font-size:10px;margin-top:3px;color:' + (speedInfo.ok ? '#2d5a27' : '#c0392b') + ';">' + statusMsg + '</div>';
    html += '</td></tr>';

    html += '<tr><td style="padding:5px;font-weight:bold;">Rýchlosť sveta:</td>';
    html += '<td style="padding:5px;"><input id="tw-speed" type="number" value="' + speedVal + '" step="0.5" min="0.1" placeholder="napr. 1" style="width:100%;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    html += '<tr><td style="padding:5px;font-weight:bold;">Rýchlosť jednotiek:</td>';
    html += '<td style="padding:5px;"><input id="tw-unit-speed" type="number" value="' + unitSpeedVal + '" step="0.5" min="0.1" placeholder="napr. 1" style="width:100%;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    html += '<tr><td style="padding:5px;font-weight:bold;">Admin meno:</td>';
    html += '<td style="padding:5px;"><input id="tw-admin-name" type="text" value="' + (localStorage.getItem('tw_fake_admin_name') || '') + '" placeholder="Tvoje meno v hre" style="width:100%;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';
    html += '</table>';

    html += '<div style="margin-bottom:10px;padding:8px;background:#e8f4e8;border-radius:4px;font-size:10px;color:#2d5a27;">';
    html += '✅ Coords a arrival okno sa nastavujú priamo v hlavnom skripte po spustení bookmarkletu.';
    html += '</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
    html += '<button id="tw-generate-btn" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Vygenerovať bookmarklet</button>';
    html += '<button id="tw-close-btn" style="padding:10px 12px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    html += '</div>';

    html += '<div id="tw-output" style="display:none;">';
    html += '<label style="font-weight:bold;">📋 Bookmarklet:</label>';
    html += '<textarea id="tw-result" rows="4" readonly style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;margin-top:3px;font-family:monospace;font-size:10px;box-sizing:border-box;"></textarea>';
    html += '<button id="tw-copy-btn" style="width:100%;padding:7px;margin-top:5px;background:#2980b9;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">📋 Kopírovať</button>';
    html += '</div>';

    panel.innerHTML = html;
    bindEvents();
  }

  function fetchWorldSpeed() {
    var worldId = document.getElementById('tw-world').value.trim();
    if (!worldId) { alert('Zadaj číslo sveta!'); return; }

    var fetchBtn = document.getElementById('tw-fetch-speed');
    fetchBtn.textContent = '⏳';
    fetchBtn.disabled = true;

    // TW config API
    fetch('/interface.php?func=get_config')
      .then(function(r) { return r.text(); })
      .then(function(xml) {
        var speed = parseXmlValue(xml, 'speed');
        var unitSpeed = parseXmlValue(xml, 'unit_speed');
        if (speed && unitSpeed) {
          render({ ok: true, speed: speed, unit_speed: unitSpeed, msg: '✅ Načítané: rýchlosť=' + speed + ', jednotky=' + unitSpeed });
        } else {
          render({ ok: false, speed: '', unit_speed: '', msg: '⚠️ Nepodarilo sa načítať — zadaj ručne' });
        }
      })
      .catch(function() {
        render({ ok: false, speed: '', unit_speed: '', msg: '❌ Chyba — zadaj ručne' });
      });
  }

  function parseXmlValue(xml, tag) {
    var m = xml.match(new RegExp('<' + tag + '>([^<]+)<\/' + tag + '>'));
    return m ? m[1].trim() : null;
  }

  function bindEvents() {
    document.getElementById('tw-fetch-speed').onclick = fetchWorldSpeed;
    document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

    document.getElementById('tw-generate-btn').onclick = function() {
      var worldId = document.getElementById('tw-world').value.trim();
      var speed = parseFloat(document.getElementById('tw-speed').value) || 1;
      var unitSpeed = parseFloat(document.getElementById('tw-unit-speed').value) || 1;
      var adminName = document.getElementById('tw-admin-name').value.trim();

      if (!worldId) { alert('Zadaj číslo sveta!'); return; }
      if (!adminName) { alert('Zadaj admin meno!'); return; }

      localStorage.setItem('tw_fake_admin_name', adminName);

      var configObj = {
        worldId: worldId,
        worldSpeed: speed,
        unitSpeedMod: unitSpeed,
        adminName: adminName,
        targets: [],
        arrivalStart: null,
        arrivalEnd: null
      };

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

      var bookmarklet = 'javascript:' + loader + 'void(0);';

      document.getElementById('tw-output').style.display = 'block';
      document.getElementById('tw-result').value = bookmarklet;
      alert('✅ Bookmarklet vygenerovaný pre svet "' + worldId + '" | admin: ' + adminName);
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

    // Auto-fetch ak je world detekovaný
    if (detectedWorld && !document.getElementById('tw-speed').value) {
      fetchWorldSpeed();
    }
  }

  document.body.appendChild(panel);
  render(null);

  // Auto-trigger fetch po renderi ak máme world
  if (detectedWorld) {
    setTimeout(function() {
      var btn = document.getElementById('tw-fetch-speed');
      if (btn) btn.click();
    }, 100);
  }

})();
A v hlavnom skripte treba upraviť načítanie worldSpeed a unitSpeedMod z configu namiesto getSpeedConstant. Zmeň tieto riadky v hlavnom skripte:

// NAHRAĎ tento blok:
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
  log('⚠️ getSpeedConstant nedostupný, používam default hodnoty');
}

// NA TOTO:
var worldSpeed = Number(config.worldSpeed) || 1;
var unitSpeedMod = Number(config.unitSpeedMod) || 1;
