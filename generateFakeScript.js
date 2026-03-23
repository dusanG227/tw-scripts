// TW Fake Launcher - Generátor konfigurácie (v2)
// Jediný bookmarklet: vygeneruje config a načíta fakeScriptMain.js

(function() {
  'use strict';

  var MAIN_SCRIPT_CDN = 'https://cdn.jsdelivr.net/gh/dusanG227/tw-scripts@main/fakeScriptMain.js';
  var MAIN_SCRIPT_RAW = 'https://raw.githubusercontent.com/dusanG227/tw-scripts/main/fakeScriptMain.js';

  var old = document.getElementById('tw-fake-launcher');
  if (old) old.remove();

  var worldNum = '';
  if (typeof game_data !== 'undefined') {
    worldNum = game_data.world || '';
  }

  var panel = document.createElement('div');
  panel.id = 'tw-fake-launcher';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#f4e4bc;border:2px solid #7d510f;border-radius:8px;padding:20px;font-family:Verdana,sans-serif;font-size:12px;color:#3e2b0d;width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

  var html = '<div style="text-align:center;margin-bottom:12px;">';
  html += '<h2 style="margin:0;color:#7d510f;font-size:18px;">⚔️ TW Fake Generator</h2>';
  html += '<p style="margin:2px 0 0;font-size:10px;color:#8b7355;">v2.1 — one-bookmarklet flow</p>';
  html += '</div>';

  html += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
  html += '<tr><td style="padding:3px;font-weight:bold;">Číslo sveta:</td>';
  html += '<td><input id="tw-world" type="text" value="' + worldNum + '" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

  html += '<tr><td style="padding:3px;font-weight:bold;">Fake limit (%):</td>';
  html += '<td><input id="tw-fakelimit" type="number" value="0.5" step="0.1" min="0.1" max="100" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

  html += '<tr><td style="padding:3px;font-weight:bold;">Open tabs:</td>';
  html += '<td><input id="tw-opentabs" type="number" value="5" min="1" max="50" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></td></tr>';

  html += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov na cieľ:</td>';
  html += '<td><input id="tw-maxpertarget" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
  html += '<div style="font-size:9px;color:#8b7355;">0 = bez extra limitu</div></td></tr>';

  html += '<tr><td style="padding:3px;font-weight:bold;">Max fejkov z dediny:</td>';
  html += '<td><input id="tw-maxpervillage" type="number" value="0" min="0" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" />';
  html += '<div style="font-size:9px;color:#8b7355;">0 = bez extra limitu</div></td></tr>';
  html += '</table>';

  html += '<div style="margin-bottom:10px;">';
  html += '<label style="font-weight:bold;">Cieľové súradnice:</label>';
  html += '<textarea id="tw-targets" rows="6" placeholder="500|500 501|501&#10;Každá na novom riadku alebo oddelené medzerou" style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;margin-top:3px;resize:vertical;font-family:monospace;"></textarea>';
  html += '<div id="tw-coord-count" style="font-size:10px;color:#8b7355;">📍 0 súradníc</div>';
  html += '</div>';

  html += '<div style="margin-bottom:10px;">';
  html += '<label style="font-weight:bold;">🕐 Okno príchodu (voliteľné):</label>';
  html += '<div style="display:flex;gap:8px;margin-top:3px;">';
  html += '<div style="flex:1;"><label style="font-size:10px;">Od:</label><input id="tw-arrival-start" type="datetime-local" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></div>';
  html += '<div style="flex:1;"><label style="font-size:10px;">Do:</label><input id="tw-arrival-end" type="datetime-local" style="width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;" /></div>';
  html += '</div></div>';

  html += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
  html += '<button id="tw-generate-btn" style="flex:1;padding:8px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;">⚔️ Vygenerovať bookmarklet</button>';
  html += '<button id="tw-close-btn" style="padding:8px 12px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">✕</button>';
  html += '</div>';

  html += '<div id="tw-output" style="display:none;">';
  html += '<label style="font-weight:bold;">📋 Vygenerovaný bookmarklet:</label>';
  html += '<textarea id="tw-result" rows="5" readonly style="width:100%;padding:5px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;margin-top:3px;font-family:monospace;font-size:10px;"></textarea>';
  html += '<button id="tw-copy-btn" style="width:100%;padding:6px;margin-top:5px;background:#2980b9;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">📋 Kopírovať</button>';
  html += '<p style="margin-top:5px;font-size:10px;color:#8b7355;">💡 Tento bookmarklet stačí spustiť iba na Kombinovanej stránke.</p>';
  html += '</div>';

  html += '<div style="margin-top:8px;padding:8px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;font-size:10px;">';
  html += '<p style="margin:0;">✅ Útoky sa otvárajú už predvyplnené cez URL parametre (<b>x/y + jednotky</b>).</p>';
  html += '<p style="margin:2px 0 0;">🎯 Fejk podmienka: povinne <b>spy + (ram alebo catapult)</b>.</p>';
  html += '</div>';

  panel.innerHTML = html;
  document.body.appendChild(panel);

  function makeBookmarklet(configObj) {
    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(configObj))));

    var loader = "(function(){" +
      "window._twFakeData='" + encoded + "';" +
      "var cdn='" + MAIN_SCRIPT_CDN + "';" +
      "var raw='" + MAIN_SCRIPT_RAW + "';" +
      "var done=false;" +
      "function fail(){if(done)return;done=true;alert('❌ Nepodarilo sa načítať fakeScriptMain.js');}" +
      "function loadScript(url,onError){var s=document.createElement('script');s.src=url+'?v='+Date.now();s.async=true;s.onload=function(){done=true;};s.onerror=onError;document.head.appendChild(s);}" +
      "loadScript(cdn,function(){" +
        "fetch(raw+'?v='+Date.now())" +
        ".then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})" +
        ".then(function(code){(0,eval)(code);done=true;})" +
        ".catch(function(){loadScript(raw,fail);});" +
      "});" +
    "})();";

    return 'javascript:' + loader + 'void(0);';
  }

  document.getElementById('tw-targets').addEventListener('input', function() {
    var matches = this.value.match(/\d{3}\|\d{3}/g);
    document.getElementById('tw-coord-count').textContent = '📍 ' + (matches ? matches.length : 0) + ' súradníc';
  });

  document.getElementById('tw-close-btn').onclick = function() { panel.remove(); };

  document.getElementById('tw-generate-btn').onclick = function() {
    var targets = document.getElementById('tw-targets').value.trim();
    var fakeLimit = parseFloat(document.getElementById('tw-fakelimit').value) || 0.5;
    var openTabs = parseInt(document.getElementById('tw-opentabs').value, 10) || 5;
    var worldId = document.getElementById('tw-world').value.trim();
    var maxFakesPerTarget = parseInt(document.getElementById('tw-maxpertarget').value, 10) || 0;
    var maxFakesPerVillage = parseInt(document.getElementById('tw-maxpervillage').value, 10) || 0;
    var arrStart = document.getElementById('tw-arrival-start').value;
    var arrEnd = document.getElementById('tw-arrival-end').value;

    if (!targets) { alert('Zadaj cieľové súradnice!'); return; }

    var coordRegex = /(\d{3})\|(\d{3})/g;
    var coords = [];
    var m;
    while ((m = coordRegex.exec(targets)) !== null) {
      coords.push({ x: parseInt(m[1], 10), y: parseInt(m[2], 10) });
    }

    if (coords.length === 0) { alert('Nenašli sa žiadne platné súradnice!'); return; }

    var configObj = {
      targets: coords,
      fakeLimit: fakeLimit,
      openTabs: openTabs,
      worldId: worldId,
      maxFakesPerTarget: maxFakesPerTarget || 0,
      maxFakesPerVillage: maxFakesPerVillage || 0,
      arrivalStart: arrStart || null,
      arrivalEnd: arrEnd || null
    };

    var bookmarklet = makeBookmarklet(configObj);

    document.getElementById('tw-output').style.display = 'block';
    document.getElementById('tw-result').value = bookmarklet;

    alert('✅ Vygenerované pre ' + coords.length + ' cieľov.');
  };

  document.getElementById('tw-copy-btn').onclick = function() {
    var result = document.getElementById('tw-result');
    result.select();
    document.execCommand('copy');
    alert('📋 Skopírované!');
  };
})();
