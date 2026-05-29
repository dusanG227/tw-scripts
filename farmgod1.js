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
        sendPaused:
          'FarmGod is gepauzeerd na een trage of mislukte aanvraag om dubbele farms te voorkomen. Controleer je uitgaande aanvallen.',
        sendRecovered: 'Vertraagde aanvraag bevestigd, FarmGod gaat verder.',
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
        sendPaused:
          'A FarmGod megallt egy lassu vagy hibas keres utan, hogy elkerulje a duplikalt farmokat. Ellenorizd a kimeno tamadasokat.',
        sendRecovered: 'A kesleltetett kuldes megerositve, a FarmGod folytatja.',
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
        sendPaused:
          'FarmGod paused after a slow or failed request to avoid duplicate farms. Check outgoing commands.',
        sendRecovered: 'Delayed request confirmed, FarmGod resumed.',
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

  // Keep the original pace, but never allow more than one uncertain send in flight.
  let sendQueue = [];
  let sendTimer = null;
  let sendWatchdog = null;
  let sendInFlight = false;
  let sendPaused = false;
  let currentSend = null;
  let currentSendStartedAt = 0;
  let currentSendDelay = 0;
  let currentSendTimedOut = false;
  let activeSendRun = 0;
  let queuedSendKeys = {};
  let finishedSendKeys = {};

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
    } else if (state === 'error') {
      $row.css({ opacity: 1, background: '#f4d6d6' });
    } else {
      $row.css({ opacity: 1, background: '' });
    }
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

  const resetSendState = function () {
    activeSendRun += 1;
    clearSendTimer();
    clearSendWatchdog();
    sendQueue = [];
    sendInFlight = false;
    sendPaused = false;
    currentSend = null;
    currentSendStartedAt = 0;
    currentSendDelay = 0;
    currentSendTimedOut = false;
    queuedSendKeys = {};
    finishedSendKeys = {};
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

  const getRemainingDelay = function () {
    let elapsed = Date.now() - currentSendStartedAt;
    return Math.max(0, currentSendDelay - elapsed);
  };

  const finishCurrentSend = function () {
    sendInFlight = false;
    currentSend = null;
    currentSendStartedAt = 0;
    currentSendDelay = 0;
    currentSendTimedOut = false;
  };

  const startSendWatchdog = function (item, runId) {
    clearSendWatchdog();
    sendWatchdog = setTimeout(() => {
      if (
        runId !== activeSendRun ||
        !sendInFlight ||
        !currentSend ||
        currentSend.key !== item.key
      ) {
        return;
      }

      currentSendTimedOut = true;
      sendPaused = true;
      markSendRow(item, 'error');
      UI.ErrorMessage(t.messages.sendPaused || 'FarmGod paused after a slow request.');
    }, SEND_STALL_TIMEOUT_MS);
  };

  const scheduleNextSend = function (delay = 0) {
    clearSendTimer();
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

  const handleSendSuccess = function (item, response, runId) {
    if (runId !== activeSendRun) return;

    clearSendWatchdog();
    let wasTimedOut = currentSendTimedOut;
    let remainingDelay = getRemainingDelay();

    finishedSendKeys[item.key] = true;
    markSendRow(item, '');
    updateProgressBar();
    getSendIcon(item).closest('.farmRow').remove();
    finishCurrentSend();

    if (response && response.success) {
      UI.SuccessMessage(response.success);
    }
    if (wasTimedOut) {
      sendPaused = false;
      UI.SuccessMessage(t.messages.sendRecovered || 'Delayed request confirmed, resuming.');
    }

    scheduleNextSend(remainingDelay);
  };

  const handleSendFailure = function (item, error, runId) {
    if (runId !== activeSendRun) return;

    clearSendWatchdog();
    markSendRow(item, 'error');
    sendPaused = true;
    finishCurrentSend();
    let errorText = getSendErrorText(error);
    let pauseText = t.messages.sendPaused || 'FarmGod paused after a failed request.';
    UI.ErrorMessage(errorText && errorText !== t.messages.sendError ? `${errorText} ${pauseText}` : pauseText);
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
      currentSendTimedOut = false;
      markSendRow(item, 'sending');

      let runId = activeSendRun;
      startSendWatchdog(item, runId);
      executeSend(item, runId)
        .done((response) => handleSendSuccess(item, response, runId))
        .fail((error) => handleSendFailure(item, error, runId));
      return;
    }
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
                <div class="farmGodLoadingSubtitle">Night raid in progress</div>
                <div class="farmGodBattleIcons">
                  <img class="farmGodBladeLeft" src="graphic/unit/unit_sword.png" alt="">
                  <img class="farmGodBladeRight" src="graphic/unit/unit_axe.png" alt="">
                  <div class="farmGodBattleSpark"></div>
                </div>
                <div class="farmGodLoadingBar">
                  <div class="farmGodLoadingBarInner"></div>
                </div>
                <div class="farmGodLoadingHint">Sharpened dark mode loading screen</div>
              </div>
              <div style="display:none;">${fallbackThrobber}</div>
            </div>`;
  };

  const executeSend = function (item, runId) {
    let deferred = $.Deferred();

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
