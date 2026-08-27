import assert from "node:assert/strict";
import test from "node:test";

import { classifyItem, normalizeItems } from "../src/collector.mjs";

test("classifies dated venue announcements as schedules with evidence", () => {
  const item = classifyItem({
    title: "JJ Lin 林俊杰 将于 2026年9月20日 在 上海梅赛德斯奔驰文化中心 演出",
    description: "官方新闻稿确认演唱会公开售票。",
    link: "https://example.com/jj-lin-shanghai",
    published: "2026-08-20T10:00:00.000Z",
    source: {
      name: "官方新闻",
      url: "https://example.com/rss",
      type: "official",
      reliability: 0.95
    }
  });

  assert.equal(item.kind, "schedule");
  assert.equal(item.sourceName, "官方新闻");
  assert.equal(item.originalUrl, "https://example.com/jj-lin-shanghai");
  assert.equal(item.publishedAt, "2026-08-20T10:00:00.000Z");
  assert.equal(item.confidence, "高");
  assert.match(item.eventDate, /^2026-09-20/);
});

test("keeps public updates separate when no concrete itinerary exists", () => {
  const item = classifyItem({
    title: "JJ Lin 林俊杰 发布新歌幕后花絮",
    description: "社交平台公开更新。",
    link: "https://example.com/jj-lin-update",
    published: "2026-08-21T10:00:00.000Z",
    source: {
      name: "新闻 RSS",
      url: "https://example.com/feed",
      type: "news",
      reliability: 0.72
    }
  });

  assert.equal(item.kind, "public_update");
  assert.equal(item.eventDate, null);
  assert.equal(item.confidence, "中");
});

test("does not classify past dated announcements as current schedules", () => {
  const item = classifyItem({
    title: "林俊杰 2025年6月27日 在 北京 鸟巢 演唱会回顾",
    description: "新闻回顾已结束的公开演出。",
    link: "https://example.com/past-show",
    published: "2026-08-21T10:00:00.000Z",
    source: {
      name: "新闻 RSS",
      url: "https://example.com/feed",
      type: "news",
      reliability: 0.72
    }
  });

  assert.equal(item.kind, "public_update");
  assert.match(item.title, /回顾/);
});

test("normalization never injects hard-coded demo schedules", () => {
  const result = normalizeItems([]);

  assert.deepEqual(result.schedules, []);
  assert.deepEqual(result.updates, []);
});
