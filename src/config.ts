export interface AppConfig {
  port: number;
  twitterBearerToken: string;
  mcpServerApiKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig(): AppConfig {
  const portValue = process.env.PORT ?? "3000";
  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${portValue}`);
  }

  const twitterBearerToken = requireEnv("TWITTER_BEARER_TOKEN");
  const mcpServerApiKey = requireEnv("MCP_SERVER_API_KEY");

  return {
    port,
    twitterBearerToken,
    mcpServerApiKey
  };
}
