# Twitter MCP Server (HTTP, Render-ready)

An MCP-compatible HTTP server that exposes Twitter/X data as tools for ChatGPT Developer Mode. It uses Node.js, TypeScript, Express, and the Model Context Protocol SDK to provide structured endpoints for searching tweets and users.

## Features
- MCP HTTP server (stdin/stdout-free) using JSON-RPC over `/mcp`.
- Tools for searching tweets, fetching user timelines, fetching individual tweets, searching users, and checking health.
- Twitter/X integration via Bearer token with clear, normalized responses.
- Production-ready Dockerfile for Render deployment.
- Optional `x-api-key` protection for the MCP endpoint.

## Prerequisites
- Node.js 18+
- Twitter/X API Bearer token with access to recent search endpoints
- `TWITTER_BEARER_TOKEN` set in the environment (see `.env.example`)

## Quick Start (local)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file based on `.env.example` and set at least `TWITTER_BEARER_TOKEN`.
3. Build and start the server:
   ```bash
   npm run build
   npm start
   ```
4. MCP HTTP endpoint: `http://localhost:3000/mcp` (protected by `x-api-key` if `MCP_SERVER_API_KEY` is set).
5. Health check: `http://localhost:3000/health`.

## npm Scripts
- `npm run build` – TypeScript compile to `dist/`
- `npm start` – run compiled server
- `npm run dev` – start with `ts-node-dev` for hot reload (development only)

## MCP Tools
All tools return JSON content. Errors are surfaced as plain text messages for clarity.

| Tool | Description | Input |
| --- | --- | --- |
| `health` | Connectivity check for the MCP server. | `{}` |
| `search_tweets` | Search recent tweets by query. | `{ query: string, max_results?: number (1-50, default 10) }` |
| `get_user_tweets` | Recent tweets for a username. | `{ username: string, max_results?: number (1-50, default 10) }` |
| `get_tweet_by_id` | Fetch a single tweet by ID. | `{ id: string }` |
| `search_users` | Search users by name/handle. | `{ query: string, max_results?: number (1-25, default 10) }` |
| `get_authenticated_profile` | Profile for the bearer token account. | `{}` |

### Example tool call payloads
- Search tweets:
  ```json
  {
    "method": "search_tweets",
    "params": { "query": "open source ai", "max_results": 5 }
  }
  ```
- Get user tweets:
  ```json
  {
    "method": "get_user_tweets",
    "params": { "username": "OpenAI", "max_results": 10 }
  }
  ```
- Get tweet by ID:
  ```json
  {
    "method": "get_tweet_by_id",
    "params": { "id": "1234567890123456789" }
  }
  ```

## Environment Variables
See `.env.example` for full list. Key values:
- `TWITTER_BEARER_TOKEN` (required) – Twitter/X API bearer token.
- `PORT` (optional) – defaults to `3000`.
- `MCP_SERVER_API_KEY` (optional) – if set, requests to `/mcp` must include header `x-api-key: <value>`.
- `TWITTER_API_BASE_URL` (optional) – override Twitter API base URL (testing).

## Docker
Build and run locally:
```bash
docker build -t twitter-mcp .
docker run --rm -p 3000:3000 -e TWITTER_BEARER_TOKEN=YOUR_TOKEN twitter-mcp
```

## Deploying on Render
1. Create a new **Web Service**.
2. Use this repository and select Docker as the environment.
3. Render will build using the included `Dockerfile`. Ensure environment variable `TWITTER_BEARER_TOKEN` (and optionally `MCP_SERVER_API_KEY`) is set.
4. Expose port `3000` in the Render service settings (Render automatically maps to an external port).
5. After deployment your MCP endpoint will be: `https://YOUR-SERVICE.onrender.com/mcp`.

## Connecting to ChatGPT (Developer Mode MCP)
Add this server as a custom MCP HTTP source. Example JSON configuration:
```json
{
  "name": "twitter-mcp-server",
  "type": "http",
  "url": "https://YOUR-SERVICE.onrender.com/mcp",
  "headers": {
    "x-api-key": "<your-mcp-api-key-if-configured>"
  }
}
```
If running locally, set `url` to `http://localhost:3000/mcp`.

### Sample interactions in ChatGPT
- "Call `search_tweets` for `climate tech` with `max_results` 5."
- "Use `get_user_tweets` for `nasa` and summarize the latest posts."
- "Use `search_users` to find researchers named `Jane Doe`."
- "Call `get_tweet_by_id` for `123...` to get metrics and the URL."

## Error Handling
- All Twitter errors are converted to readable text (e.g., rate limits or missing credentials).
- Input validation via Zod enforces required fields and caps `max_results` to safe limits.
- HTTP 401 returned when `MCP_SERVER_API_KEY` is configured and missing from requests.

## Extending
To add new tools, register them in `src/mcpServer.ts` and implement the Twitter calls in `src/twitterClient.ts`. Each tool should define a Zod schema for inputs, call the client, and return `jsonContent(...)`.

