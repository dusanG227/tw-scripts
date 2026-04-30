// Resource sender for Tribal Wars - send a configurable percentage of available resources.
// Based on Sophie "Shinko to Kuma" resource sender, adjusted for production overview usage.

(function () {
    "use strict";

    var warehouseCapacity = [];
    var allWoodTotals = [];
    var allClayTotals = [];
    var allIronTotals = [];
    var availableMerchants = [];
    var totalMerchants = [];
    var farmSpaceUsed = [];
    var farmSpaceTotal = [];
    var villagesData = [];
    var sendBack;
    var totalWoodSent = 0;
    var totalStoneSent = 0;
    var totalIronSent = 0;
    var woodIconUrl = "https://dssk.innogamescdn.com/asset/610fa902/graphic/holz.webp";
    var stoneIconUrl = "https://dssk.innogamescdn.com/asset/610fa902/graphic/lehm.webp";
    var ironIconUrl = "https://dssk.innogamescdn.com/asset/610fa902/graphic/eisen.webp";
    var ratioWood = 28;
    var ratioStone = 30;
    var ratioIron = 25;
    var ratioTotal = ratioWood + ratioStone + ratioIron;

    var coordinate = sessionStorage.getItem("coordinate") || "";
    var resLimit = getStoredNumber("resLimit", 0);
    var sendPercent = getStoredNumber("sendPercent", 15);
    var villagesLoaded = false;

    var langShinko = [
        "Resource sender - percentage mode",
        "Enter coordinate to send to",
        "Save",
        "Creator",
        "Player",
        "Village",
        "Points",
        "Coordinate to send to",
        "Keep WH% behind",
        "Recalculate resources / change target",
        "Resource sender",
        "Source village",
        "Target village",
        "Distance",
        "Wood",
        "Clay",
        "Iron",
        "Send resources",
        "Created by Sophie 'Shinko to Kuma'",
        "Send % of available resources"
    ];

    if (game_data.locale == "sk_SK" || game_data.locale == "cs_CZ") {
        langShinko = [
            "Posielanie surovin - percenta",
            "Zadaj suradnice cielovej dediny",
            "Ulozit",
            "Autor",
            "Hrac",
            "Dedina",
            "Body",
            "Suradnice ciela",
            "Nechat v sklade %",
            "Prepocitat suroviny / zmenit ciel",
            "Posielanie surovin",
            "Zdrojova dedina",
            "Cielova dedina",
            "Vzdialenost",
            "Drevo",
            "Hlina",
            "Zelezo",
            "Poslat suroviny",
            "Vytvorila Sophie 'Shinko to Kuma'",
            "Poslat % dostupnych surovin"
        ];
    }

    var cssClassesSophie = `
<style>
.sophRowA {
    background-color: #32353b;
    color: white;
}
.sophRowB {
    background-color: #36393f;
    color: white;
}
.sophHeader {
    background-color: #202225;
    font-weight: bold;
    color: white;
}
#resourceSender input {
    max-width: 110px;
}
.totalsSummaryLine {
    display: block;
    margin: 2px 0;
}
.totalsSummaryLine img {
    vertical-align: middle;
    margin-left: 4px;
}
.copyTotalsButton {
    width: 100%;
}
</style>`;

    ensureProductionOverview();

    $("#contentContainer").eq(0).prepend(cssClassesSophie);
    $("#mobileHeader").eq(0).prepend(cssClassesSophie);

    loadVillagesData().done(function () {
        villagesLoaded = true;
        askCoordinate();
    }).fail(function () {
        UI.ErrorMessage("Nepodarilo sa nacitat prehlad produkcie.");
    });

    function ensureProductionOverview() {
        var params = new URLSearchParams(window.location.search);
        var screen = params.get("screen");
        var mode = params.get("mode");
        var page = params.get("page");

        if (screen !== "overview_villages" || mode !== "prod" || page !== "-1") {
            window.location.href = game_data.link_base_pure + "overview_villages&mode=prod&page=-1";
            throw new Error("Redirecting to production overview.");
        }
    }

    function getStoredNumber(key, defaultValue) {
        if (key in sessionStorage) {
            var value = parseFloat(sessionStorage.getItem(key));
            return Number.isFinite(value) ? value : defaultValue;
        }

        sessionStorage.setItem(key, defaultValue);
        return defaultValue;
    }

    function loadVillagesData() {
        var urlReq;

        if (game_data.player.sitter > 0) {
            urlReq = "game.php?t=" + game_data.player.id + "&screen=overview_villages&mode=prod&page=-1&";
        } else {
            urlReq = "game.php?&screen=overview_villages&mode=prod&page=-1&";
        }

        return $.get(urlReq).done(function (page) {
            var allWoodObjects;
            var allClayObjects;
            var allIronObjects;
            var allVillages;
            var allWarehouses;
            var allFarms;
            var allMerchants;
            var isMobile = $("#mobileHeader")[0];

            resetVillageArrays();

            if (isMobile) {
                allWoodObjects = $(page).find(".res.mwood,.warn_90.mwood,.warn.mwood");
                allClayObjects = $(page).find(".res.mstone,.warn_90.mstone,.warn.mstone");
                allIronObjects = $(page).find(".res.miron,.warn_90.miron,.warn.miron");
                allWarehouses = $(page).find(".mheader.ressources");
                allVillages = $(page).find(".quickedit-vn");
                allFarms = $(page).find(".header.population");
                allMerchants = $(page).find(".trader_img").parent();

                for (var mobileWood = 0; mobileWood < allWoodObjects.length; mobileWood++) {
                    allWoodTotals.push(parseResource(allWoodObjects[mobileWood].textContent));
                }

                for (var mobileClay = 0; mobileClay < allClayObjects.length; mobileClay++) {
                    allClayTotals.push(parseResource(allClayObjects[mobileClay].textContent));
                }

                for (var mobileIron = 0; mobileIron < allIronObjects.length; mobileIron++) {
                    allIronTotals.push(parseResource(allIronObjects[mobileIron].textContent));
                }

                for (var mobileIndex = 0; mobileIndex < allVillages.length; mobileIndex++) {
                    warehouseCapacity.push(parseResource(allWarehouses[mobileIndex].parentElement.innerText));

                    var merchantText = allMerchants[mobileIndex] ? allMerchants[mobileIndex].innerText : "0/0";
                    var merchantMatch = merchantText.match(/(\d+)\s*\/\s*(\d+)/);
                    availableMerchants.push(merchantMatch ? parseInt(merchantMatch[1], 10) : 0);
                    totalMerchants.push(merchantMatch ? parseInt(merchantMatch[2], 10) : 0);

                    var farmMatch = allFarms[mobileIndex].parentElement.innerText.match(/(\d+)\s*\/\s*(\d+)/);
                    farmSpaceUsed.push(farmMatch ? parseInt(farmMatch[1], 10) : 0);
                    farmSpaceTotal.push(farmMatch ? parseInt(farmMatch[2], 10) : 0);
                }
            } else {
                allWoodObjects = $(page).find(".res.wood,.warn_90.wood,.warn.wood");
                allClayObjects = $(page).find(".res.stone,.warn_90.stone,.warn.stone");
                allIronObjects = $(page).find(".res.iron,.warn_90.iron,.warn.iron");
                allVillages = $(page).find(".quickedit-vn");

                for (var woodIndex = 0; woodIndex < allWoodObjects.length; woodIndex++) {
                    allWoodTotals.push(parseResource(allWoodObjects[woodIndex].textContent));
                }

                for (var clayIndex = 0; clayIndex < allClayObjects.length; clayIndex++) {
                    allClayTotals.push(parseResource(allClayObjects[clayIndex].textContent));
                }

                for (var ironIndex = 0; ironIndex < allIronObjects.length; ironIndex++) {
                    allIronTotals.push(parseResource(allIronObjects[ironIndex].textContent));
                }

                for (var villageIndex = 0; villageIndex < allVillages.length; villageIndex++) {
                    var warehouseCell = allIronObjects[villageIndex].parentElement.nextElementSibling;
                    var merchantsCell = warehouseCell.nextElementSibling;
                    var farmCell = merchantsCell.nextElementSibling;
                    var merchantsMatch = merchantsCell.innerText.match(/(\d+)\s*\/\s*(\d+)/);
                    var farmSpaceMatch = farmCell.innerText.match(/(\d+)\s*\/\s*(\d+)/);

                    warehouseCapacity.push(parseResource(warehouseCell.innerText));
                    availableMerchants.push(merchantsMatch ? parseInt(merchantMatch[1], 10) : 0);
                    totalMerchants.push(merchantsMatch ? parseInt(merchantMatch[2], 10) : 0);
                    farmSpaceUsed.push(farmSpaceMatch ? parseInt(farmSpaceMatch[1], 10) : 0);
                    farmSpaceTotal.push(farmSpaceMatch ? parseInt(farmSpaceMatch[2], 10) : 0);
                }
            }

            for (var i = 0; i < allVillages.length; i++) {
                var coordMatch = allVillages[i].innerText.trim().match(/\d+\|\d+/);

                if (!coordMatch) {
                    continue;
                }

                villagesData.push({
                    id: allVillages[i].dataset.id,
                    url: allVillages[i].children[0].children[0].href,
                    coord: coordMatch[0],
                    name: allVillages[i].innerText.trim(),
                    wood: allWoodTotals[i],
                    stone: allClayTotals[i],
                    iron: allIronTotals[i],
                    availableMerchants: availableMerchants[i],
                    totalMerchants: totalMerchants[i],
                    warehouseCapacity: warehouseCapacity[i],
                    farmSpaceUsed: farmSpaceUsed[i],
                    farmSpaceTotal: farmSpaceTotal[i]
                });
            }
        });
    }

    function resetVillageArrays() {
        warehouseCapacity = [];
        allWoodTotals = [];
        allClayTotals = [];
        allIronTotals = [];
        availableMerchants = [];
        totalMerchants = [];
        farmSpaceUsed = [];
        farmSpaceTotal = [];
        villagesData = [];
    }

    function parseResource(value) {
        var cleaned = String(value || "").replace(/[^\d]/g, "");
        return cleaned ? parseInt(cleaned, 10) : 0;
    }

    function createList() {
        if (!villagesLoaded) {
            UI.ErrorMessage("Dediny este nie su nacitane, skus to znova o chvilu.");
            return;
        }

        if ($("#sendResourcesTable")[0]) {
            $("#sendResourcesTable").remove();
            $("#resourceSender").remove();
        }

        var htmlString = `
<div id="resourceSender">
    <table id="Settings" width="760">
        <thead>
            <tr>
                <td class="sophHeader">${langShinko[7]}</td>
                <td class="sophHeader">${langShinko[8]}</td>
                <td class="sophHeader">${langShinko[19]}</td>
                <td class="sophHeader"></td>
                <td class="sophHeader"></td>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="sophRowA">
                    <input type="text" id="coordinateTarget" name="coordinateTarget" size="20">
                </td>
                <td class="sophRowA" align="right">
                    <input type="text" id="resPercent" name="resPercent" size="3">%
                </td>
                <td class="sophRowA" align="right">
                    <input type="text" id="sendPercent" name="sendPercent" size="3">%
                </td>
                <td class="sophRowA">
                    <button type="button" id="saveSettings" class="btn-confirm-yes">${langShinko[2]}</button>
                </td>
                <td class="sophRowA">
                    <button type="button" id="recalculateResources" class="btn" name="sendRes">${langShinko[9]}</button>
                </td>
            </tr>
        </tbody>
    </table>
    <br>
</div>`.trim();

        var htmlCode = `
<div id="sendResourcesTable" border="0">
    <table id="tableSend" width="100%">
        <tbody id="appendHere">
            <tr>
                <td class="sophHeader" colspan="7" width="550" style="text-align:center">${langShinko[10]}</td>
            </tr>
            <tr>
                <td class="sophHeader" width="25%" style="text-align:center">${langShinko[11]}</td>
                <td class="sophHeader" width="25%" style="text-align:center">${langShinko[12]}</td>
                <td class="sophHeader" width="5%" style="text-align:center">${langShinko[13]}</td>
                <td class="sophHeader" width="10%" style="text-align:center">${langShinko[14]}</td>
                <td class="sophHeader" width="10%" style="text-align:center">${langShinko[15]}</td>
                <td class="sophHeader" width="10%" style="text-align:center">${langShinko[16]}</td>
                <td class="sophHeader" width="15%">
                    <font size="1">${langShinko[18]}</font>
                </td>
            </tr>
        </tbody>
    </table>
</div>`;

        var uiDiv = document.createElement("div");
        uiDiv.innerHTML = htmlString;

        $("#mobileHeader").eq(0).append(htmlCode);
        $("#contentContainer").eq(0).prepend(htmlCode);
        $("#mobileHeader").prepend(uiDiv.firstChild);
        $("#contentContainer").prepend(uiDiv.firstChild);

        $("#resPercent").val(resLimit);
        $("#sendPercent").val(sendPercent);
        $("#coordinateTarget").val(coordinate);

        $("#saveSettings").click(function () {
            saveSettingsFromUi();
        });

        $("#recalculateResources").click(function () {
            saveSettingsFromUi();
            reDo();
        });

        $("#resourceSender").eq(0).prepend(`
<table id="playerTarget" width="760">
    <tbody>
        <tr>
            <td class="sophHeader" rowspan="3"><img src="${sendBack[2]}"></td>
            <td class="sophHeader">${langShinko[4]}:</td>
            <td class="sophRowA">${sendBack[3]}</td>
            <td class="sophHeader"><span class="icon header wood"> </span></td>
            <td class="sophRowB" id="woodSent">${numberWithCommas(totalWoodSent)}</td>
        </tr>
        <tr>
            <td class="sophHeader">${langShinko[5]}:</td>
            <td class="sophRowB">${sendBack[1]}</td>
            <td class="sophHeader"><span class="icon header stone"> </span></td>
            <td class="sophRowA" id="stoneSent">${numberWithCommas(totalStoneSent)}</td>
        </tr>
        <tr>
            <td class="sophHeader">${langShinko[6]}:</td>
            <td class="sophRowA">${sendBack[4]}</td>
            <td class="sophHeader"><span class="icon header iron"> </span></td>
            <td class="sophRowB" id="ironSent">${numberWithCommas(totalIronSent)}</td>
        </tr>
        <tr>
            <td class="sophHeader" colspan="2">Spolu odoslane:</td>
            <td class="sophRowA" colspan="2" id="totalsSummary">${buildTotalsSummaryHtml()}</td>
            <td class="sophRowB">
                <button type="button" id="copyTotalsButton" class="btn copyTotalsButton">Kopirovat</button>
            </td>
        </tr>
    </tbody>
</table>`);

        $("#copyTotalsButton").click(function () {
            copyTotalsToClipboard();
        });

        var listHTML = "";

        for (var i = 0; i < villagesData.length; i++) {
            var tempRow = i % 2 === 0 ? "class='sophRowB'" : "class='sophRowA'";
            var res = calculateResAmounts(
                villagesData[i].wood,
                villagesData[i].stone,
                villagesData[i].iron,
                villagesData[i].warehouseCapacity,
                villagesData[i].availableMerchants
            );

            if (res.wood + res.stone + res.iron !== 0 && String(villagesData[i].id) !== String(sendBack[0])) {
                listHTML += `
<tr id="sendRow-${i}" ${tempRow} height="40">
    <td><a href="${villagesData[i].url}" style="color:#40D0E0;">${villagesData[i].name}</a></td>
    <td><a href="#" style="color:#40D0E0;">${sendBack[1]}</a></td>
    <td>${checkDistance(sendBack[5], sendBack[6], villagesData[i].coord.substring(0, 3), villagesData[i].coord.substring(4, 7))}</td>
    <td width="50" style="text-align:center">${res.wood}<span class="icon header wood"> </span></td>
    <td width="50" style="text-align:center">${res.stone}<span class="icon header stone"> </span></td>
    <td width="50" style="text-align:center">${res.iron}<span class="icon header iron"> </span></td>
    <td style="text-align:center">
        <input type="button" class="btn evt-confirm-btn btn-confirm-yes sendResourcesButton"
            value="${langShinko[17]}"
            data-source-id="${villagesData[i].id}"
            data-target-id="${sendBack[0]}"
            data-wood="${res.wood}"
            data-stone="${res.stone}"
            data-iron="${res.iron}"
            data-row-id="sendRow-${i}">
    </td>
</tr>`;
            }
        }

        $("#appendHere").eq(0).append(listHTML);
        $(".sendResourcesButton").click(function () {
            var button = $(this);
            sendResource(
                button.data("source-id"),
                button.data("target-id"),
                button.data("wood"),
                button.data("stone"),
                button.data("iron"),
                button.data("row-id")
            );
        });

        sortTableTest(2);
        formatTable();

        $(".sendResourcesButton").first().focus();
    }

    function saveSettingsFromUi() {
        var coordMatch = String($("#coordinateTarget").val() || "").match(/\d+\|\d+/);
        var newResLimit = parseFloat($("#resPercent").val());
        var newSendPercent = parseFloat($("#sendPercent").val());

        if (!coordMatch) {
            UI.ErrorMessage("Zadaj platne suradnice vo formate 500|500.");
            return false;
        }

        if (!Number.isFinite(newResLimit) || newResLimit < 0 || newResLimit > 100) {
            UI.ErrorMessage("Rezerva skladu musi byt cislo od 0 do 100.");
            return false;
        }

        if (!Number.isFinite(newSendPercent) || newSendPercent < 0 || newSendPercent > 100) {
            UI.ErrorMessage("Percento odoslania musi byt cislo od 0 do 100.");
            return false;
        }

        coordinate = coordMatch[0];
        resLimit = newResLimit;
        sendPercent = newSendPercent;

        sessionStorage.setItem("coordinate", coordinate);
        sessionStorage.setItem("resLimit", resLimit);
        sessionStorage.setItem("sendPercent", sendPercent);

        UI.SuccessMessage("Nastavenia ulozene.");
        return true;
    }

    function sendResource(sourceID, targetID, woodAmount, stoneAmount, ironAmount, rowId) {
        $(".sendResourcesButton").prop("disabled", true);

        setTimeout(function () {
            $("#" + rowId).remove();
            $(".sendResourcesButton").prop("disabled", false);
            $(".sendResourcesButton").first().focus();

            if ($("#tableSend tr").length <= 2) {
                alert("Finished sending!");

                if ($(".btn-pp").length > 0) {
                    $(".btn-pp").remove();
                }
            }
        }, 200);

        var payload = {
            target_id: targetID,
            wood: woodAmount,
            stone: stoneAmount,
            iron: ironAmount
        };

        TribalWars.post(
            "market",
            {
                ajaxaction: "map_send",
                village: sourceID
            },
            payload,
            function (response) {
                Dialog.close();
                UI.SuccessMessage(response.message);

                totalWoodSent += woodAmount;
                totalStoneSent += stoneAmount;
                totalIronSent += ironAmount;

                $("#woodSent").eq(0).text(numberWithCommas(totalWoodSent));
                $("#stoneSent").eq(0).text(numberWithCommas(totalStoneSent));
                $("#ironSent").eq(0).text(numberWithCommas(totalIronSent));
                $("#totalsSummary").eq(0).html(buildTotalsSummaryHtml());
            },
            false
        );
    }

    function buildTotalsSummaryHtml() {
        return (
            '<span class="totalsSummaryLine">Drevo ' + numberWithCommas(totalWoodSent) + ' <img src="' + woodIconUrl + '" alt="drevo" width="16" height="16"></span>' +
            '<span class="totalsSummaryLine">Hlina ' + numberWithCommas(totalStoneSent) + ' <img src="' + stoneIconUrl + '" alt="hlina" width="16" height="16"></span>' +
            '<span class="totalsSummaryLine">Zelezo ' + numberWithCommas(totalIronSent) + ' <img src="' + ironIconUrl + '" alt="zelezo" width="16" height="16"></span>'
        );
    }

    function buildTotalsCopyText() {
        return (
            "Drevo " + numberWithCommas(totalWoodSent) + "\n" +
            "Hlina " + numberWithCommas(totalStoneSent) + "\n" +
            "Zelezo " + numberWithCommas(totalIronSent)
        );
    }

    function buildTotalsCopyHtml() {
        return (
            '<div>' +
            '<div>Drevo ' + numberWithCommas(totalWoodSent) + ' <img src="' + woodIconUrl + '" alt="drevo" width="16" height="16"></div>' +
            '<div>Hlina ' + numberWithCommas(totalStoneSent) + ' <img src="' + stoneIconUrl + '" alt="hlina" width="16" height="16"></div>' +
            '<div>Zelezo ' + numberWithCommas(totalIronSent) + ' <img src="' + ironIconUrl + '" alt="zelezo" width="16" height="16"></div>' +
            "</div>"
        );
    }

    function copyTotalsToClipboard() {
        var plainText = buildTotalsCopyText();
        var htmlText = buildTotalsCopyHtml();

        if (navigator.clipboard && window.ClipboardItem) {
            var item = new ClipboardItem({
                "text/plain": new Blob([plainText], { type: "text/plain" }),
                "text/html": new Blob([htmlText], { type: "text/html" })
            });

            navigator.clipboard.write([item]).then(function () {
                UI.SuccessMessage("Sucet surovin bol skopirovany.");
            }).catch(function () {
                fallbackCopyText(plainText);
            });
        } else {
            fallbackCopyText(plainText);
        }
    }

    function fallbackCopyText(text) {
        var helper = document.createElement("textarea");
        helper.value = text;
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
        UI.SuccessMessage("Sucet surovin bol skopirovany.");
    }

    function numberWithCommas(x) {
        x = x.toString();
        var pattern = /(-?\d+)(\d{3})/;

        while (pattern.test(x)) {
            x = x.replace(pattern, "$1.$2");
        }

        return x;
    }

    function checkDistance(x1, y1, x2, y2) {
        var a = x1 - x2;
        var b = y1 - y2;
        return Math.round(Math.hypot(a, b));
    }

    function askCoordinate() {
        var content = `
<div style="max-width:1000px;">
    <h2 class="popup_box_header">
        <center><u><font color="darkgreen">${langShinko[0]}</font></u></center>
    </h2>
    <hr>
    <p>
        <center><font color="maroon"><b>${langShinko[1]}</b></font></center>
    </p>
    <center>
        <table>
            <tr>
                <td><center><input type="text" id="coordinateTargetFirstTime" name="coordinateTargetFirstTime" size="20"></center></td>
            </tr>
            <tr>
                <td><center><input type="button" class="btn evt-cancel-btn btn-confirm-yes" id="saveCoord" value="${langShinko[2]}">&emsp;</center></td>
            </tr>
        </table>
    </center>
    <br>
    <center>
        <p>${langShinko[3]}:
            <a href="https://shinko-to-kuma.my-free.website/" title="Sophie profile" target="_blank">Sophie "Shinko to Kuma"</a>
        </p>
    </center>
</div>`;

        Dialog.show("Supportfilter", content);
        $("#coordinateTargetFirstTime").val(coordinate);

        $("#saveCoord").click(function () {
            var coordMatch = String($("#coordinateTargetFirstTime").val() || "").match(/\d+\|\d+/);

            if (!coordMatch) {
                UI.ErrorMessage("Zadaj platne suradnice vo formate 500|500.");
                return;
            }

            coordinate = coordMatch[0];
            sessionStorage.setItem("coordinate", coordinate);

            var closeThis = document.getElementsByClassName("popup_box_close");
            closeThis[0].click();

            coordToId(coordinate);
        });
    }

    function calculateResAmounts(wood, stone, iron, warehouse, merchants) {
        var merchantCarry = parseInt(merchants, 10) * 1000;
        var leaveBehindRes = Math.floor(parseInt(warehouse, 10) / 100 * resLimit);
        var totalWood = parseInt(wood, 10);
        var totalStone = parseInt(stone, 10);
        var totalIron = parseInt(iron, 10);
        var availableWood = Math.max(0, totalWood - leaveBehindRes);
        var availableStone = Math.max(0, totalStone - leaveBehindRes);
        var availableIron = Math.max(0, totalIron - leaveBehindRes);
        var balancedBase = Math.min(
            availableWood / ratioWood,
            availableStone / ratioStone,
            availableIron / ratioIron
        );
        var sendBase = balancedBase * sendPercent / 100;
        var sendWood = Math.floor(sendBase * ratioWood);
        var sendStone = Math.floor(sendBase * ratioStone);
        var sendIron = Math.floor(sendBase * ratioIron);
        var totalToSend = sendWood + sendStone + sendIron;

        if (totalToSend > merchantCarry && totalToSend > 0) {
            var merchantBase = merchantCarry / ratioTotal;
            var finalBase = Math.min(sendBase, merchantBase);
            sendWood = Math.floor(finalBase * ratioWood);
            sendStone = Math.floor(finalBase * ratioStone);
            sendIron = Math.floor(finalBase * ratioIron);
        }

        return {
            wood: sendWood,
            stone: sendStone,
            iron: sendIron
        };
    }

    function coordToId(targetCoordinate) {
        var sitterID;

        if (game_data.player.sitter > 0) {
            sitterID = "game.php?t=" + game_data.player.id + "&screen=api&ajax=target_selection&input=" + targetCoordinate + "&type=coord";
        } else {
            sitterID = "/game.php?&screen=api&ajax=target_selection&input=" + targetCoordinate + "&type=coord";
        }

        $.get(sitterID).done(function (data) {
            if (!data.villages || !data.villages[0]) {
                UI.ErrorMessage("Cielova dedina sa nenasla.");
                return;
            }

            sendBack = [
                data.villages[0].id,
                data.villages[0].name,
                data.villages[0].image,
                data.villages[0].player_name,
                data.villages[0].points,
                data.villages[0].x,
                data.villages[0].y
            ];

            createList();
        });
    }

    function reDo() {
        coordToId(coordinate);
    }

    function formatTable() {
        var tableRows = $("#tableSend tr");

        for (var i = 2; i < tableRows.length; i++) {
            tableRows[i].className = i % 2 === 0 ? "sophRowB" : "sophRowA";
        }
    }

    function sortTableTest(n) {
        var table = document.getElementById("tableSend");
        var switching = true;
        var dir = "asc";
        var switchcount = 0;

        while (switching) {
            switching = false;
            var rows = table.rows;

            for (var i = 2; i < rows.length - 1; i++) {
                var shouldSwitch = false;
                var x = rows[i].getElementsByTagName("td")[n];
                var y = rows[i + 1].getElementsByTagName("td")[n];

                if (dir === "asc") {
                    if (Number(x.innerHTML) > Number(y.innerHTML)) {
                        shouldSwitch = true;
                        break;
                    }
                } else if (dir === "desc") {
                    if (Number(x.innerHTML) < Number(y.innerHTML)) {
                        shouldSwitch = true;
                        break;
                    }
                }
            }

            if (shouldSwitch) {
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
                switchcount++;
            } else if (switchcount === 0 && dir === "asc") {
                dir = "desc";
                switching = true;
            }
        }
    }
})();
