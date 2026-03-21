// TW Fake Launcher - Generátor konfigurácie
// Nahraj na GitHub ako generateFakeScript.js
// Spúšťa sa bookmarkletom: javascript:void($.getScript('RAW_URL'))

(function() {
  'use strict';

  var old = document.getElementById('tw-fake-launcher');
  if (old) old.remove();

  var panel = document.createElement('div');
  panel.id = 'tw-fake-launcher';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:420px;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

  var html = '<div style="text-align:center;margin-bottom:15px;">';
  html += '<h2 style="margin:0;font-size:16px;color:#7d510f;">⚔️ TW Fake Generator</h2>';
  html += '<p style="margin:3px 0 0;font-size:10px;color:#8b7355;">Konfigurácia sveta</p>';
  html += '</div>';

  var worldNum = '';
  if (typeof game_data !== 'undefined') {
    worldNum = game_data.world || '';
  }

  html += '<table style="width:100%;border-spacing:0 6px;">';
  html += '<tr><td style="width:140px;">Číslo sveta:</td><td><input id="tw-world" value="' + worldNum + '" style="width:100%;padding:3px;border:1px solid #c0a06a;background:#fff8e7;"></td></tr>';
  html += '<tr><td>Admin ID:</td><td><input id="tw-admin" value="" style="width:100%;padding:3px;border:1px solid #c0a06a;background:#fff8e7;"></td></tr>';
  html += '<tr><td>Názov databázy:</td><td><input id="tw-dbname" value="" style="width:100%;padding:3px;border:1px solid #c0a06a;background:#fff8e7;"></td></tr>';
  html += '<tr><td>Fake limit (%):</td><td><input id="tw-fakelimit" type="number" value="0.5" step="0.1" min="0" style="width:100%;padding:3px;border:1px solid #c0a06a;background:#fff8e7;"></td></tr>';
  html += '<tr><td>Open tabs:</td><td><input id="tw-opentabs" type="number" value="5" min="1" max="50" style="width:100%;padding:3px;border:1px solid #c0a06a;background:#fff8e7;"></td></tr>';
  html += '</table>';

  html += '<div style="margin-top:10px;">';
  html += '<label style="font-weight:bold;">Cieľové súradnice:</label>';
  html += '<textarea id="tw-targets" rows="4" placeholder="500|500 501|501 502|502..." style="width:100%;margin-top:4px;padding:4px;border:1px solid #c0a06a;background:#fff8e7;font-family:monospace;font-size:11px;resize:vertical;"></textarea>';
  html += '</div>';

  html += '<div style="margin-top:10px;">';
  html += '<label style="font-weight:bold;">Okno príchodu (voliteľné):</label>';
  html += '<div style="display:flex;gap:8px;margin-top:4px;">';
  html += '<div style="flex:1;"><label style="font-size:10px;">Od:</label><input id="tw-arrival-start" type="datetime-local" style="width:100%;padding:3px;border:1px solid #c0a06a;background:#fff8e7;font-size:10px;"></div>';
  html += '<div style="flex:1;"><label style="font-size:10px;">Do:</label><input id="tw-arrival-end" type="datetime-local" style="width:100%;padding:3px;border:1px solid #c0a06a;background:#fff8e7;font-size:10px;"></div>';
  html += '</div></div>';

  html += '<div style="margin-top:15px;display:flex;gap:8px;">';
  html += '<button id="tw-generate-btn" style="flex:1;padding:8px;background:#7d510f;color:#f4e4bc;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Vygenerovať bookmarklet</button>';
  html += '<button id="tw-close-btn" style="padding:8px 12px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>';
  html += '</div>';

  html += '<div id="tw-output" style="display:none;margin-top:12px;padding:10px;background:#fff8e7;border:1px solid #c0a06a;border-radius:4px;">';
  html += '<label style="font-weight:bold;font-size:11px;">📋 Vygenerovaný bookmarklet:</label>';
  html += '<textarea id="tw-result" rows="3" readonly style="width:100%;margin-top:4px;font-family:monospace;font-size:9px;padding:4px;border:1px solid #c0a06a;background:#f4e4bc;resize:vertical;"></textarea>';
  html += '<button id="tw-copy-btn" style="margin-top:6px;padding:5px 12px;background:#27ae60;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">📋 Kopírovať</button>';
  html += '<p style="margin-top:6px;font-size:9px;color:#8b7355;">💡 Skopíruj a vytvor novú záložku v prehliadači. Spusti ju na stránke Kombinované (overview_villages&mode=combined).</p>';
  html += '</div>';

  panel.innerHTML = html;
  document.body.appendChild(panel);

  document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

  document.getElementById('tw-generate-btn').onclick = function() {
    var targets = document.getElementById('tw-targets').value.trim();
    var fakeLimit = parseFloat(document.getElementById('tw-fakelimit').value) || 0.5;
    var openTabs = parseInt(document.getElementById('tw-opentabs').value) || 5;
    var adminId = document.getElementById('tw-admin').value.trim();
    var dbName = document.getElementById('tw-dbname').value.trim();
    var worldId = document.getElementById('tw-world').value.trim();
    var arrStart = document.getElementById('tw-arrival-start').value;
    var arrEnd = document.getElementById('tw-arrival-end').value;

    if (!targets) { alert('Zadaj cieľové súradnice!'); return; }

    var coordRegex = /(\d{3})\|(\d{3})/g;
    var coords = [];
    var m;
    while ((m = coordRegex.exec(targets)) !== null) {
      coords.push({ x: parseInt(m[1]), y: parseInt(m[2]) });
    }

    if (coords.length === 0) { alert('Nenašli sa žiadne platné súradnice!'); return; }

    var configObj = {
      targets: coords,
      fakeLimit: fakeLimit,
      openTabs: openTabs,
      adminId: adminId,
      dbName: dbName,
      worldId: worldId,
      arrivalStart: arrStart || null,
      arrivalEnd: arrEnd || null
    };

    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(configObj))));
    var bookmarklet = "javascript:var _twFakeData='" + encoded + "';$.getScript('https://raw.githubusercontent.com/dusanG227/tw-scripts/main/fakeScriptMain.js');void(0);";

    document.getElementById('tw-output').style.display = 'block';
    document.getElementById('tw-result').value = bookmarklet;

    alert('✅ Vygenerované pre ' + coords.length + ' cieľov!\nTeraz skopíruj bookmarklet a spusti ho na stránke Kombinované.');
  };

  document.getElementById('tw-copy-btn').onclick = function() {
    var result = document.getElementById('tw-result');
    result.select();
    document.execCommand('copy');
    alert('📋 Skopírované!');
  };

})();
