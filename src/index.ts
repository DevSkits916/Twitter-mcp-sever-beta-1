import pino from "pino";
import { getConfig } from "./config.js";
import { TwitterClient } from "./twitterClient.js";
import { createHttpApp } from "./mcpServer.js";

async function bootstrap() {
  const config = getConfig();
  const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

  const twitterClient = new TwitterClient(config.twitterBearerToken, config.twitterApiBaseUrl);
  const app = await createHttpApp({ config, twitterClient, logger });

  app.listen(config.port, () => {
    logger.info(`MCP server listening on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

