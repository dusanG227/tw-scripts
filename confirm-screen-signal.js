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

  function removeOverlay() {
    var node = document.getElementById(OVERLAY_ID);
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

    var now = new Date();
    now.setHours(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4] ? Number(match[4].padStart(3, '0')) : new Date().getMilliseconds()
    );
    return now;
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
    var target = new Date(now.getTime());
    target.setHours(
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

  function vibrateAndFlash() {
    var overlay = document.getElementById(OVERLAY_ID);

    if (navigator.vibrate) {
      navigator.vibrate([120, 80, 120]);
    }

    if (overlay) {
      overlay.style.background = '#ffdfdf';
      overlay.style.borderColor = '#c1121f';
      overlay.style.boxShadow = '0 0 0 4px rgba(193,18,31,0.25), 0 12px 30px rgba(0,0,0,0.25)';

      window.setTimeout(function() {
        if (!document.getElementById(OVERLAY_ID)) {
          return;
        }
        overlay.style.background = '#fff8e7';
        overlay.style.borderColor = '#c18b3b';
        overlay.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)';
      }, 400);
    }

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
      gain.gain.value = 0.03;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();

      window.setTimeout(function() {
        oscillator.stop();
        ctx.close();
      }, 180);
    } catch (error) {
      // Audio may be blocked on some devices until user gesture.
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
          vibrateAndFlash();
          setStatus(
            'SIGNAL TERAZ | ciel ' + formatTime(target) + ' | klikni rucne',
            '#c1121f'
          );
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

        window[TICK_KEY] = setTimeout(tick, signalIn > 200 ? 25 : 1);
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
    wrap.style.top = '12px';
    wrap.style.zIndex = '999999';
    wrap.style.background = '#fff8e7';
    wrap.style.border = '2px solid #c18b3b';
    wrap.style.borderRadius = '14px';
    wrap.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)';
    wrap.style.padding = '14px';
    wrap.style.fontFamily = 'Arial, sans-serif';
    wrap.style.color = '#2b2117';

    wrap.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px;">Confirm Screen Signal</div>' +
      '<div style="font-size:13px;line-height:1.35;margin-bottom:10px;">Zadaj cas ciela podla <b>serverTime</b>. Script iba signalizuje, neodosiela sam.</div>' +
      '<input id="' + INPUT_ID + '" type="text" inputmode="numeric" placeholder="12:34:56:700" value="' + savedTarget + '" style="width:100%;box-sizing:border-box;font-size:18px;padding:10px;border-radius:10px;border:1px solid #b8894f;margin-bottom:8px;">' +
      '<input id="' + LEAD_ID + '" type="number" inputmode="numeric" placeholder="200" value="' + savedLead + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border-radius:10px;border:1px solid #b8894f;margin-bottom:8px;">' +
      '<div style="font-size:12px;margin-bottom:10px;color:#6b4f2a;">Predstih signalu v ms. Zacni na 200 ms a potom doladime podla tvojej reakcie.</div>' +
      '<div id="' + STATUS_ID + '" style="font-size:13px;margin-bottom:10px;color:#17324d;">Pripravene.</div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button id="twConfirmSignalStart" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#c96f2d;color:#fff;font-weight:700;">Spustit</button>' +
      '<button id="twConfirmSignalStop" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#6b7280;color:#fff;font-weight:700;">Stop</button>' +
      '<button id="twConfirmSignalClose" style="flex:1;padding:10px 12px;border:none;border-radius:10px;background:#efe3d0;color:#2b2117;font-weight:700;">Zavriet</button>' +
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

    document.getElementById('twConfirmSignalStop').onclick = function() {
      stopTick();
      setStatus('Signal zastaveny.', '#b42318');
    };

    document.getElementById('twConfirmSignalClose').onclick = function() {
      wrap.remove();
    };
  }

  try {
    ensureMsClock();
    buildOverlay();
  } catch (error) {
    alert('Chyba: ' + error.message);
  }
})();
