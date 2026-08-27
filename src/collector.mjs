import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import he from "he";
import fetch from "node-fetch";

const DEFAULT_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 8000);

export const DEFAULT_SOURCES = [
  {
    name: "Google 新闻 RSS：林俊杰",
    url: "https://news.google.com/rss/search?q=%E6%9E%97%E4%BF%8A%E6%9D%B0&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    type: "news",
    reliability: 0.78
  },
  {
    name: "Bing 新闻 RSS：林俊杰",
    url: "https://www.bing.com/news/search?q=%E6%9E%97%E4%BF%8A%E6%9D%B0%20JJ%20Lin&format=rss",
    type: "news",
    reliability: 0.74
  },
  {
    name: "Channel NewsAsia：JJ Lin",
    url: "https://www.channelnewsasia.com/topic/jj-lin",
    type: "news",
    reliability: 0.76,
    html: true
  },
  {
    name: "The Straits Times：JJ Lin",
    url: "https://www.straitstimes.com/tags/jj-lin",
    type: "news",
    reliability: 0.76,
    html: true
  },
  {
    name: "林俊杰官方公开站点",
    url: "https://www.jjlin.com/",
    type: "official",
    reliability: 0.9,
    html: true
  }
];

const SCHEDULE_WORDS = [
  "演唱会",
  "巡演",
  "世界巡回",
  "开唱",
  "演出",
  "音乐节",
  "见面会",
  "签唱",
  "售票",
  "加场",
  "官宣",
  "concert",
  "tour",
  "live"
];

const LOCATION_WORDS = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "南京",
  "杭州",
  "成都",
  "重庆",
  "武汉",
  "西安",
  "长沙",
  "厦门",
  "福州",
  "郑州",
  "天津",
  "青岛",
  "苏州",
  "香港",
  "澳门",
  "台北",
  "高雄",
  "新加坡",
  "吉隆坡",
  "马来西亚",
  "伦敦",
  "巴黎",
  "悉尼",
  "墨尔本",
  "东京",
  "首尔",
  "纽约",
  "洛杉矶",
  "arena",
  "stadium",
  "中心",
  "体育馆",
  "文化中心"
];

const BLOCKED_PUBLICATION_WORDS = [
  "亚博",
  "万博",
  "娱乐APP",
  "官网正网",
  "手机登录",
  "滚球体育",
  "LUTUBE",
  "同升娱乐",
  "爵士娱乐",
  "BET366",
  "彩票",
  "体育网站",
  "博彩"
];

const NAVIGATION_LABELS = new Set([
  "skip to main content",
  "sign in",
  "account",
  "my feed",
  "singapore",
  "indonesia",
  "asia",
  "world"
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  cdataPropName: "cdata",
  trimValues: true
});

export async function collectRadarData({ sources = DEFAULT_SOURCES, fetchImpl = fetch } = {}) {
  const batches = await Promise.all(sources.map((source) => readSource(source, fetchImpl)));
  const sourceStatuses = batches.map(({ source, status, count, error }) => ({
    name: source.name,
    url: source.url,
    type: source.type,
    status,
    count,
    error
  }));
  const rawItems = batches.flatMap((batch) => batch.items);
  const normalized = normalizeItems(rawItems);

  return {
    ...normalized,
    sources: sourceStatuses,
    generatedAt: new Date().toISOString()
  };
}

async function readSource(source, fetchImpl) {
  try {
    const response = await fetchWithTimeout(source.url, fetchImpl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const items = source.html ? parseOfficialHtml(text, source) : parseFeed(text, source);

    return { source, status: "ok", count: items.length, items };
  } catch (error) {
    return {
      source,
      status: "error",
      count: 0,
      error: error.message,
      items: []
    };
  }
}

async function fetchWithTimeout(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetchImpl(url, {
      headers: {
        "user-agent": "JJ-LIN-Radar/1.0 (+https://github.com/wafue/jj-lin-radar)"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeed(xml, source) {
  const data = parser.parse(xml);
  const channelItems = data?.rss?.channel?.item || data?.rdf?.RDF?.item || data?.feed?.entry || [];
  const items = Array.isArray(channelItems) ? channelItems : [channelItems];

  return items.filter(Boolean).map((item) => ({
    title: readText(item.title),
    description: readText(item.description || item.summary || item.content || item["content:encoded"]),
    link: readLink(item.link || item.guid),
    published: readText(item.pubDate || item.published || item.updated || item["dc:date"]),
    source
  })).filter(isRelevant).filter(isQualityItem).slice(0, 30);
}

function parseOfficialHtml(html, source) {
  const title = cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "林俊杰官方公开站点");
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: new URL(match[1], source.url).toString(),
      label: cleanText(match[2])
    }))
    .filter((link) => isRelevant({ title: link.label }))
    .filter((link) => !NAVIGATION_LABELS.has(link.label.toLowerCase()))
    .slice(0, 12);

  if (anchors.length === 0) {
    return [{
      title,
      description: "官方公开网页可访问，但未解析到可归档链接。",
      link: source.url,
      published: null,
      source
    }];
  }

  return anchors.map((link) => ({
    title: link.label,
    description: title,
    link: link.href,
    published: null,
    source
  }));
}

function isRelevant(item) {
  const text = `${item.title || ""} ${item.description || ""}`;
  return /林俊杰|JJ\s*Lin|Wayne\s*Lin/i.test(text);
}

function isQualityItem(item) {
  const text = `${item.title || ""} ${item.description || ""}`;
  return !BLOCKED_PUBLICATION_WORDS.some((word) => text.includes(word));
}

export function normalizeItems(items) {
  const seen = new Set();
  const normalized = [];

  for (const item of items) {
    const classified = classifyItem(item);
    if (!classified.title || !classified.originalUrl) continue;
    if (seen.has(classified.id)) continue;
    seen.add(classified.id);
    normalized.push(classified);
  }

  normalized.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  return {
    schedules: normalized.filter((item) => item.kind === "schedule"),
    updates: normalized.filter((item) => item.kind === "public_update")
  };
}

export function classifyItem(item) {
  const title = cleanText(item.title);
  const summary = cleanText(item.description);
  const text = `${title} ${summary}`;
  const eventDate = extractEventDate(text);
  const hasScheduleWord = SCHEDULE_WORDS.some((word) => text.toLowerCase().includes(word.toLowerCase()));
  const hasLocation = LOCATION_WORDS.some((word) => text.toLowerCase().includes(word.toLowerCase()));
  const kind = isFutureEventDate(eventDate) && hasScheduleWord && hasLocation ? "schedule" : "public_update";
  const publishedAt = normalizeDate(item.published);
  const confidenceScore = scoreConfidence({ source: item.source, kind, eventDate, hasScheduleWord, hasLocation });

  return {
    id: stableId(`${item.source?.name || "source"}:${item.link || title}`),
    kind,
    title,
    summary,
    sourceName: item.source?.name || "未知来源",
    sourceType: item.source?.type || "unknown",
    originalUrl: item.link || item.source?.url || "",
    publishedAt,
    eventDate,
    confidence: confidenceLabel(confidenceScore),
    confidenceScore
  };
}

function extractEventDate(text) {
  const normalized = text.replace(/\s+/g, " ");
  const cn = normalized.match(/(20\d{2})\s*年\s*(1[0-2]|0?[1-9])\s*月\s*(3[01]|[12]\d|0?[1-9])\s*日?/);
  if (cn) return toIsoDate(cn[1], cn[2], cn[3]);

  const slash = normalized.match(/\b(20\d{2})[./-](1[0-2]|0?[1-9])[./-](3[01]|[12]\d|0?[1-9])\b/);
  if (slash) return toIsoDate(slash[1], slash[2], slash[3]);

  return null;
}

function scoreConfidence({ source, kind, eventDate, hasScheduleWord, hasLocation }) {
  let score = source?.reliability || 0.55;
  if (kind === "schedule") score += 0.05;
  if (eventDate) score += 0.06;
  if (hasScheduleWord) score += 0.04;
  if (hasLocation) score += 0.03;
  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

function confidenceLabel(score) {
  if (score >= 0.86) return "高";
  if (score >= 0.68) return "中";
  return "低";
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toIsoDate(year, month, day) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isFutureEventDate(value) {
  if (!value) return false;
  const eventTime = new Date(value).getTime();
  const today = new Date();
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return eventTime >= todayStart;
}

function readText(value) {
  if (!value) return "";
  if (typeof value === "string") return cleanText(value);
  return cleanText(value.cdata || value.text || value["#text"] || "");
}

function readLink(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.href || value.text || "";
}

function cleanText(value = "") {
  return he.decode(String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function stableId(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}
