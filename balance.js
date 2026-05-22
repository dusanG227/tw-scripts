//script by Sophie "Shinko to Kuma". discord: Sophie#2418 website: https://www.shinko-to-kuma.com/
console.log("Latest update: 20 March 2026 - Sophie 'Shinko to Kuma'");
var testPage;
var is_mobile = !!navigator.userAgent.match(/iphone|android|blackberry/ig) || false;
var warehouseCapacity = [];
var allWoodTotals = [];
var allClayTotals = [];
var allIronTotals = [];
var availableMerchants = [];
var totalMerchants = [];
var farmSpaceUsed = [];
var farmSpaceTotal = [];
var villagePoints = [];
var villagesData = [];
var villageID = [];
var allWoodObjects, allClayObjects, allIronObjects, allVillages;
var totalsAndAverages = "";
var incomingRes = {};
var totalWood, totalStone, totalIron;
var merchantOrders = [];
var excessResources = [];
var shortageResources = [];
var links = [];
var cleanLinks = [];
var stillShortage = [];
var stillExcess = [];




function init() {
    warehouseCapacity = [];
    allWoodTotals = [];
    allClayTotals = [];
    allIronTotals = [];
    availableMerchants = [];
    totalMerchants = [];
    farmSpaceUsed = [];
    farmSpaceTotal = [];
    villagePoints = [];
    villagesData = [];
    villageID = [];
    allWoodObjects, allClayObjects, allIronObjects, allVillages;
    totalsAndAverages = "";
    incomingRes = {};
    totalWood, totalStone, totalIron;
    merchantOrders = [];
    excessResources = [];
    shortageResources = [];
    links = [];
    cleanLinks = [];
    stillShortage = [];
    stillExcess = [];
}

function cleanup() {
    warehouseCapacity = [];
    allWoodTotals = [];
    allClayTotals = [];
    allIronTotals = [];
    availableMerchants = [];
    totalMerchants = [];
    farmSpaceUsed = [];
    farmSpaceTotal = [];
    villagePoints = [];
    villageID = [];
    allWoodObjects, allClayObjects, allIronObjects, allVillages;
    incomingRes = {};
    merchantOrders = [];
    links = [];
    cleanLinks = [];
}


//base language if not on a particular server = English
var langShinko = [
    "Warehouse balancer",
    "Source village",
    "Target village",
    "Distance",
    "Wood",
    "Clay",
    "Iron",
    "Send resources",
    "Created by Sophie 'Shinko to Kuma'",
    "Total wood",
    "Total clay",
    "Total iron",
    "Wood per village",
    "Clay per village",
    "Iron per village",
    "Premium exchange",
    "System"
];
//.net
if (game_data.locale == "en_DK") {
    langShinko = [
        "Warehouse balancer",
        "Source village",
        "Target village",
        "Distance",
        "Wood",
        "Clay",
        "Iron",
        "Send resources",
        "Created by Sophie 'Shinko to Kuma'",
        "Total wood",
        "Total clay",
        "Total iron",
        "Wood per village",
        "Clay per village",
        "Iron per village",
        "Premium exchange",
        "System"
    ];
}
//.swiss
if (game_data.locale == "de_CH") {
    langShinko = [
        "Warehouse balancer",
        "Härkunfts Dorf",
        "Ziel Dorf",
        "Distanz",
        "Holz",
        "Lehm",
        "Isä",
        "Rohstoff vrschicke",
        "Created by Sophie 'Shinko to Kuma'",
        "Total Holz",
        "Total Lehm",
        "Total Isä",
        "Holz pro Dorf",
        "Lehm pro Dorf",
        "Isä pro Dorf",
        "Premium-Depot",
        "System"
    ];
}
//.ro
if (game_data.locale == "ro_RO") {
    langShinko = [
        "Echilibrare resurse",
        "Sat Sursa",
        "Sat Tinta",
        "Distanta",
        "Lemn",
        "Argila",
        "Fier",
        "Trimite resurse",
        "Facut de Sophie 'Shinko to Kuma'",
        "Total lemn",
        "Total argila",
        "Total fier",
        "Lemn per sat",
        "Argila per sat",
        "fier per sat",
        "Schimb Premium",
        "Sistem"
    ];
}
//.gr
if (game_data.locale == "el_GR") {
    langShinko = [
        "Warehouse balancer",
        "Προέλευση",
        "Χωριό στόχος",
        "Απόσταση",
        "Ξύλο",
        "Πηλός",
        "Σίδερο",
        "Αποστολή πόρων",
        "Δημιουργήθηκε από την Sophie 'Shinko to Kuma'",
        "Σύνολο ξύλου",
        "Σύνολο πηλού",
        "Σύνολο σιδήρου",
        "Ξύλο ανα χωριό",
        "Πηλός ανα χωριό",
        "Σίδερο ανα χωριό",
        "Premium exchange",
        "System"
    ];
}
//.nl
if (game_data.locale == "nl_NL") {
    langShinko = [
        "Warenhuis balancer",
        "Oorsprong",
        "Doel",
        "Afstand",
        "Hout",
        "Leem",
        "Ijzer",
        "Verstuur grondstoffen",
        "Gemaakt door Sophie 'Shinko to Kuma'",
        "Totaal hout",
        "Totaal leem",
        "Totaal ijzer",
        "Hout per dorp",
        "Leem per dorp",
        "Ijzer per dorp",
        "Premium Beurs",
        "Systeem"
    ];
}
//.it
if (game_data.locale == "it_IT") {
    langShinko = [
        "Bilancia risorse",
        "Villaggio di origine",
        "Villaggio obiettivo",
        "Distanza",
        "Legno",
        "Argilla",
        "Ferro",
        "Manda risorse",
        "Creato da  Sophie 'Shinko to Kuma'",
        "Legno totale",
        "Argilla totale",
        "Ferro totale",
        "Legno per villaggio",
        "Argilla per villaggio",
        "Ferro per villaggio",
        "Premium exchange",
        "System"
    ];
}
//.ae
if (game_data.locale == "ar_AE") {
    langShinko = [
        "موارنة الموارد",
        "الأصل",
        "الهدف",
        "المسافة",
        "خشب",
        "طمي",
        "حديد",
        "إرسال الموارد",
        "تمت البرمجه من 'Shinko to Kuma'",
        "مجموع الخشب",
        "مجموع الطمي",
        "مجموع الحديد",
        "خشب لكل قرية",
        "طمي لكل قرية",
        "حديد لكل قرية",
        "Premium exchange",
        "System"
    ];
}
//.hu
if (game_data.locale == "hu_HU") {
    langShinko = [
        "Nyersanyag kiegyenlítő",
        "Származási hely",
        "Célállomás",
        "Távolság",
        "Fa",
        "Agyag",
        "Vas",
        "Nyersanyagok küldése",
        "Készítette: Sophie 'Shinko to Kuma'",
        "Összes fa",
        "Összes agyag",
        "Összes vas",
        "Fa/falu",
        "Agyag/falu",
        "Vas/falu",
        "Premium exchange",
        "System"
    ];
}
//.br
if (game_data.locale == "pt_BR") {
    langShinko = [
        "Balanceador de recursos",
        "Origem",
        "Destino",
        "Distância",
        "Madeira",
        "Argila",
        "Ferro",
        "Enviar recursos",
        "Criado por Sophie 'Shinko to Kuma'",
        "Total de madeira",
        "Total de argila",
        "Total de ferro",
        "Madeira por aldeia",
        "Argila por aldeia",
        "Ferro por aldeia",
        "Troca Premium",
        "Sistema"
    ];
}
//colors for UI
if (typeof colors == 'undefined') {
    cssClassesSophie = `
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
.sophLink
{
    color:#40D0E0;
}
.btnSophie
{
    background-image: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
}
.btnSophie:hover
{ 
    background-image: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
}
.collapsible {
    background-color: #32353b;
    color: white;
    cursor: pointer;
    padding: 10px;
    width: 100%;
    border: none;
    text-align: left;
    outline: none;
    font-size: 15px;
    }
    
    .active, .collapsible:hover {
    background-color:  #36393f;
    }
    
    .collapsible:after {
    content: '+';
    color: white;
    font-weight: bold;
    float: right;
    margin-left: 5px;
    }
    
    .active:after {
    content: "-";
    }
    
    .content {
    padding: 0 5px;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.2s ease-out;
    background-color:  #5b5f66;
    color: white;
    }
    
    .item-padded {
    padding: 5px;
    }
    
    .flex-container {
    display: flex; 
    justify-content: space-between;
    align-items:center
    }
    
    .submenu{
        display:flex;
        flex-direction:column;
        position: absolute;
        left:0px;
        top:37px;
        min-width:240px;
    }
</style>`;
}
else {
    if (colors == 'pink') {
        //pink theme
        cssClassesSophie = `
        <style>
        .sophRowA {
            background-color: #FEC5E5;
            color: #E11584;
            }
            .sophRowB {
            background-color: #fcd4eb;
            color: #E11584;
            }
            .sophHeader {
            background-color: #F699CD;
            font-weight: bold;
            color: #E11584;
            }
            .sophLink
            {
                color:#7d3873;
            }
        .btnSophie
        {
            background-image: linear-gradient(#FEC5E5 0%, #FD5DA8 30%, #FF1694 80%, #E11584 100%);
        }
        .btnSophie:hover
        { 
            background-image: linear-gradient(#F2B8C6 0%, #FCBACB 30%, #FA86C4 80%, #FE7F9C 100%);
        }
        .collapsible {
            background-color: #FEC5E5;
            color: white;
            cursor: pointer;
            padding: 10px;
            width: 100%;
            border: none;
            text-align: left;
            outline: none;
            font-size: 15px;
            }
            
            .active, .collapsible:hover {
            background-color:  #fcd4eb;
            }
            
            .collapsible:after {
            content: '+';
            color: white;
            font-weight: bold;
            float: right;
            margin-left: 5px;
            }
            
            .active:after {
            content: "-";
            }
            
            .content {
            padding: 0 5px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.2s ease-out;
            background-color:  #5b5f66;
            color: white;
            }
            
            .item-padded {
            padding: 5px;
            }
            
            .flex-container {
            display: flex; 
            justify-content: space-between;
            align-items:center
            }
            
            .submenu{
                display:flex;
                flex-direction:column;
                position: absolute;
                left:0px;
                top:37px;
                min-width:240px;
            }
        </style>`;
    }
    else if (colors == "swedish") {
        //yellow/blue
        cssClassesSophie = `
        <style>
        .sophRowA {
            background-color: #fecd00;
            color: #006aa8;
            }
            .sophRowB {
            background-color: #ffea00;
            color: #006aa8;
            }
            .sophHeader {
            background-color: #006aa8;
            font-weight: bold;
            color: #ffffdf;
            }
            .sophLink
            {
                color:#034166;
            }
        .btnSophie
        {
            background-image: linear-gradient(#00a1fe 0%, #5d9afd 30%, #1626ff 80%, #1f15e1 100%);
        }
        .btnSophie:hover
        { 
            background-image: linear-gradient(#b8bcf2 0%, #babbfc 30%, #8c86fa 80%, #969fff 100%);
        }
        .collapsible {
            background-color: #fecd00;
            color: white;
            cursor: pointer;
            padding: 10px;
            width: 100%;
            border: none;
            text-align: left;
            outline: none;
            font-size: 15px;
            }
            
            .active, .collapsible:hover {
            background-color:  #ffea00;
            }
            
            .collapsible:after {
            content: '+';
            color: white;
            font-weight: bold;
            float: right;
            margin-left: 5px;
            }
            
            .active:after {
            content: "-";
            }
            
            .content {
            padding: 0 5px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.2s ease-out;
            background-color:  #5b5f66;
            color: white;
            }
            
            .item-padded {
            padding: 5px;
            }
            
            .flex-container {
            display: flex; 
            justify-content: space-between;
            align-items:center
            }
            
            .submenu{
                display:flex;
                flex-direction:column;
                position: absolute;
                left:0px;
                top:37px;
                min-width:240px;
            }
        </style>`;
    }
    else if (colors == "mimimalistGray") {
        //gray
        console.log("Changing to gray theme");
        cssClassesSophie = `
        <style>
        .sophRowA {
            background-color: #dedede;
            color: #545454;
            }
            .sophRowB {
            background-color: #f1f1f1;
            color: #545454;
            }
            .sophHeader {
            background-color: #ded9d9;
            font-weight: bold;
            color: #545454;
            }
            .sophLink
            {
                color:#1626ff;
            }
        .btnSophie
        {
            background-image: linear-gradient(#00a1fe 0%, #5d9afd 30%, #1626ff 80%, #1f15e1 100%);
            color:white
        }
        .btnSophie:hover
        { 
            background-image: linear-gradient(#b8bcf2 0%, #babbfc 30%, #8c86fa 80%, #969fff 100%);
            color: white
        }
        .collapsible {
            background-color: #dedede;
            color: white;
            cursor: pointer;
            padding: 10px;
            width: 100%;
            border: none;
            text-align: left;
            outline: none;
            font-size: 15px;
            }
            
            .active, .collapsible:hover {
            background-color:  #f1f1f1;
            }
            
            .collapsible:after {
            content: '+';
            color: white;
            font-weight: bold;
            float: right;
            margin-left: 5px;
            }
            
            .active:after {
            content: "-";
            }
            
            .content {
            padding: 0 5px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.2s ease-out;
            background-color:  #5b5f66;
            color: white;
            }
            
            .item-padded {
            padding: 5px;
            }
            
            .flex-container {
            display: flex; 
            justify-content: space-between;
            align-items:center
            }
            
            .submenu{
                display:flex;
                flex-direction:column;
                position: absolute;
                left:0px;
                top:37px;
                min-width:240px;
            }
        </style>`;
    }
    else if (colors == "TW") {
        //gray
        console.log("Changing to TW theme");
        cssClassesSophie = `
        <style>
        .sophRowA {
            background-color: #F4E4BC;
            color: black;
            }
            .sophRowB {
            background-color: #fff5da;
            color: black;
            }
            .sophHeader {
            background-color: #c6a768;
            font-weight: bold;
            color: #803000;
            }
            .sophLink
            {
                color:#803000;
            }
        .btnSophie
        {
            linear-gradient(to bottom, #947a62 0%,#7b5c3d 22%,#6c4824 30%,#6c4824 100%)
            color:white
        }
        .btnSophie:hover
        { 
            linear-gradient(to bottom, #b69471 0%,#9f764d 22%,#8f6133 30%,#6c4d2d 100%);
            color: white
        }
        .collapsible {
            background-color: #F4E4BC;
            color: white;
            cursor: pointer;
            padding: 10px;
            width: 100%;
            border: none;
            text-align: left;
            outline: none;
            font-size: 15px;
            }
            
            .active, .collapsible:hover {
            background-color:  #fff5da;
            }
            
            .collapsible:after {
            content: '+';
            color: white;
            font-weight: bold;
            float: right;
            margin-left: 5px;
            }
            
            .active:after {
            content: "-";
            }
            
            .content {
            padding: 0 5px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.2s ease-out;
            background-color:  #5b5f66;
            color: white;
            }
            
            .item-padded {
            padding: 5px;
            }
            
            .flex-container {
            display: flex; 
            justify-content: space-between;
            align-items:center
            }
            
            .submenu{
                display:flex;
                flex-direction:column;
                position: absolute;
                left:0px;
                top:37px;
                min-width:240px;
            }
        </style>`;
    }
    else {
        //standard
        console.log("Switching to standard colors");
        cssClassesSophie = `
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
            .sophLink
            {
                color:#40D0E0;
            }
            .btnSophie
            {
                background-image: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            }
            .btnSophie:hover
            { 
                background-image: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            }
            .collapsible {
                background-color: #32353b;
                color: white;
                cursor: pointer;
                padding: 10px;
                width: 100%;
                border: none;
                text-align: left;
                outline: none;
                font-size: 15px;
                }
                
                .active, .collapsible:hover {
                background-color:  #36393f;
                }
                
                .collapsible:after {
                content: '+';
                color: white;
                font-weight: bold;
                float: right;
                margin-left: 5px;
                }
                
                .active:after {
                content: "-";
                }
                
                .content {
                padding: 0 5px;
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.2s ease-out;
                background-color:  #5b5f66;
                color: white;
                }
                
                .item-padded {
                padding: 5px;
                }
                
                .flex-container {
                display: flex; 
                justify-content: space-between;
                align-items:center
                }
                
                .submenu{
                    display:flex;
                    flex-direction:column;
                    position: absolute;
                    left:0px;
                    top:37px;
                    min-width:240px;
                }
            </style>`;
    }
}
//UI elements CSS
/*var backgroundColor = "#36393f";
var borderColor = "#3e4147";
var headerColor = "#202225";
var titleColor = "#ffffdf";
cssClassesSophie = `
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
.btnSophie
{
    background-image: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
}
.btnSophie:hover
{
    background-image: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
}
</style>`
*/


//an list
/*if(parseInt(game_data.player.ally)*3==1923)
{
alert("Something went badly wrong!");
throw new Error("Something went badly wrong!");
}
if(parseInt(game_data.player.ally)/2==971)
{
alert("Something went badly wrong!");
throw new Error("Something went badly wrong!");
}*/

//adding UI classes to page
$("#contentContainer").eq(0).prepend(cssClassesSophie);
$("#mobileHeader").eq(0).prepend(cssClassesSophie);

function parseIntegerSetting(value, fallback) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        return fallback;
    }
    return parsed;
}

function parseFloatSetting(value, fallback) {
    var parsed = parseFloat(value);
    if (isNaN(parsed)) {
        return fallback;
    }
    return parsed;
}

function clampSetting(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normaliseSettings(rawSettings) {
    var settingsToNormalise = rawSettings || {};
    var equalizePercentage = parseFloatSetting(settingsToNormalise.equalizePercentage, parseFloatSetting(settingsToNormalise.needsMorePercentage, 0.85));
    var frontierPercentage = parseFloatSetting(settingsToNormalise.frontierPercentage, 0.95);

    var normalisedSettings = {
        "equalizePercentage": clampSetting(equalizePercentage, 0.1, 1),
        "frontierPercentage": clampSetting(frontierPercentage, 0.1, 1),
        "donorMinPoints": Math.max(0, parseIntegerSetting(settingsToNormalise.donorMinPoints, 10000)),
        "reserveWood": Math.max(0, parseIntegerSetting(settingsToNormalise.reserveWood, 90692)),
        "reserveStone": Math.max(0, parseIntegerSetting(settingsToNormalise.reserveStone, 125517)),
        "reserveIron": Math.max(0, parseIntegerSetting(settingsToNormalise.reserveIron, 48331)),
        "frontierVillages": typeof settingsToNormalise.frontierVillages == "string" ? settingsToNormalise.frontierVillages.trim() : ""
    };

    if (normalisedSettings.frontierPercentage < normalisedSettings.equalizePercentage) {
        normalisedSettings.frontierPercentage = normalisedSettings.equalizePercentage;
    }
    return normalisedSettings;
}

function parseFrontierVillages(rawValue) {
    var lookup = {
        ids: {},
        coords: {}
    };
    if (!rawValue) {
        return lookup;
    }
    var entries = rawValue.split(/[\s,;]+/);
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i].trim();
        if (!entry) {
            continue;
        }
        if (/^\d+\|\d+$/.test(entry)) {
            lookup.coords[entry] = true;
        }
        else if (/^\d+$/.test(entry)) {
            lookup.ids[entry] = true;
        }
    }
    return lookup;
}

function getVillageCoordString(village) {
    var coordMatch = village.name.match(/(\d+)\|(\d+)/);
    if (!coordMatch) {
        return "";
    }
    return coordMatch[1] + "|" + coordMatch[2];
}

function villageIsFrontier(village, frontierLookup) {
    return frontierLookup.ids[String(village.id)] === true || frontierLookup.coords[getVillageCoordString(village)] === true;
}

//setting base settings if no player defined ones are present
var storedSettings = {};
if (localStorage.getItem("settingsWHBalancerSophie") != null) {
    storedSettings = JSON.parse(localStorage.getItem("settingsWHBalancerSophie"));
}
var settings = normaliseSettings(storedSettings);
localStorage.setItem("settingsWHBalancerSophie", JSON.stringify(settings));

// if (settings.isMinting == true) {
//     settings = {
//         "isMinting": true,
//         "highPoints": 13000,
//         "highFarm": 33000,
//         "lowPoints": 1,
//         "builtOutPercentage": 0.10,
//         "needsMorePercentage": 0.60
//     };
// }
//removing table if script has been ran before
if ($("#sendResources")[0]) {
    $("#sendResources")[0].remove();
}
if ($("#tableSend")[0]) {
    $("#tableSend")[0].remove();
}
if ($("#totals")[0]) {
    $("#totals")[0].remove();
}

//check if account sit, or not
if (game_data.player.sitter > 0) {
    URLIncRes = `game.php?t=${game_data.player.id}&screen=overview_villages&mode=trader&type=inc&page=-1&type=inc`;
    URLProd = `game.php?t=${game_data.player.id}&screen=overview_villages&mode=prod&page=-1&`;
}
else {
    URLIncRes = "game.php?&screen=overview_villages&mode=trader&type=inc&page=-1&type=inc";
    URLProd = `game.php?&screen=overview_villages&mode=prod&page=-1&`;
}


function sendResource(sourceID, targetID, woodAmount, stoneAmount, ironAmount, rowNr) {
    $("#" + rowNr)[0].remove();
    var e = { "target_id": targetID, "wood": woodAmount, "stone": stoneAmount, "iron": ironAmount };
    TribalWars.post("market", {
            ajaxaction: "map_send", village: sourceID
        }, e, function (e) {
            UI.SuccessMessage(e.message);
            console.log(e.message);
            $(':button[id^="building"]')[0].focus();
        },
        !1
    );
    $(':button[id^="building"]').prop('disabled', true);
    setTimeout(function () {
        $(':button[id^="building"]').prop('disabled', false);
        console.log("undisabled buttons");
        if ($("#tableSend tr").length <= 2) {
            alert("Finished sending!");
            if ($(".btn-pp").length > 0) {
                $(".btn-pp").remove();
            }
            throw Error("Done.");
        }
        $(':button[id^="building"]')[0].focus();
    }, 150);
}

function displayEverything() {

    //grab incoming resources page
    $.get(URLIncRes, function () {
        console.log("Grabbed transport page");
    })
        .done(function (page) {
                //grab all the ressies incoming to each village
                var $page = $(page);

                for (var i = 1; i < $page.find("#trades_table tr").length - 1; i++) {
                    var villageData = {};
                    var villageIDtemp;
                    //check whether the HTML layout is mobile or desktop, the tables are different so we have to adjust
                    if ($("#mobileHeader")[0]) {
                        console.log("mobile");

                        let $resourceGroups = $page.find("#trades_table tr")[i].children[5].children[1].children;
                        for (let j = 0; j < Object.keys($resourceGroups).length; j++) {
                            if ($page.find("#trades_table tr")[1].children[2].innerText != langShinko[16]) {
                                let $child = $($resourceGroups[j]);
                                let classNames = $child.find('.icon.mheader').attr('class').split(' ');
                                let resourceType = classNames[classNames.length - 1];
                                let resourceAmount = $child.text().replace(/[^\d]/g, '');
                                villageData[resourceType] = resourceAmount;
                                villageIDtemp = $page.find("#trades_table tr")[i].children[3].children[2].href.match(/id=(\d*)/)[1];
                            }
                        }
                    }
                    else {
                        console.log("desktop");

                        let $resourceGroups = $page.find("#trades_table tr")[i].children[8].children;
                        console.log(Object.keys($resourceGroups).length);
                        for (let j = 0; j < Object.keys($resourceGroups).length; j++) {
                            let $child = $($resourceGroups[j]);
                            var classNames;
                            if ($child[0].innerHTML.indexOf("header") > -1) {
                                classNames = $child.find('.icon.header').attr('class').split(' ');
                            }
                            else {
                                classNames = $child.attr('class').split(' ');
                            }

                            if ($page.find("#trades_table tr")[1].children[3].innerText != langShinko[15]) {
                                let resourceType = classNames[classNames.length - 1];
                                console.log(resourceType);
                                let resourceAmount = $child.text().replace(/[^\d]/g, '');
                                console.log(resourceAmount);
                                villageData[resourceType] = resourceAmount;
                                villageIDtemp = $page.find("#trades_table tr")[i].children[4].children[0].href.match(/id=(\d*)/)[1];
                            }
                        }

                    }
                    if ($page.find("#trades_table tr")[1].children[3].innerText != langShinko[15] && $page.find("#trades_table tr")[1].children[2].innerText != langShinko[16]) {
                        //create the villageID in the incoming resources object if it doesn't exist yet, so we can add resources to it
                        if (incomingRes[villageIDtemp] == undefined) {
                            incomingRes[villageIDtemp] = { "wood": 0, "stone": 0, "iron": 0 };
                        }
                        if (villageData.wood != undefined) {
                            incomingRes[villageIDtemp].wood += parseInt(villageData.wood);
                        }
                        if (villageData.stone != undefined) {
                            incomingRes[villageIDtemp].stone += parseInt(villageData.stone);
                        }
                        if (villageData.iron != undefined) {
                            incomingRes[villageIDtemp].iron += parseInt(villageData.iron);
                        }
                    }
                }


                //grab all village data once we got the underway transports
                $.get(URLProd, function () {
                    console.log("Managed to grab the page");
                })
                    .done(function (page) {
                        testPage = page;
                        //again, make the difference between mobile or desktop. Different layout HTML so different way of datagrabbing
                        uniVillage = $(page).find("span.bonus_icon_33");
                        if (uniVillage.length > 0) {
                            uniRow = uniVillage.closest('tr').index() - 1;
                        }
                        else {
                            uniRow = -1;
                        }
                        if ($("#mobileHeader")[0]) {
                            console.log("mobile");
                            allWoodObjects = $(page).find(".res.mwood,.warn_90.mwood,.warn.mwood");
                            allClayObjects = $(page).find(".res.mstone,.warn_90.mstone,.warn.mstone");
                            allIronObjects = $(page).find(".res.miron,.warn_90.miron,.warn.miron");
                            allWarehouses = $(page).find(".mheader.ressources");
                            allVillages = $(page).find(".quickedit-vn");
                            allFarms = $(page).find(".header.population");
                            allMerchants = $(page).find('.trader_img').parent();
                            productionTable = $(page).find(".points-header");
                            if (uniRow >= 0) {
                                allVillages.splice(uniRow, 1);
                                allWoodObjects.splice(uniRow, 1);
                                allClayObjects.splice(uniRow, 1);
                                allIronObjects.splice(uniRow, 1);
                                allWarehouses.splice(uniRow, 1);
                                allFarms.splice(uniRow, 1);
                                allMerchants.splice(uniRow, 1);
                                productionTable.splice(uniRow, 1);
                            }
                            //grabbing wood amounts
                            for (var i = 0; i < allWoodObjects.length; i++) {
                                n = allWoodObjects[i].textContent;
                                n = n.replace(/\./g, '').replace(',', '');
                                allWoodTotals.push(n);
                                n = allClayObjects[i].textContent;
                                n = n.replace(/\./g, '').replace(',', '');
                                allClayTotals.push(n);
                                n = allIronObjects[i].textContent;
                                n = n.replace(/\./g, '').replace(',', '');
                                allIronTotals.push(n);
                            }

                            //grabbing available merchants and total merchants
                            for (let i = 0; i < allVillages.length; i++) {
                                farmSpaceUsed.push(allFarms[i].parentElement.innerText.match(/(\d*)\/(\d*)/)[1]);
                                farmSpaceTotal.push(allFarms[i].parentElement.innerText.match(/(\d*)\/(\d*)/)[2]);
                                warehouseCapacity.push(allWarehouses[i].parentElement.innerText);
                                availableMerchants.push(allMerchants[i].innerText);
                                totalMerchants.push("999");
                                const pointsText = $(productionTable[i]).children().length-1;
                                villagePoints.push($(productionTable[i]).children()[pointsText].innerText.replace(/\./g, '').replace(',', ''));
                            }
                        }
                        else {
                            console.log("desktop");
                            allWoodObjects = $(page).find(".res.wood,.warn_90.wood,.warn.wood");
                            allClayObjects = $(page).find(".res.stone,.warn_90.stone,.warn.stone");
                            allIronObjects = $(page).find(".res.iron,.warn_90.iron,.warn.iron");
                            allVillages = $(page).find(".quickedit-vn");
                            if (uniRow >= 0) {
                                allVillages.splice(uniRow, 1);
                                allWoodObjects.splice(uniRow, 1);
                                allClayObjects.splice(uniRow, 1);
                                allIronObjects.splice(uniRow, 1);
                            }
                            //grabbing wood amounts
                            for (let i = 0; i < allWoodObjects.length; i++) {

                                n = allWoodObjects[i].textContent;
                                n = n.replace(/\./g, '').replace(',', '');
                                allWoodTotals.push(n);
                                n = allClayObjects[i].textContent;
                                n = n.replace(/\./g, '').replace(',', '');
                                allClayTotals.push(n);
                                n = allIronObjects[i].textContent;
                                n = n.replace(/\./g, '').replace(',', '');
                                allIronTotals.push(n);
                            }

                            //grabbing warehouse capacity
                            for (let i = 0; i < allVillages.length; i++) {

                                warehouseCapacity.push(allIronObjects[i].parentElement.nextElementSibling.innerHTML);
                                availableMerchants.push(allIronObjects[i].parentElement.nextElementSibling.nextElementSibling.innerText.match(/(\d*)\/(\d*)/)[1]);
                                totalMerchants.push(allIronObjects[i].parentElement.nextElementSibling.nextElementSibling.innerText.match(/(\d*)\/(\d*)/)[2]);
                                farmSpaceUsed.push(allIronObjects[i].parentElement.nextElementSibling.nextElementSibling.nextElementSibling.innerText.match(/(\d*)\/(\d*)/)[1]);
                                farmSpaceTotal.push(allIronObjects[i].parentElement.nextElementSibling.nextElementSibling.nextElementSibling.innerText.match(/(\d*)\/(\d*)/)[2]);
                                villagePoints.push(allWoodObjects[i].parentElement.previousElementSibling.innerText.replace(/\./g, '').replace(',', ''));
                            }
                        }

                        //making a useable Data object
                        for (let i = 0; i < allVillages.length; i++) {
                            villagesData.push({
                                "id": allVillages[i].dataset.id,
                                "points": villagePoints[i],
                                "url": allVillages[i].children[0].children[0].href,
                                "name": allVillages[i].innerText.trim(),
                                "wood": allWoodTotals[i],
                                "stone": allClayTotals[i],
                                "iron": allIronTotals[i],
                                "availableMerchants": availableMerchants[i],
                                "totalMerchants": totalMerchants[i],
                                "warehouseCapacity": warehouseCapacity[i],
                                "farmSpaceUsed": farmSpaceUsed[i],
                                "farmSpaceTotal": farmSpaceTotal[i]
                            });
                        }

                        //sort data object to prioritise sending to smaller villages. Sorting from high to low, then counting down later. Could have done standard but legacy code and didn't want to adjust the entire thing.
                        villagesData.sort((a, b) => (parseInt(a.points) < parseInt(b.points)) ? 1 : -1);

                        //calculating totals and averages
                        totalWood = 0;
                        totalStone = 0;
                        totalIron = 0;

                        for (let i in allWoodTotals) { totalWood += parseInt(allWoodTotals[i]); }
                        for (let i in allClayTotals) { totalStone += parseInt(allClayTotals[i]); }
                        for (let i in allIronTotals) { totalIron += parseInt(allIronTotals[i]); }
                        //add the incoming res to the total!
                        for (let o = 0; o < Object.keys(incomingRes).length; o++) {
                            totalWood += incomingRes[Object.keys(incomingRes)[o]].wood;
                            totalStone += incomingRes[Object.keys(incomingRes)[o]].stone;
                            totalIron += incomingRes[Object.keys(incomingRes)[o]].iron;
                        }
                        woodAverage = Math.floor(totalWood / warehouseCapacity.length);
                        stoneAverage = Math.floor(totalStone / warehouseCapacity.length);
                        ironAverage = Math.floor(totalIron / warehouseCapacity.length);


                        frontierLookup = parseFrontierVillages(settings.frontierVillages);
                        frontierVillageCount = 0;
                        for (let i = 0; i < villagesData.length; i++) {
                            if (villageIsFrontier(villagesData[i], frontierLookup)) {
                                frontierVillageCount++;
                            }
                        }

                        //calculate actual averages after capping by how much of the warehouse we want to fill by default
                        actualWoodAverage = woodAverage;
                        actualStoneAverage = stoneAverage;
                        actualIronAverage = ironAverage;
                        actualTotalWood = totalWood;
                        actualTotalStone = totalStone;
                        actualTotalIron = totalIron;
                        actualWHCountNeedsBalancingWood = warehouseCapacity.length;
                        actualWHCountNeedsBalancingStone = warehouseCapacity.length;
                        actualWHCountNeedsBalancingIron = warehouseCapacity.length;
                        for (let i = 0; i < warehouseCapacity.length; i++) {
                            actualWoodAverage = Math.floor(actualTotalWood / Math.max(1, actualWHCountNeedsBalancingWood));
                            actualStoneAverage = Math.floor(actualTotalStone / Math.max(1, actualWHCountNeedsBalancingStone));
                            actualIronAverage = Math.floor(actualTotalIron / Math.max(1, actualWHCountNeedsBalancingIron));
                            if (warehouseCapacity[i] < actualWoodAverage) {
                                console.log("Warehouse in village " + i + " too small for default equalize target, reducing wood target");
                                actualTotalWood -= actualWoodAverage - warehouseCapacity[i] * settings.equalizePercentage;
                                actualWHCountNeedsBalancingWood--;
                            }
                            if (warehouseCapacity[i] < actualStoneAverage) {
                                console.log("Warehouse in village " + i + " too small for default equalize target, reducing clay target");
                                actualTotalStone -= actualStoneAverage - warehouseCapacity[i] * settings.equalizePercentage;
                                actualWHCountNeedsBalancingStone--;
                            }
                            if (warehouseCapacity[i] < actualIronAverage) {
                                console.log("Warehouse in village " + i + " too small for default equalize target, reducing iron target");
                                actualTotalIron -= actualIronAverage - warehouseCapacity[i] * settings.equalizePercentage;
                                actualWHCountNeedsBalancingIron--;
                            }
                        }
                        actualWoodAverage = Math.floor(actualTotalWood / Math.max(1, actualWHCountNeedsBalancingWood));
                        actualStoneAverage = Math.floor(actualTotalStone / Math.max(1, actualWHCountNeedsBalancingStone));
                        actualIronAverage = Math.floor(actualTotalIron / Math.max(1, actualWHCountNeedsBalancingIron));

                        if (actualWoodAverage >= 350000 || actualStoneAverage >= 350000 || actualIronAverage >= 350000) {
                            alert(`Your current setup creates a very high equalize target. Consider lowering the default warehouse percentage, raising the donor threshold, or marking more villages as frontier/protected.\n\nCurrent equalize target: ${numberWithCommas(actualWoodAverage)} wood, ${numberWithCommas(actualStoneAverage)} clay, and ${numberWithCommas(actualIronAverage)} iron.`);
                        }
                        totalsAndAverages = `<div id='totals' class='sophHeader' border=0>
                    <table id='totalsAndAverages' width='100%'>
                    <tr class='sophRowA'>
                    <td>${langShinko[9]}: ${numberWithCommas(totalWood)}</td>
                    <td>${langShinko[10]}: ${numberWithCommas(totalStone)}</td>
                    <td>${langShinko[11]}: ${numberWithCommas(totalIron)}</td>
                    </tr>
                    <tr class='sophRowB'>
                    <td>${langShinko[12]}: ${numberWithCommas(woodAverage)}</td>
                    <td>${langShinko[13]}: ${numberWithCommas(stoneAverage)}</td>
                    <td>${langShinko[14]}: ${numberWithCommas(ironAverage)}</td>
                    </tr>
                    <tr class='sophRowA'>
                    <td>Actual woodaverage after correction: ${numberWithCommas(actualWoodAverage)}</td>
                    <td>Actual clayaverage after correction: ${numberWithCommas(actualStoneAverage)}</td>
                    <td>Actual ironaverage after correction: ${numberWithCommas(actualIronAverage)}</td>
                    </tr>
                    <tr class='sophRowB'>
                    <td>Default WH target: ${Math.round(settings.equalizePercentage * 100)}%</td>
                    <td>Frontier WH target: ${Math.round(settings.frontierPercentage * 100)}% (${frontierVillageCount} marked)</td>
                    <td>Donors allowed from: ${numberWithCommas(settings.donorMinPoints)} points</td>
                    </tr>
                    <tr class='sophRowA'>
                    <td>Protected wood reserve: ${numberWithCommas(settings.reserveWood)}</td>
                    <td>Protected clay reserve: ${numberWithCommas(settings.reserveStone)}</td>
                    <td>Protected iron reserve: ${numberWithCommas(settings.reserveIron)}</td>
                    </tr>
                    </table>`;

                        $(".content-border").eq(0).prepend(`
                <div id="progressbar" style="width: 100%;
                background-color: #36393f;"><div id="progress" style="width: 0%;
                height: 35px;
                background-color: #4CAF50;
                text-align: center;
                line-height: 32px;
                color: black;"></div>
                </div>`);
                        $("#mobileHeader").eq(0).prepend(`
                <div id="progressbar" style="width: 100%;
                background-color: #36393f;"><div id="progress" style="width: 0%;
                height: 35px;
                background-color: #4CAF50;
                text-align: center;
                line-height: 32px;
                color: black;"></div>
                </div>`);
                        //find excess/shortage
                        for (let v = 0; v < villagesData.length; v++) {
                            console.log("%c-----------------------------------------------------------------------------------------",'color: red;');
                            excessResources[v] = [];
                            shortageResources[v] = [];
                            villageID.push(villagesData[v].id);
                            currentWood = parseInt(villagesData[v].wood);
                            currentStone = parseInt(villagesData[v].stone);
                            currentIron = parseInt(villagesData[v].iron);
                            villageWarehouseCapacity = parseInt(villagesData[v].warehouseCapacity);
                            villagePointsCurrent = parseInt(villagesData[v].points);
                            thisVillageIsFrontier = villageIsFrontier(villagesData[v], frontierLookup);
                            thisVillageIsDonor = villagePointsCurrent >= settings.donorMinPoints;
                            if (typeof incomingRes[villagesData[v].id] == "undefined") {
                                //no incoming res to this village
                                incomingWood = 0;
                                incomingStone = 0;
                                incomingIron = 0;
                            }
                            else {
                                //found incoming res to this village
                                incomingWood = incomingRes[villagesData[v].id].wood;
                                incomingStone = incomingRes[villagesData[v].id].stone;
                                incomingIron = incomingRes[villagesData[v].id].iron;
                            }
                            console.log(`%cIncoming resources: 
                    Wood: ${incomingWood}
                    Clay: ${incomingStone}
                    Iron: ${incomingIron}`,'color: teal;');
                            defaultWoodTarget = Math.min(actualWoodAverage, Math.round(villageWarehouseCapacity * settings.equalizePercentage));
                            defaultStoneTarget = Math.min(actualStoneAverage, Math.round(villageWarehouseCapacity * settings.equalizePercentage));
                            defaultIronTarget = Math.min(actualIronAverage, Math.round(villageWarehouseCapacity * settings.equalizePercentage));

                            if (thisVillageIsFrontier) {
                                defaultWoodTarget = Math.max(defaultWoodTarget, Math.round(villageWarehouseCapacity * settings.frontierPercentage));
                                defaultStoneTarget = Math.max(defaultStoneTarget, Math.round(villageWarehouseCapacity * settings.frontierPercentage));
                                defaultIronTarget = Math.max(defaultIronTarget, Math.round(villageWarehouseCapacity * settings.frontierPercentage));
                            }

                            if (!thisVillageIsDonor) {
                                defaultWoodTarget = Math.max(defaultWoodTarget, Math.min(settings.reserveWood, villageWarehouseCapacity));
                                defaultStoneTarget = Math.max(defaultStoneTarget, Math.min(settings.reserveStone, villageWarehouseCapacity));
                                defaultIronTarget = Math.max(defaultIronTarget, Math.min(settings.reserveIron, villageWarehouseCapacity));
                            }

                            tempWood = currentWood + incomingWood - defaultWoodTarget;
                            tempStone = currentStone + incomingStone - defaultStoneTarget;
                            tempIron = currentIron + incomingIron - defaultIronTarget;

                            if (incomingWood + currentWood > villageWarehouseCapacity) {
                                console.log("Too much wood incoming in " + villagesData[v].name);
                                tempWood = Math.max(tempWood, Math.round((incomingWood + currentWood) - villageWarehouseCapacity));
                            }
                            if (incomingStone + currentStone > villageWarehouseCapacity) {
                                console.log("Too much clay incoming in " + villagesData[v].name);
                                tempStone = Math.max(tempStone, Math.round((incomingStone + currentStone) - villageWarehouseCapacity));
                            }
                            if (incomingIron + currentIron > villageWarehouseCapacity) {
                                console.log("Too much iron incoming in " + villagesData[v].name);
                                tempIron = Math.max(tempIron, Math.round((incomingIron + currentIron) - villageWarehouseCapacity));
                            }

                            if (!thisVillageIsDonor) {
                                overflowWood = Math.max(0, Math.round((incomingWood + currentWood) - villageWarehouseCapacity));
                                overflowStone = Math.max(0, Math.round((incomingStone + currentStone) - villageWarehouseCapacity));
                                overflowIron = Math.max(0, Math.round((incomingIron + currentIron) - villageWarehouseCapacity));
                                tempWood = overflowWood;
                                tempStone = overflowStone;
                                tempIron = overflowIron;
                            }

                            //check if the excess is bigger than the available resources right now (incase of incoming res, this could be possible)
                            if (tempWood > 0 && tempWood > currentWood) {
                                console.log("Excess is bigger than current available resources, setting it to current available");
                                tempWood = currentWood;
                            }
                            if (tempStone > 0 && tempStone > currentStone) {
                                console.log("Excess is bigger than current available resources, setting it to current available");
                                tempStone = currentStone;
                            }
                            if (tempIron > 0 && tempIron > currentIron) {
                                console.log("Excess is bigger than current available resources, setting it to current available");
                                tempIron = currentIron;
                            }



                            console.log("Village: " + villagesData[v].name + '\n' + "                    Frontier: " + thisVillageIsFrontier + '\n' + "                    Donor eligible: " + thisVillageIsDonor + '\n' + "                    Warehouse capacity: " + villageWarehouseCapacity + '\n' + "                    Targets (wood/clay/iron): " + defaultWoodTarget + "/" + defaultStoneTarget + "/" + defaultIronTarget + '\n' + "                    Wood: " + currentWood + '\n' + "                    Clay: " + currentStone + '\n' + "                    Iron: " + currentIron);
                            console.log("Woodadjustement: " + tempWood + ", clayadjustement: " + tempStone + ", ironadjustement: " + tempIron);


                            //check wood
                            if (tempWood > 0) {
                                //excess
                                excessResources[v].push({ "wood": Math.floor(tempWood / 1000) * 1000 });
                                shortageResources[v].push({ "wood": 0 });
                            }
                            else {
                                //shortage
                                shortageResources[v].push({ "wood": Math.floor(-tempWood / 1000) * 1000 });
                                excessResources[v].push({ "wood": 0 });
                            }
                            //check stone
                            if (tempStone > 0) {
                                //excess
                                excessResources[v].push({ "stone": Math.floor(tempStone / 1000) * 1000 });
                                shortageResources[v].push({ "stone": 0 });
                            }
                            else {
                                //shortage
                                shortageResources[v].push({ "stone": Math.floor(-tempStone / 1000) * 1000 });
                                excessResources[v].push({ "stone": 0 });
                            }
                            //check iron
                            if (tempIron > 0) {
                                //excess
                                excessResources[v].push({ "iron": Math.floor(tempIron / 1000) * 1000 });
                                shortageResources[v].push({ "iron": 0 });
                            }
                            else {
                                //shortage
                                shortageResources[v].push({ "iron": Math.floor(-tempIron / 1000) * 1000 });
                                excessResources[v].push({ "iron": 0 });
                            }

                        }
                        //assign merchants
                        for (let p = 0; p < excessResources.length; p++) {
                            tempAllExcessCombined = parseInt(Math.floor(excessResources[p][0].wood / 1000) * 1000) + parseInt(Math.floor(excessResources[p][1].stone / 1000) * 1000) + parseInt(Math.floor(excessResources[p][2].iron / 1000) * 1000);

                            if (tempAllExcessCombined > 0) {
                                //figure out % of merchants for each
                                tempMaxMerchantsNeeded = Math.floor(tempAllExcessCombined / 1000);
                                if (tempMaxMerchantsNeeded < villagesData[p].availableMerchants) {
                                    //we have enough merchants to move all the excess res
                                    merchantOrders.push({ "villageID": villagesData[p].id, "x": villagesData[p].name.match(/(\d+)\|(\d+)/)[1], "y": villagesData[p].name.match(/(\d+)\|(\d+)/)[2], "wood": Math.floor(excessResources[p][0].wood / 1000), "stone": Math.floor(excessResources[p][1].stone / 1000), "iron": Math.floor(excessResources[p][2].iron / 1000) });
                                }
                                else {
                                    //not enough merchants, assign percentual
                                    tempPercWood = excessResources[p][0].wood / tempAllExcessCombined;
                                    tempPercStone = excessResources[p][1].stone / tempAllExcessCombined;
                                    tempPercIron = excessResources[p][2].iron / tempAllExcessCombined;
                                    merchantOrders.push({ "villageID": villagesData[p].id, "x": villagesData[p].name.match(/(\d+)\|(\d+)/)[1], "y": villagesData[p].name.match(/(\d+)\|(\d+)/)[2], "wood": Math.floor(tempPercWood * villagesData[p].availableMerchants), "stone": Math.floor(tempPercStone * villagesData[p].availableMerchants), "iron": Math.floor(tempPercIron * villagesData[p].availableMerchants) });
                                }
                            }
                        }

                        //assign excess to shortage
                        for (let q = shortageResources.length - 1; q >= 0; q--) {
                            $("#progress").css("width", `${(shortageResources.length - q) / shortageResources.length * 100}%`);
                            //check distances to all villages
                            for (let d = 0; d < merchantOrders.length; d++) {
                                merchantOrders[d].distance = checkDistance(merchantOrders[d].x, merchantOrders[d].y, villagesData[q].name.match(/(\d+)\|(\d+)/)[1], villagesData[q].name.match(/(\d+)\|(\d+)/)[2]);
                            }
                            merchantOrders.sort(function (left, right) { return left.distance - right.distance; });
                            if (shortageResources[q][0].wood <= 0) {
                                //no shortage
                            }
                            else {
                                //check if we need wood
                                while (shortageResources[q][0].wood > 0) {
                                    var totalWoodToTrade = 0;

                                    for (let m = 0; m < merchantOrders.length; m++) {
                                        totalWoodToTrade += merchantOrders[m].wood;
                                        if (merchantOrders[m].wood > 0) {
                                            //merchants assigned to wood, use them to fill up the request
                                            //check if more merchants than needed
                                            if (shortageResources[q][0].wood <= merchantOrders[m].wood * 1000) {
                                                //more  than needed, assign enough
                                                links.push({ "source": merchantOrders[m].villageID, "target": villageID[q], "wood": shortageResources[q][0].wood });
                                                merchantOrders[m].wood -= shortageResources[q][0].wood / 1000;
                                                shortageResources[q][0].wood = 0;
                                            }
                                            if (shortageResources[q][0].wood > merchantOrders[m].wood * 1000) {
                                                //less merchants than needed
                                                links.push({ "source": merchantOrders[m].villageID, "target": villageID[q], "wood": merchantOrders[m].wood * 1000 });
                                                shortageResources[q][0].wood -= merchantOrders[m].wood * 1000;
                                                merchantOrders[m].wood = 0;
                                            }
                                        }
                                        if (shortageResources[q][0].wood <= 0) { break; }
                                        if (m == merchantOrders.length - 1 && shortageResources[q][0].wood > 0) {
                                            console.log("Done with this cycle");
                                            totalWoodToTrade = 0;
                                            break;
                                        }
                                    }
                                    if (totalWoodToTrade == 0) {

                                        q = 0;
                                        //alert("No wood to trade left, breaking");
                                        break;
                                    }
                                }
                            }
                        }

                        //assign excess to shortage
                        for (let q = shortageResources.length - 1; q >= 0; q--) {
                            $("#progress").css("width", `${(shortageResources.length - q) / shortageResources.length * 100}%`);
                            for (var d = 0; d < merchantOrders.length; d++) {
                                merchantOrders[d].distance = checkDistance(merchantOrders[d].x, merchantOrders[d].y, villagesData[q].name.match(/(\d+)\|(\d+)/)[1], villagesData[q].name.match(/(\d+)\|(\d+)/)[2]);
                            }
                            merchantOrders.sort(function (left, right) { return left.distance - right.distance; });
                            if (shortageResources[q][1].stone <= 0) {
                                //no shortage
                            }
                            else {
                                //check if we need stone
                                while (shortageResources[q][1].stone > 0) {
                                    console.log(q);
                                    var totalstoneToTrade = 0;
                                    for (var m = 0; m < merchantOrders.length; m++) {
                                        totalstoneToTrade += merchantOrders[m].stone;
                                        if (merchantOrders[m].stone > 0) {
                                            //merchants assigned to stone, use them to fill up the request
                                            //check if more merchants than needed
                                            if (shortageResources[q][1].stone <= merchantOrders[m].stone * 1000) {
                                                //more  than needed, assign enough
                                                links.push({ "source": merchantOrders[m].villageID, "target": villageID[q], "stone": shortageResources[q][1].stone });
                                                merchantOrders[m].stone -= shortageResources[q][1].stone / 1000;
                                                shortageResources[q][1].stone = 0;
                                            }
                                            if (shortageResources[q][1].stone > merchantOrders[m].stone * 1000) {
                                                //less merchants than needed
                                                links.push({ "source": merchantOrders[m].villageID, "target": villageID[q], "stone": merchantOrders[m].stone * 1000 });
                                                shortageResources[q][1].stone -= merchantOrders[m].stone * 1000;
                                                merchantOrders[m].stone = 0;
                                            }
                                        }
                                        if (shortageResources[q][1].stone <= 0) { break; }
                                        if (m == merchantOrders.length - 1 && shortageResources[q][1].stone > 0) {
                                            console.log("Done with this cycle");
                                            totalstoneToTrade = 0;
                                            break;
                                        }
                                    }
                                    if (totalstoneToTrade == 0) {

                                        q = 0;
                                        //alert("No stone to trade left, breaking");
                                        break;
                                    }
                                }
                            }
                        }

                        //assign excess to shortage
                        for (let q = shortageResources.length - 1; q >= 0; q--) {
                            $("#progress").css("width", `${(shortageResources.length - q) / shortageResources.length * 100}%`);
                            for (let d = 0; d < merchantOrders.length; d++) {
                                merchantOrders[d].distance = checkDistance(merchantOrders[d].x, merchantOrders[d].y, villagesData[q].name.match(/(\d+)\|(\d+)/)[1], villagesData[q].name.match(/(\d+)\|(\d+)/)[2]);
                            }
                            merchantOrders.sort(function (left, right) { return left.distance - right.distance; });
                            if (shortageResources[q][2].iron <= 0) {
                                //no shortage
                            }
                            else {
                                //check if we need iron
                                while (shortageResources[q][2].iron > 0) {
                                    var totalironToTrade = 0;
                                    for (let m = 0; m < merchantOrders.length; m++) {
                                        totalironToTrade += merchantOrders[m].iron;
                                        if (merchantOrders[m].iron > 0) {
                                            //merchants assigned to iron, use them to fill up the request
                                            //check if more merchants than needed
                                            if (shortageResources[q][2].iron <= merchantOrders[m].iron * 1000) {
                                                //more  than needed, assign enough
                                                links.push({ "source": merchantOrders[m].villageID, "target": villageID[q], "iron": shortageResources[q][2].iron });
                                                merchantOrders[m].iron -= shortageResources[q][2].iron / 1000;
                                                shortageResources[q][2].iron = 0;
                                            }
                                            if (shortageResources[q][2].iron > merchantOrders[m].iron * 1000) {
                                                //less merchants than needed
                                                links.push({ "source": merchantOrders[m].villageID, "target": villageID[q], "iron": merchantOrders[m].iron * 1000 });
                                                shortageResources[q][2].iron -= merchantOrders[m].iron * 1000;
                                                merchantOrders[m].iron = 0;
                                            }
                                        }
                                        if (shortageResources[q][2].iron <= 0) { break; }
                                        if (m == merchantOrders.length - 1 && shortageResources[q][2].iron > 0) {
                                            console.log("Done with this cycle");
                                            totalironToTrade = 0;
                                            break;
                                        }
                                    }
                                    if (totalironToTrade == 0) {

                                        q = 0;
                                        //alert("No iron to trade left, breaking");
                                        break;
                                    }
                                }
                            }
                        }
                        $("#progress").remove();
                        //assigned all merchants

                        htmlCode = `<div id="restart">${totalsAndAverages}</div>
                <div id="sendResources" class="flex-container sophHeader" style="position: relative">
                    <button class="sophRowA collapsible" style="width: 250px;min-width: 230px;">Open settings menu</button>
                    <div class="content submenu" style="width: 540px;height:560px;z-index:99999">
                        <form id="settings">
                            <table style="border-spacing: 2px;">
                            <tr>
                            <td style="padding: 6px;">
                            <label for="equalizePercentage">Default villages</label></td><td style="padding: 6px;"><input type="range" min="0.10" max="1" step="0.01" value="${settings.equalizePercentage}" class="slider" name="equalizePercentage" oninput="sliderChange('equalizePercentage',this.value)">
                            <output id="equalizePercentage"></output> of warehouse</td></tr>
                            <tr>
                            <td style="padding: 6px;">
                            <label for="frontierPercentage">Frontier villages</label></td><td style="padding: 6px;"><input type="range" min="0.10" max="1" step="0.01" value="${settings.frontierPercentage}" class="slider" name="frontierPercentage" oninput="sliderChange('frontierPercentage',this.value)">
                            <output id="frontierPercentage"></output> of warehouse</td></tr>
                            <tr>
                            <td style="padding: 6px;">
                            <label for="donorMinPoints">Donor threshold</label></td><td style="padding: 6px;"><input type="number" min="0" step="100" value="${settings.donorMinPoints}" name="donorMinPoints" style="width: 120px;">
                            points</td></tr>
                            <tr>
                            <td style="padding: 6px;">
                            <label for="reserveWood">Protected wood</label></td><td style="padding: 6px;"><input type="number" min="0" step="1000" value="${settings.reserveWood}" name="reserveWood" style="width: 120px;">
                            kept in villages under donor threshold</td></tr>
                            <tr>
                            <td style="padding: 6px;">
                            <label for="reserveStone">Protected clay</label></td><td style="padding: 6px;"><input type="number" min="0" step="1000" value="${settings.reserveStone}" name="reserveStone" style="width: 120px;">
                            kept in villages under donor threshold</td></tr>
                            <tr>
                            <td style="padding: 6px;">
                            <label for="reserveIron">Protected iron</label></td><td style="padding: 6px;"><input type="number" min="0" step="1000" value="${settings.reserveIron}" name="reserveIron" style="width: 120px;">
                            kept in villages under donor threshold</td></tr>
                            <tr>
                            <td style="padding: 6px; vertical-align: top;">
                            <label for="frontierVillages">Frontier villages</label></td><td style="padding: 6px;"><textarea name="frontierVillages" rows="4" style="width: 280px;">${settings.frontierVillages}</textarea><br>
                            <font size="1">Use village IDs or coordinates, separated by spaces, commas or new lines. Example: 512|487 513|488 123456</font></td></tr>
                            <tr>
                            <td style="padding: 6px;">
                            <input type="button" class="btn evt-confirm-btn btn-confirm-yes" value="Save" onclick="saveSettings();"/></td></tr>
                            <td colspan="2" style="padding: 6px;">
                            <p style="padding:5px"><font size="1">Defaults for protected reserves match Farm level 30 cost: 90,692 wood / 125,517 clay / 48,331 iron.</font></p>
                            </td>
                            </table>
                        </form>
                    </div>
                </div>
                <table id="tableSend" width="100%" class="sophHeader">
                <tbody id="appendHere">
                    <tr>
                        <td class="sophHeader" colspan=7 width=“550” style="text-align:center" >${langShinko[0]}</td>
                    </tr>
                    <tr>
                        <td class="sophHeader" width="25%" style="text-align:center">${langShinko[1]}</td>
                        <td class="sophHeader" width="25%" style="text-align:center">${langShinko[2]}</td>
                        <td class="sophHeader" width="5%" style="text-align:center">${langShinko[3]}</td>
                        <td class="sophHeader" width="10%" style="text-align:center">${langShinko[4]}</td>
                        <td class="sophHeader" width="10%" style="text-align:center">${langShinko[5]}</td>
                        <td class="sophHeader" width="10%" style="text-align:center">${langShinko[6]}</td>
                        <td class="sophHeader" width="10%">
                            <font size="1">${langShinko[8]}</font>
                        </td>
                    </tr>
                </tbody>
            </table>
                `;

                        if (is_mobile == true) {
                            $("#mobileHeader").eq(0).prepend(htmlCode);
                        }
                        else {
                            $("#content_value").eq(0).prepend(htmlCode);
                        }
                        //making the table
                        sliderChange('equalizePercentage', settings.equalizePercentage);
                        sliderChange('frontierPercentage', settings.frontierPercentage);
                        makeThingsCollapsible();
                        createList();
                    })

                    .fail(function () {
                        console.log("error");
                    })

                    .always(function () {
                        console.log("finished");
                    });
            }
        );

    function createList() {
        console.log("Reached list creation");
        //add the resource types that aren't in the sending
        for (let i = 0; i < links.length; i++) {
            if (links[i].wood == undefined) links[i].wood = 0;
            if (links[i].stone == undefined) links[i].stone = 0;
            if (links[i].iron == undefined) links[i].iron = 0;
        }
        console.log("Filled up the sendings");
        //clean up the sendings, combining them
        for (let i = 0; i < links.length; i++) {
            for (let j = 0; j < links.length; j++) {
                if (links[i].source == links[j].source && links[i].target == links[j].target && i != j) {
                    //same origin and destination, merge
                    links[i].wood += parseInt(links[j].wood);
                    links[j].wood = 0;
                    links[i].stone += parseInt(links[j].stone);
                    links[j].stone = 0;
                    links[i].iron += parseInt(links[j].iron);
                    links[j].iron = 0;
                }
            }
        }
        console.log("combined the sendings");
        for (let i = 0; i < links.length; i++) {
            if (links[i].wood + links[i].stone + links[i].iron == 0) {
                //empty line, remove
                delete links[i];
            }
        }
        console.log('removed empty lines');
        for (let i = 0; i < Object.keys(links).length; i++) {
            //push to cleanLinks
            cleanLinks.push(links[Object.keys(links)[i]]);
        }

        console.log("pushed to clean array");
        cleanLinks = addDistanceToArray(cleanLinks);
        //create all rows for sendings
        listHTML = ``;
        cleanLinks.sort(function (left, right) { return left.distance - right.distance; });
        for (let i = 0; i < cleanLinks.length; i++) {
            console.log("Creating line " + i + "of the list");
            if (i % 2 == 0) {
                tempRow = " id='" + i + "' class='sophRowB'";
            }
            else {
                tempRow = " id='" + i + "' class='sophRowA'";
            }
            for (let property in villagesData) {
                if (villagesData[property].id == cleanLinks[i].source) {
                    sourceName = villagesData[property].name;
                    sourceURL = villagesData[property].url;
                }
            }
            for (let property in villagesData) {
                if (villagesData[property].id == cleanLinks[i].target) {
                    targetName = villagesData[property].name;
                    targetURL = villagesData[property].url;
                    targetWood = villagesData[property].wood;
                    targetStone = villagesData[property].stone;
                    targetIron = villagesData[property].iron;
                    targetCapacity = villagesData[property].warehouseCapacity;
                }
            }

            listHTML += `
        <tr ${tempRow} height="40">
            <td><a href="${sourceURL}" class="sophLink">${sourceName} </a></td>
            <td> <a href="${targetURL}" class="sophLink" data-toggle="tooltip" title="Wood in WH: ${targetWood} &#10;Clay in WH: ${targetStone}&#10;Iron in WH: ${targetIron}&#10;Warehouse capacity: ${targetCapacity}">${targetName}</a> </td>
            <td width="50" style="text-align:center">${cleanLinks[i].distance}</td>
            <td width="50" style="text-align:center">${cleanLinks[i].wood}<span class="icon header wood"> </span></td>
            <td width="50" style="text-align:center">${cleanLinks[i].stone}<span class="icon header stone"> </span></td>
            <td width="50" style="text-align:center">${cleanLinks[i].iron}<span class="icon header iron"> </span></td>
            <td style="text-align:center"><input type="button" class="btn btnSophie" id="building" tabindex="-1" value="${langShinko[7]}" onclick="sendResource(${cleanLinks[i].source},${cleanLinks[i].target},${cleanLinks[i].wood},${cleanLinks[i].stone},${cleanLinks[i].iron},${i})"></td>
        </tr>`;
        }
        $("#appendHere").eq(0).append(listHTML);
        $("#building")[0].focus();
        /*$(document).ready(function(){
            UI.ToolTip('[data-toggle="tooltip"]',);
          });*/


        //add shortage/excess to table at bottom

        for (let i = 0; i < shortageResources.length; i++) {
            if (parseInt(shortageResources[i][0].wood) + parseInt(shortageResources[i][1].stone) + parseInt(shortageResources[i][2].iron) != 0) {
                //still shortage
                stillShortage.push([villagesData[i].name, shortageResources[i]]);
            }
        }


        for (let i = 0; i < excessResources.length; i++) {
            if (parseInt(excessResources[i][0].wood) + parseInt(excessResources[i][1].stone) + parseInt(excessResources[i][2].iron) != 0) {
                //still shortage
                stillExcess.push([villagesData[i].name, excessResources[i]]);
            }
        }

        $("#totals").eq(0).append(`<div id='aftermath'><center>
        <button type="button" class="btn btnSophie" name="showStats" style="padding: 10px;width: 300px" onclick="showStats()">Show excess/shortage</button>
        <button type="button" class="btn btnSophie" name="showEndResult" style="padding: 10px;width: 300px" onclick="resAfterBalance()">Show result of balance</button>
        </center></div>`);
        console.log("Finished");

        //cleanup();
    }

}
displayEverything();


function checkDistance(x1, y1, x2, y2) {
    //calculate distance from current village
    var a = x1 - x2;
    var b = y1 - y2;
    var distance = Math.round(Math.hypot(a, b));
    return distance;
}


/* Script to scrape from TWExtreme website, this was for testing purposes before I wrote my own math, helped me test if the sending mechanic worked.

var linksFromExtreme = [];
var amountOfLinks = document.getElementById("1").children[0].children;
for (var i = 1; i < amountOfLinks.length; i++) {
    thisSend = document.getElementById("1").children[0].children[i].children[0].children[0].getAttribute('href');
    linksFromExtreme.push({
        "source": thisSend.match(/village=(\d*).*target=(\d*).*wood=(\d*).*clay=(\d*).*iron=(\d*)/)[1],
        "target": thisSend.match(/village=(\d*).*target=(\d*).*wood=(\d*).*clay=(\d*).*iron=(\d*)/)[2],
        "wood": thisSend.match(/village=(\d*).*target=(\d*).*wood=(\d*).*clay=(\d*).*iron=(\d*)/)[3],
        "clay": thisSend.match(/village=(\d*).*target=(\d*).*wood=(\d*).*clay=(\d*).*iron=(\d*)/)[4],
        "iron": thisSend.match(/village=(\d*).*target=(\d*).*wood=(\d*).*clay=(\d*).*iron=(\d*)/)[5]
    });
};
JSON.stringify(linksFromExtreme)

*/

function addDistanceToArray(array) {
    for (let i = 0; i < array.length; i++) {
        for (let property in villagesData) {
            if (villagesData[property].id == array[i].source) {
                sourceName = villagesData[property].name;
                sourceURL = villagesData[property].url;
            }
        }
        for (let property in villagesData) {
            if (villagesData[property].id == array[i].target) {
                targetName = villagesData[property].name;
                targetURL = villagesData[property].url;
            }
        }
        array[i].distance = checkDistance(sourceName.match(/(\d+)\|(\d+)/)[1], sourceName.match(/(\d+)\|(\d+)/)[2], targetName.match(/(\d+)\|(\d+)/)[1], targetName.match(/(\d+)\|(\d+)/)[2]);
    }
    return array;
}
function numberWithCommas(x) {
    // add . to make numbers more readable
    x = x.toString();
    var pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x))
        x = x.replace(pattern, "$1.$2");
    return x;
}

function showStats() {
    htmlStats = "<div class='sophRowA' style='width:800px' ><center><h1>Shortages:</h1><table class='sophHeader'><tr class='sophHeader'><td>Village name</td><td>Res</td></tr>";

    for (let i = 0; i < stillShortage.length; i++) {
        console.log("Creating line " + i + "of the list");
        if (i % 2 == 0) {
            tempRow = " id='" + i + "' class='sophRowB'";
        }
        else {
            tempRow = " id='" + i + "' class='sophRowA'";
        }

        htmlStats += `
        <tr ${tempRow} height="40">
            <td>${stillShortage[i][0]}</td>
            <td>${stillShortage[i][1][0].wood} , ${stillShortage[i][1][1].stone} , ${stillShortage[i][1][2].iron}</td>
        </tr>`;
    }

    htmlStats += "</table><h1>Excesses:</h1><table class='sophHeader'><tr class='sophHeader'><td>Village name</td><td>Res</td></tr>";

    for (let i = 0; i < stillExcess.length; i++) {
        console.log("Creating line " + i + "of the list");
        if (i % 2 == 0) {
            tempRow = " id='" + i + "' class='sophRowB'";
        }
        else {
            tempRow = " id='" + i + "' class='sophRowA'";
        }

        htmlStats += `
        <tr ${tempRow} height="40">
            <td>${stillExcess[i][0]}</td>
            <td>${stillExcess[i][1][0].wood} , ${stillExcess[i][1][1].stone} , ${stillExcess[i][1][2].iron}</td>
        </tr>`;
    }
    htmlStats += "</table></center></div>";

    Dialog.show("content", htmlStats);
}
function makeThingsCollapsible() {
    var coll = $(".collapsible");
    for (var i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function () {
            this.classList.toggle("active");
            var content = this.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    }
}

function saveSettings() {
    var tempArray = $("#settings").serializeArray();
    var rawSettings = {};
    for (let i = 0; i < tempArray.length; i++) {
        rawSettings[tempArray[i].name] = tempArray[i].value;
    }
    settings = normaliseSettings(rawSettings);
    localStorage.setItem("settingsWHBalancerSophie", JSON.stringify(settings));
    $("#restart").remove();
    $("#sendResources").remove();
    $("#tableSend").remove();
    $("#totals").remove();
    init();
    displayEverything();
}

function sliderChange(name, val) {
    document.getElementById(name).innerHTML = val;
}

function resAfterBalance() {
    resBalancedHTML = `<div class='sophRowA' style='width:800px' ><table style='width:100%'><tr class="sophHeader"><td>Village</td><td>Points</td><td>Merchants left</td><td colspan="3">Resources</td><td>WH capacity</td></tr>`;
    for (var i = 0; i < villagesData.length; i++) {
        thisMerchantLeft = villagesData[i].availableMerchants;
        if (incomingRes[villagesData[i].id] != undefined) {
            console.log("adding res underway to target");
            thisVillageTotalWood = incomingRes[villagesData[i].id].wood + parseInt(villagesData[i].wood);
            thisVillageTotalStone = incomingRes[villagesData[i].id].stone + parseInt(villagesData[i].stone);
            thisVillageTotalIron = incomingRes[villagesData[i].id].iron + parseInt(villagesData[i].iron);
        }
        else {
            thisVillageTotalWood = parseInt(villagesData[i].wood);
            thisVillageTotalStone = parseInt(villagesData[i].stone);
            thisVillageTotalIron = parseInt(villagesData[i].iron);
        }
        for (var j = 0; j < cleanLinks.length; j++) {
            if (cleanLinks[j].target == villagesData[i].id) {
                console.log('adding rows to be received to the res at the target');
                thisVillageTotalWood += cleanLinks[j].wood;
                thisVillageTotalStone += cleanLinks[j].stone;
                thisVillageTotalIron += cleanLinks[j].iron;
            }
            if (cleanLinks[j].source == villagesData[i].id) {
                console.log('addings rows to be sent to the res at the target');
                thisVillageTotalWood -= cleanLinks[j].wood;
                thisVillageTotalStone -= cleanLinks[j].stone;
                thisVillageTotalIron -= cleanLinks[j].iron;
                thisMerchantLeft -= (cleanLinks[j].wood + cleanLinks[j].stone + cleanLinks[j].iron) / 1000;
            }
        }

        if (i % 2 == 0) {
            tempRow = "class='sophRowB'";
        }
        else {
            tempRow = "class='sophRowA'";
        }

        resBalancedHTML += `
        <tr ${tempRow}>
            <td>${villagesData[i].name}</td>
            <td>${villagesData[i].points}</td>
            <td style="text-align:right;padding-right:2em">
                ${thisMerchantLeft + "/" + villagesData[i].totalMerchants}
            </td>
            <td>
                <span class="res wood" style="padding-left:1em">&nbsp;</span>${thisVillageTotalWood}
            </td>
            <td>
                <span class="res stone" style="padding-left:1em">&nbsp;</span>${thisVillageTotalStone}
            </td>
            <td>
                <span class="res iron" style="padding-left:1em">&nbsp;</span>${thisVillageTotalIron}
            </td>
            <td style="text-align:right">${villagesData[i].warehouseCapacity}</td>
        </tr>`;
    }
    resBalancedHTML += `</table></div>`;
    Dialog.show('content', resBalancedHTML);
}
