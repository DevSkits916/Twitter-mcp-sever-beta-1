import express, { Request, Response } from "express";
import pino, { Logger } from "pino";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AppConfig } from "./config.js";
import { TwitterClient } from "./twitterClient.js";

/** Helper to wrap JSON data in the MCP content format expected by the SDK. */
function jsonContent(json: unknown): { content: ContentBlock[] } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2)
      }
    ]
  };
}

function textContent(text: string): { content: ContentBlock[] } {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

const healthSchema = z.object({});
const searchTweetsSchema = z.object({
  query: z.string().min(1, "query is required"),
  max_results: z.number().int().min(1).max(50).default(10)
});

const userTweetsSchema = z.object({
  username: z.string().min(1, "username is required"),
  max_results: z.number().int().min(1).max(50).default(10)
});

const tweetIdSchema = z.object({
  id: z.string().min(1, "id is required")
});

const searchUsersSchema = z.object({
  query: z.string().min(1, "query is required"),
  max_results: z.number().int().min(1).max(25).default(10)
});

export interface BuildServerOptions {
  config: AppConfig;
  twitterClient: TwitterClient;
  logger?: Logger;
}

/**
 * Configure the MCP server instance with all Twitter tools.
 */
export function buildMcpServer(options: BuildServerOptions) {
  const logger = options.logger ?? pino({ level: "info" });
  const server = new McpServer({
    name: "twitter-mcp-server",
    version: "1.0.0"
  });

  const { twitterClient } = options;

  server.registerTool(
    "health",
    {
      description: "Check connectivity to the Twitter MCP server.",
      inputSchema: healthSchema
    },
    async () => {
      return jsonContent({ status: "ok", message: "Twitter MCP server is reachable" });
    }
  );

  server.registerTool(
    "search_tweets",
    {
      description: "Search recent tweets that match the provided query string (recent search API).",
      inputSchema: searchTweetsSchema
    },
    async (input) => {
      try {
        const { query, max_results } = searchTweetsSchema.parse(input ?? {});
        const tweets = await twitterClient.searchRecentTweets(query, max_results);
        return jsonContent({ query, count: tweets.length, tweets });
      } catch (error) {
        logger.error({ err: error }, "search_tweets failed");
        return textContent(formatTwitterError(error));
      }
    }
  );

  server.registerTool(
    "get_user_tweets",
    {
      description: "Fetch recent tweets for a given Twitter username.",
      inputSchema: userTweetsSchema
    },
    async (input) => {
      try {
        const { username, max_results } = userTweetsSchema.parse(input ?? {});
        const user = await twitterClient.getUserByUsername(username);
        const tweets = await twitterClient.getUserTweets(user.id, max_results);
        return jsonContent({ user, tweets });
      } catch (error) {
        logger.error({ err: error }, "get_user_tweets failed");
        return textContent(formatTwitterError(error));
      }
    }
  );

  server.registerTool(
    "get_tweet_by_id",
    {
      description: "Retrieve a single tweet by its ID with public metrics.",
      inputSchema: tweetIdSchema
    },
    async (input) => {
      try {
        const { id } = tweetIdSchema.parse(input ?? {});
        const tweet = await twitterClient.getTweetById(id);
        return jsonContent(tweet);
      } catch (error) {
        logger.error({ err: error }, "get_tweet_by_id failed");
        return textContent(formatTwitterError(error));
      }
    }
  );

  server.registerTool(
    "search_users",
    {
      description: "Search for Twitter users by name or handle.",
      inputSchema: searchUsersSchema
    },
    async (input) => {
      try {
        const { query, max_results } = searchUsersSchema.parse(input ?? {});
        const users = await twitterClient.searchUsers(query, max_results);
        return jsonContent({ query, count: users.length, users });
      } catch (error) {
        logger.error({ err: error }, "search_users failed");
        return textContent(formatTwitterError(error));
      }
    }
  );

  server.registerTool(
    "get_authenticated_profile",
    {
      description: "Return profile information for the account associated with the configured bearer token.",
      inputSchema: healthSchema
    },
    async () => {
      try {
        const profile = await twitterClient.getMe();
        return jsonContent(profile);
      } catch (error) {
        logger.error({ err: error }, "get_authenticated_profile failed");
        return textContent(formatTwitterError(error));
      }
    }
  );

  return server;
}

/**
 * Create an Express app that exposes the MCP server over HTTP with optional API key protection.
 */
export async function createHttpApp(options: BuildServerOptions) {
  const logger = options.logger ?? pino({ level: "info" });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = buildMcpServer(options);
  await server.connect(transport);

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.use("/mcp", (req, res, next) => {
    if (options.config.mcpServerApiKey) {
      const key = req.header("x-api-key");
      if (!key || key !== options.config.mcpServerApiKey) {
        res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized MCP request" },
          id: null
        });
        return;
      }
    }
    next();
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ err: error }, "Unhandled MCP error");
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: formatTwitterError(error) },
        id: null
      });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "twitter-mcp-server" });
  });

  return app;
}

function formatTwitterError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || "Unknown error";
    if (message.toLowerCase().includes("429")) {
      return "Twitter API rate limit exceeded, try again later.";
    }
    return `Twitter API error: ${message}`;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred while contacting Twitter.";
}

