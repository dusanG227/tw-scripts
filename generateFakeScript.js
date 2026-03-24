// TW Fake Generator v3.0 - Jednorazová konfigurácia
// Nahraj na GitHub ako generateFakeScript.js
// Bookmarklet: javascript:void($.getScript('RAW_URL'))

(function() {
  'use strict';

  var old = document.getElementById('tw-fake-launcher');
  if (old) old.remove();

  var worldNum = '';
  if (typeof game_data !== 'undefined') worldNum = game_data.world || '';

  var panel = document.createElement('div');
  panel.id = 'tw-fake-launcher';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:380px;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

  var html = '<div style="text-align:center;margin-bottom:12px;">';
  html += '<h2 style="margin:0;font-size:16px;color:#7d510f;">⚔️ TW Fake - Setup</h2>';
  html += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v3.0 — Jednorazová konfigurácia sveta</p>';
  html += '</div>';

  html += '<table style="width:100%;border-spacing:0 6px;">';
  html += '<tr><td style="width:130px;">Číslo sveta:</td><td><input id="tw-world" value="' + worldNum + '" style="width:100%;padding:4px;border:1px solid #c0a06a;background:#fff8e7;border-radius:3px;"></td></tr>';
  html += '<tr><td>Admin ID:</td><td><input id="tw-admin" value="" style="width:100%;padding:4px;border:1px solid #c0a06a;background:#fff8e7;border-radius:3px;"></td></tr>';
  html += '<tr><td>Názov databázy:</td><td><input id="tw-dbname" value="" style="width:100%;padding:4px;border:1px solid #c0a06a;background:#fff8e7;border-radius:3px;"></td></tr>';
  html += '</table>';

  html += '<p style="font-size:9px;color:#888;margin:8px 0 4px;">💡 Tieto údaje sa použijú len na identifikáciu. Všetko ostatné (coordy, jednotky, limity) nastavíš v hlavnom scripte.</p>';

  html += '<div style="margin-top:12px;display:flex;gap:8px;">';
  html += '<button id="tw-gen-btn" style="flex:1;padding:10px;background:#7d510f;color:#f4e4bc;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Vygenerovať bookmarklet</button>';
  html += '<button id="tw-close-btn" style="padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>';
  html += '</div>';

  html += '<div id="tw-output" style="display:none;margin-top:10px;padding:10px;background:#fff8e7;border:1px solid #c0a06a;border-radius:4px;">';
  html += '<label style="font-weight:bold;font-size:11px;">📋 Bookmarklet (hlavný script):</label>';
  html += '<textarea id="tw-result" rows="4" readonly style="width:100%;margin-top:4px;font-family:monospace;font-size:9px;padding:4px;border:1px solid #c0a06a;background:#f4e4bc;resize:vertical;"></textarea>';
  html += '<button id="tw-copy-btn" style="margin-top:6px;padding:6px 14px;background:#27ae60;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:bold;">📋 Kopírovať</button>';
  html += '<p style="margin-top:6px;font-size:9px;color:#8b7355;">💡 Skopíruj, vytvor záložku v prehliadači. Spusti na stránke <b>Kombinované</b>.</p>';
  html += '</div>';

  panel.innerHTML = html;
  document.body.appendChild(panel);

  document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

  document.getElementById('tw-gen-btn').onclick = function() {
    var worldId = document.getElementById('tw-world').value.trim();
    var adminId = document.getElementById('tw-admin').value.trim();
    var dbName = document.getElementById('tw-dbname').value.trim();

    if (!worldId) { alert('Zadaj číslo sveta!'); return; }

    var setupData = btoa(unescape(encodeURIComponent(JSON.stringify({
      worldId: worldId,
      adminId: adminId,
      dbName: dbName
    }))));

    var bookmarklet = "javascript:var _twSetup='" + setupData + "';$.getScript('https://raw.githubusercontent.com/dusanG227/tw-scripts/refs/heads/main/fakeScriptMain.js');void(0);";

    document.getElementById('tw-output').style.display = 'block';
    document.getElementById('tw-result').value = bookmarklet;
    alert('✅ Bookmarklet vygenerovaný!\\nSkopíruj ho a spusti na stránke Kombinované.');
  };

  document.getElementById('tw-copy-btn').onclick = function() {
    var r = document.getElementById('tw-result');
    r.select();
    document.execCommand('copy');
    alert('📋 Skopírované!');
  };
})();
