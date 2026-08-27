const statusEl = document.querySelector("#status");
const updatedEl = document.querySelector("#updated");
const schedulesEl = document.querySelector("#schedules");
const updatesEl = document.querySelector("#updates");
const sourcesEl = document.querySelector("#sources");
const scheduleCountEl = document.querySelector("#schedule-count");
const updateCountEl = document.querySelector("#update-count");

load();

async function load() {
  try {
    const response = await fetch("/api/schedule");
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    render(payload.data);
    statusEl.textContent = "已连接公开来源";
  } catch (error) {
    statusEl.textContent = `采集失败：${error.message}`;
    schedulesEl.innerHTML = empty("暂时没有可展示的行程。");
    updatesEl.innerHTML = empty("暂时没有可展示的公开动态。");
  }
}

function render(data) {
  updatedEl.textContent = formatDateTime(data.generatedAt);
  scheduleCountEl.textContent = data.schedules.length;
  updateCountEl.textContent = data.updates.length;
  schedulesEl.innerHTML = data.schedules.length
    ? data.schedules.map(renderItem).join("")
    : empty("当前公开来源中未识别到可验证的未来行程。");
  updatesEl.innerHTML = data.updates.length
    ? data.updates.map(renderItem).join("")
    : empty("当前公开来源中未识别到公开动态。");
  sourcesEl.innerHTML = data.sources.map(renderSource).join("");
}

function renderItem(item) {
  const dateChip = item.eventDate ? `<span class="chip">行程日期：${formatDate(item.eventDate)}</span>` : "";

  return `
    <article class="item">
      <h3><a href="${escapeAttr(item.originalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
      <p>${escapeHtml(item.summary || "暂无摘要")}</p>
      <div class="meta">
        <span class="chip">来源：${escapeHtml(item.sourceName)}</span>
        <span class="chip">发布时间：${formatDateTime(item.publishedAt)}</span>
        <span class="chip confidence">可信度：${item.confidence}</span>
        ${dateChip}
      </div>
    </article>
  `;
}

function renderSource(source) {
  const className = source.status === "ok" ? "ok" : "error";
  const status = source.status === "ok" ? `正常，${source.count} 条` : `异常：${source.error || "无法读取"}`;

  return `
    <div class="source">
      <a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)}</a>
      <span class="${className}">${escapeHtml(status)}</span>
    </div>
  `;
}

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function formatDateTime(value) {
  if (!value) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "long",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
