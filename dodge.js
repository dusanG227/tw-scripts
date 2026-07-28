// ==UserScript==
// @name         Real-time simulator skeleton
// @match        https://test.example.com/*
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const CONFIG = {
        routes: {
            arrivals: "/prichody",
            map: "/mapa",
            send: "/poslat",
            commands: "/prikazy",
        },

        timing: {
            redirectBeforeImpactMs: 30_000,
            cancelAfterSendMs: 31_000,
            domTimeoutMs: 15_000,
        },

        reserves: {
            unitX: 200,
            unitY: 30,
        },

        selectors: {
            serverTime: "[data-server-time]",
            arrivalRows: "[data-arrival]",

            mapPointsA: "[data-point-a]",
            mapPointsB: "[data-point-b]",

            unitX: "[data-unit='x']",
            unitY: "[data-unit='y']",
            coordinateX: "[name='coordinate-x']",
            coordinateY: "[name='coordinate-y']",
            sendUnitsButton: "[data-action='send-units']",

            resources: {
                wood: "[data-resource='wood']",
                clay: "[data-resource='clay']",
                iron: "[data-resource='iron']",
            },
            sendResourcesButton: "[data-action='send-resources']",

            commandRows: "[data-command-id]",
            cancelButton: "[data-action='cancel']",
        },

        storageKey: "realtime-simulator-state-v1",
    };

    const DEFAULT_STATE = {
        phase: "MONITORING",
        target: null,
        impactAt: null,
        cancellationAt: null,
        processedCommandIds: [],
    };

    // ------------------------------------------------------------------
    // Pomocné funkcie
    // ------------------------------------------------------------------

    function loadState() {
        try {
            return {
                ...DEFAULT_STATE,
                ...JSON.parse(sessionStorage.getItem(CONFIG.storageKey) || "{}"),
            };
        } catch {
            return { ...DEFAULT_STATE };
        }
    }

    function saveState(patch) {
        const next = { ...loadState(), ...patch };
        sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(next));
        return next;
    }

    function resetState() {
        sessionStorage.setItem(
            CONFIG.storageKey,
            JSON.stringify(DEFAULT_STATE),
        );
    }

    function currentRoute() {
        return window.location.pathname;
    }

    function navigate(path, parameters = {}) {
        const url = new URL(path, window.location.origin);

        for (const [key, value] of Object.entries(parameters)) {
            url.searchParams.set(key, String(value));
        }

        window.location.assign(url.toString());
    }

    function parseNumber(value) {
        const normalized = String(value ?? "")
            .replace(/\s/g, "")
            .replace(/[^\d-]/g, "");

        const result = Number.parseInt(normalized, 10);
        return Number.isFinite(result) ? result : 0;
    }

    function readNumericElement(selector) {
        const element = document.querySelector(selector);
        if (!element) return 0;

        return parseNumber(
            "value" in element ? element.value : element.textContent,
        );
    }

    function setInput(selector, value) {
        const input = document.querySelector(selector);
        if (!input) {
            throw new Error(`Vstupný element nebol nájdený: ${selector}`);
        }

        // Setter z prototypu je užitočný aj pri React/Vue formulároch.
        const prototype = Object.getPrototypeOf(input);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

        if (descriptor?.set) {
            descriptor.set.call(input, String(value));
        } else {
            input.value = String(value);
        }

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function click(selector, root = document) {
        const element = root.querySelector(selector);
        if (!element) {
            throw new Error(`Tlačidlo nebolo nájdené: ${selector}`);
        }

        element.click();
    }

    function waitForElement(selector, timeoutMs = CONFIG.timing.domTimeoutMs) {
        const existing = document.querySelector(selector);
        if (existing) return Promise.resolve(existing);

        return new Promise((resolve, reject) => {
            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);

                if (element) {
                    clearTimeout(timeout);
                    observer.disconnect();
                    resolve(element);
                }
            });

            const timeout = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Čakanie na ${selector} vypršalo.`));
            }, timeoutMs);

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
            });
        });
    }

    // ------------------------------------------------------------------
    // Čas servera
    // ------------------------------------------------------------------

    function parseServerTime(element) {
        /*
         * Adaptér podľa aplikácie:
         *
         * return Date.parse(element.dataset.serverTime);
         *
         * Ak stránka zobrazuje iba HH:mm:ss, treba doplniť dátum a ošetriť
         * prechod cez polnoc.
         */
        return Date.parse(element.dataset.serverTime);
    }

    function getServerClockOffset() {
        const clock = document.querySelector(CONFIG.selectors.serverTime);
        if (!clock) return 0;

        const serverNow = parseServerTime(clock);

        return Number.isFinite(serverNow)
            ? serverNow - Date.now()
            : 0;
    }

    function serverNow() {
        return Date.now() + getServerClockOffset();
    }

    function scheduleAtServerTime(serverTimestamp, callback) {
        let timeoutId;

        const arm = () => {
            const remaining = serverTimestamp - serverNow();

            if (remaining <= 0) {
                callback();
                return;
            }

            // Pri dlhšom čakaní pravidelne prepočítame odchýlku servera.
            timeoutId = window.setTimeout(
                arm,
                Math.min(remaining, 1_000),
            );
        };

        arm();
        return () => clearTimeout(timeoutId);
    }

    // ------------------------------------------------------------------
    // Príchody
    // ------------------------------------------------------------------

    function readArrivals() {
        return [...document.querySelectorAll(CONFIG.selectors.arrivalRows)]
            .map((row) => ({
                impactAt: Date.parse(row.dataset.impactAt),
                targetId: row.dataset.targetId,
            }))
            .filter((arrival) =>
                Number.isFinite(arrival.impactAt) &&
                arrival.impactAt > serverNow()
            )
            .sort((a, b) => a.impactAt - b.impactAt);
    }

    async function monitorArrivals() {
        await waitForElement(CONFIG.selectors.arrivalRows);

        const arrival = readArrivals()[0];
        if (!arrival) {
            console.info("Nebol nájdený žiadny budúci príchod.");
            return;
        }

        const redirectAt =
            arrival.impactAt -
            CONFIG.timing.redirectBeforeImpactMs;

        saveState({
            phase: "WAITING_FOR_MAP",
            target: { id: arrival.targetId },
            impactAt: arrival.impactAt,
        });

        scheduleAtServerTime(redirectAt, () => {
            navigate(CONFIG.routes.map);
        });
    }

    // ------------------------------------------------------------------
    // Mapa a výber najbližšieho bodu
    // ------------------------------------------------------------------

    function readPoint(element) {
        return {
            x: Number(element.dataset.x),
            y: Number(element.dataset.y),
            element,
        };
    }

    function distanceSquared(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    function findNearestPointB(pointA, pointsB) {
        return pointsB.reduce((nearest, candidate) => {
            if (!nearest) return candidate;

            return distanceSquared(pointA, candidate) <
                distanceSquared(pointA, nearest)
                ? candidate
                : nearest;
        }, null);
    }

    async function handleMap() {
        await waitForElement(CONFIG.selectors.mapPointsA);
        await waitForElement(CONFIG.selectors.mapPointsB);

        const pointAElement =
            document.querySelector(CONFIG.selectors.mapPointsA);

        const pointA = readPoint(pointAElement);
        const pointsB = [
            ...document.querySelectorAll(CONFIG.selectors.mapPointsB),
        ].map(readPoint);

        const nearest = findNearestPointB(pointA, pointsB);
        if (!nearest) {
            throw new Error("Na mape nebol nájdený žiadny bod B.");
        }

        saveState({
            phase: "SENDING_UNITS",
            target: { x: nearest.x, y: nearest.y },
        });

        navigate(CONFIG.routes.send, {
            x: nearest.x,
            y: nearest.y,
        });
    }

    // ------------------------------------------------------------------
    // Jednotky a suroviny
    // ------------------------------------------------------------------

    function calculateUnits() {
        const availableX =
            readNumericElement(CONFIG.selectors.unitX);

        const availableY =
            readNumericElement(CONFIG.selectors.unitY);

        return {
            unitX: Math.max(0, availableX - CONFIG.reserves.unitX),
            unitY: Math.max(0, availableY - CONFIG.reserves.unitY),
        };
    }

    function calculateResourceThirds() {
        const selectors = CONFIG.selectors.resources;

        return {
            wood: Math.floor(readNumericElement(selectors.wood) / 3),
            clay: Math.floor(readNumericElement(selectors.clay) / 3),
            iron: Math.floor(readNumericElement(selectors.iron) / 3),
        };
    }

    async function sendUnitsAndResources() {
        const state = loadState();
        const target = state.target;

        if (!target?.x || !target?.y) {
            throw new Error("Chýbajú cieľové súradnice.");
        }

        setInput(CONFIG.selectors.coordinateX, target.x);
        setInput(CONFIG.selectors.coordinateY, target.y);

        const units = calculateUnits();

        /*
         * Doplň selektory polí formulára:
         *
         * setInput("[name='unit-x']", units.unitX);
         * setInput("[name='unit-y']", units.unitY);
         */
        console.info("Vypočítané jednotky:", units);

        click(CONFIG.selectors.sendUnitsButton);

        /*
         * Ak kliknutie spôsobí navigáciu alebo otvorí potvrdzovací dialóg,
         * pokračovanie sa musí uložiť ako samostatná fáza a obnoviť po
         * načítaní ďalšej stránky.
         */
        await waitForElement(CONFIG.selectors.resources.wood);

        const resources = calculateResourceThirds();

        /*
         * Doplň selektory polí:
         *
         * setInput("[name='wood']", resources.wood);
         * setInput("[name='clay']", resources.clay);
         * setInput("[name='iron']", resources.iron);
         */
        console.info("Tretiny surovín:", resources);

        click(CONFIG.selectors.sendResourcesButton);

        const cancellationAt =
            serverNow() + CONFIG.timing.cancelAfterSendMs;

        saveState({
            phase: "WAITING_FOR_CANCELLATION",
            cancellationAt,
        });

        scheduleAtServerTime(cancellationAt, () => {
            navigate(CONFIG.routes.commands);
        });
    }

    // ------------------------------------------------------------------
    // Zrušenie posledných dvoch príkazov
    // ------------------------------------------------------------------

    async function cancelLastTwoCommands() {
        await waitForElement(CONFIG.selectors.commandRows);

        const rows = [
            ...document.querySelectorAll(CONFIG.selectors.commandRows),
        ];

        // Ak DOM nie je zoradený od najnovšieho, zoradíme ho podľa ID.
        const latestTwo = rows
            .map((row) => ({
                row,
                id: parseNumber(row.dataset.commandId),
            }))
            .filter((command) => command.id > 0)
            .sort((a, b) => b.id - a.id)
            .slice(0, 2);

        for (const command of latestTwo) {
            const cancelButton = command.row.querySelector(
                CONFIG.selectors.cancelButton,
            );

            if (!cancelButton) {
                console.warn(
                    `Príkaz ${command.id} nie je možné zrušiť.`,
                );
                continue;
            }

            cancelButton.click();

            // Podľa aplikácie sem patrí čakanie na potvrdenie alebo refresh.
            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        resetState();
        console.info("Cyklus simulátora bol dokončený.");
    }

    // ------------------------------------------------------------------
    // Obnova procesu po navigácii
    // ------------------------------------------------------------------

    async function main() {
        const route = currentRoute();
        const state = loadState();

        if (
            route === CONFIG.routes.arrivals &&
            state.phase === "MONITORING"
        ) {
            await monitorArrivals();
            return;
        }

        if (
            route === CONFIG.routes.map &&
            state.phase === "WAITING_FOR_MAP"
        ) {
            await handleMap();
            return;
        }

        if (
            route === CONFIG.routes.send &&
            state.phase === "SENDING_UNITS"
        ) {
            await sendUnitsAndResources();
            return;
        }

        if (state.phase === "WAITING_FOR_CANCELLATION") {
            const cancellationAt = Number(state.cancellationAt);

            if (route === CONFIG.routes.commands) {
                if (serverNow() >= cancellationAt) {
                    await cancelLastTwoCommands();
                } else {
                    scheduleAtServerTime(
                        cancellationAt,
                        cancelLastTwoCommands,
                    );
                }

                return;
            }

            scheduleAtServerTime(cancellationAt, () => {
                navigate(CONFIG.routes.commands);
            });
        }
    }

    main().catch((error) => {
        console.error("[Simulator]", error);
    });
})();
