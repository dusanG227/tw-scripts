(function () {
    var SCRIPT_URL = "https://shinko-to-kuma.com/scripts/massScavenge.js";

    function patchMassScavenge() {
        if (window.massScavengePriorityHoursPatched === true) {
            return;
        }

        if (typeof calculateUnitsPerVillage !== "function") {
            console.error("massScavenge patch: calculateUnitsPerVillage was not found.");
            return;
        }

        window.massScavengePriorityHoursPatched = true;

        var originalCalculateUnitsPerVillage = calculateUnitsPerVillage;

        calculateUnitsPerVillage = function (troopsAllowed) {
            var shouldForcePriority =
                (typeof $ === "function" &&
                    $("#timeSelectorHours").length > 0 &&
                    $("#timeSelectorHours")[0].checked === true) ||
                localStorage.getItem("timeElement") === "Hours";

            if (shouldForcePriority !== true) {
                return originalCalculateUnitsPerVillage(troopsAllowed);
            }

            var previousPrioritiseHighCat = prioritiseHighCat;
            prioritiseHighCat = true;

            try {
                return originalCalculateUnitsPerVillage(troopsAllowed);
            } finally {
                prioritiseHighCat = previousPrioritiseHighCat;
            }
        };
    }

    if (typeof premiumBtnEnabled === "undefined") {
        window.premiumBtnEnabled = false;
    }

    if (typeof calculateUnitsPerVillage === "function") {
        patchMassScavenge();
        return;
    }

    $.getScript(SCRIPT_URL).done(function () {
        patchMassScavenge();
    });
})();
