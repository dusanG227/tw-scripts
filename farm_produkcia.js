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
    extractResourcesFromCommandRow,
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
      const homeVillage = extractHomeVillageFromRow(row, currentVillage);
      const targetVillage = extractTargetVillageFromText(text);
      const arrivalText = extractArrivalTextFromRow(row);
      const inlineLoot = extractResourcesFromCommandRow(row);
      const lootTriggerElement = findLootTriggerElement(row);
      const commandId = extractCommandIdFromUrl(detailLink && detailLink.href)
        || extractReportId(text)
        || buildSyntheticCommandId(homeVillage, targetVillage, arrivalText, commands.length);

      if (seenIds.has(commandId)) {
        continue;
      }

      commands.push({
        id: commandId,
        key: commandId,
        detailUrl: detailLink ? new URL(detailLink.getAttribute("href"), baseUrl).href : null,
        homeVillage,
        targetVillage,
        arrivalText,
        inlineLoot,
        lootTriggerElement,
        rowElement: row,
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

  function extractResourcesFromCommandRow(row) {
    const directText = normalizeText(row.textContent || "");
    const directLootText = extractLootOnlyText(directText);
    if (directLootText) {
      const fromDirectText = parseStrictLootText(directLootText);
      if (fromDirectText) {
        return fromDirectText;
      }
    }

    const elements = [row, ...Array.from(row.querySelectorAll("*"))];
    for (const element of elements) {
      const attributeSnippet = extractLootSnippetFromElementAttributes(element);
      if (!attributeSnippet) {
        continue;
      }

      const fromAttribute = parseStrictLootText(attributeSnippet);
      if (fromAttribute) {
        return fromAttribute;
      }
    }

    const htmlSnippet = extractLootSnippetFromHtml(row.outerHTML || "");
    if (htmlSnippet) {
      const fromHtml = parseStrictLootText(htmlSnippet);
      if (fromHtml) {
        return fromHtml;
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

  function findLootTriggerElement(row) {
    const candidates = [row, ...Array.from(row.querySelectorAll("img, a, span, td, div"))];
    let bestElement = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = scoreLootTriggerElement(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestElement = candidate;
      }
    }

    return bestScore > 0 ? bestElement : row;
  }

  function scoreLootTriggerElement(element) {
    if (!element) {
      return 0;
    }

    const html = toAsciiLower((element.outerHTML || "").slice(0, 4000));
    const text = toAsciiLower(element.textContent || "");
    let score = 0;

    if (/korist|loot|beute|lup/.test(html) || /korist|loot|beute|lup/.test(text)) {
      score += 8;
    }

    if (/onmouseover|onmouseenter|overlib|tooltip/.test(html)) {
      score += 6;
    }

    if (/wood|holz|stone|clay|lehm|iron|eisen|res/.test(html)) {
      score += 4;
    }

    if (element.tagName === "IMG") {
      score += 2;
    }

    if (/screen=info_command|info_command&id=/.test(html)) {
      score -= 3;
    }

    return score;
  }

  function buildSyntheticCommandId(homeVillage, targetVillage, arrivalText, index) {
    const base = [homeVillage, targetVillage, arrivalText, index + 1]
      .map((value) => String(value || "").replace(/[^\w|]+/g, "_"))
      .filter(Boolean)
      .join("|");

    return `row-${base || index + 1}`;
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

  function extractLootSnippetFromElementAttributes(element) {
    if (!element || !element.getAttributeNames) {
      return null;
    }

    const values = element.getAttributeNames()
      .map((name) => element.getAttribute(name))
      .filter(Boolean);

    for (const value of values) {
      const decoded = decodeHtmlEntities(value);
      const snippet = extractLootSnippetFromHtml(decoded);
      if (snippet) {
        return snippet;
      }
    }

    return null;
  }

  function stripHtml(raw) {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ");
  }

  function decodeHtmlEntities(value) {
    const container = globalScope.document ? globalScope.document.createElement("textarea") : null;
    if (!container) {
      return String(value || "");
    }

    container.innerHTML = String(value || "");
    return container.value;
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

  const AUTO_SCAN_KEY = `tw-farm-tracker-autoscan-single-v1:${window.location.host}`;

  if (shouldRedirectToVillageOverview()) {
    redirectToVillageOverview();
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

  function shouldRedirectToVillageOverview() {
    const url = new URL(window.location.href);
    if (!/\/game\.php$/i.test(url.pathname)) {
      return false;
    }

    return url.searchParams.get("screen") !== "overview";
  }

  function redirectToVillageOverview() {
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/game.php";
    url.searchParams.set("screen", "overview");
    url.searchParams.delete("mode");
    url.searchParams.delete("type");
    url.searchParams.delete("page");
    url.searchParams.delete("id");
    url.searchParams.delete("try");
    window.sessionStorage.setItem(AUTO_SCAN_KEY, "1");
    window.location.assign(url.href);
  }

  function createApp(core) {
    const ROOT_ID = "tw-farm-tracker-root";
    const MAX_VISIBLE_COMMANDS = 50;
    const FETCH_CONCURRENCY = 4;
    const HOVER_WAIT_MS = 90;

    const state = {
      currentVillage: core.getCurrentVillageLabel(document),
      currentRows: [],
      status: "Pripraveny.",
      isScanning: false,
      root: null,
      shadowRoot: null,
      refs: {},
      scanMeta: {
        inlineHits: 0,
        hoverHits: 0,
        detailHits: 0,
        failed: 0,
      },
    };

    return {
      init,
      reopen,
    };

    function init() {
      mount();
      render();
      if (consumePendingAutoScan()) {
        scanCurrentVillage(true);
      } else {
        scanCurrentVillage(true);
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
            width: min(980px, calc(100vw - 24px));
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

          .muted {
            color: #75583e;
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
            <p class="meta">Host: ${escapeHtml(window.location.host)} | Dedina: ${escapeHtml(state.currentVillage)} | Rezim: jedna dedina</p>
          </header>
          <div class="body">
            <div class="actions">
              <button type="button" data-action="scan">Prepocitat navraty tejto dediny</button>
              <button type="button" data-action="export" class="secondary">Export aktualneho skenu</button>
              <button type="button" data-action="close" class="danger">Zavriet</button>
            </div>
            <p class="status" data-role="status"></p>
            <div class="summary" data-role="summary"></div>

            <h3 class="section-title">Nacitane navraty z barbarov</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Barbarka</th>
                    <th>Cas navratu</th>
                    <th>Drevo</th>
                    <th>Hlina</th>
                    <th>Zelezo</th>
                    <th>Zdroj</th>
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
      state.refs.rows = mountPoint.querySelector("[data-role='rows']");

      mountPoint.querySelectorAll("[data-action='close']").forEach((button) => {
        button.addEventListener("click", closePanel);
      });
      mountPoint.querySelector("[data-action='scan']").addEventListener("click", () => scanCurrentVillage(false));
      mountPoint.querySelector("[data-action='export']").addEventListener("click", exportData);
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

    async function scanCurrentVillage(isAutomatic) {
      if (state.isScanning) {
        return;
      }

      const commands = core.scanReturnCommands(document, { baseUrl: window.location.href });
      if (!commands.length) {
        setStatus("Na stranke tejto dediny som nenasiel `Navrat z Dedina barbarov`. Otvor prehlad dediny s tabulkou `Vlastne prikazy`.");
        render();
        return;
      }

      state.isScanning = true;
      toggleBusy(true);
      setStatus(`Nasiel som ${commands.length} navratov v dedine ${state.currentVillage}. Pocitam korist...`);
      render();

      try {
        const resolution = await resolveCommands(commands);
        state.currentRows = resolution.records;
        state.scanMeta = {
          inlineHits: resolution.inlineHits,
          hoverHits: resolution.hoverHits,
          detailHits: resolution.detailHits,
          failed: resolution.failed,
        };

        const prefix = isAutomatic ? "Automaticky scan hotovy." : "Prepocet hotovy.";
        setStatus(
          `${prefix} Navratov: ${resolution.records.length}, z riadkov: ${resolution.inlineHits}, z tooltipu: ${resolution.hoverHits}, z detailu: ${resolution.detailHits}, zlyhalo: ${resolution.failed}.`
        );
      } catch (error) {
        console.error("Farm Tracker single-village scan failed", error);
        setStatus("Nepodarilo sa dokoncit scan tejto dediny. Skus otvorit prehlad dediny a spustit bookmarklet este raz.");
      } finally {
        state.isScanning = false;
        toggleBusy(false);
        render();
      }
    }

    async function resolveCommands(commands) {
      const records = [];
      const missing = [];
      let inlineHits = 0;
      let hoverHits = 0;
      let detailHits = 0;
      let failed = 0;

      for (const command of commands) {
        if (isValidLoot(command.inlineLoot)) {
          inlineHits += 1;
          records.push(buildResolvedRecord(command, command.inlineLoot, "riadok"));
          continue;
        }

        setStatus(`Citam tooltipy navratov... ${records.length + missing.length + 1}/${commands.length}`);
        render();
        const hoverLoot = await readLootFromHover(command);
        if (isValidLoot(hoverLoot)) {
          hoverHits += 1;
          records.push(buildResolvedRecord(command, hoverLoot, "tooltip"));
          continue;
        }

        missing.push(command);
      }

      let processed = 0;
      await runPool(missing, FETCH_CONCURRENCY, async (command) => {
        try {
          if (!command.detailUrl) {
            throw new Error(`Missing detail URL for command ${command.id}`);
          }

          const html = await fetchCommandDetail(command.detailUrl);
          const resources = core.parseCommandDetailHtml(html);
          if (!isValidLoot(resources)) {
            throw new Error(`Missing loot for command ${command.id}`);
          }

          detailHits += 1;
          records.push(buildResolvedRecord(command, resources, "detail"));
        } catch (error) {
          console.error(`Farm Tracker failed for command ${command.id}`, error);
          failed += 1;
        } finally {
          processed += 1;
          if (missing.length) {
            setStatus(`Dopocitavam detail prikazov... ${processed}/${missing.length}`);
            render();
          }
        }
      });

      records.sort(compareArrival);
      return {
        records,
        inlineHits,
        hoverHits,
        detailHits,
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

    async function readLootFromHover(command) {
      const trigger = command.lootTriggerElement || command.rowElement;
      if (!trigger || !document.contains(trigger)) {
        return null;
      }

      const tooltip = await revealTooltip(trigger);
      const resources = tooltip ? parseTooltipResources(tooltip) : null;
      hideTooltip(trigger);
      return resources;
    }

    async function revealTooltip(trigger) {
      dispatchPointerEvent(trigger, "mouseenter");
      dispatchPointerEvent(trigger, "mouseover");
      dispatchPointerEvent(trigger, "mousemove");
      await delay(HOVER_WAIT_MS);
      return findVisibleLootTooltip();
    }

    function hideTooltip(trigger) {
      dispatchPointerEvent(trigger, "mouseout");
      dispatchPointerEvent(trigger, "mouseleave");
    }

    function dispatchPointerEvent(element, type) {
      const rect = typeof element.getBoundingClientRect === "function"
        ? element.getBoundingClientRect()
        : { left: 0, top: 0, width: 0, height: 0 };
      const clientX = Math.round(rect.left + (rect.width / 2 || 1));
      const clientY = Math.round(rect.top + (rect.height / 2 || 1));
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
      });

      element.dispatchEvent(event);
      const handlerName = `on${type}`;
      if (typeof element[handlerName] === "function") {
        try {
          element[handlerName](event);
        } catch (error) {
          console.debug(`Farm Tracker pointer handler ${type} failed`, error);
        }
      }
    }

    function findVisibleLootTooltip() {
      const explicitCandidates = Array.from(document.querySelectorAll("#tooltip, #overDiv, .tooltip, [role='tooltip']"));
      const genericCandidates = Array.from(document.querySelectorAll("body div, body table, body td, body span"));
      const candidates = explicitCandidates.length ? explicitCandidates : genericCandidates;

      const viable = candidates.filter((element) => {
        if (!element || element === state.root || (state.root && state.root.contains(element))) {
          return false;
        }

        const style = window.getComputedStyle(element);
        if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") === 0) {
          return false;
        }

        const text = normalizeLooseText(element.innerText || element.textContent || "");
        const html = String(element.innerHTML || "");
        if (!/\d/.test(text)) {
          return false;
        }

        return /(korist|loot|beute|lup)/i.test(text)
          || /(korist|loot|beute|lup)/i.test(html)
          || ((/wood|holz|stone|clay|lehm|iron|eisen/i.test(html)) && /\d/.test(text));
      });

      viable.sort((left, right) => {
        const leftText = normalizeLooseText(left.innerText || left.textContent || "");
        const rightText = normalizeLooseText(right.innerText || right.textContent || "");
        return rightText.length - leftText.length;
      });

      return viable[0] || null;
    }

    function parseTooltipResources(tooltip) {
      const html = tooltip.outerHTML || tooltip.innerHTML || "";
      const text = normalizeLooseText(tooltip.innerText || tooltip.textContent || "");
      return core.parseCommandDetailHtml(html)
        || core.extractResources(text);
    }

    function normalizeLooseText(value) {
      return String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function delay(ms) {
      return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });
    }

    function render() {
      if (!state.refs.status || !state.refs.summary || !state.refs.rows) {
        return;
      }

      state.refs.status.textContent = state.status;
      renderSummary();
      renderRows();
    }

    function renderSummary() {
      const totals = sumResolvedRows(state.currentRows);

      state.refs.summary.innerHTML = [
        makeSummaryCard("Dedina", state.currentVillage, "Aktualne otvorena dedina"),
        makeSummaryCard("Prikazy", state.currentRows.length, "Nacitane navraty z barbarov"),
        makeSummaryCard("Drevo", core.formatNumber(totals.wood), "Sucet dreva"),
        makeSummaryCard("Hlina", core.formatNumber(totals.clay), "Sucet hliny"),
        makeSummaryCard("Zelezo", core.formatNumber(totals.iron), "Sucet zeleza"),
        makeSummaryCard("Spolu", core.formatNumber(totals.total), "Drevo + hlina + zelezo"),
        makeSummaryCard("Riadok", state.scanMeta.inlineHits, "Precitanie koristi priamo z tabulky"),
        makeSummaryCard("Tooltip", state.scanMeta.hoverHits, "Precitanie koristi cez hover ikonky"),
        makeSummaryCard("Detail", state.scanMeta.detailHits, "Dopoctene z detailu prikazu"),
      ].join("");
    }

    function renderRows() {
      if (!state.currentRows.length) {
        state.refs.rows.innerHTML = `<tr><td colspan="6" class="empty">Zatial tu nie su ziadne nacitane navraty.</td></tr>`;
        return;
      }

      state.refs.rows.innerHTML = state.currentRows.slice(0, MAX_VISIBLE_COMMANDS).map((row) => `
        <tr>
          <td>${escapeHtml(row.targetVillage || "Dedina barbarov")}</td>
          <td>${escapeHtml(row.arrivalText || "-")}</td>
          <td>${escapeHtml(core.formatNumber(row.wood))}</td>
          <td>${escapeHtml(core.formatNumber(row.clay))}</td>
          <td>${escapeHtml(core.formatNumber(row.iron))}</td>
          <td>${escapeHtml(row.source || "-")}</td>
        </tr>
      `).join("");
    }

    function exportData() {
      if (!state.currentRows.length) {
        setStatus("Najprv sprav scan, potom je co exportovat.");
        render();
        return;
      }

      const payload = {
        scannedAt: new Date().toISOString(),
        host: window.location.host,
        village: state.currentVillage,
        sourceUrl: window.location.href,
        meta: state.scanMeta,
        commands: state.currentRows,
      };

      const filename = `farm-single-village-${window.location.host.replace(/[^\w.-]+/g, "_")}-${core.formatDateForFile(new Date())}.json`;
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

      state.shadowRoot.querySelectorAll("button[data-action='scan'], button[data-action='export']")
        .forEach((button) => {
          button.disabled = isBusy;
        });
    }

    function buildResolvedRecord(command, loot, source) {
      return {
        id: command.id,
        key: command.id,
        detailUrl: command.detailUrl,
        homeVillage: command.homeVillage,
        targetVillage: command.targetVillage,
        arrivalText: command.arrivalText,
        source,
        wood: loot.wood || 0,
        clay: loot.clay || 0,
        iron: loot.iron || 0,
        total: (loot.wood || 0) + (loot.clay || 0) + (loot.iron || 0),
      };
    }

    function isValidLoot(entry) {
      return entry
        && Number.isFinite(entry.wood)
        && Number.isFinite(entry.clay)
        && Number.isFinite(entry.iron);
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

    function compareArrival(left, right) {
      return String(left.arrivalText || "").localeCompare(String(right.arrivalText || ""), "sk");
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

    function consumePendingAutoScan() {
      const pending = window.sessionStorage.getItem(AUTO_SCAN_KEY) === "1";
      if (pending) {
        window.sessionStorage.removeItem(AUTO_SCAN_KEY);
      }
      return pending;
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

