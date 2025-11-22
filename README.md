# Twitter MCP Server (HTTP, Render-ready)

## Overview
This project is an MCP server that exposes Twitter/X as tools for LLMs over HTTP. It is built with Node.js, `@modelcontextprotocol/sdk`, Express, and the Twitter API v2. Use it with any MCP-aware client that supports HTTP MCP servers (e.g., ChatGPT custom data sources).

## Prerequisites
- Node 18+
- A Twitter/X developer account and **Bearer token** for the Twitter API v2
- `TWITTER_BEARER_TOKEN` environment variable set to your bearer token

## Local Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Twitter bearer token:
   - macOS/Linux:
     ```bash
     export TWITTER_BEARER_TOKEN="YOUR_TOKEN_HERE"
     ```
   - Windows (PowerShell):
     ```powershell
     $env:TWITTER_BEARER_TOKEN="YOUR_TOKEN_HERE"
     ```
3. Start the server:
   ```bash
   npm start
   ```
4. MCP HTTP endpoint:
   - URL: `http://localhost:3000/mcp`
   - Method: `POST`

## MCP Tools Exposed
- `twitter_search_recent`
  - Parameters:
    - `query` (string, required): search query string.
    - `max_results` (optional, 10–100): number of tweets to return.
  - Description: Uses the Twitter API `/tweets/search/recent` endpoint.
- `twitter_user_tweets`
  - Parameters:
    - `username` (string, required, without @)
    - `max_results` (optional, 5–100)
  - Description: Resolves the user by username, then fetches recent tweets for that user.

## Deploying on Render
1. Create a new **Web Service** on Render and connect your Git repo containing this project.
2. Use the following settings:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
3. Set environment variable in Render:
   - `TWITTER_BEARER_TOKEN` = your bearer token
4. Deploy the service. After deployment, your MCP endpoint will be:
   - `https://YOUR-SERVICE-NAME.onrender.com/mcp`

## Connecting from ChatGPT (as an MCP HTTP server)
1. In ChatGPT or any MCP-aware client, add a new HTTP MCP server / custom data source.
2. Configure with:
   - Name: `twitter-mcp`
   - URL: `https://YOUR-SERVICE-NAME.onrender.com/mcp`
3. Example prompts once connected:
   - "Use `twitter_search_recent` to search recent tweets about Sacramento housing."
   - "Call `twitter_user_tweets` for username `elonmusk` with max_results=10."

## Error Handling & Notes
- If `TWITTER_BEARER_TOKEN` is missing or invalid, the tools return clear errors.
- Twitter API rate limits and access tier restrictions apply.
- Extend `twitter.js` with more endpoints (likes, replies, etc.) and register additional tools in `index.js` as needed.
