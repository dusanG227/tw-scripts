// TW Fake Executor v3.3 - Opravený výbeh jednotiek + prvé parsovanie z kombinovanej
// fakeScriptMain.js - načítava sa z GitHub cez bookmarklet

(funkcia() {
  „používajte prísne“;

  if (typeof _twFakeData === 'nedefinované') {
    alert (' J️ Chýba konfigurácia. Najprv vygeneruj bookmarklet cez launcher.');
    návrat;
  }

  var config;
  skús {
    config = JSON.parse (decodeURIComponent(escape(atob(_twFakeData))));
  } chytiť (e) {
    alert ('❌ Nepodarilo sa dekódovať konfiguráciu: ' + e.message);
    návrat;
  }

  var ciele = Array.isArray (config.targets) ? config.targets : [];
  var arrivalStart = config.arrivalStart (konfigurácia)? nový dátum (config.arrivalStart): null;
  var príchodKoniec = config.arrivalKoniec ? nový dátum (config.arrivalEnd): null;

  var fakeLimit = 0,5;
  var openTabs = 5;
  var maxFakesPerTarget = 0;
  var maxFakesPerVillage = 0;
  var unitMode = 'náhodný';

  protokol funkcií (msg) {console.log('[TW-Fake] ' + msg); }

  var unitPop = {
    kopija: 1, meč: 1, sekera: 1, lukostrelec: 1,
    špión: 2, ľahký: 4, pochodujúci: 5, ťažký: 6,
    baran: 5, katapult: 8, rytier: 10, snob: 100
  };

  var unitSpeed = {
    kopija: 18, meč: 22, sekera: 18, lukostrelec: 18,
    špión: 9, ľahký: 10, pochodujúci: 10, ťažký: 11,
    baran: 30, katapult: 30, rytier: 10, snob: 35
  };

  var exclusiveUnits = {miliation: true, knight: true, snob: true };

  var worldSpeed = 1;
  var unitSpeedMod = 1;
  skús {
    if (typ getSpeedConstant === 'funkcia') {
      var speedData = getSpeedConstant();
      if (speedData) {
        worldSpeed = Číslo (speedData.worldSpeed) || 1;
        unitSpeedMod = Číslo (speedData.unitSpeed) || 1;
      }
    }
  } chytiť (e) {
    log ('L️ getSpeedConstant nedostupný, používam default hodnoty');
  }

  funkcia randInt (min, max) {
    ak (max <= 0) vráti 0;
    ak (max < min) vráti max;
    vrátiť Math.floor (Math.random() * (max - min + 1)) + min;
  }

  // Minimálny pop podľa bodov cieľa
  funkcia getMinPopForFake (targetPoints) {
    ak (!targetPoints || targetPoints <= 0) vrátiť 25;
    ak (targetPoints < 500) vrátite 15;
    ak (targetPoints < 1500) vrátite 20;
    ak (targetPoints < 3000) vrátite 25;
    ak (targetPoints < 5000) vrátite 30;
    ak (targetPoints < 8000) vrátite 35;
    ak (cieľové body < 10 000) vrátite 40;
    vrátiť 50;
  }

  // OPRAVENÝ náhodný výber — nikdy nevyberie jednotku ktorú dedinu nemú
  funkcia selectRandomUnits (availableUnits, fakeLimitPct, targetPoints) {
    var hasSpy = (dostupnéUnits.spy || 0) >= 1;
    var hasRam = (dostupné Units.ram || 0) >= 1;
    var hasCat = (dostupné jednotky.catapult || 0) >= 1;
    ak (!hasSpy || (!hasRam & &!hasCat)) vrátiť {};

    var totalPop = 0;
    pre (var u v dostupných jednotkách) {
      ak (dostupné jednotky[u] > 0) totalPop += dostupné jednotky[u] * (unitPop[u] || 1);
    }

    var minPopForTarget = getMinPopForFake (targetPoints);
    var siegePop = má Ram (Ram)? unitPop.ram: unitPop.catapult;
    var povinnéMinPop = unitPop.spy + obliehaniePop;

    var popBudget = Math.max(
      Math.ceil(totalPop * (fakeLimitPct/100)),
      minPopForTarget,
      povinnéMinPop
    );
    popBudget = Math.min (popBudget, totalPop);

    var vybrané = {};
    var usedPop = 0;

    //1. Špionážny
    var maxSpyByBudget = Math.floor ((popBudget - siegePop) /unitPop.spy);
    var maxSpy = Math.min (4, dostupnéUnits.spy, Math.max (1, maxSpyByBudget));
    selected.spy = randInt (1, maxSpy);
    usedPop += selected.spy * unitPop.spy;

    //2. Ram /Mačka — LEN ak dedina má!
    if (hasRam & & hasCat) {
      var combo = randInt (0, 2);
      ak (kombo!== 1 & & usedPop + unitPop.ram <= popBudget) {
        var maxRam = Math.min (dostupnéUnits.ram, Math.floor ((popBudget - usedPop) /unitPop.ram));
        ak (maxRam >= 1) {selected.ram = randInt (1, Math.min (6, maxRam)); usedPop += selected.ram * unitPop.ram; }
      }
      ak (kombo!== 0 & & usedPop + unitPop.catapult <= popBudget) {
        var maxCat = Math.min (availableUnits.catapult, Math.floor ((popBudget - usedPop) /unitPop.catapult));
        ak (maxCat >= 1) {selected.catapult = randInt (1, Math.min (6, maxCat)); usedPop += selected.catapult * unitPop.catapult; }
      }
    } inak, ak (hasRam) {
      var maxRam2 = Math.min (dostupnéUnits.ram, Math.floor ((popBudget - usedPop) /unitPop.ram));
      ak (maxRam2 >= 1) {selected.ram = randInt (1, Math.min (6, maxRam2)); usedPop += selected.ram * unitPop.ram; }
    } ostatné {
      var maxCat2 = Math.min (availableUnits.catapult, Math.floor ((popBudget - usedPop) /unitPop.catapult));
      ak (maxCat2 >= 1) {selected.catapult = randInt (1, Math.min (6, maxCat2)); usedPop += selected.catapult * unitPop.catapult; }
    }

    ak (!vybrané.ram & &!selected.catapult) vrátiť {};

    //3. Liehovar — náhodné
    var plnivá = [];
    pre (var unitName in availableUnits) {
      ak (vylúčenéJednotky[unitName]) pokračovať;
      ak (unitName === 'spy' || unitName === 'ram' || unitName === 'catapult') pokračovať;
      if (availableUnits[unitName] > 0) fillers.push (unitName);
    }
    pre (var f = fillers.length - 1; f > 0; f--) {
      var swap = Math.floor (Math.random() * (f + 1));
      var tmp = plnivá[f]; plnivá[f] = plnivá[swap]; plnivá[swap] = tmp;
    }

    var nižšieMinimum = usedPop < minPopForTarget;
    pre (var fi = 0; fi < fillers.length && usedPop < popBudget; fi++) {
      var fn = plnivá[fi];
      var fp = jednotkaPop[fn] || 1;
      var canAfford = Math.floor ((popBudget - usedPop) /fp);
      ak (canAfford <= 0) pokračovať;
      var maxU = Math.min (dostupné jednotky [fn], canAfford);
      ak (maxU <= 0) pokračovať;
      ak (pod minimom) {
        var c = randInt (1, maxU);
        vybrané[fn] = c; usedPop += c * fp;
        nižšie Minimum = usedPop < minPopForTarget;
      } inak, ak (Math.random() < 0,5) {
        var c2 = randInt (1, maxU);
        vybrané[fn] = c2; usedPop += c2 * fp;
      }
    }

    //Druhý priechod ak stále pod minimom
    ak (použitýPop < minPopForTarget) {
      pre (var fi2 = 0; fi2 < fillers.length && usedPop < minPopForTarget; fi2++) {
        var fn2 = plnivá[fi2];
        ak (vybrané[fn2]) pokračovať;
        var fp2 = jednotkaPop[fn2] || 1;
        var ca2 = Math.floor ((popBudget - usedPop) /fp2);
        ak (ca2 <= 0) pokračovať;
        var mu2 = Math.min (dostupné jednotky [fn2], ca2);
        ak (mu2 <= 0) pokračovať;
        var potrebný = Math.ceil ((minPopForTarget - usedPop) /fp2);
        var c3 = Math.min (potrebné, mu2);
        ak (c3 > 0) {vybraté[fn2] = c3; usedPop += c3 * fp2; }
      }
    }

    //Fínna validácia
    pre (var k vo vybratom) {
      ak (vybrané[k] > (dostupné jednotky[k] || 0)) vrátite {};
      ak (vybrané[k] <= 0) vymazať vybrané[k];
    }
    vrátiť vybrané;
  }

  var fakePriorita = ['svetlo', 'kopija', 'sekera', 'lukostrelec', 'lukostrelec', 'ťažký', 'meč'];

  funkcia vyberteManualUnits (availableUnits, fakeLimitPct, targetPoints) {
    var hasSpy = (dostupnéUnits.spy || 0) > 0;
    var hasRam = (dostupné Units.ram || 0) > 0;
    var hasCat = (dostupné jednotky.katapult || 0) > 0;
    ak (!hasSpy || (!hasRam & &!hasCat)) vrátiť {};

    var totalPop = 0;
    pre (var u v dostupných jednotkách) {
      ak (dostupné jednotky[u] > 0) totalPop += dostupné jednotky[u] * (unitPop[u] || 1);
    }

    var minPopForTarget = getMinPopForFake (targetPoints);
    var siegePop = má Ram (Ram)? unitPop.ram: unitPop.catapult;
    var maxPop = Math.max (Math.ceil (totalPop * (fakeLimitPct /100)), minPopForTarget, unitPop.spy + siegePop);
    maxPop = Math.min (maxPop, totalPop);

    var vybrané = {};
    var usedPop = 0;
    selected.spy = 1; usedPop += unitPop.spy;
    ak (hasRam) {vybraté.ram = 1; usedPop += unitPop.ram; }
    else {selected.catapult = 1; usedPop += unitPop.catapult; }

    pre (var i = 0; i < fakePriority.length && usedPop < maxPop; i++) {
      var un = falošná priorita[i];
      var majú = dostupné jednotky [ne] || 0;
      ak (mať <= 0) pokračovať;
      var už = vybrané[un] || 0;
      var rem = mať - už;
      ak (rem <= 0) pokračovať;
      var pop = unitPop[un] || 1;
      var canTake = Math.floor ((maxPop - usedPop) / pop);
      var cnt = Math.min (rem, canTake);
      ak (cnt > 0) {vybraté[un] = už + cnt; usedPop += cnt * pop; }
    }
    vrátiť vybrané;
  }

  funkcia selectUnitsForFake (dostupné jednotky, fakeLimitPct, targetPoints) {
    ak (unitMode === 'náhodný') vráti výber RandomUnits (availableUnits, fakeLimitPct, targetPoints);
    vrátiť výberManualUnits (dostupné jednotky, fakeLimitPct, targetPoints);
  }

  // =========== KONTROLNÁ STRÁNKA ==========
  var isCombined = window.location.href.indexOf ('screen=overview_villages') !== -1;
  ak (!isCombined) {
    if (window.location.href.indexOf('screen=place') !== -1) {
      alert ('i️ Tento skript spúšťaj iba na Kombinovanej strane.');
      návrat;
    }
    if (typ hry_data!== 'nedefinované' && game_data.village && game_data.village.id) {
      window.location.href = '/game.php?village=' + game_data.village.id + '&screen=overview_villages&mode=combined';
      návrat;
    }
    alert ('JEDÁLNIČO Otvor stránku Kombinované (overview_villages&mode=combined).');
    návrat;
  }

  ak (!targets.length) {
    alert ('IEL️ Neboli zadané žiadne mestské úrady.');
    návrat;
  }

  showConfigPanel();

  funkcia showConfigPanel() {
    var old = document.getElementById('tw-fake-config');
    ak (starý) starý.remove();

    var p = document.createElement ('div');
    p.id = 'tw-fake-config';
    p.style.cssText = 'pozícia:pevná;hore:50%;ľavý:50%;transformovať:preložiť (-50%,-50%);z-index:99999;pozadie:#f4e4bc;hranica:2px pevné #7d510f;hranica-polomer:8px;padding:20px;font-rodina:Verdana,sans-serif;font-veľkosť:12px;farba:#3e2b0d;šírka:440px;max-výška:90vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';

    var h = '<div style=“text-align:center;margin-bottom:12px;“>';
    h += '<h2 style=“margin:0;color:#7d510f;font-size:18px;“>️ TW Fake - Konfigurácia</h2>';
    h += '<p style=“margin:2px 0 0;font-size:10px;color:#8b7355;“>v3.3 — ' + terče.dĺžka + 'cieľov načítaných</p>';
    h += '</div>';

    h += '<div style=“margin-bottom:10px;padding:8px;background:#e8d5a3;border-radius:4px;“>';
    h += '<label style=“font-weight:bold;“>Režim jednotiek:</label><br/>';
    h += '<label style=“cursor:pointer;margin-right:12px;“><input type=“radio“ name=“tw-mode“ value=“random“ checked /> 🎲 Random (odporúčané)</label>';
    h += '<label style=“kurzor:ukazovateľ;“><typ vstupu=“rádio“ názov=“tw-mode“ hodnota=“manuál“ />  ⁇ ️ Manuálny</label>';
    h += '</div>';

    h += '<table style=“width:100%;border-collapse:collapse;margin-bottom:10px;“>';
    h += '<tr><td style=“padding:3px;font-weight:bold;“>Falošný limit (%):</td>';
    h += '<td><input id=“tw-cfg-fakelimit“ type=“number“ value=“0.5“ step=“0.1“ min=“0.1“ max=“100“ style=“width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;“ />';
    h += '<div style=“font-size:9px;color:#8b7355;“>% z populácie dediny = max veľká vec fake útoku</div></td></tr>';
    h += '<tr><td style=“padding:3px;font-weight:bold;“>Otvoriť karty:</td>';
    h += '<td><input id=“tw-cfg-opentabs“ type=“number“ value=“5“ min=“1“ max=“50“ style=“width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;“/></td></tr>';
    h += '<tr><td style=“padding:3px;font-weight:bold;“>Max fejkov na cieli:</td>';
    h += '<td><input id=“tw-cfg-maxpertarget“ type=“number“ value=“0“ min=“0“ style=“width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;“ />';
    h += '<div style=“veľkosť písma:9px;color:#8b7355;“>0 = bez limitu</div></td></tr>';
    h += '<tr><td style=“padding:3px;font-weight:bold;“>Max fejkov z dediny:</td>';
    h += '<td><input id=“tw-cfg-maxpervillage“ type=“number“ value=“0“ min=“0“ style=“width:100%;padding:3px;border:1px solid #7d510f;border-radius:3px;background:#fff8e7;“ />';
    h += '<div style=“veľkosť písma:9px;color:#8b7355;“>0 = bez limitu</div></td></tr>';
    h += '</tabuľka>';

    h += '<div style=“display:flex;gap:8px;“>';
    h += '<button id=“tw-cfg-start“ style=“flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;“>️ Spusť</tlačidlo>';
    h += '<button id=“tw-cfg-close“ style=“padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;“>✕</tlačidlo>';
    h += '</div>';

    if (arrivalStart || arrivalEnd) {
      h += '<div style=“margin-top:8px;font-size:10px;color:#8b7355;“>';
      h += '🕐 Príchod: ' + (príchodZačať (arrivalStart)? arrivalStart.toLocaleString('sk-SK') : '?') + ' – ' + (príchodKoniec? arrivalEnd.toLocaleString('sk-SK') : '?');
      h += '</div>';
    }

    p.innerHTML = h;
    document.body.appendChild(p);

    document.getElementById('tw-cfg-close').onclick = funkcia() {p.remove(); };
    document.getElementById('tw-cfg-start').onclick = funkcia() {
      fakeLimit = parseFloat (document.getElementById('tw-cfg-fakelimit').value) || 0,5;
      openTabs = parseInt(document.getElementById('tw-cfg-opentabs').value, 10) || 5;
      maxFakesPerTarget = parseInt(document.getElementById('tw-cfg-maxpertarget').value, 10) || 0;
      maxFakesPerVillage = parseInt(document.getElementById('tw-cfg-maxpervillage').value, 10) || 0;
      var modeRadios = document.querySelectorAll('input[name=“tw-mode“]');
      pre (var i = 0; i < modeRadios.length; i++) {
        if (modeRadios[i].checked) { unitMode = modeRadios[i].value; prestávka; }
      }
      p.remove();
      runFakeAttacks();
    };
  }

  funkcia runFakeAttacks() {
    var dediny = parseVillagesFromCombined();
    ak (!villages.length) {
      alert ('JEDÁLNI Nenašli sa žiadne dediny s jednotkami.');
      návrat;
    }
    log ('📋 Načítaných dedín: ' + dediny.dĺžka);
    pre (var d = 0; d < Math.min (3, dediny.dĺžka); d++) {
      var dbg = dediny[d];
      var ul = []; pre (var u v dbg.units) ul.push(u + ':' + dbg.units[u]);
      log (' ' + dbg.name + '— ' + ul.join(', '));
    }
    var attackQueue = buildAttackQueue (dediny, ciele, fakeLimit);
    log ('️ Naplnených: ' + attackQueue.length);
    ak (!attackQueue.length) {
      alert (' J️ Nevytvoril sa žiadny útok. Skontroluj limity a jednotky.');
      návrat;
    }
    window._twAttackQueue = attackQueue;
    window._twAttackIndex = 0;
    showControlPanel (attackQueue);
  }

  // OPRAVENÉ parsovanie — čítanie jednotiek z hlavičiek tabuľky
  analýza funkciíVillagesFromCombined() {
    výsledok var = [];
    var tabuľka = document.getElementById('combined_table');
    ak (!tabuľka) {
      var tabuľky = document.querySelectorAll('tabuľka');
      pre (var t = 0; t < tabuľky.dĺžka; t++) {
        if (tables[t].querySelector('td.unit-item')) {tabuľka = tabuľky[t]; prestávka; }
      }
    }
    ak (!tabuľka) { log ('L ⁇ LTabuľka nenájdená'); výsledok vrátenia; }

    //Detekuj poradu jednotiek z hlavičiek
    var unitColumnOrder = [];
    var headerRow = table.querySelector('tr.units_header') || table.querySelector('thead tr');
    ak (!headerRow) {
      var allRows = tabuľka.querySelectorAll('tr');
      pre (var ri = 0; ri < allRows.length; ri++) {
        if (allRows[ri].querySelectorAll('img[src*=“unit_“]').length >= 3) {
          headerRow = allRows[ri]; zlomiť;
        }
      }
    }
    if (headerRow) {
      var hCells = headerRow.querySelectorAll('th, td');
      pre (var hi = 0; hi < hCells.length; hi++) {
        var img = hCells[hi].querySelector('img[src*=“unit_“]');
        ak (img) {
          var m = (img.getAttribute('src') || '').match(/unit_(\w+)/);
          ak (m) jednotkaColumnOrder.push(m[1]);
        }
      }
    }
    if (unitColumnOrder.length === 0) {
      if (typ hry_data!== 'nedefinované' && Array.isArray (game_data.units)) {
        unitColumnOrder = game_data.units.slice();
      } ostatné {
        unitColumnOrder = ['kopija','meč','sekera','lukostrelec','špión','ľahký','lukostrelec','ťažký','ram','katapult','rytier','snob'];
      }
      log('i️ Záložný radie: ' + unitColumnOrder.join(', '));
    } ostatné {
      log ('✅ Poradie z hlavičiek: ' + unitColumnOrder.join(', '));
    }

    var riadky = tabuľka.querySelectorAll('tr.row_a, tr.row_b');
    ak (!rows.length) riadky = document.querySelectorAll('tr.row_a, tr.row_b');

    pre (var i = 0; i < rows.length; i++) {
      var riadok = riadky[i];
      var vLink = row.querySelector('.quickedit-content a[href*=“dedina=“]') || row.querySelector('a[href*=“dedina=“]');
      var cSrc = row.querySelector('.quickedit-label') || vLink;
      ak (!vLink || !cSrc) pokračovať;
      var idM = (vLink.href || '').match(/dedina=(\d+)/);
      ak (!idM) pokračovať;
      var cM = (cSrc.textContent || '').match(/(\d{3})\|(\d{3})/);
      ak (!cM) pokračovať;

      var unitCells = row.querySelectorAll('td.unit-item');
      ak (!unitCells.length) pokračovať;

      jednotky Var = {};
      pre (var j = 0; j < unitCells.length && j < unitColumnOrder.length; j++) {
        var un = unitColumnOrder[j];
        ak (vylúčené jednotky [ne]) pokračujú;
        var val = parseInt((unitCells[j].textContent || '').trim().replace(/\D+/g, ''), 10) || 0;
        ak (val > 0) jednotiek [un] = val;
      }

      var totalPop = 0;
      pre (var u v jednotkách) totalPop += jednotky[u] * (unitPop[u] || 1);
      ak (totalPop > 0) {
        result.push(výsledok)({
          id: idM[1], x: parseInt(cM[1], 10), y: parseInt(cM[2], 10),
          názov: (cSrc.textContent || '').trim(),
          jednotky: jednotky, totalPop: totalPop
        });
      }
    }
    výsledok vrátenia;
  }

  funkcia calcDistance(x1, y1, x2, y2) {
    vrátiť Math.sqrt (Math.pow(x2-x1,2) + Math.pow(y2-y1,2));
  }

  funkcia getSlowestUnit(jednotky) {
    var slowest = 'ram', slowestVal = 0;
    pre (var u v jednotkách) {
      ak (!jednotky[u] || jednotky[u] <= 0) pokračovať;
      var spd = unitSpeed[u] || 0;
      if (spd > slowestVal) { slowestVal = spd; slowest = u; }
    }
    najpomalšie vracať;
  }

  funkcia parseServerNow() {
    var timeEl = document.getElementById('serverTime');
    var dateEl = document.getElementById('serverDate');
    if (timeEl & & dateEl) {
      var t = (timeEl.textContent||'').trim();
      var d = (dateEl.textContent||'').trim();
      var dp = d.split(/[.\/-]/), tp = t.split(':');
      if (dp.length===3 && tp.length>=2) {
        var dt = nový dátum (parseInt(dp[2],10), parseInt(dp[1],10)-1, parseInt(dp[0],10),
                          parseInt(tp[0],10), parseInt(tp[1],10), parseInt(tp[2]||'0',10));
        ak (!isNaN(dt.getTime())) vrátiť dt;
      }
    }
    vrátiť nový dátum();
  }

  funkcia calcTravelTimeMs (fromX, fromY, toX, toY, slowestUnit) {
    var dist = calcDistance (od X, odY, toX, toY);
    vrátiť dist * (unitSpeed[slowestUnit]||30) * 60 * 1000 /(worldSpeed * unitSpeedMod);
  }

  funkcia isInArrivalWindow (dedina, cieľ, vybranéJednotky) {
    ak (!príchodZačnite a &!arrivalEnd) vrátiť pravda;
    var now = parseServerNow();
    var arrMs = now.getTime() + calcTravelTimeMs (village.x, village.y, target.x, target.y, getSlowestUnit (selectedUnits));
    ak (arrivalStart & & arrMs < arrivalStart.getTime()) vráti hodnotu false;
    ak (arrivalEnd & & arrMs > arrivalEnd.getTime()) vrátiť false;
    vrátiť pravdu;
  }

  funkcia buildAttackQueue (villageList, targetList, fakeLimitPct) {
    var front = [];
    var pripravenéDediny = [];

    pre (var i = 0; i < dedinaZoznam.dĺžka; i++) {
      var v = dedinaZoznam[i];
      if (unitMode === 'náhodný') {
        ak ((v.units.spy||0)>=1 && ((v.units.ram||0)>=1 || (v.units.catapult||0)>=1)) {
          preparedVillages.push({ obec: v, jednotky: null });
        }
      } ostatné {
        var avg = 0;
        pre (var tp=0; tp<targetList.length; tp++) avg += (targetList[tp].points||0);
        avg = targetList.length > 0 (cieľový zoznam)? avg/targetList.dĺžka : 0;
        var vybraný = vyberte UnitsForFake (v.units, fakeLimitPct, avg);
        ak (Object.keys(volený).length) pripravenýVillages.push ({dedina: v, jednotky: zvolený });
      }
    }

    ak (!reparedVillages.length) vrátiť front;

    var targetCap = maxFakesPerTarget > 0? maxFakesPerTarget: preparedVillages.length;
    var villageCap = maxFakesPerVillage > 0? maxFakesPerVillage: targetList.length;
    var targetCounts = {}, villageCounts = {}, targetCursor = 0;
    var maxTotal = targetList.length * targetCap;
    var bezpečnosť = maxTotal * Math.max(1, reparedVillages.length) + 100;

    kým (dĺžka frontu < maxTotal & & safety-- > 0) {
      var pokročil = nepravda;
      pre (var v2 = 0; v2 < pripravenéDediny.dĺžka; v2++) {
        var pv = pripravenéDediny[v2];
        var vKey = pv.village.id;
        ak ((villageCounts[vKey]||0) >= villageCap) pokračovať;
        var tries = 0;
        kým (skúša < targetList.length) {
          var target = targetList[targetCursor % targetList.length];
          targetCursor++; skúša++;
          var tKey = target.x+'|'+target.y;
          ak ((targetCounts[tKey]||0) >= targetCap) pokračovať;
          var targetPts = target.points || 0;
          var attackUnits;
          if (unitMode === 'náhodný') {
            var best = null, bestPop = 0;
            pre (var att=0; att<5; att++) {
              var cand = selectUnitsForFake (pv.dedina.jednotky, fakeLimitPct, targetPts);
              ak (!Object.keys(cand).length) pokračovať;
              var cp = 0; pre (var cu v cand) cp += cand[cu]*(unitPop[cu]||1);
              if (cp > bestPop) {bestPop=cp; best=cand; }
            }
            attackUnits = najlepšie || {};
            ak (!Object.keys (attackUnits).length) pokračovať;
          } ostatné {
            attackUnits = pv.units;
          }
          ak (!isInArrivalWindow (pv.dedina, cieľ, útočné jednotky)) pokračovať;
          var atkPop = 0;
          pre (var au in attackUnits) atkPop += attackUnits[au]*(unitPop[au]||1);
          front.push ({
            villageId: pv.village.id, villageName: pv.village.name,
            villageX: pv.village.x, villageY: pv.village.y,
            targetX: target.x, targetY: target.y,
            jednotky: attackUnits, totalPop: atkPop
          });
          targetCounts[tKey] = (targetCounts[tKey]||0)+1;
          villageCounts[vKey] = (villageCounts[vKey]||0)+1;
          pokročilý = pravda; zlom;
        }
      }
      ak (!pokročila) prestávka;
    }
    vrátiť front;
  }

  funkcia zobraziťControlPanel (queue) {
    var old = document.getElementById('tw-fake-panel');
    ak (starý) starý.remove();
    var panel = document.createElement ('div');
    panel.id = 'tw-fake-panel';
    panel.style.cssText = 'pozícia:pevná;hore:10px;vpravo:10px;z-index:99999;pozadie:#f4e4bc;hranica:2px pevné #7d510f;hranica-polomer:8px;vyplnenie:15px;font-rodina:Verdana,sans-serif;font-veľkosť:11px;farba:#3e2b0d;šírka:420px;max-výška:80vh;overflow-y:auto;box-shadow:0 5px 30px rgba(0,0,0,0.5);';
    var h = '<div style=“text-align:center;margin-bottom:8px;“><h3 style=“margin:0;color:#7d510f;“>️ Fake Attack Queue</h3></div>';
    h += '<div style=“pozadie:#fff3cd;výplň:6px 10px;hraničný polomer:4px;okraj-dole:8px;veľkosť písma:11px;“>';
    h += '<b>'+queue.length+'</b> útokov | <b>'+(unitMode==='random'?'🎲 Random':' ⁇ ️ Manuálny')+'</b><br/>';
    h += 'Falošný limit: <b>'+fakeLimit+'%</b> | Karty: <b>'+openTabs+'</b>';
    ak (maxFakesPerTarget>0) h += '<br/>Max/cieľ: <b>'+maxFakesPerTarget+'</b>';
    ak (maxFakesPerVillage>0) h += ' | Max/dedina: <b>'+maxFakesPerVillage+'</b>';
    ak (arrivalStart||arrivalEnd) h += '<br/>🕐 '+ (arrivalStart?príchodStart.toLocaleString('sk-SK'):'?')+' – '+ (príchodKoniec?príchodKoniec.toLocaleString('sk-SK'):'?');
    h += '</div>';
    h += '<div style=“max-výška:250px; overflow-y:auto;border:1px solid #d4a574;border-radius:4px;margin-bottom:8px;“>';
    pre (var i=0; i<Math.min (queue.length,30); i++) {
      var atk = front[i];
      var uStr = Object.keys(atk.units).map(funkcia(k){return k+':'+atk.units[k];}).join(', ');
      var bg = i%2===0?'#fff8e7':'#f4e4bc';
      h += '<div style=“padding:4px 8px;background:'+bg+';border-bottom:1px solid #e6d5b8;veľkosť písma: 10px;“>';
      h += '<b>'+atk.villageName.substring(0,22)+'</b> → '+atk.targetX+'|'+atk.targetY;
      h += '<span style=“color:#4a7c3f;font-weight:bold;“>['+atk.totalPop+' pop]</span>';
      h += '<br/><span style=“color:#8b7355;“>'+uStr+'</span></div>';
    }
    if (queue.length>30) h += '<div style=“padding:4px 8px;text-align:center;font-size:10px;color:#8b7355;“>...a ďalších '+(queue.length-30)+'</div>';
    h += '</div>';
    h += '<div style=“display:flex;gap:8px;“>';
    h += '<button id=“tw-start-btn“ style=“flex:1;padding:10px;background:#4a7c3f;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:13px;“>▶ Spusť ('+openTabs+' tabov)</tlačidlo>';
    h += '<button id=“tw-close-panel“ style=“padding:10px 14px;background:#c0392b;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;“>✕</tlačidlo>';
    h += '</div>';
    panel.innerHTML = h;
    document.body.appendChild(panel);
    document.getElementById('tw-zavrieť-panel').onclick = funkcia(){panel.remove();};
    document.getElementById('tw-start-btn').onclick = launchAttacks;
  }

  funkcia launchAttacks() {
    var fronta = okno._twAttackQueue || [];
    var idx = okno._twAttackIndex || 0;
    var tabsToOpen = Math.min (openTabs, queue.length - idx);
    if (tabsToOpen <= 0) { alert('✅ Všetky útoky už boli otvorené.'); return; }
    pre (var i=0; i<tabsToOpen; i++) {
      var attack = front [idx+i];
      ak (!útok) zlomiť;
      var params = ['village='+encodeURIComponent(attack.villageId),'screen=place','x='+encodeURIComponent(attack.targetX),'y='+encodeURIComponent(attack.targetY)];
      Object.keys(attack.units).forEach(funkcia(un){if(attack.units[un]>0) params.push(encodeURIComponent(un)+'='+encodeURIComponent(attack.units[un])); });
      window.open('/game.php?'+params.join('&'), '_blank');
    }
    window._twAttackIndex = idx + tabsToOpen;
    var btn = document.getElementById('tw-start-btn');
    var zostávajúci = front.dĺžka - okno._twAttackIndex;
    ak (btn) {
      ak (zostávajúci>0) btn.textContent = '▶ Ďalších '+Math.min (openTabs, remaining)+' (zostava '+remaining+')';
      inak {btn.textContent='✅ Hotovo!'; btn.disabled=true; btn.style.background='#95a5a6'; }
    }
    log ('📑 Otvorených '+tabsToOpen+' tabov, zostáv '+zostávajúci);
  }

})();
