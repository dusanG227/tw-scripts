// Tribal Wars mobile resource sender diagnostics.
// Read-only: does not save settings and does not send resources.
(function () {
    "use strict";

    var oldPanel = document.getElementById("tw-mobile-diagnostics");
    if (oldPanel) {
        oldPanel.parentNode.removeChild(oldPanel);
    }

    function cleanText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 180);
    }

    function count($root, selector) {
        return $root.find(selector).length;
    }

    function sampleTexts($elements, limit) {
        var result = [];
        var max = Math.min($elements.length, limit);

        for (var i = 0; i < max; i++) {
            result.push((i + 1) + ": " + cleanText($elements[i].innerText || $elements[i].textContent));
        }

        return result.length ? result.join("\n") : "(nič)";
    }

    function showResult(text) {
        var panel = document.createElement("div");
        panel.id = "tw-mobile-diagnostics";
        panel.style.cssText = [
            "position:fixed",
            "left:8px",
            "right:8px",
            "top:8px",
            "bottom:8px",
            "z-index:2147483647",
            "overflow:auto",
            "box-sizing:border-box",
            "padding:14px",
            "background:#f5e5bf",
            "color:#2b1607",
            "border:3px solid #7d3b00",
            "border-radius:8px",
            "font:14px/1.4 monospace",
            "-webkit-overflow-scrolling:touch"
        ].join(";");

        var closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.textContent = "Zavrieť diagnostiku";
        closeButton.style.cssText = "position:sticky;top:0;width:100%;min-height:44px;margin-bottom:10px;font-size:16px;z-index:2";
        closeButton.onclick = function () {
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        };

        var output = document.createElement("pre");
        output.style.cssText = "margin:0;white-space:pre-wrap;overflow-wrap:anywhere";
        output.textContent = text;

        panel.appendChild(closeButton);
        panel.appendChild(output);
        document.body.appendChild(panel);
    }

    if (typeof window.jQuery === "undefined" || typeof window.game_data === "undefined") {
        showResult("CHYBA\nNa stránke nie je dostupné jQuery alebo game_data.");
        return;
    }

    var $ = window.jQuery;
    var sitterPart = game_data.player && game_data.player.sitter > 0
        ? "t=" + game_data.player.id + "&"
        : "";
    var url = "game.php?" + sitterPart + "screen=overview_villages&mode=prod&page=-1";

    $.get(url).done(function (page) {
        var $page = $(page);
        var $villages = $page.find(".quickedit-vn");
        var $marketLinks = $page.find('a[href*="market"]');
        var lines = [];

        lines.push("SURKY – MOBILNÁ DIAGNOSTIKA");
        lines.push("Nič nebolo odoslané ani uložené.");
        lines.push("");
        lines.push("Doména: " + window.location.hostname);
        lines.push("Svet: " + (game_data.world || "?"));
        lines.push("game_data.device: " + (game_data.device || "?"));
        lines.push("mobileHeader na stránke: " + $("#mobileHeader").length);
        lines.push("Načítané znaky HTML: " + String(page).length);
        lines.push("");
        lines.push("--- POČTY V NAČÍTANOM PREHĽADE ---");
        lines.push(".quickedit-vn (dediny): " + $villages.length);
        lines.push(".mobile_box: " + count($page, ".mobile_box"));
        lines.push("#production_table: " + count($page, "#production_table"));
        lines.push(".res.mwood: " + count($page, ".res.mwood"));
        lines.push(".res.mstone: " + count($page, ".res.mstone"));
        lines.push(".res.miron: " + count($page, ".res.miron"));
        lines.push(".res.wood: " + count($page, ".res.wood"));
        lines.push(".res.stone: " + count($page, ".res.stone"));
        lines.push(".res.iron: " + count($page, ".res.iron"));
        lines.push(".mheader.ressources (sklady): " + count($page, ".mheader.ressources"));
        lines.push(".header.population (farmy): " + count($page, ".header.population"));
        lines.push("a[href*=market]: " + $marketLinks.length);
        lines.push(".trader_img: " + count($page, ".trader_img"));
        lines.push("");
        lines.push("--- PRVÉ 3 DEDINY ---");
        lines.push(sampleTexts($villages, 3));
        lines.push("");
        lines.push("--- PRVÝCH 5 ODKAZOV NA TRH ---");
        lines.push(sampleTexts($marketLinks, 5));

        if ($villages.length) {
            var village = $villages.eq(0);
            var parent = village.parent();
            var grandParent = parent.parent();
            lines.push("");
            lines.push("--- ŠTRUKTÚRA PRVEJ DEDINY ---");
            lines.push("Dedina tag/class: " + village.prop("tagName") + " / " + (village.attr("class") || ""));
            lines.push("data-id: " + (village.attr("data-id") || "(chýba)"));
            lines.push("Rodič tag/class: " + parent.prop("tagName") + " / " + (parent.attr("class") || ""));
            lines.push("Starý rodič tag/class: " + grandParent.prop("tagName") + " / " + (grandParent.attr("class") || ""));
        }

        showResult(lines.join("\n"));
    }).fail(function (xhr, status) {
        showResult(
            "SURKY – MOBILNÁ DIAGNOSTIKA\n\n" +
            "Nepodarilo sa načítať prehľad produkcie.\n" +
            "Stav: " + status + "\n" +
            "HTTP: " + (xhr && xhr.status ? xhr.status : "?")
        );
    });
})();
