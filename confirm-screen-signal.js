if (typeof ScriptAPI !== 'undefined') {
  ScriptAPI.register('Confirm Screen Signal', true, 'Codex', 'tribalwars');
}

(function confirmScreenSignal() {
  var OVERLAY_ID = 'twConfirmSignalOverlay';
  var STATUS_ID = 'twConfirmSignalStatus';
  var INPUT_ID = 'twConfirmSignalTime';
  var LEAD_ID = 'twConfirmSignalLead';
  var STORAGE_TARGET = 'twConfirmSignal.target';
  var STORAGE_LEAD = 'twConfirmSignal.lead';
  var STORAGE_ARMED = 'twConfirmSignal.armed';
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

    return {
      day: a,
      month: b,
      year: year
    };
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

  function normalizeTimeInput(value) {
    var raw = String(value || '').trim();
    var digits = raw.replace(/\D/g, '').slice(0, 9);

    if (!digits) {
      return '';
    }

    var parts = [];
    var hh = digits.slice(0, 2);
    var mm = digits.slice(2, 4);
    var ss = digits.slice(4, 6);
    var ms = digits.slice(6, 9);

    if (hh) {
      parts.push(hh);
    }
    if (mm) {
      parts.push(mm);
    }
    if (ss) {
      parts.push(ss);
    }
    if (ms) {
      parts.push(ms);
    }

    return parts.join(':');
  }

  function parseTarget(value) {
    var input = normalizeTimeInput(value);
    var match = input.match(/^(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?$/);
    if (!match) {
      throw new Error('Pouzi format HH:MM:SS:MS, napr. 12:34:56:700.');
    }

    var now = getServerNow();
    var target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4] ? Number(match[4].padStart(3, '0')) : 0
    );

    if (target.getTime() < now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target;
  }

  function formatTime(date) {
    return [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
      String(date.getMilliseconds()).padStart(3, '0')
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

  function showBigAlert(text) {
    removeAlert();

    var alertBox = document.createElement('div');
    alertBox.id = ALERT_ID;
    alertBox.style.position = 'fixed';
    alertBox.style.left = '0';
    alertBox.style.right = '0';
    alertBox.style.top = '0';
    alertBox.style.bottom = '0';
    alertBox.style.zIndex = '1000000';
    alertBox.style.background = 'rgba(193,18,31,0.88)';
    alertBox.style.display = 'flex';
    alertBox.style.alignItems = 'center';
    alertBox.style.justifyContent = 'center';
    alertBox.style.textAlign = 'center';
    alertBox.style.color = '#ffffff';
    alertBox.style.fontFamily = 'Arial, sans-serif';
    alertBox.style.fontWeight = '700';
    alertBox.style.fontSize = '42px';
    alertBox.style.lineHeight = '1.15';
    alertBox.style.padding = '24px';
    alertBox.style.boxSizing = 'border-box';
    alertBox.innerHTML = '<div>' + text + '<br><span style="font-size:22px;">KLIKNI RUCNE</span></div>';

    document.body.appendChild(alertBox);

    var blink = false;
    var blinkTimer = window.setInterval(function() {
      blink = !blink;
      alertBox.style.background = blink ? 'rgba(193,18,31,0.95)' : 'rgba(255,140,0,0.92)';
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

  function fireSignal(target) {
    showBigAlert('KLIK TERAZ');
    trySound();
    setStatus('SIGNAL TERAZ | ciel ' + formatTime(target) + ' | klikni rucne', '#c1121f');

    var panel = document.getElementById(OVERLAY_ID);
    if (panel) {
      panel.style.background = '#ffdfdf';
      panel.style.borderColor = '#c1121f';
      panel.style.boxShadow = '0 0 0 4px rgba(193,18,31,0.25), 0 12px 30px rgba(0,0,0,0.25)';
    }
  }

  function stopTick() {
    if (window[TICK_KEY]) {
      clearTimeout(window[TICK_KEY]);
      window[TICK_KEY] = null;
    }
    localStorage.removeItem(STORAGE_ARMED);
  }

  function armSignal(target, leadMs) {
    stopTick();
    removeAlert();
    localStorage.setItem(STORAGE_TARGET, formatTime(target));
    localStorage.setItem(STORAGE_LEAD, String(leadMs));
    localStorage.setItem(STORAGE_ARMED, '1');

    function tick() {
      try {
        var now = getServerNow();
        var triggerAt = target.getTime() - leadMs;
        var remaining = target.getTime() - now.getTime();
        var signalIn = triggerAt - now.getTime();

        if (signalIn <= 0) {
          fireSignal(target);
          stopTick();
          return;
        }

        setStatus(
          'Ciel ' +
            formatTime(target) +
            ' | signal za ' +
            signalIn +
            ' ms | do ciela ' +
            remaining +
            ' ms',
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

    var savedTarget = localStorage.getItem(STORAGE_TARGET) || '';
    var savedLead = localStorage.getItem(STORAGE_LEAD) || '200';

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
      '<div style="font-size:13px;line-height:1.35;margin-bottom:10px;">Zadaj cas ciela podla <b>serverTime</b>. Script iba signalizuje, neodosiela sam.</div>' +
      '<input id="' + INPUT_ID + '" type="text" inputmode="numeric" placeholder="12:34:56:700" value="' + savedTarget + '" style="width:100%;box-sizing:border-box;font-size:18px;padding:10px;border-radius:10px;border:1px solid #b8894f;margin-bottom:8px;">' +
      '<input id="' + LEAD_ID + '" type="number" inputmode="numeric" placeholder="200" value="' + savedLead + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border-radius:10px;border:1px solid #b8894f;margin-bottom:8px;">' +
      '<div style="font-size:12px;margin-bottom:10px;color:#6b4f2a;">Pises len cisla. Cas sa sam formatuje. Predstih zacni na 200 ms.</div>' +
      '<div id="' + STATUS_ID + '" style="font-size:13px;margin-bottom:10px;color:#17324d;">Pripravene.</div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button id="twConfirmSignalStart" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#c96f2d;color:#fff;font-weight:700;">Spustit</button>' +
      '<button id="twConfirmSignalTest" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#b42318;color:#fff;font-weight:700;">Test</button>' +
      '<button id="twConfirmSignalStop" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#6b7280;color:#fff;font-weight:700;">Stop</button>' +
      '</div>';

    document.body.appendChild(wrap);

    var timeInput = document.getElementById(INPUT_ID);
    timeInput.addEventListener('input', function() {
      var normalized = normalizeTimeInput(timeInput.value);
      if (timeInput.value !== normalized) {
        timeInput.value = normalized;
      }
    });

    document.getElementById('twConfirmSignalStart').onclick = function() {
      try {
        var target = parseTarget(document.getElementById(INPUT_ID).value);
        var leadMs = Number(document.getElementById(LEAD_ID).value || 200);

        if (!Number.isFinite(leadMs) || leadMs < 0) {
          throw new Error('Predstih musi byt cislo 0 alebo viac.');
        }

        armSignal(target, Math.round(leadMs));
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
    };
  }

  try {
    ensureMsClock();
    buildOverlay();
  } catch (error) {
    alert('Chyba: ' + error.message);
  }
})();
