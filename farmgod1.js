import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check } from 'lucide-react';

const SCRIPT_CONTENT = `// Hungarian translation provided by =Krumpli=
// Fixed version - UTF-8 encoding fix + ScriptAPI safety check

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
          this.queues = this.queueLib.createQueues(20);
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
              window.open(...item.arguments).addEventListener('DOMContentLoaded', function () {
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
          let leastBusyQueue = twLib.queues
            .map((q) => q.length)
            .reduce((next, curr) => (curr < next ? curr : next), 0);
          twLib.queues[leastBusyQueue].enqueue(item);
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
      $(xml).find('config').children().map((i, el) => {
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
    let navSelect = $html.find('.paged-nav-item').first().closest('td').find('select').first();
    let navLength =
      $html.find('#am_widget_Farm').length > 0
        ? parseInt(
            $('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item')[
              $('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item').length - 1
            ].textContent.replace(/\\D/g, '')
          ) - 1
        : navSelect.length > 0
        ? navSelect.find('option').length - 1
        : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
    let pageSize = $('#mobileHeader').length > 0 ? 10 : parseInt($html.find('input[name="page_size"]').val());

    if (page == -1 && villageLength == 1000) {
      return Math.floor(1000 / pageSize);
    } else if (page < navLength) {
      return page + 1;
    }
    return false;
  };

  const processPage = function (url, page, wrapFn) {
    let pageText = url.match('am_farm') ? \`&Farm_page=\${page}\` : \`&page=\${page}\`;
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
    let [hour, min, sec, day, month, year] = $('#serverTime').closest('p').text().match(/\\d+/g);
    return new Date(year, month - 1, day, hour, min, sec).getTime();
  };

  const timestampFromString = function (timestr) {
    let d = $('#serverDate').text().split('/').map((x) => +x);
    let todayPattern = new RegExp(window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace('%s', '([\\\\d+|:]+)')).exec(timestr);
    let tomorrowPattern = new RegExp(window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace('%s', '([\\\\d+|:]+)')).exec(timestr);
    let laterDatePattern = new RegExp(
      window.lang['0cb274c906d622fa8ce524bcfbb7552d'].replace('%1', '([\\\\d+|\\\\.]+)').replace('%2', '([\\\\d+|:]+)')
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
    let c = (this.match(/\\d{1,3}\\|\\d{1,3}/g) || [false]).pop();
    return c && objectified ? { x: c.split('|')[0], y: c.split('|')[1] } : c;
  };
  String.prototype.toNumber = function () { return parseFloat(this); };
  Number.prototype.toNumber = function () { return parseFloat(this); };

  return { getUnitSpeeds, processPage, processAllPages, getDistance, subtractArrays, getCurrentServerTime, timestampFromString };
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
        distance: 'Maximaal aantal velden dat farms mogen lopen:',
        time: 'Hoe veel tijd in minuten moet er tussen farms zitten:',
        losses: 'Verstuur farm naar dorpen met gedeeltelijke verliezen:',
        maxloot: 'Verstuur een B farm als de buit vorige keer vol was:',
        newbarbs: 'Voeg nieuwe barbarendorpen toe om te farmen:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned: 'Er kunnen met de opgegeven instellingen geen farms verstuurd worden.',
        origin: 'Oorsprong', target: 'Doel', fields: 'Velden', farm: 'Farm', goTo: 'Ga naar',
      },
      messages: {
        villageChanged: 'Succesvol van dorp veranderd!',
        villageError: 'Alle farms voor het huidige dorp zijn reeds verstuurd!',
        sendError: 'Error: farm niet verstuurd!',
      },
    },
    hu_HU: {
      missingFeatures: 'A scriptnek Premium fiokra es FarmkezeloRe van szuksege!',
      options: {
        title: 'FarmGod opciok',
        warning: '<b>Figyelem:</b><br>- Bizonyosodj meg rola, hogy az "A" sablon az alapertelmezett es a "B" egy nagyobb mennyisegu mikro-farm<br>- Bizonyosodj meg rola, hogy a farm-filterek megfeleloen vannak beallitva mielott hasznalod a scriptet',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters_HU.png',
        group: 'Ebbol a csoportbol kuld:',
        distance: 'Maximalis mezo tavolsag:',
        time: 'Mekkora idointervallumban kuld a tamadasokat percben:',
        losses: 'Kuldjoen tamadast olyan falvakba ahol reszleges veszteseggel jarhat a tamadas:',
        maxloot: 'A "B" sablont kuld ha az elozo tamadas maximalis fosztogatassal jart:',
        newbarbs: 'Adj hozza uj barbar falukat:',
        button: 'Farm megtervezese',
      },
      table: {
        noFarmsPlanned: 'A jelenlegi beallitasokkal nem lehet uj tamadast kikuld.',
        origin: 'Origin', target: 'Celpoint', fields: 'Tavolsag', farm: 'Farm', goTo: 'Go to',
      },
      messages: {
        villageChanged: 'Falu sikeresen megvaltoztatva!',
        villageError: 'Minden farm kiment a jelenlegi falubol!',
        sendError: 'Hiba: Farm nem volt elkuld!',
      },
    },
    int: {
      missingFeatures: 'Script requires a premium account and loot assistent!',
      options: {
        title: 'FarmGod Options',
        warning: '<b>Warning:</b><br>- Make sure A is set as your default microfarm and B as a larger microfarm<br>- Make sure the farm filters are set correctly before using the script',
        filterImage: 'https://higamy.github.io/TW/Scripts/Assets/farmGodFilters.png',
        group: 'Send farms from group:',
        distance: 'Maximum fields for farms:',
        time: 'How much time in minutes should there be between farms:',
        losses: 'Send farm to villages with partial losses:',
        maxloot: 'Send a B farm if the loot was full last time:',
        newbarbs: 'Add new barbarian villages to farm:',
        button: 'Plan farms',
      },
      table: {
        noFarmsPlanned: 'No farms can be sent with the given settings.',
        origin: 'Origin', target: 'Target', fields: 'Fields', farm: 'Farm', goTo: 'Go to',
      },
      messages: {
        villageChanged: 'Successfully changed village!',
        villageError: 'All farms for the current village have already been sent!',
        sendError: 'Error: farm not sent!',
      },
    },
  };

  const getTranslation = function () {
    let lang = typeof game_data !== 'undefined' ? game_data.locale : 'int';
    return msg[lang] || msg['int'];
  };

  return { getTranslation };
})();

window.FarmGod.Options = (function () {
  const storageKey = 'FarmGod_options';

  const defaultOptions = {
    group: 0,
    distance: 20,
    time: 15,
    losses: false,
    maxloot: false,
    newbarbs: false,
  };

  const getOptions = function () {
    return JSON.parse(localStorage.getItem(storageKey)) || defaultOptions;
  };

  const saveOptions = function (options) {
    localStorage.setItem(storageKey, JSON.stringify(options));
  };

  const showOptions = function () {
    let t = window.FarmGod.Translation.getTranslation();
    let options = getOptions();

    let groupOptions = '<option value="0">-</option>';
    if (typeof game_data !== 'undefined') {
      $.get(\`/game.php?village=\${game_data.village.id}&screen=overview_villages&mode=groups&ajax=load_group_menu\`).then((data) => {
        data.result.forEach((group) => {
          groupOptions += \`<option value="\${group.group_id}" \${options.group == group.group_id ? 'selected' : ''}>\${group.name}</option>\`;
        });
        $('#FarmGod_group').html(groupOptions);
      });
    }

    let dialog = \`
      <div id="FarmGod_options" style="padding:10px;">
        <p>\${t.options.warning}</p>
        <img src="\${t.options.filterImage}" style="max-width:100%;margin:10px 0;">
        <table>
          <tr><td>\${t.options.group}</td><td><select id="FarmGod_group">\${groupOptions}</select></td></tr>
          <tr><td>\${t.options.distance}</td><td><input type="number" id="FarmGod_distance" value="\${options.distance}" min="1" max="200"></td></tr>
          <tr><td>\${t.options.time}</td><td><input type="number" id="FarmGod_time" value="\${options.time}" min="1"></td></tr>
          <tr><td>\${t.options.losses}</td><td><input type="checkbox" id="FarmGod_losses" \${options.losses ? 'checked' : ''}></td></tr>
          <tr><td>\${t.options.maxloot}</td><td><input type="checkbox" id="FarmGod_maxloot" \${options.maxloot ? 'checked' : ''}></td></tr>
          <tr><td>\${t.options.newbarbs}</td><td><input type="checkbox" id="FarmGod_newbarbs" \${options.newbarbs ? 'checked' : ''}></td></tr>
        </table>
        <button id="FarmGod_save" class="btn">\${t.options.button}</button>
      </div>
    \`;

    if (typeof Dialog !== 'undefined') {
      Dialog.show('FarmGod', dialog);
    } else {
      $('body').append(\`<div id="FarmGod_dialog" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:2px solid #000;z-index:9999;padding:20px;max-width:500px;overflow:auto;">\${dialog}<br><button onclick="$('#FarmGod_dialog').remove()" class="btn">Close</button></div>\`);
    }

    $('#FarmGod_save').on('click', function () {
      saveOptions({
        group: parseInt($('#FarmGod_group').val()),
        distance: parseInt($('#FarmGod_distance').val()),
        time: parseInt($('#FarmGod_time').val()),
        losses: $('#FarmGod_losses').is(':checked'),
        maxloot: $('#FarmGod_maxloot').is(':checked'),
        newbarbs: $('#FarmGod_newbarbs').is(':checked'),
      });
      window.FarmGod.Core.run();
    });
  };

  return { getOptions, saveOptions, showOptions };
})();

window.FarmGod.Core = (function () {
  const lib = window.FarmGod.Library;
  const t = window.FarmGod.Translation.getTranslation();

  const getFarmList = function () {
    let options = window.FarmGod.Options.getOptions();
    let groupParam = options.group > 0 ? \`&group=\${options.group}\` : '';
    let url = \`/game.php?village=\${game_data.village.id}&screen=am_farm&mode=farm\${groupParam}\`;
    let farms = [];

    return lib.processAllPages(url, ($html) => {
      $html.find('tr[id^="village_"]').each(function () {
        let $row = $(this);
        let villageId = $row.attr('id').replace('village_', '');
        let coords = $row.find('td:nth-child(2) a').text().trim();
        let distance = parseFloat($row.find('td:nth-child(4)').text().trim());
        let farmA = $row.find('td:nth-child(5) a');
        let farmB = $row.find('td:nth-child(6) a');
        let lastLoot = $row.find('td:nth-child(7)').text().trim();
        let hasLosses = $row.find('td:nth-child(8) img[src*="red"]').length > 0;

        if (distance > options.distance) return;
        if (hasLosses && !options.losses) return;

        let useFarmB = options.maxloot && lastLoot === '100%' && farmB.length > 0;
        let farmLink = useFarmB ? farmB : farmA;

        if (farmLink.length > 0) {
          farms.push({
            villageId,
            coords,
            distance,
            farmLink: farmLink.attr('href'),
            farmType: useFarmB ? 'B' : 'A',
            lastLoot,
          });
        }
      });
    }).then(() => farms);
  };

  const sendFarms = function (farms) {
    let options = window.FarmGod.Options.getOptions();
    let delay = 0;
    farms.forEach((farm) => {
      setTimeout(() => {
        twLib.ajax({ url: farm.farmLink }).then(() => {
          $(\`#FarmGod_row_\${farm.villageId}\`).css('background', '#90EE90');
        }).fail(() => {
          $(\`#FarmGod_row_\${farm.villageId}\`).css('background', '#FFB6C1');
        });
      }, delay);
      delay += 250; // 4 attacks per second (250ms fixed delay)
    });
  };

  const showTable = function (farms) {
    let t = window.FarmGod.Translation.getTranslation();
    if (farms.length === 0) {
      if (typeof Dialog !== 'undefined') Dialog.show('FarmGod', \`<p>\${t.table.noFarmsPlanned}</p>\`);
      return;
    }

    let rows = farms.map((farm) => \`
      <tr id="FarmGod_row_\${farm.villageId}">
        <td>\${game_data.village.name} (\${game_data.village.coord})</td>
        <td><a href="/game.php?village=\${game_data.village.id}&screen=info_village&id=\${farm.villageId}">\${farm.coords}</a></td>
        <td>\${farm.distance}</td>
        <td>\${farm.farmType}</td>
      </tr>
    \`).join('');

    let table = \`
      <div style="max-height:400px;overflow-y:auto;">
        <table class="vis" style="width:100%">
          <thead><tr>
            <th>\${t.table.origin}</th>
            <th>\${t.table.target}</th>
            <th>\${t.table.fields}</th>
            <th>\${t.table.farm}</th>
          </tr></thead>
          <tbody>\${rows}</tbody>
        </table>
      </div>
      <br><button id="FarmGod_send" class="btn">Send farms</button>
    \`;

    if (typeof Dialog !== 'undefined') {
      Dialog.show('FarmGod', table);
    }

    $('#FarmGod_send').on('click', function () {
      sendFarms(farms);
    });
  };

  const run = function () {
    if (typeof game_data === 'undefined' || !$('#am_widget_Farm').length) {
      alert(t.missingFeatures);
      return;
    }
    getFarmList().then(showTable);
  };

  return { run };
})();

window.FarmGod.Options.showOptions();
`;

export default function FarmGodScript() {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([SCRIPT_CONTENT], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'farmgod1.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(SCRIPT_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">FarmGod Script - Opravená verzia</h1>
        <p className="text-gray-400 mb-6">Úprava: 4 útoky za sekundu (250ms delay), 20 paralelných frontov</p>

        <div className="flex gap-3 mb-6">
          <Button onClick={handleDownload} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Stiahnuť farmgod1.js
          </Button>
          <Button onClick={handleCopy} variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
            {copied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Skopírované!' : 'Kopírovať kód'}
          </Button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-2 text-yellow-400">Bookmarklet (použiť na TW):</h2>
          <code className="text-sm text-green-400 break-all">
            {"javascript:(function(){if(typeof ScriptAPI==='undefined'){window.ScriptAPI={register:function(){}};}$.getScript('https://cdn.jsdelivr.net/gh/dusanG227/tw-scripts@main/farmgod1.js');})();"}
          </code>
        </div>

        <pre className="bg-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
          {SCRIPT_CONTENT}
        </pre>
      </div>
    </div>
  );
}
