# JJ LIN Radar V1

中文 JJ LIN Radar，聚合公开来源中与林俊杰相关的动态，并把明确包含日期/地点/演出类线索的信息归为“行程”，其余归为“公开动态”。

## 要点

- 不包含任何硬编码、seed 或 demo 行程。
- `/health` 提供健康检查。
- `/api/schedule` 返回行程、公开动态、来源状态和采集时间。
- RSSHub 只作为可选补充来源；默认数据来自公开新闻 RSS 和官方公开网页探测。

## 本地运行

```bash
npm install
npm test
npm run build
npm start
```

服务默认监听 `PORT`，未设置时使用 `3000`。
