// TW Fake Launcher - Generátor konfigurácie (v2)
// Nahraj na GitHub ako generateFakeScript.js

(function() {
 'use strict';

 var old = document.getElementById('tw-fake-launcher');
 if (old) old.remove();

 var panel = document.createElement('div');
 panel.id = 'tw-fake-launcher';
 panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:420px;box-shadow:0 5px 30px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto;';

 var worldNum = '';
 if (typeof game_data !== 'undefined') {
   worldNum = game_data.world || '';
 }

 var html = '<div>';
 html += '<h2 style="text-align:center;margin:0 0 10px;color:#5c3a11;">⚔️ TW Fake Generator</h2>';

 // World config
 html += '<fieldset style="border:1px solid #c9a96e;padding:8px;margin-bottom:8px;border-radius:4px;"><legend style="font-weight:bold;">Konfigurácia sveta</legend>';
 html += '<table style="width:100%;border-collapse:collapse;">';
 html += '<tr><td>Číslo sveta:</td><td><input id="tw-world" value="' + worldNum + '" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;"></td></tr>';
 html += '<tr><td>Admin ID:</td><td><input id="tw-admin" value="" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;"></td></tr>';
 html += '<tr><td>Názov databázy:</td><td><input id="tw-dbname" value="" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;"></td></tr>';
 html += '<tr><td>Fake limit (%):</td><td><input id="tw-fakelimit" type="number" step="0.1" min="0.1" max="100" value="0.5" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;"></td></tr>';
 html += '<tr><td>Open tabs:</td><td><input id="tw-opentabs" type="number" min="1" max="50" value="5" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;"></td></tr>';
 html += '<tr><td>Max fejkov na cieľ:</td><td><input id="tw-maxpertarget" type="number" min="0" value="0" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;"><br><span style="font-size:10px;color:#888;">0 = neobmedzené</span></td></tr>';
 html += '<tr><td>Max fejkov z dediny:</td><td><input id="tw-maxpervillage" type="number" min="0" value="0" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;"><br><span style="font-size:10px;color:#888;">0 = neobmedzené</span></td></tr>';
 html += '</table></fieldset>';

 // Targets
 html += '<div style="margin-bottom:8px;">';
 html += '<label style="font-weight:bold;">Cieľové súradnice:</label>';
 html += '<textarea id="tw-targets" rows="4" style="width:100%;padding:5px;border:1px solid #c9a96e;border-radius:3px;font-family:monospace;font-size:11px;margin-top:3px;" placeholder="123|456 789|012 ..."></textarea>';
 html += '</div>';

 // Arrival window
 html += '<fieldset style="border:1px solid #c9a96e;padding:8px;margin-bottom:8px;border-radius:4px;"><legend style="font-weight:bold;">Okno príchodu (voliteľné)</legend>';
 html += '<div style="display:flex;gap:8px;">';
 html += '<div style="flex:1;"><label style="font-size:10px;">Od:</label><input id="tw-arrival-start" type="datetime-local" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;font-size:11px;"></div>';
 html += '<div style="flex:1;"><label style="font-size:10px;">Do:</label><input id="tw-arrival-end" type="datetime-local" style="width:100%;padding:3px;border:1px solid #c9a96e;border-radius:3px;font-size:11px;"></div>';
 html += '</div></fieldset>';

 // Buttons
 html += '<div style="display:flex;gap:8px;margin-bottom:8px;">';
 html += '<button id="tw-generate-btn" style="flex:1;padding:8px;background:#5c3a11;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:12px;">⚔️ Vygenerovať bookmarklet</button>';
 html += '<button id="tw-close-btn" style="padding:8px 12px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">✕</button>';
 html += '</div>';

 // Output
 html += '<div id="tw-output" style="display:none;">';
 html += '<label style="font-weight:bold;">📋 Vygenerovaný bookmarklet:</label>';
 html += '<textarea id="tw-result" rows="3" style="width:100%;padding:5px;border:1px solid #c9a96e;border-radius:3px;font-family:monospace;font-size:10px;margin-top:3px;" readonly></textarea>';
 html += '<button id="tw-copy-btn" style="margin-top:4px;padding:5px 12px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">📋 Kopírovať</button>';
 html += '<p style="font-size:10px;margin-top:5px;color:#666;">💡 Skopíruj a vytvor novú záložku v prehliadači. Spusti ju na stránke Kombinované.</p>';
 html += '</div>';

 html += '</div>';

 panel.innerHTML = html;
 document.body.appendChild(panel);

 document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

 document.getElementById('tw-generate-btn').onclick = function() {
   var targets = document.getElementById('tw-targets').value.trim();
   var fakeLimit = parseFloat(document.getElementById('tw-fakelimit').value) || 0.5;
   var openTabs = parseInt(document.getElementById('tw-opentabs').value) || 5;
   var maxFakesPerTarget = parseInt(document.getElementById('tw-maxpertarget').value) || 0;
   var maxFakesPerVillage = parseInt(document.getElementById('tw-maxpervillage').value) || 0;
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
     maxFakesPerTarget: maxFakesPerTarget || undefined,
     maxFakesPerVillage: maxFakesPerVillage || undefined,
     adminId: adminId || undefined,
     dbName: dbName || undefined,
     worldId: worldId || undefined,
     arrivalStart: arrStart || null,
     arrivalEnd: arrEnd || null
   };

   var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(configObj))));
   var bookmarklet = "javascript:var _twFakeData='" + encoded + "';$.getScript('https://raw.githubusercontent.com/dusanG227/tw-scripts/main/fakeScriptMain.js');void(0);";

   document.getElementById('tw-output').style.display = 'block';
   document.getElementById('tw-result').value = bookmarklet;

   alert('✅ Vygenerované pre ' + coords.length + ' cieľov!\nMax fejkov na cieľ: ' + (maxFakesPerTarget || '∞') + '\nMax fejkov z dediny: ' + (maxFakesPerVillage || '∞') + '\nTeraz skopíruj bookmarklet a spusti ho na Kombinovanej.');
 };

 document.getElementById('tw-copy-btn').onclick = function() {
   var result = document.getElementById('tw-result');
   result.select();
   document.execCommand('copy');
   alert('📋 Skopírované!');
 };
})();
