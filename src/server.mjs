import express from "express";
import { collectRadarData } from "./collector.mjs";

export function createApp({ collect = collectRadarData } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.static("public", {
    extensions: ["html"],
    maxAge: "5m"
  }));

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "jj-lin-radar",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/schedule", async (_request, response) => {
    try {
      const data = await collect();
      response.json({
        ok: true,
        data
      });
    } catch (error) {
      response.status(502).json({
        ok: false,
        error: error.message
      });
    }
  });

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, "0.0.0.0", () => {
    console.log(`JJ LIN Radar listening on ${port}`);
  });
}
