import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { searchRecentTweets, getUserTweets } from "./twitter.js";

const server = new McpServer({ name: "twitter-mcp", version: "1.0.0" });

server.tool(
  "twitter_search_recent",
  {
    query: z.string(),
    max_results: z.number().int().min(10).max(100).optional(),
  },
  async ({ query, max_results }) => {
    const result = await searchRecentTweets(query, max_results);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "twitter_user_tweets",
  {
    username: z.string(),
    max_results: z.number().int().min(5).max(100).optional(),
  },
  async ({ username, max_results }) => {
    const result = await getUserTweets(username, max_results);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP server error" });
    }
  }
});

const port = parseInt(process.env.PORT || "3000", 10);
app
  .listen(port, () => {
    console.log(`Twitter MCP server running on port ${port}`);
    console.log(`POST endpoint: /mcp`);
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
