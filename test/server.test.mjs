import assert from "node:assert/strict";
import test from "node:test";
import fetch from "node-fetch";

import { createApp } from "../src/server.mjs";

test("health endpoint reports ok", async () => {
  const app = createApp({ collect: async () => ({ schedules: [], updates: [], sources: [] }) });
  const server = app.listen(0, "127.0.0.1");
  await onceListening(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.service, "jj-lin-radar");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("schedule endpoint returns separated schedules and public updates", async () => {
  const payload = {
    schedules: [],
    updates: [
      {
        id: "source-title",
        kind: "public_update",
        title: "公开动态",
        sourceName: "新闻 RSS",
        originalUrl: "https://example.com/news",
        publishedAt: "2026-08-21T10:00:00.000Z",
        confidence: "中"
      }
    ],
    sources: [{ name: "新闻 RSS", status: "ok" }]
  };
  const app = createApp({ collect: async () => payload });
  const server = app.listen(0, "127.0.0.1");
  await onceListening(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/schedule`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.schedules, []);
    assert.equal(body.data.updates[0].kind, "public_update");
    assert.equal(body.data.updates[0].originalUrl, "https://example.com/news");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function onceListening(server) {
  return new Promise((resolve, reject) => {
    if (server.listening) {
      resolve();
      return;
    }
    server.once("listening", resolve);
    server.once("error", reject);
  });
}
