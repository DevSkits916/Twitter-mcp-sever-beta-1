import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { TwitterClient } from "./twitterClient.js";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

function jsonContent(json: unknown) {
  return {
    content: [
      {
        type: "json",
        json
      }
    ]
  } as any;
}

function textContent(text: string) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  } as any;
}

const searchRecentTweetsInput = z.object({
  query: z.string().min(1, "Query text is required."),
  limit: z.number().int().min(1).max(50).default(10)
});

const userTimelineInput = z.object({
  username: z.string().min(1, "Username is required."),
  limit: z.number().int().min(1).max(50).default(10)
});

async function start() {
  const config = getConfig();
  const twitterClient = new TwitterClient(config.twitterBearerToken);

  const mcpServer = new McpServer({
    name: "twitter-mcp-server",
    version: "1.0.0"
  });

  mcpServer.registerTool(
    "twitter_get_profile",
    {
      description:
        "Get basic information about the authenticated Twitter (X) user associated with this server's bearer token.",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const profileData = await twitterClient.getMe();
        return jsonContent(profileData);
      } catch (error) {
        const safeMessage = safeErrorMessage(error);
        return textContent(`Twitter API error: ${safeMessage}`);
      }
    }
  );

  mcpServer.registerTool(
    "twitter_search_recent_tweets",
    {
      description:
        "Search recent public tweets matching a query using the Twitter API v2 (read-only).",
      inputSchema: searchRecentTweetsInput
    },
    async (args) => {
      try {
        const { query, limit } = searchRecentTweetsInput.parse(args ?? {});
        const results = await twitterClient.searchRecentTweets(query, limit);
        return jsonContent(results);
      } catch (error) {
        const safeMessage = safeErrorMessage(error);
        return textContent(`Twitter API error: ${safeMessage}`);
      }
    }
  );

  mcpServer.registerTool(
    "twitter_get_user_timeline",
    {
      description: "Get recent tweets from a user's timeline by username (read-only).",
      inputSchema: userTimelineInput
    },
    async (args) => {
      try {
        const { username, limit } = userTimelineInput.parse(args ?? {});
        const userData = await twitterClient.getUserByUsername(username);
        const user = userData?.data;

        if (!user?.id) {
          throw new Error("User not found or missing id");
        }

        const tweetsData = await twitterClient.getUserTweets(user.id, limit);

        return jsonContent({
          user: userData,
          tweets: tweetsData
        });
      } catch (error) {
        const safeMessage = safeErrorMessage(error);
        return textContent(`Twitter API error: ${safeMessage}`);
      }
    }
  );

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  await mcpServer.connect(transport);

  app.use("/mcp", (req, res, next) => {
    const key = req.header("x-api-key");
    if (!key || key !== config.mcpServerApiKey) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized MCP request" },
        id: null
      });
      return;
    }
    next();
  });

  app.post("/mcp", async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const safeMessage = safeErrorMessage(error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: `Internal MCP error: ${safeMessage}` },
        id: null
      });
    }
  });

  app.get("/mcp", (req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null
    });
  });

  app.delete("/mcp", (req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null
    });
  });

  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`MCP server listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
