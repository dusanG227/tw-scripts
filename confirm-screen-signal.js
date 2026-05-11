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
  var CORRECTION_ID = 'twConfirmSignalCorrection';
  var STORAGE_TARGET = 'twConfirmSignal.target.parts';
  var STORAGE_LEAD = 'twConfirmSignal.lead';
  var STORAGE_CORRECTION = 'twConfirmSignal.correction';
  var TICK_TIMEOUT_KEY = '__twConfirmSignalTickTimeout';
  var TICK_RAF_KEY = '__twConfirmSignalTickRaf';
  var ALERT_ID = 'twConfirmSignalAlert';
  var CLOCK_STATE_KEY = '__twConfirmSignalClockState';
  var CLOCK_BIND_TIMER_KEY = '__twConfirmSignalClockBindTimer';
  var CLOCK_OBSERVER_KEY = '__twConfirmSignalClockObserver';

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

  function getPerformanceNow() {
    if (window.performance && typeof window.performance.now === 'function') {
      return window.performance.now();
    }
    return Date.now();
  }

  function requestFrame(callback) {
    if (typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(callback);
    }
    return window.setTimeout(callback, 16);
  }

  function cancelFrame(handle) {
    if (!handle) {
      return;
    }

    if (typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(handle);
      return;
    }

    clearTimeout(handle);
  }

  function clampMs(value) {
    return Math.max(0, Math.min(999, Math.floor(value)));
  }

  function getSecondKey(hours, minutes, seconds) {
    return [hours, minutes, seconds].join(':');
  }

  function parseServerTimeText(text) {
    var match = (text || '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})/);
    if (!match) {
      return null;
    }

    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    var seconds = Number(match[3]);

    return {
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      secondKey: getSecondKey(hours, minutes, seconds)
    };
  }

  function getClockState() {
    return window[CLOCK_STATE_KEY] || null;
  }

  function syncClockStateFromNode(node) {
    var parsed = parseServerTimeText(node && node.textContent);
    var state = getClockState();

    if (!parsed || !state) {
      return false;
    }

    var perfNow = getPerformanceNow();

    if (state.lastSecondKey !== parsed.secondKey) {
      state.lastSecondKey = parsed.secondKey;
      state.secondStartedAtPerf = perfNow;
    } else if (state.secondStartedAtPerf === null) {
      state.secondStartedAtPerf = perfNow;
    }

    state.displayedMs = clampMs(perfNow - state.secondStartedAtPerf);
    state.lastSeenText = (node.textContent || '').trim();
    return true;
  }

  function bindClockTracking() {
    var serverTime = document.getElementById('serverTime');

    if (!serverTime) {
      window[CLOCK_BIND_TIMER_KEY] = window.setTimeout(bindClockTracking, 100);
      return;
    }

    if (window[CLOCK_BIND_TIMER_KEY]) {
      clearTimeout(window[CLOCK_BIND_TIMER_KEY]);
      window[CLOCK_BIND_TIMER_KEY] = null;
    }

    syncClockStateFromNode(serverTime);

    if (window[CLOCK_OBSERVER_KEY]) {
      return;
    }

    var observer = new MutationObserver(function() {
      syncClockStateFromNode(serverTime);
    });

    observer.observe(serverTime, {
      childList: true,
      characterData: true,
      subtree: true
    });

    window[CLOCK_OBSERVER_KEY] = observer;
  }

  function ensureClockTracking() {
    if (!getClockState()) {
      window[CLOCK_STATE_KEY] = {
        lastSecondKey: null,
        secondStartedAtPerf: null,
        displayedMs: 0,
        lastSeenText: ''
      };
    }

    bindClockTracking();
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

  function getEstimatedDisplayedMs(parsed) {
    var state = getClockState();

    if (!state || state.secondStartedAtPerf === null) {
      return 0;
    }

    if (state.lastSecondKey !== parsed.secondKey) {
      return state.displayedMs || 0;
    }

    var elapsed = clampMs(getPerformanceNow() - state.secondStartedAtPerf);
    state.displayedMs = elapsed;
    return elapsed;
  }

  function getServerNow() {
    var serverTime = document.getElementById('serverTime');
    if (!serverTime) {
      throw new Error('Nenasiel som #serverTime.');
    }

    syncClockStateFromNode(serverTime);

    var parsed = parseServerTimeText(serverTime.textContent || '');
    if (!parsed) {
      throw new Error('Neviem precitat serverovy cas.');
    }

    var dateParts = getServerDateParts();
    var ms = getEstimatedDisplayedMs(parsed);

    return new Date(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      parsed.hours,
      parsed.minutes,
      parsed.seconds,
      ms
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

  function getSignedNumber(id, label) {
    var node = document.getElementById(id);
    var raw = (node && node.value ? node.value : '').trim();

    if (raw === '') {
      return 0;
    }

    var num = Number(raw);
    if (!Number.isFinite(num)) {
      throw new Error(label + ' musi byt cislo.');
    }

    return Math.round(num);
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
    dot.style.transition = 'transform 90ms ease, opacity 90ms ease';

    document.body.appendChild(dot);

    var pulse = false;
    var pulseTimer = window.setInterval(function() {
      pulse = !pulse;
      dot.style.opacity = pulse ? '1' : '0.45';
      dot.style.transform = pulse ? 'scale(1.35)' : 'scale(0.92)';
    }, 120);

    window.setTimeout(function() {
      clearInterval(pulseTimer);
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
      gain.gain.value = 0.05;

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();

      window.setTimeout(function() {
        oscillator.stop();
        ctx.close();
      }, 220);
    } catch (error) {}
  }

  function fireSignal(sendTime, actualTriggerTime, plannedTriggerTime) {
    showSignalDot();
    trySound();

    var deltaMs = actualTriggerTime.getTime() - plannedTriggerTime.getTime();

    setStatus(
      'KLIKNI PRI CERVENEJ BODKE | klik cas ' +
        formatTime(sendTime) +
        ' | real signal ' +
        formatTime(actualTriggerTime) +
        ' | plan ' +
        formatTime(plannedTriggerTime) +
        ' | odchylka ' +
        deltaMs +
        ' ms',
      '#c1121f'
    );

    var panel = document.getElementById(OVERLAY_ID);
    if (panel) {
      panel.style.background = '#ffdfdf';
      panel.style.borderColor = '#c1121f';
      panel.style.boxShadow = '0 0 0 4px rgba(193,18,31,0.18), 0 12px 30px rgba(0,0,0,0.25)';
    }
  }

  function stopTick() {
    if (window[TICK_TIMEOUT_KEY]) {
      clearTimeout(window[TICK_TIMEOUT_KEY]);
      window[TICK_TIMEOUT_KEY] = null;
    }

    if (window[TICK_RAF_KEY]) {
      cancelFrame(window[TICK_RAF_KEY]);
      window[TICK_RAF_KEY] = null;
    }
  }

  function armSignal(desiredArrival, leadMs, correctionMs) {
    stopTick();
    removeAlert();
    localStorage.setItem(STORAGE_LEAD, String(leadMs));
    localStorage.setItem(STORAGE_CORRECTION, String(correctionMs));

    var travelDurationMs = getTravelDurationMs();
    var sendTime = new Date(desiredArrival.getTime() - travelDurationMs);
    var totalLeadMs = leadMs + correctionMs;
    var triggerTime = new Date(sendTime.getTime() - totalLeadMs);

    function updateDebug(now, signalIn) {
      setDebug(
        'Server now: ' + formatTime(now) +
        ' | Klik: ' + formatTime(sendTime) +
        ' | Signal: ' + formatTime(triggerTime) +
        ' | Prichod: ' + formatTime(desiredArrival) +
        ' | Trvanie: ' + formatDuration(travelDurationMs) +
        ' | Do signalu: ' + signalIn + ' ms'
      );
    }

    function updateStatus(signalIn) {
      setStatus(
        'Klikni pri cervenej bodke | signal za ' +
          signalIn +
          ' ms | klik cas ' +
          formatTime(sendTime) +
          ' | predstih ' +
          leadMs +
          ' ms | korekcia ' +
          correctionMs +
          ' ms | spolu ' +
          totalLeadMs +
          ' ms',
        signalIn <= 1000 ? '#a15c00' : '#17324d'
      );
    }

    function fireFromNow(now) {
      fireSignal(sendTime, now, triggerTime);
      stopTick();
    }

    function fineTick() {
      try {
        var now = getServerNow();
        var signalIn = triggerTime.getTime() - now.getTime();

        updateDebug(now, signalIn);

        if (signalIn <= 0) {
          fireFromNow(now);
          return;
        }

        updateStatus(signalIn);
        window[TICK_RAF_KEY] = requestFrame(fineTick);
      } catch (error) {
        stopTick();
        setStatus(error.message, '#b42318');
      }
    }

    function coarseTick() {
      try {
        var now = getServerNow();
        var signalIn = triggerTime.getTime() - now.getTime();

        updateDebug(now, signalIn);

        if (signalIn <= 0) {
          fireFromNow(now);
          return;
        }

        updateStatus(signalIn);

        if (signalIn <= 120) {
          window[TICK_RAF_KEY] = requestFrame(fineTick);
          return;
        }

        var nextDelay = Math.min(250, Math.max(20, signalIn - 80));
        window[TICK_TIMEOUT_KEY] = window.setTimeout(coarseTick, nextDelay);
      } catch (error) {
        stopTick();
        setStatus(error.message, '#b42318');
      }
    }

    coarseTick();
  }

  function buildOverlay() {
    removeOverlay();

    var savedParts = loadTargetParts();
    var savedLead = localStorage.getItem(STORAGE_LEAD) || '200';
    var savedCorrection = localStorage.getItem(STORAGE_CORRECTION) || '0';
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
    wrap.style.top = '12px';
    wrap.style.width = '380px';
    wrap.style.maxWidth = 'calc(100vw - 24px)';
    wrap.style.maxHeight = 'calc(100vh - 24px)';
    wrap.style.overflowY = 'auto';
    wrap.style.boxSizing = 'border-box';
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
      '<div style="font-size:13px;line-height:1.35;margin-bottom:10px;">Zadaj pozadovany <b>cas prichodu</b>. Klikaj pri <b>cervenej bodke</b>. Milisekundy sa len odhaduju z preklopenia hernych hodin, takze jedna pevna korekcia nemusi sadnut na kazdy pokus.</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
      '<input id="' + HOUR_ID + '" type="text" inputmode="numeric" placeholder="HH" style="flex:1;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '<input id="' + MINUTE_ID + '" type="text" inputmode="numeric" placeholder="MM" style="flex:1;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '<input id="' + SECOND_ID + '" type="text" inputmode="numeric" placeholder="SS" style="flex:1;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '<input id="' + MS_ID + '" type="text" inputmode="numeric" placeholder="MS" style="flex:1.2;min-width:0;box-sizing:border-box;font-size:18px;text-align:center;padding:10px;border-radius:10px;border:1px solid #b8894f;">' +
      '</div>' +
      '<input id="' + LEAD_ID + '" type="number" inputmode="numeric" placeholder="200" value="' + savedLead + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border-radius:10px;border:1px solid #b8894f;margin-bottom:8px;">' +
      '<input id="' + CORRECTION_ID + '" type="number" inputmode="numeric" placeholder="0" value="' + savedCorrection + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border-radius:10px;border:1px solid #b8894f;margin-bottom:8px;">' +
      '<div style="font-size:12px;margin-bottom:6px;color:#6b4f2a;">1. pole navyse je tvoja priemerna reakcia v ms. 2. pole navyse je korekcia skriptu. Ak stale klikas neskoro o 300 ms, daj sem <b>300</b>. Ak skoro, daj zaporne cislo. Nahodnu odchylku ruky to neodstrani. Trvanie: ' + travelText + '. Prichod v hre: ' + arrivalText + '.</div>' +
      '<div id="' + DEBUG_ID + '" style="font-size:12px;margin-bottom:8px;color:#7c5a1b;">Server now: - | Klik: - | Signal: - | Prichod: - | Trvanie: - | Do signalu: -</div>' +
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
        var leadMs = getSignedNumber(LEAD_ID, 'Predstih');
        var correctionMs = getSignedNumber(CORRECTION_ID, 'Korekcia');

        armSignal(desiredArrival, leadMs, correctionMs);
      } catch (error) {
        setStatus(error.message, '#b42318');
      }
    };

    document.getElementById('twConfirmSignalTest').onclick = function() {
      showSignalDot();
      setStatus('Test signalu: klikaj pri cervenej bodke.', '#c1121f');
    };

    document.getElementById('twConfirmSignalStop').onclick = function() {
      stopTick();
      removeAlert();
      setStatus('Signal zastaveny.', '#b42318');
      setDebug('Server now: - | Klik: - | Signal: - | Prichod: - | Trvanie: - | Do signalu: -');
    };
  }

  try {
    ensureClockTracking();
    buildOverlay();
  } catch (error) {
    alert('Chyba: ' + error.message);
  }
})();
