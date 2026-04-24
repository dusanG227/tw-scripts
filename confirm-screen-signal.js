if (typeof ScriptAPI !== 'undefined') {
  ScriptAPI.register('Confirm Screen Signal', true, 'Codex', 'tribalwars');
}

(function confirmScreenSignal() {
  var OVERLAY_ID = 'twConfirmSignalOverlay';
  var STATUS_ID = 'twConfirmSignalStatus';
  var DEBUG_ID = 'twConfirmSignalDebug';
  var HOUR_ID = 'twConfirmSignalHour';
  var MINUTE_ID = 'twConfirmSignalMinute';
  var SECOND_ID = 'twConfirmSignalSecond';
  var MS_ID = 'twConfirmSignalMs';
  var LEAD_ID = 'twConfirmSignalLead';
  var STORAGE_TARGET = 'twConfirmSignal.target.parts';
  var STORAGE_LEAD = 'twConfirmSignal.lead';
  var TICK_KEY = '__twConfirmSignalTick';
  var ALERT_ID = 'twConfirmSignalAlert';

  function removeOverlay() {
    var node = document.getElementById(OVERLAY_ID);
    if (node) {
      node.remove();
    }
  }

  function removeAlert() {
    var node = document.getElementById(ALERT_ID);
    if (node) {
      node.remove();
    }
  }

  function ensureMsClock() {
    if (window.__twConfirmSignalMsClock) {
      return;
    }

    window.__twConfirmSignalMsClock = window.setInterval(function() {
      var serverTime = document.getElementById('serverTime');
      if (!serverTime) {
        return;
      }

      var baseMatch = (serverTime.textContent || '').match(/^\d{1,2}:\d{2}:\d{2}/);
      if (!baseMatch) {
        return;
      }

      serverTime.textContent =
        baseMatch[0] + ':' + String(new Date().getMilliseconds()).padStart(3, '0');
    }, 1);
  }

  function getServerDateParts() {
    var serverDate = document.getElementById('serverDate');
    if (!serverDate) {
      var fallback = new Date();
      return {
        day: fallback.getDate(),
        month: fallback.getMonth() + 1,
        year: fallback.getFullYear()
      };
    }

    var text = (serverDate.textContent || '').trim();
    var match = text.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
    if (!match) {
      var fallbackDate = new Date();
      return {
        day: fallbackDate.getDate(),
        month: fallbackDate.getMonth() + 1,
        year: fallbackDate.getFullYear()
      };
    }

    var a = Number(match[1]);
    var b = Number(match[2]);
    var c = Number(match[3]);
    var year = c < 100 ? 2000 + c : c;

    if (a > 12) {
      return { day: a, month: b, year: year };
    }

    if (b > 12) {
      return { day: b, month: a, year: year };
    }

    return { day: a, month: b, year: year };
  }

  function getServerNow() {
    var serverTime = document.getElementById('serverTime');
    if (!serverTime) {
      throw new Error('Nenasiel som #serverTime.');
    }

    var match = (serverTime.textContent || '').trim().match(
      /^(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?$/
    );

    if (!match) {
      throw new Error('Neviem precitat serverovy cas.');
    }

    var dateParts = getServerDateParts();
    return new Date(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4] ? Number(match[4].padStart(3, '0')) : new Date().getMilliseconds()
    );
  }

  function findLabelRowValue(labelPattern) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('tr'));
    for (var i = 0; i < rows.length; i += 1) {
      var cells = rows[i].querySelectorAll('td, th');
      if (cells.length < 2) {
        continue;
      }

      var label = (cells[0].textContent || '').trim();
      if (labelPattern.test(label)) {
        return (cells[1].textContent || '').trim();
      }
    }
    return '';
  }

  function getTravelDurationMs() {
    var durationText = findLabelRowValue(/^(Trvanie|Doba pochodu|Duration|Travel time)\s*:/i);
    var match = durationText.match(/(\d{1,2}):(\d{2}):(\d{2})/);

    if (!match) {
      throw new Error('Neviem najst Trvanie na obrazovke.');
    }

    return (
      Number(match[1]) * 3600000 +
      Number(match[2]) * 60000 +
      Number(match[3]) * 1000
    );
  }

  function getDisplayedArrivalText() {
    return findLabelRowValue(/^(Pr[ií]chod|Arrival)\s*:/i) || '-';
  }

  function formatTime(date) {
    return [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
      String(date.getMilliseconds()).padStart(3, '0')
    ].join(':');
  }

  function formatDuration(ms) {
    var totalSeconds = Math.floor(ms / 1000);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0')
    ].join(':');
  }

  function setStatus(text, color) {
    var node = document.getElementById(STATUS_ID);
    if (!node) {
      return;
    }

    node.textContent = text;
    if (color) {
      node.style.color = color;
    }
  }

  function setDebug(text) {
    var node = document.getElementById(DEBUG_ID);
    if (!node) {
      return;
    }

    node.textContent = text;
  }

  function limitDigits(input, maxLen) {
    input.addEventListener('input', function() {
      var digits = input.value.replace(/\D/g, '').slice(0, maxLen);
      if (input.value !== digits) {
        input.value = digits;
      }
    });
  }

  function autoAdvance(current, next, maxLen) {
    current.addEventListener('input', function() {
      if (current.value.length >= maxLen && next) {
        next.focus();
        next.select();
      }
    });
  }

  function getFieldNumber(id, maxValue, label) {
    var node = document.getElementById(id);
    var raw = (node && node.value ? node.value : '').trim();

    if (raw === '') {
      return 0;
    }

    var num = Number(raw);
    if (!Number.isFinite(num) || num < 0 || num > maxValue) {
      throw new Error(label + ' ma neplatnu hodnotu.');
    }

    return num;
  }

  function getTargetParts() {
    return {
      hour: getFieldNumber(HOUR_ID, 23, 'Hodina'),
      minute: getFieldNumber(MINUTE_ID, 59, 'Minuta'),
      second: getFieldNumber(SECOND_ID, 59, 'Sekunda'),
      ms: getFieldNumber(MS_ID, 999, 'Milisekundy')
    };
  }

  function saveTargetParts(parts) {
    localStorage.setItem(STORAGE_TARGET, JSON.stringify(parts));
  }

  function loadTargetParts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_TARGET) || '{}');
    } catch (error) {
      return {};
    }
  }

  function fillFields(parts) {
    document.getElementById(HOUR_ID).value =
      parts.hour !== undefined ? String(parts.hour).padStart(2, '0') : '';
    document.getElementById(MINUTE_ID).value =
      parts.minute !== undefined ? String(parts.minute).padStart(2, '0') : '';
    document.getElementById(SECOND_ID).value =
      parts.second !== undefined ? String(parts.second).padStart(2, '0') : '';
    document.getElementById(MS_ID).value =
      parts.ms !== undefined ? String(parts.ms).padStart(3, '0') : '';
  }

  function parseArrivalFromFields() {
    var parts = getTargetParts();
    var now = getServerNow();

    var arrival = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parts.hour,
      parts.minute,
      parts.second,
      parts.ms
    );

    if (arrival.getTime() < now.getTime()) {
      arrival.setDate(arrival.getDate() + 1);
    }

    saveTargetParts(parts);
    return arrival;
  }

  function showSignalDot() {
    removeAlert();

    var dot = document.createElement('div');
    dot.id = ALERT_ID;
    dot.style.position = 'fixed';
    dot.style.top = '16px';
    dot.style.right = '16px';
    dot.style.width = '22px';
    dot.style.height = '22px';
    dot.style.borderRadius = '999px';
    dot.style.background = '#ff2d55';
    dot.style.boxShadow = '0 0 0 4px rgba(255,45,85,0.28), 0 0 18px rgba(255,45,85,0.85)';
    dot.style.zIndex = '1000000';
    dot.style.pointerEvents = 'none';
    dot.style.transition = 'transform 90ms ease, opacity 90ms ease, background 90ms ease';

    document.body.appendChild(dot);

    var blink = false;
    var blinkTimer = window.setInterval(function() {
      blink = !blink;
      dot.style.opacity = blink ? '1' : '0.35';
      dot.style.transform = blink ? 'scale(1.35)' : 'scale(0.92)';
      dot.style.background = blink ? '#ff2d55' : '#ffd60a';
    }, 120);

    window.setTimeout(function() {
      clearInterval(blinkTimer);
      removeAlert();
    }, 1800);
  }

  function trySound() {
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      var ctx = new AudioContextClass();
      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();

      oscillator.type = 'square';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.06;

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();

      window.setTimeout(function() {
        oscillator.stop();
        ctx.close();
      }, 250);
    } catch (error) {}
  }

  function fireSignal(sendTime) {
    showSignalDot();
    trySound();
    setStatus('SIGNAL TERAZ | odosli o ' + formatTime(sendTime) + ' | klikni rucne', '#c1121f');

    var panel = document.getElementById(OVERLAY_ID);
    if (panel) {
      panel.style.background = '#ffdfdf';
      panel.style.borderColor = '#c1121f';
      panel.style.boxShadow = '0 0 0 4px rgba(193,18,31,0.18), 0 12px 30px rgba(0,0,0,0.25)';
    }
  }

  function stopTick() {
    if (window[TICK_KEY]) {
      clearTimeout(window[TICK_KEY]);
      window[TICK_KEY] = null;
    }
  }

  function armSignal(desiredArrival, leadMs) {
    stopTick();
    removeAlert();
    localStorage.setItem(STORAGE_LEAD, String(leadMs));

    var travelDurationMs = getTravelDurationMs();
    var sendTime = new Date(desiredArrival.getTime() - travelDurationMs);

    function tick() {
      try {
        var now = getServerNow();
        var triggerAt = sendTime.getTime() - leadMs;
        var signalIn = triggerAt - now.getTime();

        setDebug(
          'Server now: ' + formatTime(now) +
          ' | Klik: ' + formatTime(sendTime) +
          ' | Prichod: ' + formatTime(desiredArrival) +
          ' | Trvanie: ' + formatDuration(travelDurationMs)
        );

        if (signalIn <= 0) {
          fireSignal(sendTime);
          stopTick();
          return;
        }

        setStatus(
          'Prichod ' +
            formatTime(desiredArrival) +
            ' | klik za ' +
            signalIn +
            ' ms | odoslanie o ' +
            formatTime(sendTime),
          signalIn <= 1000 ? '#a15c00' : '#17324d'
        );

        window[TICK_KEY] = setTimeout(tick, signalIn > 300 ? 50 : signalIn > 80 ? 10 : 1);
      } catch (error) {
        stopTick();
        setStatus(error.message, '#b42318');
      }
    }

    tick();
  }

  function buildOverlay() {
    removeOverlay();

    var savedParts = loadTargetParts();
    var savedLead = localStorage.getItem(STORAGE_LEAD) || '200';
    var travelText = '-';
    var arrivalText = '-';

    try {
      travelText = formatDuration(getTravelDurationMs());
    } catch (error) {}

    try {
      arrivalText = getDisplayedArrivalText();
    } catch (error) {}

    var wrap = document.createElement('div');
    wrap.id = OVERLAY_ID;
    wrap.style.position = 'fixed';
    wrap.style.left = '12px';
    wrap.style.right = '12px';
    wrap.style.bottom = '12px';
    wrap.style.zIndex = '999999';
    wrap.style.background = '#fff8e7';
    wrap.style.border = '2px solid #c18b3b';
    wrap.style.borderRadius = '14px';
    wrap.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)';
    wrap.style.padding = '14px';
    wrap.style.fontFamily = 'Arial, sans-serif';
    wrap.style.color = '#2b2117';
    wrap.style.transition = 'background 120ms ease, box-shadow 120ms ease, border-color 120ms ease';

    wrap.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px;">Confirm Screen Signal</div>' +
      '<div style="font-size:13px;line-height:1.35;margin-bottom:10px;">Zadaj pozadovany <b>cas prichodu</b>. Script odrata trvanie a signal da v case kliknutia.</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
      '<input id="' + HOUR_ID + '" type="text" inputmode="numeric" placeholder="HH" style="flex:1;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '<input id="' + MINUTE_ID + '" type="text" inputmode="numeric" placeholder="MM" style="flex:1;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '<input id="' + SECOND_ID + '" type="text" inputmode="numeric" placeholder="SS" style="flex:1;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '<input id="' + MS_ID + '" type="text" inputmode="numeric" placeholder="MS" style="flex:1.2;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '</div>' +
      '<input id="' + LEAD_ID + '" type="number" inputmode="numeric" placeholder="200" value="' + savedLead + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border-radius:10px;border:1px solid #b8894f;margin-bottom:8px;">' +
      '<div style="font-size:12px;margin-bottom:6px;color:#6b4f2a;">Polia su prichod: hodina, minuta, sekunda, milisekundy. Trvanie z obrazovky: ' + travelText + '. Zobrazeny prichod v hre: ' + arrivalText + '.</div>' +
      '<div id="' + DEBUG_ID + '" style="font-size:12px;margin-bottom:8px;color:#7c5a1b;">Server now: - | Klik: - | Prichod: - | Trvanie: -</div>' +
      '<div id="' + STATUS_ID + '" style="font-size:13px;margin-bottom:10px;color:#17324d;">Pripravene.</div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button id="twConfirmSignalStart" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#c96f2d;color:#fff;font-weight:700;">Spustit</button>' +
      '<button id="twConfirmSignalTest" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#b42318;color:#fff;font-weight:700;">Test</button>' +
      '<button id="twConfirmSignalStop" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#6b7280;color:#fff;font-weight:700;">Stop</button>' +
      '</div>';

    document.body.appendChild(wrap);

    fillFields(savedParts);

    var hourInput = document.getElementById(HOUR_ID);
    var minuteInput = document.getElementById(MINUTE_ID);
    var secondInput = document.getElementById(SECOND_ID);
    var msInput = document.getElementById(MS_ID);

    limitDigits(hourInput, 2);
    limitDigits(minuteInput, 2);
    limitDigits(secondInput, 2);
    limitDigits(msInput, 3);

    autoAdvance(hourInput, minuteInput, 2);
    autoAdvance(minuteInput, secondInput, 2);
    autoAdvance(secondInput, msInput, 2);

    document.getElementById('twConfirmSignalStart').onclick = function() {
      try {
        var desiredArrival = parseArrivalFromFields();
        var leadMs = Number(document.getElementById(LEAD_ID).value || 200);

        if (!Number.isFinite(leadMs) || leadMs < 0) {
          throw new Error('Predstih musi byt cislo 0 alebo viac.');
        }

        armSignal(desiredArrival, Math.round(leadMs));
      } catch (error) {
        setStatus(error.message, '#b42318');
      }
    };

    document.getElementById('twConfirmSignalTest').onclick = function() {
      fireSignal(new Date());
    };

    document.getElementById('twConfirmSignalStop').onclick = function() {
      stopTick();
      removeAlert();
      setStatus('Signal zastaveny.', '#b42318');
      setDebug('Server now: - | Klik: - | Prichod: - | Trvanie: -');
    };
  }

  try {
    ensureMsClock();
    buildOverlay();
  } catch (error) {
    alert('Chyba: ' + error.message);
  }
})();
