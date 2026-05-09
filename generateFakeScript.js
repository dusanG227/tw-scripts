// TW Fake Launcher v4.1
(function() {
  'use strict';

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function encodeBase64Utf8(value) {
    var text = String(value == null ? '' : value);

    if (typeof TextEncoder !== 'undefined') {
      var bytes = new TextEncoder().encode(text);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    return btoa(unescape(encodeURIComponent(text)));
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (isNaN(num)) return fallback;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  }

  function clampInt(value, min, max, fallback) {
    var num = parseInt(value, 10);
    if (isNaN(num)) return fallback;
    if (num < min) return min;
    if (num > max) return max;
    return num;
  }

  function parseXmlValue(xml, tag) {
    var m = xml.match(new RegExp('<' + tag + '>([^<]+)</' + tag + '>'));
    return m ? m[1].trim() : null;
  }

  var old = document.getElementById('tw-fake-launcher');
  if (old) old.remove();

  var detectedWorld = '';
  if (typeof game_data !== 'undefined') {
    detectedWorld = String(game_data.world || '');
  }

  var formState = {
    worldId: detectedWorld,
    worldSpeed: '',
    unitSpeedMod: '',
    fakeLimit: '0.5',
    fakeMinPop: '0',
    statusMsg: '',
    statusOk: true,
    bookmarklet: ''
  };

  var panel = document.createElement('div');
  panel.id = 'tw-fake-launcher';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

  function syncFormStateFromDom() {
    var worldInput = document.getElementById('tw-world');
    var speedInput = document.getElementById('tw-speed');
    var unitSpeedInput = document.getElementById('tw-unit-speed');
    var fakeLimitInput = document.getElementById('tw-fake-limit');
    var fakeMinPopInput = document.getElementById('tw-fake-min-pop');

    if (worldInput) formState.worldId = worldInput.value;
    if (speedInput) formState.worldSpeed = speedInput.value;
    if (unitSpeedInput) formState.unitSpeedMod = unitSpeedInput.value;
    if (fakeLimitInput) formState.fakeLimit = fakeLimitInput.value;
    if (fakeMinPopInput) formState.fakeMinPop = fakeMinPopInput.value;
  }

  function render() {
    var html = '<div style="text-align:center;margin-bottom:16px;">';
    html += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake Generator</h2>';
    html += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v4.1</p>';
    html += '</div>';

    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">';

    html += '<tr><td style="padding:5px;font-weight:bold;width:160px;">Číslo sveta:</td>';
    html += '<td style="padding:5px;">';
    html += '<div style="display:flex;gap:6px;align-items:center;">';
    html += '<input id="tw-world" type="text" value="' + escapeHtml(formState.worldId) + '" placeholder="napr. sk10" style="flex:1;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
    html += '<button id="tw-fetch-speed" style="padding:4px 10px;background:#2980b9;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;white-space:nowrap;">🔄 Načítať z otvoreného</button>';
    html += '</div>';
    if (formState.statusMsg) {
      html += '<div style="font-size:10px;margin-top:3px;color:' + (formState.statusOk ? '#2d5a27' : '#c0392b') + ';">' + escapeHtml(formState.statusMsg) + '</div>';
    }
    html += '</td></tr>';

    html += '<tr><td style="padding:5px;font-weight:bold;">Rýchlosť sveta:</td>';
    html += '<td style="padding:5px;"><input id="tw-speed" type="number" value="' + escapeHtml(formState.worldSpeed) + '" step="0.5" min="0.1" placeholder="napr. 1" style="width:100%;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    html += '<tr><td style="padding:5px;font-weight:bold;">Rýchlosť jednotiek:</td>';
    html += '<td style="padding:5px;"><input id="tw-unit-speed" type="number" value="' + escapeHtml(formState.unitSpeedMod) + '" step="0.5" min="0.1" placeholder="napr. 1" style="width:100%;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    html += '<tr><td style="padding:5px;font-weight:bold;">Fake limit (%):</td>';
    html += '<td style="padding:5px;"><input id="tw-fake-limit" type="number" value="' + escapeHtml(formState.fakeLimit) + '" step="0.1" min="0" max="100" placeholder="napr. 0.5 alebo 1" style="width:100%;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    html += '<tr><td style="padding:5px;font-weight:bold;">Min fake pop:</td>';
    html += '<td style="padding:5px;"><input id="tw-fake-min-pop" type="number" value="' + escapeHtml(formState.fakeMinPop) + '" min="0" max="100000" placeholder="napr. 0 alebo 100" style="width:100%;padding:4px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

    html += '</table>';

    html += '<div style="margin-bottom:10px;padding:8px;background:#e8f4e8;border-radius:4px;font-size:10px;color:#2d5a27;">';
    html += '✅ Bookmarklet je samostatný a nespolieha sa na posledný config v localStorage.';
    html += '<br/>✅ Coords a arrival okno sa nastavujú priamo v hlavnom skripte po spustení bookmarkletu.';
    html += '<br/>✅ Fake pravidlo bude: <b>max(povinné jednotky, % z bodov, min fake pop)</b>.';
    if (detectedWorld) {
      html += '<br/>ℹ️ Tlačidlo Načítať funguje len pre aktuálne otvorený svet <b>' + escapeHtml(detectedWorld) + '</b>.';
    }
    html += '</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
    html += '<button id="tw-generate-btn" style="flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Vygenerovať bookmarklet</button>';
    html += '<button id="tw-close-btn" style="padding:10px 12px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
    html += '</div>';

    html += '<div id="tw-output" style="display:' + (formState.bookmarklet ? 'block' : 'none') + ';">';
    html += '<label style="font-weight:bold;">📋 Bookmarklet:</label>';
    html += '<textarea id="tw-result" rows="5" readonly style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;margin-top:3px;font-family:monospace;font-size:10px;box-sizing:border-box;">' + escapeHtml(formState.bookmarklet) + '</textarea>';
    html += '<button id="tw-copy-btn" style="width:100%;padding:7px;margin-top:5px;background:#2980b9;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">📋 Kopírovať</button>';
    html += '</div>';

    panel.innerHTML = html;
    bindEvents();
  }

  function fetchWorldSpeed() {
    syncFormStateFromDom();

    if (detectedWorld && formState.worldId.trim() && formState.worldId.trim() !== detectedWorld) {
      formState.statusOk = false;
      formState.statusMsg = 'Načítať vie len aktuálne otvorený svet ' + detectedWorld + '. Pre iný svet zadaj rýchlosti ručne.';
      render();
      return;
    }

    var fetchBtn = document.getElementById('tw-fetch-speed');
    fetchBtn.textContent = '⏳';
    fetchBtn.disabled = true;

    fetch('/interface.php?func=get_config')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function(xml) {
        var speed = parseXmlValue(xml, 'speed');
        var unitSpeed = parseXmlValue(xml, 'unit_speed');

        if (speed && unitSpeed) {
          formState.worldSpeed = speed;
          formState.unitSpeedMod = unitSpeed;
          formState.statusOk = true;
          formState.statusMsg = 'Načítané z otvoreného sveta: rýchlosť=' + speed + ', jednotky=' + unitSpeed;
        } else {
          formState.statusOk = false;
          formState.statusMsg = 'Nepodarilo sa načítať config sveta, zadaj hodnoty ručne.';
        }
        render();
      })
      .catch(function(e) {
        formState.statusOk = false;
        formState.statusMsg = 'Chyba pri načítaní configu sveta: ' + e.message;
        render();
      });
  }

  function buildBookmarklet(encodedConfig) {
    var executorUrl = 'https://raw.githubusercontent.com/dusanG227/tw-scripts/main/fakeScriptMain.js';
    var loader = "(function(){" +
      "window._twFakeData=" + JSON.stringify(encodedConfig) + ";" +
      "fetch(" + JSON.stringify(executorUrl) + "+'?v='+Date.now())" +
      ".then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})" +
      ".then(function(code){(0,eval)(code);})" +
      ".catch(function(e){alert('\\u274c Nepodarilo sa načítať fakeScriptMain.js: '+e.message);});" +
    "})();";

    return 'javascript:' + loader + 'void(0);';
  }

  function copyBookmarklet() {
    var result = document.getElementById('tw-result');
    if (!result) return;

    result.focus();
    result.select();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(result.value)
        .then(function() { alert('📋 Skopírované!'); })
        .catch(function() {
          if (document.execCommand('copy')) alert('📋 Skopírované!');
          else alert('⚠️ Kopírovanie zlyhalo, skopíruj text ručne.');
        });
      return;
    }

    if (document.execCommand('copy')) {
      alert('📋 Skopírované!');
    } else {
      alert('⚠️ Kopírovanie zlyhalo, skopíruj text ručne.');
    }
  }

  function bindEvents() {
    document.getElementById('tw-fetch-speed').onclick = fetchWorldSpeed;
    document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

    document.getElementById('tw-generate-btn').onclick = function() {
      syncFormStateFromDom();

      var worldId = formState.worldId.trim();
      var speed = clampNumber(formState.worldSpeed, 0.1, 1000, 1);
      var unitSpeed = clampNumber(formState.unitSpeedMod, 0.1, 1000, 1);
      var fakeLimit = clampNumber(formState.fakeLimit, 0, 100, 0.5);
      var fakeMinPop = clampInt(formState.fakeMinPop, 0, 100000, 0);

      if (!worldId) {
        alert('Zadaj číslo sveta!');
        return;
      }

      if (!formState.worldSpeed || !formState.unitSpeedMod) {
        alert('Zadaj rýchlosť sveta aj rýchlosť jednotiek.');
        return;
      }

      var configObj = {
        worldId: worldId,
        worldSpeed: speed,
        unitSpeedMod: unitSpeed,
        fakeLimit: fakeLimit,
        fakeMinPop: fakeMinPop,
        targets: [],
        arrivalStart: null,
        arrivalEnd: null
      };

      var encoded = encodeBase64Utf8(JSON.stringify(configObj));
      formState.bookmarklet = buildBookmarklet(encoded);
      formState.statusOk = true;
      formState.statusMsg = 'Bookmarklet pripravený pre svet ' + worldId + '.';
      render();
      alert('✅ Bookmarklet vygenerovaný pre svet "' + worldId + '"');
    };

    var copyBtn = document.getElementById('tw-copy-btn');
    if (copyBtn) copyBtn.onclick = copyBookmarklet;
  }

  document.body.appendChild(panel);
  render();

  if (detectedWorld) {
    setTimeout(function() {
      var btn = document.getElementById('tw-fetch-speed');
      if (btn) btn.click();
    }, 100);
  }
})();
