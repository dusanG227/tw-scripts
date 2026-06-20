// Hungarian translation provided by =Krumpli=

if (typeof ScriptAPI !== 'undefined') {
  ScriptAPI.register('FarmGod', true, 'Warre', 'nl.tribalwars@coma.innogames.de');
}

window.FarmGod = {};
window.FarmGod.Library = (function () {
  /**** TribalWarsLibrary.js ****/
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () {
        if (this.queues === null) {
          this.queues = this.queueLib.createQueues(5);
        }
      },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) {
          this.action = action;
          this.arguments = arg;
          this.promise = promise;
          this.attempts = 0;
        },
        Queue: function () {
          this.list = [];
          this.working = false;
          this.length = 0;

          this.doNext = function () {
            let item = this.dequeue();
            let self = this;

            if (item.action == 'openWindow') {
              window
                .open(...item.arguments)
                .addEventListener('DOMContentLoaded', function () {
                  self.start();
                });
            } else {
              $[item.action](...item.arguments)
                .done(function () {
                  item.promise.resolve.apply(null, arguments);
                  self.start();
                })
                .fail(function () {
                  item.attempts += 1;
                  if (item.attempts < twLib.queueLib.maxAttempts) {
                    self.enqueue(item, true);
                  } else {
                    item.promise.reject.apply(null, arguments);
                  }
                  self.start();
                });
            }
          };

          this.start = function () {
            if (this.length) {
              this.working = true;
              this.doNext();
            } else {
              this.working = false;
            }
          };

          this.dequeue = function () {
            this.length -= 1;
            return this.list.shift();
          };

          this.enqueue = function (item, front = false) {
            front ? this.list.unshift(item) : this.list.push(item);
            this.length += 1;
            if (!this.working) {
              this.start();
            }
          };
        },
        createQueues: function (amount) {
          let arr = [];
          for (let i = 0; i < amount; i++) {
            arr[i] = new twLib.queueLib.Queue();
          }
          return arr;
        },
        addItem: function (item) {
          let leastBusyQueueIndex = twLib.queues.reduce(
            (leastIndex, queue, index, queues) =>
              queue.length < queues[leastIndex].length ? index : leastIndex,
            0
          );
          twLib.queues[leastBusyQueueIndex].enqueue(item);
        },
        orchestrator: function (type, arg) {
          let promise = $.Deferred();
          let item = new twLib.queueLib.Item(type, arg, promise);
          twLib.queueLib.addItem(item);
          return promise;
        },
      },
      ajax: function () {
        return twLib.queueLib.orchestrator('ajax', arguments);
      },
      get: function () {
        return twLib.queueLib.orchestrator('get', arguments);
      },
      post: function () {
        return twLib.queueLib.orchestrator('post', arguments);
      },
      openWindow: function () {
        let item = new twLib.queueLib.Item('openWindow', arguments);
        twLib.queueLib.addItem(item);
      },
    };

    twLib.init();
  }

  /**** Script Library ****/
  const setUnitSpeeds = function () {
    let unitSpeeds = {};
    $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
      $(xml)
        .find('config')
        .children()
        .map((i, el) => {
          unitSpeeds[$(el).prop('nodeName')] = $(el).find('speed').text().toNumber();
        });
      localStorage.setItem('FarmGod_unitSpeeds', JSON.stringify(unitSpeeds));
    });
  };

  const getUnitSpeeds = function () {
    return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false;
  };

  if (!getUnitSpeeds()) setUnitSpeeds();

  const determineNextPage = function (page, $html) {
    let villageLength =
      $html.find('#scavenge_mass_screen').length > 0
        ? $html.find('tr[id*="scavenge_village"]').length
        : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html
      .find('.paged-nav-item')
      .first()
      .closest('td')
      .find('select')
      .first();
    let navLength =
      $html.find('#am_widget_Farm').length > 0
        ? parseInt(
            $('#plunder_list_nav')
              .first()
              .find('a.paged-nav-item, strong.paged-nav-item')[
              $('#plunder_list_nav')
                .first()
                .find('a.paged-nav-item, strong.paged-nav-item').length - 1
            ].textContent.replace(/\D/g, '')
          ) - 1
        : navSelect.length > 0
        ? navSelect.find('option').length - 1
        : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
    let pageSize =
      $('#mobileHeader').length > 0
        ? 10
        : parseInt($html.find('input[name="page_size"]').val());

    if (page == -1 && villageLength == 1000) {
      return Math.floor(1000 / pageSize);
    } else if (page < navLength) {
      return page + 1;
    }
    return false;
  };

  const processPage = function (url, page, wrapFn) {
    let pageText = url.match('am_farm') ? `&Farm_page=${page}` : `&page=${page}`;
    return twLib.ajax({ url: url + pageText }).then((html) => {
      return wrapFn(page, $(html));
    });
  };

  const processAllPages = function (url, processorFn) {
    let page = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;
    let wrapFn = function (page, $html) {
      let dnp = determineNextPage(page, $html);
      if (dnp) {
        processorFn($html);
        return processPage(url, dnp, wrapFn);
      } else {
        return processorFn($html);
      }
    };
    return processPage(url, page, wrapFn);
  };

  const getDistance = function (origin, target) {
    let a = origin.toCoord(true).x - target.toCoord(true).x;
    let b = origin.toCoord(true).y - target.toCoord(true).y;
    return Math.hypot(a, b);
  };

  const subtractArrays = function (array1, array2) {
    let result = array1.map((val, i) => val - array2[i]);
    return result.some((v) => v < 0) ? false : result;
  };

  const getCurrentServerTime = function () {
    let [hour, min, sec, day, month, year] = $('#serverTime').closest('p').text().match(/\d+/g);
    return new Date(year, month - 1, day, hour, min, sec).getTime();
  };

  const timestampFromString = function (timestr) {
    let d = $('#serverDate').text().split('/').map((x) => +x);
    let todayPattern = new RegExp(
      window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace('%s', '([\\d+|:]+)')
    ).exec(timestr);
    let tomorrowPattern = new RegExp(
      window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace('%s', '([\\d+|:]+)')
    ).exec(timestr);
    let laterDatePattern = new RegExp(
      window.lang['0cb274c906d622fa8ce524bcfbb7552d']
        .replace('%1', '([\\d+|\\.]+)')
        .replace('%2', '([\\d+|:]+)')
    ).exec(timestr);
    let t, date;

    if (todayPattern !== null) {
      t = todayPattern[1].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    } else if (tomorrowPattern !== null) {
      t = tomorrowPattern[1].split(':');
      date = new Date(d[2], d[1] - 1, d[0] + 1, t[0], t[1], t[2], t[3] || 0);
    } else {
      d = (laterDatePattern[1] + d[2]).split('.').map((x) => +x);
      t = laterDatePattern[2].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    }
    return date.getTime();
  };

  String.prototype.toCoord = function (objectified) {
    let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop();
    return c && objectified ? { x: c.split('|')[0], y: c.split('|')[1] } : c;
  };

  String.prototype.toNumber = function () {
    return parseFloat(this);
  };

  Number.prototype.toNumber = function () {
    return parseFloat(this);
  };

  return {
    getUnitSpeeds,
    processPage,
    processAllPages,
    getDistance,
    subtractArrays,
    getCurrentServerTime,
    timestampFromString,
  };
})();

window.FarmGod.Translation = (function () {
  const msg = {
    nl_NL: {
      missingFeatures: 'Script vereist een premium account en farm assistent!',
      options: {
        title: 'FarmGod Opties',
        warning: '<b>Waarschuwingen:</b><br>- Zorg dat A is ingesteld als je standaard microfarm en B als een grotere microfarm<br>- Zorg dat de farm filters correct zijn ingesteld voor je het script gebruikt',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Uit welke groep moet er gefarmd worden:',
        excludeGroups: 'Verstuur geen farms vanuit dorpen in deze groepen:',
        excludeGroupsHint: 'Dorpen die ook in een aangevinkte groep zitten, worden overgeslagen.',
        distance: 'Maximaal aantal velden dat farms mogen lopen:',
        time: 'Hoe veel tijd in minuten moet er tussen farms zitten:',
        losses: 'Verstuur farm naar dorpen met gedeeltelijke verliezen:',
        maxloot: 'Verstuur een B farm als de buit vorige keer vol was:',
        newbarbs: 'Voeg nieuwe barbarendorpen toe om te farmen:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned: 'Er kunnen met de opgegeven instellingen geen farms verstuurd worden.',
        origin: 'Oorsprong',
        target: 'Doel',
        fields: 'Velden',
        farm: 'Farm',
        goTo: 'Ga naar',
      },
      messages: {
        villageChanged: 'Succesvol van dorp veranderd!',
        villageError: 'Alle farms voor het huidige dorp zijn reeds verstuurd!',
        sendError: 'Error: farm niet verstuurd!',
        sendDelayed:
          'Een farm is niet op tijd bevestigd. Deze rij blijft gemarkeerd en FarmGod gaat verder.',
        sendPaused:
          'FarmGod is gepauzeerd omdat meerdere farms nog onbevestigd zijn. Controleer je uitgaande aanvallen.',
        sendRecovered: 'Vertraagde aanvraag bevestigd, FarmGod gaat verder.',
        sendRetrying: 'FarmGod probeert de overgeslagen farms nog een keer aan het einde.',
        sendSkipped:
          'Een farm kon niet bevestigd worden en is gemarkeerd. FarmGod gaat verder met de rest.',
      },
    },
    hu_HU: {
      missingFeatures: 'A scriptnek sz\u00FCks\u00E9ge van Pr\u00E9mium fi\u00F3kra \u00E9s FarmkezelÅ\u0151re!',
      options: {
        title: 'FarmGod opci\u00F3k',
        warning: '<b>Figyelem:</b><br>- Bizonyosodj meg r\u00F3la, hogy az "A" sablon az alap\u00E9rtelmezett \u00E9s a "B" egy nagyobb mennyis\u00E9g\u0171 mikr\u00F3-farm<br>- Bizonyosodj meg r\u00F3la, hogy a farm-filterek megfelel\u0151en vannak be\u00E1ll\u00EDtva miel\u0151tt haszn\u00E1lod a sctiptet',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters_HU.png',
        group: 'Ebb\u0151l a csoportb\u00F3l k\u00FClje:',
        excludeGroups: 'Ne kuldjon farmot az ezekben a csoportokban levo falvakbol:',
        excludeGroupsHint: 'Ha a falu egy bejelolt csoportban is benne van, ki lesz hagyva.',
        distance: 'Maxim\u00E1lis mez\u0151 t\u00E1vols\u00E1g:',
        time: 'Mekkora id\u0151intervallumban k\u00FClje a t\u00E1mad\u00E1sokat percben:',
        losses: 'K\u00FCldj\u00F6n t\u00E1mad\u00E1st olyan falvakba ahol r\u00E9szleges vesztes\u00E9ggel j\u00E1rhat a t\u00E1mad\u00E1s:',
        maxloot: 'A "B" sablont k\u00FClje abban az esetben, ha az el\u0151z\u0151 t\u00E1mad\u00E1s maxim\u00E1lis fosztogat\u00E1ssal j\u00E1rt:',
        newbarbs: 'Adj hozz\u00E1 \u00FAj barb\u00E1r falukat:',
        button: 'Farm megtervez\u00E9se',
      },
      table: {
        noFarmsPlanned: 'A jelenlegi be\u00E1ll\u00EDt\u00E1sokkal nem lehet \u00FAj t\u00E1mad\u00E1st kik\u00FCldeni.',
        origin: 'Origin',
        target: 'C\u00E9lpont',
        fields: 'T\u00E1vols\u00E1g',
        farm: 'Farm',
        goTo: 'Go to',
      },
      messages: {
        villageChanged: 'Falu sikeresen megv\u00E1ltoztatva!',
        villageError: 'Minden farm kiment a jelenlegi falub\u00F3l!',
        sendError: 'Hiba: Farm nemvolt elk\u00FCldve!',
        sendDelayed:
          'Egy farm nincs idoben megerositve. A sor megjelolve marad, a FarmGod pedig tovabb megy.',
        sendPaused:
          'A FarmGod megallt, mert egyszerre tobb farm maradt megerosites nelkul. Ellenorizd a kimeno tamadasokat.',
        sendRecovered: 'A kesleltetett kuldes megerositve, a FarmGod folytatja.',
        sendRetrying: 'A FarmGod a vegen meg egyszer megprobalja a kihagyott farmokat.',
        sendSkipped:
          'Egy farmot nem sikerult megerositeni, ezert meg lett jelolve. A FarmGod tovabb megy a tobbivel.',
      },
    },
    int: {
      missingFeatures: 'Script requires a premium account and loot assistent!',
      options: {
        title: 'FarmGod Options',
        warning: '<b>Warning:</b><br>- Make sure A is set as your default microfarm and B as a larger microfarm<br>- Make sure the farm filters are set correctly before using the script',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Send farms from group:',
        excludeGroups: 'Do not send farms from villages in these groups:',
        excludeGroupsHint: 'If a village is also in one of the checked groups, it will be skipped.',
        distance: 'Maximum fields for farms:',
        time: 'How much time in minutes should there be between farms:',
        losses: 'Send farm to villages with partial losses:',
        maxloot: 'Send a B farm if the last loot was full:',
        newbarbs: 'Add new barbs te farm:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned: 'No farms can be sent with the specified settings.',
        origin: 'Origin',
        target: 'Target',
        fields: 'fields',
        farm: 'Farm',
        goTo: 'Go to',
      },
      messages: {
        villageChanged: 'Successfully changed village!',
        villageError: 'All farms for the current village have been sent!',
        sendError: 'Error: farm not send!',
        sendDelayed:
          'A farm was not confirmed in time. The row stays marked and FarmGod continues with the rest.',
        sendPaused:
          'FarmGod paused because multiple farms are still unconfirmed. Check outgoing commands.',
        sendRecovered: 'Delayed request confirmed, FarmGod resumed.',
        sendRetrying: 'FarmGod is retrying the skipped farms once at the end.',
        sendSkipped:
          'A farm could not be confirmed and stays marked. FarmGod continues with the rest.',
      },
    },
  };

  const get = function () {
    let lang = msg.hasOwnProperty(game_data.locale) ? game_data.locale : 'int';
    return msg[lang];
  };

  return { get };
})();

window.FarmGod.Main = (function (Library, Translation) {
  const lib = Library;
  const t = Translation.get();
  let curVillage = null;

  const SEND_MIN_DELAY_MS = 180;
  const SEND_MAX_DELAY_MS = 220;
  const SEND_STALL_TIMEOUT_MS = 12000;
  const FINAL_RETRY_GRACE_MS = 15000;
  const MAX_UNCERTAIN_SENDS = 2;

  // Keep the original pace, but never allow more than one active send request at a time.
  let sendQueue = [];
  let retryQueue = [];
  let sendTimer = null;
  let sendWatchdog = null;
  let finalRetryTimer = null;
  let pauseRecoveryTimer = null;
  let sendInFlight = false;
  let sendPaused = false;
  let finalRetryScheduled = false;
  let currentSend = null;
  let currentSendStartedAt = 0;
  let currentSendDelay = 0;
  let currentSendAttemptId = 0;
  let currentSendTimedOut = false;
  let nextSendAttemptId = 0;
  let activeSendRun = 0;
  let queuedSendKeys = {};
  let retryQueuedKeys = {};
  let retriedSendKeys = {};
  let finishedSendKeys = {};
  let uncertainSendKeys = {};

  const buildSendKey = function (origin, target, template) {
    return [origin, target, template].join('-');
  };

  const getRandomSendDelay = function () {
    return SEND_MIN_DELAY_MS + Math.floor(Math.random() * (SEND_MAX_DELAY_MS - SEND_MIN_DELAY_MS + 1));
  };

  const getSendIcon = function (item) {
    return $(`.farmGod_icon[data-farmgod-key="${item.key}"]`).first();
  };

  const updateProgressBar = function () {
    let $pb = $('#FarmGodProgessbar');
    if ($pb.length === 0) return;
    $pb.data('current', $pb.data('current') + 1);
    UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));
  };

  const extractSendItem = function ($icon) {
    if (!$icon || $icon.length === 0) return null;

    let origin = parseInt($icon.data('origin'), 10);
    let target = parseInt($icon.data('target'), 10);
    let template = parseInt($icon.data('template'), 10);

    if ([origin, target, template].some((value) => Number.isNaN(value))) {
      return null;
    }

    let key = buildSendKey(origin, target, template);
    $icon.attr('data-farmgod-key', key);
    return { key, origin, target, template };
  };

  const markSendRow = function (item, state) {
    let $row = getSendIcon(item).closest('.farmRow');
    if ($row.length === 0) return;

    if (state === 'sending') {
      $row.css({ opacity: 0.65, background: '' });
    } else if (state === 'warning') {
      $row.css({ opacity: 1, background: '#f3e7b3' });
    } else if (state === 'error') {
      $row.css({ opacity: 1, background: '#f4d6d6' });
    } else {
      $row.css({ opacity: 1, background: '' });
    }
  };

  const getUncertainSendCount = function () {
    return Object.keys(uncertainSendKeys).length;
  };

  const clearSendTimer = function () {
    if (sendTimer) {
      clearTimeout(sendTimer);
      sendTimer = null;
    }
  };

  const clearSendWatchdog = function () {
    if (sendWatchdog) {
      clearTimeout(sendWatchdog);
      sendWatchdog = null;
    }
  };

  const clearFinalRetryTimer = function () {
    if (finalRetryTimer) {
      clearTimeout(finalRetryTimer);
      finalRetryTimer = null;
    }
    finalRetryScheduled = false;
  };

  const clearPauseRecoveryTimer = function () {
    if (pauseRecoveryTimer) {
      clearTimeout(pauseRecoveryTimer);
      pauseRecoveryTimer = null;
    }
  };

  const resetSendState = function () {
    activeSendRun += 1;
    clearSendTimer();
    clearSendWatchdog();
    clearFinalRetryTimer();
    clearPauseRecoveryTimer();
    sendQueue = [];
    retryQueue = [];
    sendInFlight = false;
    sendPaused = false;
    currentSend = null;
    currentSendStartedAt = 0;
    currentSendDelay = 0;
    currentSendAttemptId = 0;
    currentSendTimedOut = false;
    nextSendAttemptId = 0;
    queuedSendKeys = {};
    retryQueuedKeys = {};
    retriedSendKeys = {};
    finishedSendKeys = {};
    uncertainSendKeys = {};
  };

  const enqueueSend = function ($icon, front = false) {
    let item = extractSendItem($icon);
    if (!item) return false;
    if (
      finishedSendKeys[item.key] ||
      queuedSendKeys[item.key] ||
      (currentSend && currentSend.key === item.key)
    ) {
      return false;
    }

    front ? sendQueue.unshift(item) : sendQueue.push(item);
    queuedSendKeys[item.key] = true;
    return true;
  };

  const enqueueFinalRetry = function (item) {
    if (
      !item ||
      finishedSendKeys[item.key] ||
      retryQueuedKeys[item.key] ||
      retriedSendKeys[item.key]
    ) {
      return false;
    }

    retryQueue.push({
      key: item.key,
      origin: item.origin,
      target: item.target,
      template: item.template,
    });
    retryQueuedKeys[item.key] = true;
    return true;
  };

  const getRemainingDelay = function () {
    let elapsed = Date.now() - currentSendStartedAt;
    return Math.max(0, currentSendDelay - elapsed);
  };

  const finishCurrentSend = function () {
    sendInFlight = false;
    currentSend = null;
    currentSendStartedAt = 0;
    currentSendDelay = 0;
    currentSendAttemptId = 0;
    currentSendTimedOut = false;
  };

  const startFinalRetryPass = function () {
    clearFinalRetryTimer();
    clearPauseRecoveryTimer();
    if (sendInFlight || sendQueue.length > 0 || retryQueue.length === 0) {
      return;
    }

    let pendingRetries = retryQueue.filter((item) => {
      if (finishedSendKeys[item.key] || queuedSendKeys[item.key]) return false;
      let $icon = getSendIcon(item);
      return $icon.length > 0 && $icon.closest('.farmRow').length > 0;
    });

    retryQueue = [];
    retryQueuedKeys = {};

    if (pendingRetries.length === 0) {
      return;
    }

    pendingRetries.forEach((item) => {
      retriedSendKeys[item.key] = true;
      sendQueue.push(item);
      queuedSendKeys[item.key] = true;
      markSendRow(item, 'warning');
    });

    sendPaused = false;
    UI.SuccessMessage(t.messages.sendRetrying || 'FarmGod is retrying skipped farms once at the end.');
    scheduleNextSend(SEND_MIN_DELAY_MS);
  };

  const scheduleFinalRetryPass = function (delay = FINAL_RETRY_GRACE_MS) {
    if (
      finalRetryScheduled ||
      sendInFlight ||
      sendQueue.length > 0 ||
      retryQueue.length === 0
    ) {
      return;
    }

    finalRetryScheduled = true;
    finalRetryTimer = setTimeout(() => {
      finalRetryScheduled = false;
      finalRetryTimer = null;
      startFinalRetryPass();
    }, Math.max(0, delay));
  };

  const continueQueue = function (delay = SEND_MIN_DELAY_MS) {
    if (!sendInFlight && !sendPaused && sendQueue.length > 0) {
      scheduleNextSend(delay);
    } else if (!sendInFlight && sendQueue.length === 0) {
      scheduleFinalRetryPass();
    }
  };

  const schedulePauseRecovery = function () {
    if (pauseRecoveryTimer) {
      return;
    }

    pauseRecoveryTimer = setTimeout(() => {
      pauseRecoveryTimer = null;
      if (!sendPaused || sendInFlight) {
        return;
      }

      sendPaused = false;
      continueQueue(SEND_MIN_DELAY_MS);
    }, FINAL_RETRY_GRACE_MS);
  };

  const tryResumeAfterUncertain = function (delay = SEND_MIN_DELAY_MS) {
    if (sendPaused && getUncertainSendCount() < MAX_UNCERTAIN_SENDS) {
      sendPaused = false;
      clearPauseRecoveryTimer();
    }
    if (!sendPaused && !sendInFlight && sendQueue.length > 0) {
      scheduleNextSend(delay);
    } else if (!sendInFlight && sendQueue.length === 0) {
      scheduleFinalRetryPass();
    }
  };

  const startSendWatchdog = function (item, runId, attemptId) {
    clearSendWatchdog();
    sendWatchdog = setTimeout(() => {
      if (
        runId !== activeSendRun ||
        !sendInFlight ||
        !currentSend ||
        currentSend.key !== item.key ||
        currentSendAttemptId !== attemptId
      ) {
        return;
      }

      let remainingDelay = getRemainingDelay();
      currentSendTimedOut = true;
      uncertainSendKeys[item.key] = true;
      enqueueFinalRetry(item);
      markSendRow(item, 'warning');
      clearSendWatchdog();
      finishCurrentSend();

      if (getUncertainSendCount() >= MAX_UNCERTAIN_SENDS) {
        sendPaused = true;
        UI.ErrorMessage(t.messages.sendPaused || 'FarmGod paused after multiple slow requests.');
        schedulePauseRecovery();
        return;
      }

      UI.ErrorMessage(t.messages.sendDelayed || 'A farm was not confirmed in time.');
      continueQueue(remainingDelay);
    }, SEND_STALL_TIMEOUT_MS);
  };

  const scheduleNextSend = function (delay = 0) {
    clearSendTimer();
    clearFinalRetryTimer();
    if (sendPaused || sendInFlight || sendQueue.length === 0) {
      return;
    }

    sendTimer = setTimeout(fireNext, Math.max(0, delay));
  };

  const getSendErrorText = function (error) {
    if (!error) return t.messages.sendError;
    if (typeof error === 'string') return error;
    if (typeof error.error === 'string') return error.error;
    if (typeof error.message === 'string') return error.message;
    if (typeof error.responseText === 'string' && error.responseText.trim()) {
      return error.responseText;
    }
    return t.messages.sendError;
  };

  const handleSendSuccess = function (item, response, runId, attemptId) {
    if (runId !== activeSendRun) return;

    let wasCurrent =
      currentSend &&
      currentSend.key === item.key &&
      currentSendAttemptId === attemptId;
    let remainingDelay = wasCurrent ? getRemainingDelay() : SEND_MIN_DELAY_MS;
    let wasTimedOut = !!uncertainSendKeys[item.key] || (wasCurrent && currentSendTimedOut);

    if (finishedSendKeys[item.key]) {
      if (wasCurrent) {
        clearSendWatchdog();
        finishCurrentSend();
        continueQueue(remainingDelay);
      }
      return;
    }

    if (wasCurrent) {
      clearSendWatchdog();
      finishCurrentSend();
    }

    if (uncertainSendKeys[item.key]) {
      delete uncertainSendKeys[item.key];
    }
    if (retryQueuedKeys[item.key]) {
      delete retryQueuedKeys[item.key];
    }

    finishedSendKeys[item.key] = true;
    markSendRow(item, '');
    updateProgressBar();
    getSendIcon(item).closest('.farmRow').remove();

    if (response && response.success) {
      UI.SuccessMessage(response.success);
    }
    if (wasTimedOut) {
      UI.SuccessMessage(t.messages.sendRecovered || 'Delayed request confirmed, resuming.');
    }

    if (wasCurrent) {
      continueQueue(remainingDelay);
    } else {
      tryResumeAfterUncertain();
    }
  };

  const handleSendFailure = function (item, error, runId, attemptId) {
    if (runId !== activeSendRun) return;

    let wasCurrent =
      currentSend &&
      currentSend.key === item.key &&
      currentSendAttemptId === attemptId;
    let remainingDelay = wasCurrent ? getRemainingDelay() : SEND_MIN_DELAY_MS;

    if (finishedSendKeys[item.key]) {
      if (wasCurrent) {
        clearSendWatchdog();
        finishCurrentSend();
        continueQueue(remainingDelay);
      }
      return;
    }

    if (wasCurrent) {
      clearSendWatchdog();
      finishCurrentSend();
    }

    if (uncertainSendKeys[item.key]) {
      delete uncertainSendKeys[item.key];
    }
    enqueueFinalRetry(item);

    markSendRow(item, 'error');
    let errorText = getSendErrorText(error);
    let continueText = t.messages.sendSkipped || 'A farm could not be confirmed and was marked.';
    UI.ErrorMessage(
      errorText && errorText !== t.messages.sendError ? `${errorText} ${continueText}` : continueText
    );

    if (wasCurrent) {
      continueQueue(remainingDelay);
    } else {
      tryResumeAfterUncertain();
    }
  };

  const fireNext = function () {
    clearSendTimer();
    if (sendPaused || sendInFlight) {
      return;
    }

    while (sendQueue.length > 0) {
      let item = sendQueue.shift();
      delete queuedSendKeys[item.key];

      if (finishedSendKeys[item.key]) {
        continue;
      }

      let $icon = getSendIcon(item);
      if ($icon.length === 0 || $icon.closest('.farmRow').length === 0) {
        continue;
      }

      sendInFlight = true;
      currentSend = item;
      currentSendStartedAt = Date.now();
      currentSendDelay = getRandomSendDelay();
      currentSendAttemptId = ++nextSendAttemptId;
      currentSendTimedOut = false;
      markSendRow(item, 'sending');

      let runId = activeSendRun;
      let attemptId = currentSendAttemptId;
      startSendWatchdog(item, runId, attemptId);
      executeSend(item, runId, attemptId)
        .done((response) => handleSendSuccess(item, response, runId, attemptId))
        .fail((error) => handleSendFailure(item, error, runId, attemptId));
      return;
    }

    scheduleFinalRetryPass();
  };

  const startSendQueue = function () {
    if (sendTimer || sendInFlight || sendPaused) return;
    scheduleNextSend();
  };

  const cleanupLegacyUi = function () {
    $('#farmGodScrollControls, .farmGodScrollBtn, .farmGodBottomSpacer').remove();
  };

  const init = function () {
    cleanupLegacyUi();
    resetSendState();

    if (
      game_data.features.Premium.active &&
      game_data.features.FarmAssistent.active
    ) {
      if (game_data.screen == 'am_farm') {
        $.when(buildOptions()).then((html) => {
          Dialog.show('FarmGod', html);

          $('.optionGroup')
            .off('change.farmGod')
            .on('change.farmGod', syncExcludedGroupInputs);
          syncExcludedGroupInputs();

          $('.optionButton')
            .off('click')
            .on('click', () => {
              resetSendState();

              let optionGroup = parseInt($('.optionGroup').val(), 10);
              let optionDistance = parseFloat($('.optionDistance').val());
              let optionTime = parseFloat($('.optionTime').val());
              let optionLosses = $('.optionLosses').prop('checked');
              let optionMaxloot = $('.optionMaxloot').prop('checked');
              let optionNewbarbs = $('.optionNewbarbs').prop('checked') || false;
              let optionExcludedGroups = $('.optionExcludeGroup:checked')
                .map((i, el) => parseInt($(el).val(), 10))
                .get()
                .filter((groupId) => !Number.isNaN(groupId) && groupId !== optionGroup);

              localStorage.setItem(
                'farmGod_options',
                JSON.stringify({
                  optionGroup,
                  optionExcludedGroups,
                  optionDistance,
                  optionTime,
                  optionLosses,
                  optionMaxloot,
                  optionNewbarbs,
                })
              );

              cleanupLegacyUi();
              $('.optionsContent').html(buildLoadingContent());
              getData(
                optionGroup,
                optionExcludedGroups,
                optionNewbarbs,
                optionLosses,
                optionTime
              ).then((data) => {
                Dialog.close();
                let plan = createPlanning(optionDistance, optionTime, optionMaxloot, data);
                $('.farmGodContent').remove();
                $('#am_widget_Farm').first().before(buildTable(plan.farms));
                bindEventHandlers();
                UI.InitProgressBars();
                UI.updateProgressBar($('#FarmGodProgessbar'), 0, plan.counter);
                $('#FarmGodProgessbar').data('current', 0).data('max', plan.counter);

                // Auto-enqueue all planned farm icons
                $('.farmGod_icon').each(function () {
                  enqueueSend($(this));
                });
                startSendQueue();
              });
            });

          document.querySelector('.optionButton').focus();
        });
      } else {
        location.href = game_data.link_base_pure + 'am_farm';
      }
    } else {
      UI.ErrorMessage(t.missingFeatures);
    }
  };

  const bindEventHandlers = function () {
    $('.switchVillage')
      .off('click')
      .on('click', function () {
        curVillage = $(this).data('id');
        UI.SuccessMessage(t.messages.villageChanged);
        $(this).closest('tr').remove();
      });
  };

  const syncExcludedGroupInputs = function () {
    let selectedGroup = parseInt($('.optionGroup').val(), 10);

    $('.optionExcludeGroup').each((i, el) => {
      let $el = $(el);
      let isSelectedGroup = parseInt($el.val(), 10) === selectedGroup;

      $el.prop('disabled', isSelectedGroup);
      if (isSelectedGroup) $el.prop('checked', false);
      $el.closest('label').css('opacity', isSelectedGroup ? 0.5 : 1);
    });
  };

  const buildLoadingContent = function () {
    let fallbackThrobber =
      typeof UI !== 'undefined' && UI.Throbber && UI.Throbber[0]
        ? UI.Throbber[0].outerHTML
        : '';
    let loadingMessages = [
      'Zasa farmíš, ty kokot?',
      'Keď nevieš, čo poslať, pošli všetko.',
      'Neutečieš, bo kone už idú.',
      'Kone bez STK.',
      'Fast & Furious: Koňská edícia.',
      'Suroviny majú nový domov.',
      'Ľem kus dreva, kus hliny, kus železa.',
      'Barbarka = bankomat bez PINu.'
    ];
    let loadingUnits = [
      ['graphic/unit/unit_light.png', 'graphic/unit/unit_axe.png'],
      ['graphic/unit/unit_sword.png', 'graphic/unit/unit_ram.png'],
      ['graphic/unit/unit_spy.png', 'graphic/unit/unit_light.png']
    ];
    let loadingImage = 'data:image/jpeg;base64,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';
    let loadingMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
    let loadingUnitPair = loadingUnits[Math.floor(Math.random() * loadingUnits.length)];

    return `<style>
              .farmGodLoadingCard{
                width:min(94%, 348px);
                margin:0 auto;
                padding:20px 18px 18px;
                border:1px solid #b7893f;
                border-radius:14px;
                background:
                  radial-gradient(circle at 50% 0%, rgba(255, 180, 75, 0.22), transparent 36%),
                  linear-gradient(180deg, #21110d 0%, #0d090a 58%, #050405 100%);
                box-shadow:0 10px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,214,146,0.08);
                color:#f6e7bf;
              }
              .farmGodLoadingTitle{
                font-size:34px;
                line-height:1.1;
                font-weight:800;
                letter-spacing:1.5px;
                color:#fff0c5;
                text-shadow:0 0 2px rgba(255,255,255,0.35), 0 2px 10px rgba(0,0,0,0.9), 0 0 18px rgba(184,95,26,0.4);
              }
              .farmGodLoadingSubtitle{
                margin-top:7px;
                font-size:13px;
                font-weight:700;
                letter-spacing:2.4px;
                text-transform:uppercase;
                color:#d4a45a;
                text-shadow:0 1px 4px rgba(0,0,0,0.85);
              }
              .farmGodBattleIcons{
                position:relative;
                width:196px;
                height:132px;
                margin:14px auto 12px;
              }
              .farmGodLoadingPhoto{
                width:100%;
                max-width:292px;
                aspect-ratio:1/1;
                margin:14px auto 12px;
                border:1px solid rgba(233, 197, 120, 0.42);
                border-radius:12px;
                overflow:hidden;
                background:#080607;
                box-shadow:0 8px 22px rgba(0,0,0,0.5), 0 0 18px rgba(255, 126, 32, 0.18);
              }
              .farmGodLoadingPhoto img{
                display:block;
                width:100%;
                height:100%;
                object-fit:cover;
              }
              .farmGodBattleIcons img{
                position:absolute;
                top:14px;
                left:50px;
                width:96px;
                height:96px;
                transform-origin:50% 72%;
                image-rendering:-webkit-optimize-contrast;
                image-rendering:crisp-edges;
                filter:contrast(1.15) saturate(1.1) drop-shadow(0 5px 10px rgba(0,0,0,0.75));
              }
              .farmGodBladeLeft{
                transform:rotate(-30deg);
                animation:farmGodBladeLeft 1.25s ease-in-out infinite alternate;
              }
              .farmGodBladeRight{
                transform:rotate(30deg);
                animation:farmGodBladeRight 1.25s ease-in-out infinite alternate;
              }
              .farmGodBattleSpark{
                position:absolute;
                left:50%;
                top:50%;
                width:28px;
                height:28px;
                margin:-14px 0 0 -14px;
                border-radius:50%;
                background:radial-gradient(circle, rgba(255,245,196,1) 0%, rgba(255,202,90,0.95) 28%, rgba(255,110,25,0.52) 56%, rgba(255,130,30,0) 76%);
                animation:farmGodBattleSpark 1s ease-in-out infinite;
                box-shadow:0 0 18px rgba(255, 166, 52, 0.45);
              }
              .farmGodLoadingBar{
                overflow:hidden;
                height:12px;
                margin-top:14px;
                border:1px solid rgba(233, 197, 120, 0.42);
                border-radius:999px;
                background:rgba(8, 6, 7, 0.88);
                box-shadow:inset 0 1px 5px rgba(0,0,0,0.65);
              }
              .farmGodLoadingBarInner{
                width:42%;
                height:100%;
                border-radius:999px;
                background:linear-gradient(90deg, #5d0f10 0%, #ba3f22 30%, #ffb24a 70%, #fff1b7 100%);
                box-shadow:0 0 14px rgba(255, 157, 56, 0.68);
                animation:farmGodLoadingBar 1.45s ease-in-out infinite;
              }
              .farmGodLoadingHint{
                margin-top:12px;
                font-size:12px;
                color:#bba792;
                text-shadow:0 1px 3px rgba(0,0,0,0.7);
              }
              @keyframes farmGodBladeLeft{
                0%{transform:rotate(-38deg) translateY(2px);}
                100%{transform:rotate(-22deg) translateY(-2px);}
              }
              @keyframes farmGodBladeRight{
                0%{transform:rotate(38deg) translateY(2px);}
                100%{transform:rotate(22deg) translateY(-2px);}
              }
              @keyframes farmGodBattleSpark{
                0%, 100%{transform:scale(0.75); opacity:0.5;}
                50%{transform:scale(1.2); opacity:1;}
              }
              @keyframes farmGodLoadingBar{
                0%{transform:translateX(-110%);}
                100%{transform:translateX(310%);}
              }
            </style>
            <div class="farmGodLoading" style="display:flex;flex:1;align-items:center;justify-content:center;min-height:220px;padding:24px 0;">
              <div class="farmGodLoadingCard">
                <div class="farmGodLoadingTitle">El-Cigino</div>
                <div class="farmGodLoadingSubtitle">${loadingMessage}</div>
                <div class="farmGodLoadingPhoto">
                  <img src="${loadingImage}" alt="">
                </div>
                <div class="farmGodBattleIcons" style="display:none;">
                  <img class="farmGodBladeLeft" src="${loadingUnitPair[0]}" alt="">
                  <img class="farmGodBladeRight" src="${loadingUnitPair[1]}" alt="">
                </div>
                <div class="farmGodLoadingBar">
                  <div class="farmGodLoadingBarInner"></div>
                </div>
                <div class="farmGodLoadingHint">FarmGod nakladá ďalšiu návštevu.</div>
              </div>
              <div style="display:none;">${fallbackThrobber}</div>
            </div>`;
  };

  const executeSend = function (item, runId, attemptId) {
    let deferred = $.Deferred();
    void attemptId;

    TribalWars.post(
      Accountmanager.send_units_link.replace(/village=(\d+)/, 'village=' + item.origin),
      null,
      {
        target: item.target,
        template_id: item.template,
        source: item.origin,
      },
      function (response) {
        if (runId !== activeSendRun) return;
        deferred.resolve(response);
      },
      function (error) {
        if (runId !== activeSendRun) return;
        deferred.reject(error);
      }
    );

    return deferred.promise();
  };

  const buildOptions = function () {
    let options = JSON.parse(localStorage.getItem('farmGod_options')) || {
      optionGroup: 0,
      optionExcludedGroups: [],
      optionDistance: 25,
      optionTime: 10,
      optionLosses: false,
      optionMaxloot: true,
      optionNewbarbs: true,
    };
    let checkboxSettings = [false, true, true, true, false];
    let checkboxError = $('#plunder_list_filters')
      .find('input[type="checkbox"]')
      .map((i, el) => $(el).prop('checked') != checkboxSettings[i])
      .get()
      .includes(true);
    let $templateRows = $('form[action*="action=edit_all"]')
      .find('input[type="hidden"][name*="template"]')
      .closest('tr');
    let templateError =
      $templateRows.first().find('td').last().text().toNumber() >=
      $templateRows.last().find('td').last().text().toNumber();

    return $.when(
      buildGroupSelectors(options.optionGroup, options.optionExcludedGroups)
    ).then(({ groupSelect, excludeGroupList }) => {
      return `<style>
                #popup_box_FarmGod{
                  text-align:center;
                  width:620px;
                  max-width:calc(100vw - 16px);
                  box-sizing:border-box;
                }
                #popup_box_FarmGod h3{
                  margin:0;
                  padding:4px 32px 0;
                }
                #popup_box_FarmGod .optionsContent{
                  display:flex;
                  flex-direction:column;
                  max-height:calc(100vh - 150px);
                }
                #popup_box_FarmGod .farmGodScrollArea{
                  overflow-y:auto;
                  overflow-x:hidden;
                  -webkit-overflow-scrolling:touch;
                  padding:12px 2px 0;
                }
                #popup_box_FarmGod .farmGodActionBar{
                  position:sticky;
                  bottom:0;
                  background:#F7EED6;
                  padding:10px 0 calc(10px + env(safe-area-inset-bottom));
                }
                @media (max-width: 700px){
                  #popup_box_FarmGod{
                    position:fixed !important;
                    left:8px !important;
                    right:8px !important;
                    top:8px !important;
                    bottom:92px !important;
                    width:auto !important;
                    max-width:none !important;
                    margin:0 !important;
                    overflow:hidden !important;
                    box-sizing:border-box;
                  }
                  #popup_box_FarmGod .optionsContent{
                    max-height:none;
                    height:100%;
                  }
                  #popup_box_FarmGod .farmGodScrollArea{
                    padding-top:8px;
                    padding-bottom:8px;
                  }
                }
              </style>
              <h3>${t.options.title}</h3><div class="optionsContent"><div class="farmGodScrollArea">
              ${
                checkboxError || templateError
                  ? `<div class="info_box" style="line-height:15px;font-size:10px;text-align:left;"><p style="margin:0px 5px;">${t.options.warning}<br><img src="${t.options.filterImage}" style="width:100%;"></p></div><br>`
                  : ``
              }
              <div style="width:90%;margin:auto;background:url('graphic/index/main_bg.jpg') 100% 0% #E3D5B3;border:1px solid #7D510F;border-collapse:separate !important;border-spacing:0px !important;"><table class="vis" style="width:100%;text-align:left;font-size:11px;">
                <tr><td>${t.options.group}</td><td>${groupSelect}</td></tr>
                <tr><td style="vertical-align:top;">${t.options.excludeGroups}</td><td>${excludeGroupList}<div style="margin-top:4px;font-size:10px;line-height:14px;">${t.options.excludeGroupsHint}</div></td></tr>
                <tr><td>${t.options.distance}</td><td><input type="text" size="5" class="optionDistance" value="${options.optionDistance}"></td></tr>
                <tr><td>${t.options.time}</td><td><input type="text" size="5" class="optionTime" value="${options.optionTime}"></td></tr>
                <tr><td>${t.options.losses}</td><td><input type="checkbox" class="optionLosses" ${options.optionLosses ? 'checked' : ''}></td></tr>
                <tr><td>${t.options.maxloot}</td><td><input type="checkbox" class="optionMaxloot" ${options.optionMaxloot ? 'checked' : ''}></td></tr>
                ${
                  game_data.market == 'nl'
                    ? `<tr><td>${t.options.newbarbs}</td><td><input type="checkbox" class="optionNewbarbs" ${options.optionNewbarbs ? 'checked' : ''}></td></tr>`
                    : ''
                }
              </table></div></div><div class="farmGodActionBar"><input type="button" class="btn optionButton" value="${t.options.button}"></div></div>`;
    });
  };

  const buildGroupSelectors = function (id, excludedIds = []) {
    return $.get(
      TribalWars.buildURL('GET', 'groups', { ajax: 'load_group_menu' })
    ).then((groups) => {
      let groupSelect = `<select class="optionGroup">`;
      let excludeGroupList = `<div class="farmGodExcludedGroups" style="max-height:140px;overflow-y:auto;border:1px solid #7D510F;background:#F8F1E1;padding:4px;">`;
      let hasExcludeGroup = false;

      groups.result.forEach((val) => {
        if (val.type == 'separator') {
          groupSelect += `<option disabled=""/>`;
        } else {
          let groupId = parseInt(val.group_id, 10);
          groupSelect += `<option value="${val.group_id}" ${val.group_id == id ? 'selected' : ''}>${val.name}</option>`;

          if (groupId !== 0) {
            hasExcludeGroup = true;
            excludeGroupList += `<label style="display:block;margin:2px 0;"><input type="checkbox" class="optionExcludeGroup" value="${groupId}" ${excludedIds.includes(groupId) ? 'checked' : ''}> ${val.name}</label>`;
          }
        }
      });

      if (!hasExcludeGroup) {
        excludeGroupList += `<span style="font-style:italic;">-</span>`;
      }

      groupSelect += `</select>`;
      excludeGroupList += `</div>`;

      return { groupSelect, excludeGroupList };
    });
  };

  const buildTable = function (plan) {
    cleanupLegacyUi();

    let html = `<div class="vis farmGodContent" style="margin-bottom:18px;"><h4>FarmGod</h4><table class="vis" width="100%">
                <tr><div id="FarmGodProgessbar" class="progress-bar live-progress-bar progress-bar-alive" style="width:98%;margin:5px auto;"><div style="background:rgb(146,194,0);"></div><span class="label" style="margin-top:0px;"></span></div></tr>
                <tr><th style="text-align:center;">${t.table.origin}</th><th style="text-align:center;">${t.table.target}</th><th style="text-align:center;">${t.table.fields}</th><th style="text-align:center;">${t.table.farm}</th></tr>`;

    if (!$.isEmptyObject(plan)) {
      for (let prop in plan) {
        if (game_data.market == 'nl') {
          html += `<tr><td colspan="4" style="background:#e7d098;"><input type="button" class="btn switchVillage" data-id="${plan[prop][0].origin.id}" value="${t.table.goTo} ${plan[prop][0].origin.name} (${plan[prop][0].origin.coord})" style="float:right;"></td></tr>`;
        }
        plan[prop].forEach((val, i) => {
          html += `<tr class="farmRow row_${i % 2 == 0 ? 'a' : 'b'}">
                    <td style="text-align:center;"><a href__="${game_data.link_base_pure}info_village&id=${val.origin.id}">${val.origin.name} (${val.origin.coord})</a></td>
                    <td style="text-align:center;"><a href__="${game_data.link_base_pure}info_village&id=${val.target.id}">${val.target.coord}</a></td>
                    <td style="text-align:center;">${val.fields.toFixed(2)}</td>
                    <td style="text-align:center;"><a href__="#" data-origin="${val.origin.id}" data-target="${val.target.id}" data-template="${val.template.id}" data-farmgod-key="${buildSendKey(val.origin.id, val.target.id, val.template.id)}" class="farmGod_icon farm_icon farm_icon_${val.template.name}" style="margin:auto;"></a></td>
                  </tr>`;
        });
      }
    } else {
      html += `<tr><td colspan="4" style="text-align:center;">${t.table.noFarmsPlanned}</td></tr>`;
    }

    html += `</table></div><div class="farmGodBottomSpacer" style="height:140px;"></div>`;
    return html;
  };

  const getData = function (group, excludedGroups, newbarbs, losses, optionTime) {
    excludedGroups = [...new Set((excludedGroups || [])
      .map((groupId) => parseInt(groupId, 10))
      .filter((groupId) => !Number.isNaN(groupId) && groupId !== group))];

    let data = {
      villages: {},
      commands: {},
      farms: { templates: {}, farms: {} },
    };
    let loadCommands = optionTime > 0 || newbarbs;
    let excludedVillageCoords = {};

    let villagesProcessor = ($html) => {
      let skipUnits = ['ram', 'catapult', 'knight', 'snob', 'militia'];
      const mobileCheck = $('#mobileHeader').length > 0;

      if (mobileCheck) {
        let table = jQuery($html).find('.overview-container > div');
        table.each((i, el) => {
          try {
            const villageId = jQuery(el).find('.quickedit-vn').data('id');
            const name = jQuery(el).find('.quickedit-label').attr('data-text');
            const coord = jQuery(el).find('.quickedit-label').text().toCoord();
            const units = new Array(game_data.units.length).fill(0);
            const unitsElements = jQuery(el).find('.overview-units-row > div.unit-row-item');
            unitsElements.each((_, unitElement) => {
              const img = jQuery(unitElement).find('img');
              const span = jQuery(unitElement).find('span.unit-row-name');
              if (img.length && span.length) {
                let unitType = img.attr('src').split('unit_')[1].replace('@2x.webp', '').replace('.webp', '').replace('.png', '');
                const value = parseInt(span.text()) || 0;
                const unitIndex = game_data.units.indexOf(unitType);
                if (unitIndex !== -1) units[unitIndex] = value;
              }
            });
            const filteredUnits = units.filter((_, index) => skipUnits.indexOf(game_data.units[index]) === -1);
            data.villages[coord] = { name, id: villageId, units: filteredUnits };
          } catch (e) {
            console.error('Error processing village data:', e);
          }
        });
      } else {
        $html
          .find('#combined_table')
          .find('.row_a, .row_b')
          .filter((i, el) => $(el).find('.bonus_icon_33').length == 0)
          .map((i, el) => {
            let $el = $(el);
            let $qel = $el.find('.quickedit-label').first();
            let units = $el
              .find('.unit-item')
              .filter((index) => skipUnits.indexOf(game_data.units[index]) == -1)
              .map((index, element) => $(element).text().toNumber())
              .get();
            return (data.villages[$qel.text().toCoord()] = {
              name: $qel.data('text'),
              id: parseInt($el.find('.quickedit-vn').first().data('id')),
              units,
            });
          });
      }
      return data;
    };

    let excludedVillagesProcessor = ($html) => {
      const mobileCheck = $('#mobileHeader').length > 0;

      if (mobileCheck) {
        jQuery($html)
          .find('.overview-container > div')
          .each((i, el) => {
            let coord = jQuery(el).find('.quickedit-label').text().toCoord();
            if (coord) excludedVillageCoords[coord] = true;
          });
      } else {
        $html
          .find('#combined_table')
          .find('.row_a, .row_b')
          .filter((i, el) => $(el).find('.bonus_icon_33').length == 0)
          .each((i, el) => {
            let coord = $(el).find('.quickedit-label').first().text().toCoord();
            if (coord) excludedVillageCoords[coord] = true;
          });
      }

      return excludedVillageCoords;
    };

    let commandsProcessor = ($html) => {
      $html
        .find('#commands_table')
        .find('.row_a, .row_ax, .row_b, .row_bx')
        .map((i, el) => {
          let $el = $(el);
          let coord = $el.find('.quickedit-label').first().text().toCoord();
          if (coord) {
            if (!data.commands.hasOwnProperty(coord)) data.commands[coord] = [];
            return data.commands[coord].push(
              Math.round(lib.timestampFromString($el.find('td').eq(2).text().trim()) / 1000)
            );
          }
        });
      return data;
    };

    let farmProcessor = ($html) => {
      if ($.isEmptyObject(data.farms.templates)) {
        let unitSpeeds = lib.getUnitSpeeds();
        $html
          .find('form[action*="action=edit_all"]')
          .find('input[type="hidden"][name*="template"]')
          .closest('tr')
          .map((i, el) => {
            let $el = $(el);
            return (data.farms.templates[
              $el.prev('tr').find('a.farm_icon').first().attr('class').match(/farm_icon_(.*)\s/)[1]
            ] = {
              id: $el.find('input[type="hidden"][name*="template"][name*="[id]"]').first().val().toNumber(),
              units: $el
                .find('input[type="text"], input[type="number"]')
                .map((index, element) => $(element).val().toNumber())
                .get(),
              speed: Math.max(
                ...$el
                  .find('input[type="text"], input[type="number"]')
                  .map((index, element) => {
                    return $(element).val().toNumber() > 0
                      ? unitSpeeds[$(element).attr('name').trim().split('[')[0]]
                      : 0;
                  })
                  .get()
              ),
            });
          });
      }

      $html
        .find('#plunder_list')
        .find('tr[id^="village_"]')
        .map((i, el) => {
          let $el = $(el);
          return (data.farms.farms[
            $el.find('a[href*="screen=report&mode=all&view="]').first().text().toCoord()
          ] = {
            id: $el.attr('id').split('_')[1].toNumber(),
            color: $el.find('img[src*="graphic/dots/"]').attr('src').match(/dots\/(green|yellow|red|blue|red_blue)/)[1],
            max_loot: $el.find('img[src*="max_loot/1"]').length > 0,
          });
        });

      return data;
    };

    let findNewbarbs = () => {
      if (newbarbs) {
        return twLib.get('/map/village.txt').then((allVillages) => {
          allVillages.match(/[^\r\n]+/g).forEach((villageData) => {
            let [id, name, x, y, player_id] = villageData.split(',');
            let coord = `${x}|${y}`;
            if (player_id == 0 && !data.farms.farms.hasOwnProperty(coord)) {
              data.farms.farms[coord] = { id: id.toNumber() };
            }
          });
          return data;
        });
      } else {
        return data;
      }
    };

    let removeExcludedVillages = () => {
      Object.keys(excludedVillageCoords).forEach((coord) => {
        delete data.villages[coord];
      });
      return data;
    };

    let filterFarms = () => {
      data.farms.farms = Object.fromEntries(
        Object.entries(data.farms.farms).filter(([key, val]) => {
          return (
            !val.hasOwnProperty('color') ||
            (val.color != 'red' &&
              val.color != 'red_blue' &&
              (val.color != 'yellow' || losses))
          );
        })
      );
      return data;
    };

    return Promise.all([
      lib.processAllPages(
        TribalWars.buildURL('GET', 'overview_villages', { mode: 'combined', group }),
        villagesProcessor
      ),
      loadCommands
        ? lib.processAllPages(
            TribalWars.buildURL('GET', 'overview_villages', { mode: 'commands', type: 'attack' }),
            commandsProcessor
          )
        : $.Deferred().resolve(data),
      excludedGroups.length > 0
        ? Promise.all(
            excludedGroups.map((groupId) =>
              lib.processAllPages(
                TribalWars.buildURL('GET', 'overview_villages', { mode: 'combined', group: groupId }),
                excludedVillagesProcessor
              )
            )
          )
        : $.Deferred().resolve(excludedVillageCoords),
      lib.processAllPages(TribalWars.buildURL('GET', 'am_farm'), farmProcessor),
      findNewbarbs(),
    ])
      .then(removeExcludedVillages)
      .then(filterFarms)
      .then(() => data);
  };

  const createPlanning = function (optionDistance, optionTime, optionMaxloot, data) {
    let plan = { counter: 0, farms: {} };
    let serverTime = Math.round(lib.getCurrentServerTime() / 1000);

    for (let prop in data.villages) {
      let orderedFarms = Object.keys(data.farms.farms)
        .map((key) => ({ coord: key, dis: lib.getDistance(prop, key) }))
        .sort((a, b) => (a.dis > b.dis ? 1 : -1));

      orderedFarms.forEach((el) => {
        let farmIndex = data.farms.farms[el.coord];
        let template_name =
          optionMaxloot && farmIndex.hasOwnProperty('max_loot') && farmIndex.max_loot ? 'b' : 'a';
        let template = data.farms.templates[template_name];
        let unitsLeft = lib.subtractArrays(data.villages[prop].units, template.units);
        let distance = lib.getDistance(prop, el.coord);
        let arrival = Math.round(serverTime + distance * template.speed * 60 + Math.round(plan.counter / 5));
        let maxTimeDiff = Math.round(optionTime * 60);
        let timeDiff = true;

        if (data.commands.hasOwnProperty(el.coord)) {
          if (!farmIndex.hasOwnProperty('color') && data.commands[el.coord].length > 0) timeDiff = false;
          data.commands[el.coord].forEach((timestamp) => {
            if (Math.abs(timestamp - arrival) < maxTimeDiff) timeDiff = false;
          });
        } else {
          data.commands[el.coord] = [];
        }

        if (unitsLeft && timeDiff && distance < optionDistance) {
          plan.counter++;
          if (!plan.farms.hasOwnProperty(prop)) plan.farms[prop] = [];
          plan.farms[prop].push({
            origin: { coord: prop, name: data.villages[prop].name, id: data.villages[prop].id },
            target: { coord: el.coord, id: farmIndex.id },
            fields: distance,
            template: { name: template_name, id: template.id },
          });
          data.villages[prop].units = unitsLeft;
          data.commands[el.coord].push(arrival);
        }
      });
    }

    return plan;
  };

  return { init };
})(window.FarmGod.Library, window.FarmGod.Translation);

(() => {
  window.FarmGod.Main.init();
})();
