(function attachFarmTrackerCore(globalScope) {
  "use strict";

  const DATE_PATTERN = String.raw`(?:\b\d{1,2}\.\d{1,2}\.\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\b|\b\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\b)`;
  const LOOT_HINT_PATTERN = String.raw`(?:lup|loot|plunder|hauls?|haul|beute|korist|farm|drevo|wood|holz|hlina|clay|stone|lehm|zelezo|iron|eisen)`;
  const REPORT_ID_PATTERN = /(?:view|report_id|report|sprava|id)[^\d]{0,8}(\d{4,})/i;

  const RESOURCE_ICON_SELECTORS = {
    wood: [
      ".icon.header.wood",
      "[data-type='wood']",
      "img[src*='holz']",
      "img[src*='wood']",
    ],
    clay: [
      ".icon.header.stone",
      ".icon.header.clay",
      "[data-type='stone']",
      "[data-type='clay']",
      "img[src*='stone']",
      "img[src*='clay']",
      "img[src*='lehm']",
    ],
    iron: [
      ".icon.header.iron",
      "[data-type='iron']",
      "img[src*='iron']",
      "img[src*='eisen']",
    ],
  };
  const LOOT_LABEL_REGEX = /(korist|lup|loot|haul|beute)/i;
  const NUMBER_GROUP_REGEX = /\d{1,3}(?:[ .,'\u00a0]\d{3})*|\d+/g;

  const FarmTrackerCore = {
    dedupeRecords,
    extractResources,
    formatDateForFile,
    formatDateTime,
    formatNumber,
    getCurrentVillageLabel,
    isSameCalendarDay,
    isWithinLastDays,
    mergeRecords,
    parseCommandDetailHtml,
    parseInput,
    scanReturnCommands,
    scanPage,
    summarizeByVillage,
    sumRecords,
  };

  globalScope.FarmTrackerCore = FarmTrackerCore;

  function parseInput(raw) {
    const htmlRecords = parseHtmlInput(raw);
    const textRecords = parseTextInput(stripHtml(raw));
    return dedupeRecords([...htmlRecords, ...textRecords]);
  }

  function parseHtmlInput(raw) {
    if (!/<[a-z][\s\S]*>/i.test(raw)) {
      return [];
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    const records = [];
    const candidates = Array.from(doc.querySelectorAll("tr, li, article, section, div"));

    for (const candidate of candidates) {
      const text = normalizeText(candidate.innerText || candidate.textContent || "");
      if (!text || text.length > 420) {
        continue;
      }

      if (!containsDate(text) && !createLootHintRegex().test(text)) {
        continue;
      }

      const record = parseRecordBlock(text);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  function parseTextInput(rawText) {
    const normalized = rawText.replace(/\r/g, "").trim();
    if (!normalized) {
      return [];
    }

    const delimitedRecords = parseDelimitedText(normalized);
    const blocks = splitIntoBlocks(normalized);
    const records = [...delimitedRecords];

    for (const block of blocks) {
      const record = parseRecordBlock(block);
      if (record) {
        records.push(record);
      }
    }

    if (records.length) {
      return records;
    }

    const fallback = parseResourceRuns(normalized);
    return fallback.map((resources, index) => buildRecord({
      block: normalized,
      isoDate: new Date().toISOString(),
      wood: resources.wood,
      clay: resources.clay,
      iron: resources.iron,
      reportId: `fallback-${index + 1}`,
    }));
  }

  function scanPage(doc) {
    const scope = findScanRoot(doc);
    const records = [];
    const candidates = Array.from(scope.querySelectorAll("tr, li, article, section, div"));

    for (const candidate of candidates) {
      const text = normalizeText(candidate.innerText || candidate.textContent || "");
      if (!isLikelyReportCandidate(candidate, text)) {
        continue;
      }

      const record = parseElementRecord(candidate);
      if (record) {
        records.push(record);
      }
    }

    if (!records.length) {
      const selectedText = String(doc.getSelection ? doc.getSelection() : "").trim();
      if (selectedText) {
        return parseTextInput(selectedText);
      }
    }

    if (!records.length && scope && shouldFallbackToScopeText(doc, scope)) {
      return parseTextInput(normalizeText(scope.innerText || scope.textContent || ""));
    }

    return dedupeRecords(records);
  }

  function scanReturnCommands(doc, options = {}) {
    const commands = [];
    const baseUrl = options.baseUrl
      || (doc.location && doc.location.href)
      || doc.baseURI
      || (globalScope.location && globalScope.location.href)
      || "";
    const currentVillage = getCurrentVillageLabel(doc);
    const seenIds = new Set();
    const rows = Array.from(doc.querySelectorAll("tr"));

    for (const row of rows) {
      const text = normalizeText(row.textContent || "");
      const asciiText = toAsciiLower(text);

      if (!asciiText.includes("navrat z dedina barbarov")) {
        continue;
      }

      const detailLink = findCommandDetailLink(row);
      if (!detailLink) {
        continue;
      }

      const commandId = extractCommandIdFromUrl(detailLink.href) || extractReportId(text);
      if (!commandId || seenIds.has(commandId)) {
        continue;
      }

      const homeVillage = extractHomeVillageFromRow(row, currentVillage);
      const targetVillage = extractTargetVillageFromText(text);
      const arrivalText = extractArrivalTextFromRow(row);

      commands.push({
        id: commandId,
        key: commandId,
        detailUrl: new URL(detailLink.getAttribute("href"), baseUrl).href,
        homeVillage,
        targetVillage,
        arrivalText,
        rawText: text,
      });

      seenIds.add(commandId);
    }

    return commands;
  }

  function parseCommandDetailHtml(rawHtml) {
    if (!rawHtml) {
      return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");
    const containers = Array.from(doc.querySelectorAll("tr, td, th, div, span, table, li, p"));

    for (const container of containers) {
      const resources = extractLootFromElement(container);
      if (resources) {
        return resources;
      }
    }

    const snippet = extractLootSnippetFromHtml(rawHtml);
    if (snippet) {
      const resources = parseStrictLootText(snippet);
      if (resources) {
        return resources;
      }
    }

    return null;
  }

  function summarizeByVillage(records) {
    const buckets = new Map();

    for (const record of records) {
      const village = record.homeVillage || "Neznama dedina";
      const current = buckets.get(village) || {
        village,
        count: 0,
        wood: 0,
        clay: 0,
        iron: 0,
        total: 0,
      };

      current.count += 1;
      current.wood += record.wood || 0;
      current.clay += record.clay || 0;
      current.iron += record.iron || 0;
      current.total += record.total || 0;
      buckets.set(village, current);
    }

    return Array.from(buckets.values()).sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total;
      }

      return left.village.localeCompare(right.village, "sk");
    });
  }

  function findScanRoot(doc) {
    return doc.querySelector("#report_list, #report_table, #content_value, #contentContainer, #ds_body, #mobileContent, body") || doc.body;
  }

  function getCurrentVillageLabel(doc) {
    const selectors = [
      "#menu_row2 b",
      "#menu_row2 strong",
      "#menu_row2 .quickedit-label",
      "#menu_row2 span",
      "#header_info .village-name",
      "#content_value h2",
      "title",
    ];

    for (const selector of selectors) {
      const elements = selector === "title"
        ? [doc.querySelector("title")]
        : Array.from(doc.querySelectorAll(selector));

      for (const element of elements) {
        const text = normalizeText(element && (element.textContent || ""));
        const label = extractVillageLabel(text);
        if (label) {
          return label;
        }
      }
    }

    const bodyText = normalizeText(doc.body ? doc.body.textContent : "");
    return extractVillageLabel(bodyText) || `Dedina #${new URL(doc.location.href).searchParams.get("village") || "?"}`;
  }

  function isLikelyReportCandidate(element, text) {
    if (!text || text.length < 12 || text.length > 420) {
      return false;
    }

    if (!containsDate(text) && !hasReportLink(element) && !hasResourceIcon(element)) {
      return false;
    }

    if (hasResourceIcon(element)) {
      return true;
    }

    if (createLootHintRegex().test(text)) {
      return true;
    }

    return countNumericTokens(removeDateFragments(text)) >= 3;
  }

  function parseElementRecord(element) {
    const text = normalizeText(element.innerText || element.textContent || "");
    if (!text) {
      return null;
    }

    const resources = extractResourcesFromElement(element) || extractResources(text);
    if (!resources) {
      return null;
    }

    const reportId = extractReportIdFromElement(element) || extractReportId(text);
    const isoDate = extractDate(text) || extractDateFromElement(element) || new Date().toISOString();

    return buildRecord({
      block: text,
      isoDate,
      wood: resources.wood,
      clay: resources.clay,
      iron: resources.iron,
      reportId,
    });
  }

  function parseDelimitedText(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseDelimitedLine)
      .filter(Boolean);
  }

  function parseDelimitedLine(line) {
    if (!/[;\t]/.test(line)) {
      return null;
    }

    const parts = line.split(/[;\t]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 4) {
      return null;
    }

    const isoDate = parseDateString(parts[0]) || new Date().toISOString();
    const wood = parseWholeNumber(parts[1]);
    const clay = parseWholeNumber(parts[2]);
    const iron = parseWholeNumber(parts[3]);

    if (![wood, clay, iron].every((value) => Number.isFinite(value))) {
      return null;
    }

    return buildRecord({
      block: line,
      isoDate,
      wood,
      clay,
      iron,
      reportId: parts[4] || extractReportId(line),
    });
  }

  function splitIntoBlocks(text) {
    const dateRegex = createDateRegex("g");
    const dateMatches = Array.from(text.matchAll(dateRegex));

    if (dateMatches.length > 1) {
      return dateMatches.map((match, index) => {
        const start = match.index;
        const next = dateMatches[index + 1];
        const end = next ? next.index : text.length;
        return text.slice(start, end).trim();
      }).filter(Boolean);
    }

    return text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  function parseRecordBlock(block) {
    const isoDate = extractDate(block);
    const resources = extractResources(block);

    if (!resources) {
      return null;
    }

    return buildRecord({
      block,
      isoDate: isoDate || new Date().toISOString(),
      wood: resources.wood,
      clay: resources.clay,
      iron: resources.iron,
      reportId: extractReportId(block),
    });
  }

  function extractDate(block) {
    const match = block.match(createDateRegex());
    if (!match || !match[0]) {
      return null;
    }

    return parseDateString(match[0]);
  }

  function extractDateFromElement(element) {
    const attrValues = [
      element.getAttribute("data-date"),
      element.getAttribute("title"),
      element.getAttribute("datetime"),
    ].filter(Boolean);

    const timeNode = element.querySelector("time[datetime], time[title], [data-date]");
    if (timeNode) {
      attrValues.push(
        timeNode.getAttribute("datetime"),
        timeNode.getAttribute("title"),
        timeNode.getAttribute("data-date"),
      );
    }

    for (const value of attrValues) {
      const parsed = parseDateString(value);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  function parseDateString(value) {
    if (!value) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const parsedIso = new Date(value.replace(" ", "T"));
      return Number.isNaN(parsedIso.getTime()) ? null : parsedIso.toISOString();
    }

    const dateTimeMatch = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!dateTimeMatch) {
      return null;
    }

    const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw] = dateTimeMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const isoLike = `${year}-${pad(monthRaw)}-${pad(dayRaw)}T${pad(hourRaw)}:${pad(minuteRaw)}:${pad(secondRaw || "00")}`;
    const parsed = new Date(isoLike);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function extractResources(block) {
    const fromLabels = extractResourcesFromLabels(block);
    if (fromLabels) {
      return fromLabels;
    }

    const fromLootLine = extractResourcesFromLootLines(block);
    if (fromLootLine) {
      return fromLootLine;
    }

    const runs = parseResourceRuns(block);
    return runs[0] || null;
  }

  function extractResourcesFromElement(element) {
    const wood = readResourceValueFromElement(element, RESOURCE_ICON_SELECTORS.wood);
    const clay = readResourceValueFromElement(element, RESOURCE_ICON_SELECTORS.clay);
    const iron = readResourceValueFromElement(element, RESOURCE_ICON_SELECTORS.iron);

    if (![wood, clay, iron].every((value) => Number.isFinite(value))) {
      return null;
    }

    return { wood, clay, iron };
  }

  function extractLootFromElement(element) {
    const text = normalizeText(element.textContent || "");
    if (!text || text.length > 320 || !LOOT_LABEL_REGEX.test(text)) {
      return null;
    }

    const lootOnlyText = extractLootOnlyText(text);
    if (lootOnlyText) {
      const fromText = parseStrictLootText(lootOnlyText);
      if (fromText) {
        return fromText;
      }
    }

    const fromIcons = extractResourcesFromElement(element);
    return fromIcons || null;
  }

  function readResourceValueFromElement(element, selectors) {
    for (const selector of selectors) {
      const matches = Array.from(element.querySelectorAll(selector));
      for (const match of matches) {
        const siblingValue = readNumberAfterNode(match);
        if (Number.isFinite(siblingValue)) {
          return siblingValue;
        }

        const parentCell = match.closest("td, th, span, div");
        if (parentCell) {
          const numbers = (normalizeText(parentCell.textContent || "").match(/\d[\d.,'\s]*/g) || [])
            .map(parseWholeNumber)
            .filter((value) => Number.isFinite(value));
          if (numbers.length === 1) {
            return numbers[0];
          }
        }
      }
    }

    return null;
  }

  function readNumberAfterNode(node) {
    let cursor = node.nextSibling;

    while (cursor) {
      if (cursor.nodeType === Node.ELEMENT_NODE && hasResourceIcon(cursor)) {
        break;
      }

      const text = normalizeText(cursor.textContent || "");
      const matches = text.match(/\d[\d.,'\s]*/g) || [];
      if (matches.length) {
        return parseWholeNumber(matches[0]);
      }

      cursor = cursor.nextSibling;
    }

    return null;
  }

  function extractResourcesFromLabels(block) {
    const wood = captureNumberNearLabel(block, ["drevo", "wood", "holz"]);
    const clay = captureNumberNearLabel(block, ["hlina", "clay", "stone", "lehm"]);
    const iron = captureNumberNearLabel(block, ["zelezo", "iron", "eisen"]);

    if ([wood, clay, iron].some((value) => value === null)) {
      return null;
    }

    return { wood, clay, iron };
  }

  function captureNumberNearLabel(block, labels) {
    for (const label of labels) {
      const afterRegex = new RegExp(`${escapeRegex(label)}[^\\d]{0,16}([\\d.,'\\s]+)`, "i");
      const afterMatch = block.match(afterRegex);
      if (afterMatch && afterMatch[1]) {
        return parseWholeNumber(afterMatch[1]);
      }

      const beforeRegex = new RegExp(`([\\d.,'\\s]+)[^\\d]{0,16}${escapeRegex(label)}`, "i");
      const beforeMatch = block.match(beforeRegex);
      if (beforeMatch && beforeMatch[1]) {
        return parseWholeNumber(beforeMatch[1]);
      }
    }

    return null;
  }

  function extractResourcesFromLootLines(block) {
    const lines = block.split("\n");

    for (const line of lines) {
      if (!createLootHintRegex().test(line)) {
        continue;
      }

      const triplet = extractTripletNumbers(removeDateFragments(line));
      if (triplet) {
        return triplet;
      }
    }

    return null;
  }

  function parseResourceRuns(block) {
    if (!createLootHintRegex().test(block) && !/(drevo|wood|holz|hlina|clay|lehm|iron|eisen|zelezo)/i.test(block)) {
      return [];
    }

    const triplet = extractTripletNumbers(removeDateFragments(block));
    return triplet ? [triplet] : [];
  }

  function extractTripletNumbers(text) {
    const cleaned = normalizeText(
      text
        .replace(/\(\d{1,3}\|\d{1,3}\)/g, " ")
        .replace(/\bK\d{1,3}\b/gi, " ")
        .replace(/\b(?:report|sprava|id)\b/gi, " ")
        .replace(createLootHintRegex("gi"), " ")
        .replace(/(?:drevo|wood|holz|hlina|clay|stone|lehm|zelezo|iron|eisen)/gi, " ")
        .replace(/[:=]/g, " ")
    );

    const separated = cleaned
      .split(/[;\t/]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map(parseWholeNumber)
      .filter((value) => Number.isFinite(value));

    if (separated.length >= 3) {
      return {
        wood: separated[0],
        clay: separated[1],
        iron: separated[2],
      };
    }

    const tokens = cleaned.match(/\d+/g) || [];
    if (tokens.length < 3) {
      return null;
    }

    if (tokens.length === 3) {
      return {
        wood: Number.parseInt(tokens[0], 10),
        clay: Number.parseInt(tokens[1], 10),
        iron: Number.parseInt(tokens[2], 10),
      };
    }

    for (let start = Math.max(0, tokens.length - 9); start <= tokens.length - 3; start += 1) {
      const candidate = chooseBestPartition(tokens.slice(start));
      if (candidate) {
        return {
          wood: candidate[0],
          clay: candidate[1],
          iron: candidate[2],
        };
      }
    }

    const lastThree = tokens.slice(-3).map((value) => Number.parseInt(value, 10));
    if (lastThree.every((value) => Number.isFinite(value))) {
      return {
        wood: lastThree[0],
        clay: lastThree[1],
        iron: lastThree[2],
      };
    }

    return null;
  }

  function chooseBestPartition(tokens) {
    let best = null;

    for (let firstEnd = 1; firstEnd <= tokens.length - 2; firstEnd += 1) {
      for (let secondEnd = firstEnd + 1; secondEnd <= tokens.length - 1; secondEnd += 1) {
        const groups = [
          tokens.slice(0, firstEnd),
          tokens.slice(firstEnd, secondEnd),
          tokens.slice(secondEnd),
        ];

        if (!groups.every(isValidThousandsGroup)) {
          continue;
        }

        const numbers = groups.map((group) => Number.parseInt(group.join(""), 10));
        if (!numbers.every((value) => Number.isFinite(value) && value <= 1000000000)) {
          continue;
        }

        const score = magnitudeSpreadScore(numbers) + Math.abs(groups[0].length - groups[2].length);
        if (!best || score < best.score) {
          best = { numbers, score };
        }
      }
    }

    return best ? best.numbers : null;
  }

  function isValidThousandsGroup(group) {
    if (!group.length) {
      return false;
    }

    if (group[0].length < 1 || group[0].length > 3) {
      return false;
    }

    return group.slice(1).every((token) => token.length === 3);
  }

  function magnitudeSpreadScore(numbers) {
    const safe = numbers.map((value) => Math.max(1, value));
    return Math.max(...safe) / Math.min(...safe);
  }

  function extractReportId(block) {
    const explicitMatch = block.match(REPORT_ID_PATTERN);
    if (explicitMatch) {
      return explicitMatch[1];
    }

    return null;
  }

  function extractReportIdFromElement(element) {
    const links = Array.from(element.querySelectorAll("a[href]"));
    for (const link of links) {
      const match = link.href.match(/(?:view|report_id|id)=(\d{4,})/i);
      if (match) {
        return match[1];
      }
    }

    return extractReportId(normalizeText(element.textContent || ""));
  }

  function hasReportLink(element) {
    return Boolean(element.querySelector("a[href*='report'], a[href*='view='], a[href*='id=']"));
  }

  function findCommandDetailLink(row) {
    return row.querySelector("a[href*='screen=info_command'][href*='id='], a[href*='info_command&id='], a[href*='screen=info_command']");
  }

  function extractCommandIdFromUrl(url) {
    const match = String(url || "").match(/[?&]id=(\d{4,})/i);
    return match ? match[1] : null;
  }

  function extractHomeVillageFromRow(row, fallbackVillage) {
    const cells = Array.from(row.cells || []);

    for (const cell of cells) {
      const text = normalizeText(cell.textContent || "");
      const label = extractVillageLabel(text);

      if (!label) {
        continue;
      }

      if (toAsciiLower(text).includes("dedina barbarov")) {
        continue;
      }

      return label;
    }

    return fallbackVillage || "Neznama dedina";
  }

  function extractTargetVillageFromText(text) {
    const targetMatch = normalizeText(text).match(/Dedina barbarov\s*\(\d{1,3}\|\d{1,3}\)\s*K\d{1,3}/i);
    return targetMatch ? targetMatch[0] : "Dedina barbarov";
  }

  function extractArrivalTextFromRow(row) {
    const cells = Array.from(row.cells || []);

    for (const cell of cells) {
      const text = normalizeText(cell.textContent || "");
      const asciiText = toAsciiLower(text);

      if (!text) {
        continue;
      }

      if (asciiText.includes("dnes") || asciiText.includes("zajtra") || asciiText.includes("vcera")) {
        return text;
      }

      if (/\d{1,2}:\d{2}:\d{2}/.test(text)) {
        return text;
      }
    }

    return "";
  }

  function extractVillageLabel(text) {
    const match = normalizeText(text).match(/[^\n\r]+?\(\d{1,3}\|\d{1,3}\)\s*K\d{1,3}/);
    return match ? normalizeText(match[0]) : null;
  }

  function hasResourceIcon(element) {
    const selector = [
      ...RESOURCE_ICON_SELECTORS.wood,
      ...RESOURCE_ICON_SELECTORS.clay,
      ...RESOURCE_ICON_SELECTORS.iron,
    ].join(",");

    return typeof element.matches === "function" && element.matches(selector)
      || Boolean(element.querySelector && element.querySelector(selector));
  }

  function containsDate(text) {
    return createDateRegex().test(text);
  }

  function shouldFallbackToScopeText(doc, scope) {
    const scopeText = normalizeText(scope.innerText || scope.textContent || "");
    const href = doc.location ? String(doc.location.href || "") : "";

    if (/screen=report/i.test(href)) {
      return true;
    }

    if (/\breport\b/i.test(scopeText) && createLootHintRegex().test(scopeText)) {
      return true;
    }

    return false;
  }

  function createDateRegex(flags = "g") {
    return new RegExp(DATE_PATTERN, flags);
  }

  function createLootHintRegex(flags = "i") {
    return new RegExp(LOOT_HINT_PATTERN, flags);
  }

  function countNumericTokens(text) {
    return (text.match(/\d+/g) || []).length;
  }

  function buildRecord({ block, isoDate, wood, clay, iron, reportId }) {
    const timestamp = new Date(isoDate).getTime();
    const safeTimestamp = Number.isNaN(timestamp) ? Date.now() : timestamp;

    return {
      id: reportId || null,
      key: reportId || makeFingerprint(block, safeTimestamp, wood, clay, iron),
      date: new Date(safeTimestamp).toISOString(),
      timestamp: safeTimestamp,
      wood,
      clay,
      iron,
      total: wood + clay + iron,
    };
  }

  function mergeRecords(existingRecords, incomingRecords) {
    const merged = existingRecords.slice();
    const knownKeys = new Set(existingRecords.map((record) => record.key));
    let added = 0;
    let skipped = 0;

    for (const record of incomingRecords) {
      if (!record || knownKeys.has(record.key)) {
        skipped += 1;
        continue;
      }

      merged.push(record);
      knownKeys.add(record.key);
      added += 1;
    }

    merged.sort((left, right) => right.timestamp - left.timestamp);
    return { records: merged, added, skipped };
  }

  function dedupeRecords(records) {
    const seen = new Set();
    return records.filter((record) => {
      if (!record || seen.has(record.key)) {
        return false;
      }

      seen.add(record.key);
      return true;
    });
  }

  function makeFingerprint(block, timestamp, wood, clay, iron) {
    const normalizedBlock = normalizeText(block).toLowerCase().slice(0, 220);
    return `${timestamp}:${wood}:${clay}:${iron}:${normalizedBlock}`;
  }

  function removeDateFragments(text) {
    return text.replace(createDateRegex("g"), " ");
  }

  function extractLootOnlyText(text) {
    const match = normalizeText(text).match(/(?:korist|lup|loot|haul|beute)\s*:?\s*([\s\S]{0,120})/i);
    return match ? normalizeText(match[1]) : null;
  }

  function parseStrictLootText(text) {
    const normalized = normalizeText(text)
      .replace(/\(\d{1,3}\|\d{1,3}\)/g, " ")
      .replace(/\bK\d{1,3}\b/gi, " ")
      .replace(/(?:drevo|wood|holz|hlina|clay|stone|lehm|zelezo|iron|eisen|korist|lup|loot|haul|beute)/gi, " ")
      .replace(/[:=|]/g, " ")
      .trim();

    const numberMatches = normalized.match(NUMBER_GROUP_REGEX) || [];
    if (numberMatches.length < 3) {
      return null;
    }

    const parsedNumbers = numberMatches
      .slice(0, 3)
      .map(parseWholeNumber);

    if (!parsedNumbers.every((value) => Number.isFinite(value))) {
      return null;
    }

    return {
      wood: parsedNumbers[0],
      clay: parsedNumbers[1],
      iron: parsedNumbers[2],
    };
  }

  function extractLootSnippetFromHtml(rawHtml) {
    const match = String(rawHtml).match(/(?:korist|lup|loot|haul|beute)(?:.|\n|\r){0,180}/i);
    return match ? stripHtml(match[0]) : null;
  }

  function stripHtml(raw) {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ");
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function toAsciiLower(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function parseWholeNumber(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (!digits) {
      return null;
    }

    return Number.parseInt(digits, 10);
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function sumRecords(records) {
    return records.reduce((totals, record) => {
      totals.wood += record.wood;
      totals.clay += record.clay;
      totals.iron += record.iron;
      totals.total += record.total;
      return totals;
    }, { wood: 0, clay: 0, iron: 0, total: 0 });
  }

  function isSameCalendarDay(timestamp, date) {
    const entry = new Date(timestamp);
    return entry.getFullYear() === date.getFullYear()
      && entry.getMonth() === date.getMonth()
      && entry.getDate() === date.getDate();
  }

  function isWithinLastDays(timestamp, days, now) {
    const diff = now.getTime() - timestamp;
    return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("sk-SK").format(value);
  }

  function formatDateTime(timestamp) {
    return new Intl.DateTimeFormat("sk-SK", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(timestamp));
  }

  function formatDateForFile(date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    return `${year}-${month}-${day}-${hour}${minute}`;
  }
})(window);


(function bootFarmTrackerBookmarklet() {
  "use strict";

  if (shouldRedirectToReturnPage()) {
    redirectToReturnPage();
    return;
  }

  if (window.__TW_FARM_TRACKER_APP__ && typeof window.__TW_FARM_TRACKER_APP__.reopen === "function") {
    window.__TW_FARM_TRACKER_APP__.reopen();
    return;
  }

  if (window.FarmTrackerCore) {
    start(window.FarmTrackerCore);
    return;
  }

  const currentScript = resolveCurrentScript();
  const baseUrl = currentScript && currentScript.src
    ? new URL(".", currentScript.src).href
    : "";

  if (!baseUrl) {
    window.alert("Farm Tracker: nepodarilo sa zistit URL bookmarkletu.");
    return;
  }

  const coreUrl = new URL("tracker-core.js", baseUrl).href;

  const existingCore = document.getElementById("tw-farm-tracker-core-loader");
  if (existingCore) {
    existingCore.addEventListener("load", () => start(window.FarmTrackerCore), { once: true });
    return;
  }

  const loader = document.createElement("script");
  loader.id = "tw-farm-tracker-core-loader";
  loader.src = `${coreUrl}?v=${Date.now()}`;
  loader.addEventListener("load", () => start(window.FarmTrackerCore), { once: true });
  loader.addEventListener("error", () => {
    window.alert("Farm Tracker: nepodarilo sa nacitat tracker-core.js z GitHub hostingu.");
  }, { once: true });
  (document.head || document.documentElement).appendChild(loader);

  function start(core) {
    if (!core) {
      window.alert("Farm Tracker: core nie je dostupny.");
      return;
    }

    const app = createApp(core);
    window.__TW_FARM_TRACKER_APP__ = app;
    app.init();
  }

  function resolveCurrentScript() {
    const direct = document.currentScript || document.getElementById("tw-farm-tracker-loader");
    if (direct && direct.src) {
      return direct;
    }

    const candidates = Array.from(document.querySelectorAll("script[src]"));
    return candidates.find((script) => /(?:farm-tracker|bookmarklet)\.js/i.test(script.src)) || null;
  }

  function shouldRedirectToReturnPage() {
    const url = new URL(window.location.href);
    const isGamePage = /\/game\.php$/i.test(url.pathname);
    const screen = url.searchParams.get("screen");
    const mode = url.searchParams.get("mode");
    const type = url.searchParams.get("type");

    if (!isGamePage) {
      return false;
    }

    return !(screen === "overview_villages" && mode === "commands" && type === "return");
  }

  function redirectToReturnPage() {
    const targetUrl = buildReturnPageUrl();
    window.location.assign(targetUrl.href);
  }

  function buildReturnPageUrl() {
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/game.php";
    url.searchParams.set("screen", "overview_villages");
    url.searchParams.set("mode", "commands");
    url.searchParams.set("type", "return");
    url.searchParams.delete("try");
    url.searchParams.delete("subtype");
    url.searchParams.delete("view");
    url.searchParams.delete("id");
    return url;
  }

  function createApp(core) {
    const CACHE_STORAGE_KEY = `tw-farm-tracker-cache-v5:${window.location.host}`;
    const AUTO_SCAN_KEY = `tw-farm-tracker-autoscan-v1:${window.location.host}`;
    const ROOT_ID = "tw-farm-tracker-root";
    const MAX_VISIBLE_COMMANDS = 30;
    const FETCH_CONCURRENCY = 6;

    const state = {
      cache: loadCache(),
      currentRows: [],
      lastSummary: [],
      lastScanInfo: {
        pages: 1,
        mode: "current",
      },
      status: "Pripraveny.",
      isScanning: false,
      root: null,
      shadowRoot: null,
      refs: {},
    };

    return {
      init,
      reopen,
    };

    function init() {
      mount();
      render();
      if (consumePendingAutoScan()) {
        scanCurrentView(true);
      } else {
        scanCurrentView(true);
      }
    }

    function reopen() {
      if (!state.root || !document.body.contains(state.root)) {
        mount();
      }

      render();
    }

    function mount() {
      const existingRoot = document.getElementById(ROOT_ID);
      if (existingRoot) {
        existingRoot.remove();
      }

      const host = document.createElement("div");
      host.id = ROOT_ID;
      state.root = host;
      document.body.appendChild(host);

      const mountPoint = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
      state.shadowRoot = mountPoint;
      mountPoint.innerHTML = `
        <style>
          :host {
            all: initial;
          }

          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .wrap {
            position: fixed;
            right: 16px;
            bottom: 16px;
            width: min(960px, calc(100vw - 24px));
            max-height: calc(100vh - 24px);
            overflow: hidden;
            border-radius: 18px;
            border: 1px solid rgba(52, 35, 17, 0.26);
            background: rgba(255, 251, 241, 0.98);
            color: #2f2418;
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
            z-index: 2147483647;
          }

          .head {
            padding: 16px 18px 12px;
            border-bottom: 1px solid rgba(52, 35, 17, 0.12);
            background: linear-gradient(180deg, #f6e7cb 0%, #fdf9ef 100%);
          }

          .title-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
          }

          .title {
            margin: 0;
            font-size: 20px;
            line-height: 1.1;
            font-weight: 800;
          }

          .meta {
            margin: 6px 0 0;
            font-size: 12px;
            color: #75583e;
          }

          .body {
            padding: 14px 18px 18px;
            max-height: calc(100vh - 120px);
            overflow: auto;
          }

          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 12px;
          }

          button {
            border: 0;
            border-radius: 999px;
            padding: 11px 14px;
            font-size: 13px;
            font-weight: 700;
            color: #fffaf1;
            background: #8d5327;
            cursor: pointer;
          }

          button:hover {
            background: #6f3d18;
          }

          button:disabled {
            opacity: 0.6;
            cursor: wait;
          }

          button.secondary {
            background: #645243;
          }

          button.danger {
            background: #8a2d20;
          }

          .status {
            margin: 0 0 14px;
            font-size: 13px;
            color: #6e563d;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .card {
            border: 1px solid rgba(52, 35, 17, 0.12);
            border-radius: 14px;
            padding: 12px;
            background: #fff7e8;
          }

          .card h3 {
            margin: 0 0 8px;
            font-size: 14px;
          }

          .card strong {
            display: block;
            font-size: 18px;
            line-height: 1.2;
          }

          .section-title {
            margin: 0 0 8px;
            font-size: 14px;
            font-weight: 800;
            color: #4b361f;
          }

          .table-wrap {
            overflow: auto;
            border: 1px solid rgba(52, 35, 17, 0.12);
            border-radius: 14px;
            background: #fffdf7;
            margin-bottom: 14px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          thead {
            background: rgba(141, 83, 39, 0.08);
          }

          th,
          td {
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid rgba(52, 35, 17, 0.08);
            vertical-align: top;
          }

          .empty {
            text-align: center;
            color: #6e563d;
          }

          .muted {
            color: #75583e;
          }

          @media (max-width: 860px) {
            .summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 640px) {
            .wrap {
              right: 12px;
              left: 12px;
              bottom: 12px;
              width: auto;
            }

            .summary {
              grid-template-columns: 1fr;
            }

            .actions {
              flex-direction: column;
            }

            button {
              width: 100%;
            }
          }
        </style>
        <section class="wrap">
          <header class="head">
            <div class="title-row">
              <h2 class="title">Farm Tracker</h2>
              <button type="button" data-action="close" class="secondary">Zavriet</button>
            </div>
            <p class="meta">Host: ${escapeHtml(window.location.host)} | Rezim: navraty z barbarov</p>
          </header>
          <div class="body">
            <div class="actions">
              <button type="button" data-action="scan">Prepocitat navraty</button>
              <button type="button" data-action="scan-all">Vsetky stranky</button>
              <button type="button" data-action="export" class="secondary">Export aktualneho skenu</button>
              <button type="button" data-action="clear-cache" class="secondary">Vymazat cache detailov</button>
              <button type="button" data-action="close" class="danger">Zavriet</button>
            </div>
            <p class="status" data-role="status"></p>
            <div class="summary" data-role="summary"></div>

            <h3 class="section-title">Rozpis po dedinach</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dedina</th>
                    <th>Prikazy</th>
                    <th>Drevo</th>
                    <th>Hlina</th>
                    <th>Zelezo</th>
                    <th>Spolu</th>
                  </tr>
                </thead>
                <tbody data-role="villages"></tbody>
              </table>
            </div>

            <h3 class="section-title">Naposledy nacitane navraty</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Domovska dedina</th>
                    <th>Barbarka</th>
                    <th>Cas navratu</th>
                    <th>Drevo</th>
                    <th>Hlina</th>
                    <th>Zelezo</th>
                  </tr>
                </thead>
                <tbody data-role="rows"></tbody>
              </table>
            </div>
          </div>
        </section>
      `;

      state.refs.status = mountPoint.querySelector("[data-role='status']");
      state.refs.summary = mountPoint.querySelector("[data-role='summary']");
      state.refs.villages = mountPoint.querySelector("[data-role='villages']");
      state.refs.rows = mountPoint.querySelector("[data-role='rows']");

      mountPoint.querySelectorAll("[data-action='close']").forEach((button) => {
        button.addEventListener("click", closePanel);
      });
      mountPoint.querySelector("[data-action='scan']").addEventListener("click", () => scanCurrentView(false));
      mountPoint.querySelector("[data-action='scan-all']").addEventListener("click", scanAllPages);
      mountPoint.querySelector("[data-action='export']").addEventListener("click", exportData);
      mountPoint.querySelector("[data-action='clear-cache']").addEventListener("click", clearCache);
    }

    function closePanel() {
      if (state.root) {
        state.root.remove();
      }

      state.root = null;
      state.shadowRoot = null;
      state.refs = {};
      delete window.__TW_FARM_TRACKER_APP__;
    }

    async function scanCurrentView(isAutomatic) {
      if (state.isScanning) {
        return;
      }

      const switchedToAll = ensureAllCommandsVisible();
      if (switchedToAll) {
        return;
      }

      const commands = core.scanReturnCommands(document, { baseUrl: window.location.href });
      if (!commands.length) {
        setStatus("Na tejto stranke som nenasiel navraty z barbarov. Otvor `Nahlady > Prikazy > Navrat` alebo prehlad dediny s vlastnymi prikazmi.");
        render();
        return;
      }

      state.isScanning = true;
      toggleBusy(true);
      setStatus(`Nasiel som ${commands.length} navratov. Nacitavam detaily koristi...`);
      render();

      try {
        const resolution = await resolveCommands(commands);
        state.currentRows = resolution.records;
        state.lastSummary = core.summarizeByVillage(resolution.records);
        state.lastScanInfo = {
          pages: 1,
          mode: "current",
        };

        const prefix = isAutomatic ? "Automaticky scan hotovy." : "Prepocet hotovy.";
        const paginationNote = hasVillagePagination(document) && !isCurrentPageShowingAll()
          ? " Vidim strankovanie prehladu dedin, takze tento sucet je len z aktualne zobrazenej stranky. Ak chces, pouzi `Vsetky stranky`."
          : "";

        setStatus(
          `${prefix} Navratov: ${resolution.records.length}, z cache: ${resolution.cacheHits}, dotiahnute detailom: ${resolution.fetched}, zlyhalo: ${resolution.failed}.${paginationNote}`
        );
      } catch (error) {
        console.error("Farm Tracker scan failed", error);
        setStatus("Nepodarilo sa dokoncit scan. Skus stranku obnovit a spustit bookmarklet este raz.");
      } finally {
        state.isScanning = false;
        toggleBusy(false);
        render();
      }
    }

    async function scanAllPages() {
      if (state.isScanning) {
        return;
      }

      const switchedToAll = ensureAllCommandsVisible();
      if (switchedToAll) {
        return;
      }

      const currentCommands = core.scanReturnCommands(document, { baseUrl: window.location.href });
      if (currentCommands.length > 0 && isCurrentPageShowingAll()) {
        await scanCurrentView(false);
        return;
      }

      const pages = discoverAllReturnPages(document);
      if (!pages.length) {
        setStatus("Nepodarilo sa zistit stranky prehladu navratov.");
        render();
        return;
      }

      if (pages.length === 1) {
        await scanCurrentView(false);
        return;
      }

      if (pages.length > 25) {
        const confirmed = window.confirm(
          `Nasiel som ${pages.length} stran navratov. Toto moze znamenat vela requestov na zoznamy aj detaily prikazov. Chces spustit plny scan vsetkych stran?`
        );

        if (!confirmed) {
          return;
        }
      }

      state.isScanning = true;
      toggleBusy(true);
      setStatus(`Pripravujem scan vsetkych stran... 1/${pages.length}`);
      render();

      try {
        const commands = await collectCommandsFromPages(pages);
        if (!commands.length) {
          setStatus("Zo ziadnej stranky som nevytiahol navraty z barbarov.");
          return;
        }

        setStatus(`Nasiel som ${commands.length} navratov na ${pages.length} stranach. Nacitavam detaily koristi...`);
        render();

        const resolution = await resolveCommands(commands);
        state.currentRows = resolution.records;
        state.lastSummary = core.summarizeByVillage(resolution.records);
        state.lastScanInfo = {
          pages: pages.length,
          mode: "all",
        };

        setStatus(
          `Plny scan hotovy. Stran: ${pages.length}, navratov: ${resolution.records.length}, z cache: ${resolution.cacheHits}, dotiahnute detailom: ${resolution.fetched}, zlyhalo: ${resolution.failed}.`
        );
      } catch (error) {
        console.error("Farm Tracker all-pages scan failed", error);
        setStatus("Nepodarilo sa dokoncit scan vsetkych stran. Skus to este raz alebo pouzi iba aktualnu stranku.");
      } finally {
        state.isScanning = false;
        toggleBusy(false);
        render();
      }
    }

    async function resolveCommands(commands) {
      const records = [];
      const missing = [];
      let cacheHits = 0;

      for (const command of commands) {
        const cached = state.cache[command.id];
        if (isValidCachedLoot(cached)) {
          cacheHits += 1;
          records.push(buildResolvedRecord(command, cached));
          continue;
        }

        missing.push(command);
      }

      let fetched = 0;
      let failed = 0;
      let processed = 0;

      await runPool(missing, FETCH_CONCURRENCY, async (command) => {
        try {
          const html = await fetchCommandDetail(command.detailUrl);
          const resources = core.parseCommandDetailHtml(html);
          if (!resources) {
            throw new Error(`Missing loot for command ${command.id}`);
          }

          const cacheEntry = {
            id: command.id,
            wood: resources.wood,
            clay: resources.clay,
            iron: resources.iron,
            total: resources.wood + resources.clay + resources.iron,
            cachedAt: new Date().toISOString(),
          };

          state.cache[command.id] = cacheEntry;
          records.push(buildResolvedRecord(command, cacheEntry));
          fetched += 1;
        } catch (error) {
          console.error(`Farm Tracker failed for command ${command.id}`, error);
          failed += 1;
        } finally {
          processed += 1;
          if (missing.length) {
            setStatus(`Nacitavam detaily koristi... ${processed}/${missing.length}`);
            render();
          }
        }
      });

      persistCache();
      records.sort(compareArrivalThenVillage);

      return {
        records,
        cacheHits,
        fetched,
        failed,
      };
    }

    async function fetchCommandDetail(detailUrl) {
      const response = await window.fetch(detailUrl, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.text();
    }

    async function exportData() {
      if (!state.currentRows.length) {
        setStatus("Najprv sprav scan, potom je co exportovat.");
        render();
        return;
      }

      const payload = {
        scannedAt: new Date().toISOString(),
        host: window.location.host,
        sourceUrl: window.location.href,
        villages: state.lastSummary,
        commands: state.currentRows,
      };

      const filename = `farm-return-scan-${window.location.host.replace(/[^\w.-]+/g, "_")}-${core.formatDateForFile(new Date())}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      setStatus("Export aktualneho skenu je pripraveny.");
      render();
    }

    function clearCache() {
      const confirmed = window.confirm("Naozaj chces vymazat lokalnu cache detailov prikazov?");
      if (!confirmed) {
        return;
      }

      state.cache = {};
      persistCache();
      setStatus("Cache detailov bola vymazana.");
      render();
    }

    function loadCache() {
      try {
        const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
        if (!raw) {
          return {};
        }

        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        console.error("Farm Tracker cache load failed", error);
        return {};
      }
    }

    function persistCache() {
      window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(state.cache));
    }

    function setStatus(message) {
      state.status = message;
      if (state.refs.status) {
        state.refs.status.textContent = message;
      }
    }

    function toggleBusy(isBusy) {
      if (!state.shadowRoot) {
        return;
      }

      state.shadowRoot.querySelectorAll("button[data-action='scan'], button[data-action='scan-all'], button[data-action='export'], button[data-action='clear-cache']")
        .forEach((button) => {
          button.disabled = isBusy;
        });
    }

    function render() {
      if (!state.refs.status || !state.refs.summary || !state.refs.villages || !state.refs.rows) {
        return;
      }

      state.refs.status.textContent = state.status;
      renderSummary();
      renderVillages();
      renderRows();
    }

    function renderSummary() {
      const totals = sumResolvedRows(state.currentRows);
      const villageCount = state.lastSummary.length;
      const scanLabel = isCurrentPageShowingAll() && state.lastScanInfo.mode === "current"
        ? "vsetko"
        : state.lastScanInfo.mode === "all"
        ? `${state.lastScanInfo.pages} stran`
        : "1 strana";

      state.refs.summary.innerHTML = [
        makeSummaryCard("Prikazy", state.currentRows.length, "Naposledy nacitane navraty"),
        makeSummaryCard("Dediny", villageCount, "Kolko vlastnych dedin prave dostava korist"),
        makeSummaryCard("Drevo", core.formatNumber(totals.wood), "Sucet dreva"),
        makeSummaryCard("Hlina", core.formatNumber(totals.clay), "Sucet hliny"),
        makeSummaryCard("Zelezo", core.formatNumber(totals.iron), "Sucet zeleza"),
        makeSummaryCard("Spolu", core.formatNumber(totals.total), "Drevo + hlina + zelezo"),
        makeSummaryCard("Rozsah", scanLabel, "Kolko stran prehladu bolo zahrnutych"),
        makeSummaryCard("Cache", core.formatNumber(Object.keys(state.cache).length), "Pocet ulozenych detailov prikazov"),
      ].join("");
    }

    function renderVillages() {
      if (!state.lastSummary.length) {
        state.refs.villages.innerHTML = `<tr><td colspan="6" class="empty">Zatial tu nie je ziadny prepocitany navrat.</td></tr>`;
        return;
      }

      state.refs.villages.innerHTML = state.lastSummary.map((entry) => `
        <tr>
          <td>${escapeHtml(entry.village)}</td>
          <td>${entry.count}</td>
          <td>${escapeHtml(core.formatNumber(entry.wood))}</td>
          <td>${escapeHtml(core.formatNumber(entry.clay))}</td>
          <td>${escapeHtml(core.formatNumber(entry.iron))}</td>
          <td>${escapeHtml(core.formatNumber(entry.total))}</td>
        </tr>
      `).join("");
    }

    function renderRows() {
      if (!state.currentRows.length) {
        state.refs.rows.innerHTML = `<tr><td colspan="6" class="empty">Zatial tu nie su ziadne nacitane navraty.</td></tr>`;
        return;
      }

      state.refs.rows.innerHTML = state.currentRows.slice(0, MAX_VISIBLE_COMMANDS).map((row) => `
        <tr>
          <td>${escapeHtml(row.homeVillage)}</td>
          <td>${escapeHtml(row.targetVillage || "Dedina barbarov")}</td>
          <td>${escapeHtml(row.arrivalText || "-")}</td>
          <td>${escapeHtml(core.formatNumber(row.wood))}</td>
          <td>${escapeHtml(core.formatNumber(row.clay))}</td>
          <td>${escapeHtml(core.formatNumber(row.iron))}</td>
        </tr>
      `).join("");
    }

    function makeSummaryCard(title, value, note) {
      return `
        <article class="card">
          <h3>${escapeHtml(title)}</h3>
          <strong>${escapeHtml(String(value))}</strong>
          <div class="muted">${escapeHtml(note)}</div>
        </article>
      `;
    }

    function sumResolvedRows(rows) {
      return rows.reduce((totals, row) => {
        totals.wood += row.wood || 0;
        totals.clay += row.clay || 0;
        totals.iron += row.iron || 0;
        totals.total += row.total || 0;
        return totals;
      }, { wood: 0, clay: 0, iron: 0, total: 0 });
    }

    function buildResolvedRecord(command, loot) {
      return {
        id: command.id,
        key: command.id,
        detailUrl: command.detailUrl,
        homeVillage: command.homeVillage,
        targetVillage: command.targetVillage,
        arrivalText: command.arrivalText,
        wood: loot.wood || 0,
        clay: loot.clay || 0,
        iron: loot.iron || 0,
        total: loot.total || ((loot.wood || 0) + (loot.clay || 0) + (loot.iron || 0)),
      };
    }

    function isValidCachedLoot(entry) {
      return entry
        && Number.isFinite(entry.wood)
        && Number.isFinite(entry.clay)
        && Number.isFinite(entry.iron);
    }

    function compareArrivalThenVillage(left, right) {
      const arrivalCompare = String(left.arrivalText || "").localeCompare(String(right.arrivalText || ""), "sk");
      if (arrivalCompare !== 0) {
        return arrivalCompare;
      }

      return String(left.homeVillage || "").localeCompare(String(right.homeVillage || ""), "sk");
    }

    function hasVillagePagination(doc) {
      return Boolean(doc.querySelector("a[href*='overview_villages'][href*='page=']"));
    }

    function ensureAllCommandsVisible() {
      if (isCurrentPageShowingAll()) {
        return false;
      }

      const select = findAllCommandsSelect();
      if (!select) {
        return false;
      }

      const targetOption = findAllOption(select);
      if (!targetOption) {
        return false;
      }

      persistPendingAutoScan();
      setStatus("Prepinem prehlad na `vsetko`, aby som pocital z celeho zoznamu navratov...");
      render();

      select.value = targetOption.value;
      targetOption.selected = true;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));

      const form = select.form || select.closest("form");
      if (form) {
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.submit();
        }
        return true;
      }

      const fallbackUrl = buildAllCommandsUrl(select, targetOption);
      if (fallbackUrl) {
        window.location.assign(fallbackUrl);
        return true;
      }

      return false;
    }

    function isCurrentPageShowingAll() {
      const select = findAllCommandsSelect();
      if (!select) {
        return false;
      }

      const selectedOption = select.options[select.selectedIndex];
      if (!selectedOption) {
        return false;
      }

      const selectedLabel = normalizeAscii(selectedOption.textContent || selectedOption.label || "");
      const selectedValue = String(selectedOption.value || "").trim().toLowerCase();
      return selectedLabel === "vsetko" || selectedValue === "-1" || selectedValue === "all" || selectedValue === "vsetko";
    }

    function findAllCommandsSelect() {
      const selects = Array.from(document.querySelectorAll("select"));
      return selects.find((select) => findAllOption(select));
    }

    function findAllOption(select) {
      return Array.from(select.options).find((option) => {
        const label = normalizeAscii(option.textContent || option.label || "");
        const value = String(option.value || "").trim().toLowerCase();
        return label === "vsetko" || value === "-1" || value === "all" || value === "vsetko";
      }) || null;
    }

    function buildAllCommandsUrl(select, option) {
      const url = new URL(window.location.href);
      const fieldName = select.name || select.id;
      if (!fieldName) {
        return null;
      }

      url.searchParams.set(fieldName, option.value);
      return url.href;
    }

    function persistPendingAutoScan() {
      window.sessionStorage.setItem(AUTO_SCAN_KEY, "1");
    }

    function consumePendingAutoScan() {
      const pending = window.sessionStorage.getItem(AUTO_SCAN_KEY) === "1";
      if (pending) {
        window.sessionStorage.removeItem(AUTO_SCAN_KEY);
      }
      return pending;
    }

    function discoverAllReturnPages(doc) {
      const currentUrl = new URL(window.location.href);
      const pageLinks = Array.from(doc.querySelectorAll("a[href*='screen=overview_villages'][href*='mode=commands'][href*='type=return']"));
      const numberedLinks = pageLinks.map((link) => {
        const label = parsePageNumber(link.textContent || "");
        if (!label) {
          return null;
        }

        const url = new URL(link.getAttribute("href"), currentUrl.href);
        const rawParam = url.searchParams.get("page");
        const param = rawParam !== null && /^-?\d+$/.test(rawParam) ? Number.parseInt(rawParam, 10) : null;
        return {
          label,
          url: url.href,
          param,
        };
      }).filter(Boolean);

      const maxLabel = Math.max(1, ...numberedLinks.map((entry) => entry.label));
      const knownPages = new Map();
      knownPages.set(1, stripPageParam(currentUrl).href);

      for (const entry of numberedLinks) {
        knownPages.set(entry.label, entry.url);
      }

      const builder = makePageUrlBuilder(currentUrl, numberedLinks);
      const pages = [];

      for (let pageNumber = 1; pageNumber <= maxLabel; pageNumber += 1) {
        const knownUrl = knownPages.get(pageNumber);
        if (knownUrl) {
          pages.push({ pageNumber, url: knownUrl, live: sameUrl(knownUrl, currentUrl.href) });
          continue;
        }

        if (!builder) {
          continue;
        }

        pages.push({ pageNumber, url: builder(pageNumber), live: false });
      }

      return dedupePages(pages).sort((left, right) => left.pageNumber - right.pageNumber);
    }

    function makePageUrlBuilder(currentUrl, numberedLinks) {
      const samples = numberedLinks.filter((entry) => Number.isFinite(entry.param));
      if (!samples.length) {
        return null;
      }

      const sample = samples[samples.length - 1];
      const offset = sample.param - sample.label;

      return (pageNumber) => {
        const url = new URL(currentUrl.href);
        const paramValue = pageNumber + offset;

        if (pageNumber === 1 && !currentUrl.searchParams.has("page") && offset <= -1) {
          url.searchParams.delete("page");
        } else {
          url.searchParams.set("page", String(paramValue));
        }

        return url.href;
      };
    }

    async function collectCommandsFromPages(pages) {
      const commands = [];
      const seenIds = new Set();

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        setStatus(`Nacitavam zoznam navratov... ${index + 1}/${pages.length}`);
        render();

        let pageCommands = [];
        if (page.live || sameUrl(page.url, window.location.href)) {
          pageCommands = core.scanReturnCommands(document, { baseUrl: page.url });
        } else {
          const html = await fetchPageHtml(page.url);
          const parsedDoc = parseHtmlDocument(html);
          pageCommands = core.scanReturnCommands(parsedDoc, { baseUrl: page.url });
        }

        for (const command of pageCommands) {
          if (seenIds.has(command.id)) {
            continue;
          }

          commands.push(command);
          seenIds.add(command.id);
        }
      }

      return commands;
    }

    async function fetchPageHtml(url) {
      const response = await window.fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.text();
    }

    function parseHtmlDocument(html) {
      return new DOMParser().parseFromString(html, "text/html");
    }

    function parsePageNumber(text) {
      const match = String(text || "").match(/(\d{1,5})/);
      return match ? Number.parseInt(match[1], 10) : null;
    }

    function stripPageParam(urlLike) {
      const url = new URL(urlLike, window.location.href);
      url.searchParams.delete("page");
      return url;
    }

    function sameUrl(left, right) {
      return new URL(left, window.location.href).href === new URL(right, window.location.href).href;
    }

    function dedupePages(pages) {
      const seen = new Set();
      return pages.filter((page) => {
        if (!page || seen.has(page.url)) {
          return false;
        }

        seen.add(page.url);
        return true;
      });
    }

    async function runPool(items, concurrency, worker) {
      const queue = items.slice();
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length) {
          const item = queue.shift();
          await worker(item);
        }
      });

      await Promise.all(workers);
    }

    function normalizeAscii(value) {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();

