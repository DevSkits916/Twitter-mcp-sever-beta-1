# Twitter MCP Server (Read-Only)

This project is a remote Model Context Protocol (MCP) server that exposes Twitter/X as a read-only data source over the MCP Streamable HTTP transport. It provides tools to fetch the authenticated user's profile, search recent public tweets, and retrieve a user's recent tweets by username.

## Prerequisites

- Node.js 20+
- A valid Twitter/X API v2 Bearer token with permissions for the read-only endpoints used by this server.

## Configuration

Set the following environment variables:

- `TWITTER_BEARER_TOKEN` — your Twitter/X API v2 Bearer token
- `MCP_SERVER_API_KEY` — shared secret key required in the `x-api-key` header for all MCP requests
- `PORT` — optional; defaults to `3000` locally. Render automatically sets this value in production.

## Local Development

```bash
npm install
export TWITTER_BEARER_TOKEN=your_token_here
export MCP_SERVER_API_KEY=some-long-random-secret
npm run build
npm start
```

The MCP endpoint will be available at `http://localhost:3000/mcp` (or the port you configured).

## Security Notes

- Every request to `/mcp` must include an `x-api-key` header matching `MCP_SERVER_API_KEY`.
- The server is strictly read-only and only calls official Twitter/X API v2 endpoints.
- No scraping, posting, or automation beyond read-only queries is implemented.
- Ensure compliance with Twitter/X terms, rate limits, and privacy requirements when using this server.

## Example curl Usage

Send a JSON-RPC `initialize` request:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: $MCP_SERVER_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {}
    }
  }'
```

After initialization, you can call `tools/list` to discover available tools and `tools/call` to invoke them:

- `twitter_get_profile`
- `twitter_search_recent_tweets`
- `twitter_get_user_timeline`

## Deployment on Render

Deploy using the included `render.yaml`. Render sets the `PORT` environment variable automatically. Ensure `TWITTER_BEARER_TOKEN` and `MCP_SERVER_API_KEY` are configured in your Render service environment.

## Using with MCP Clients

Any MCP-aware client can be pointed to the HTTP endpoint (e.g., `https://<your-render-service>.onrender.com/mcp`) using the Streamable HTTP transport and providing the `x-api-key` header. The Twitter tools will be exposed to the client as the three tools listed above.
