const BASE_URL = "https://api.twitter.com/2";

async function fetchJson(url: string, bearerToken: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(
      `Twitter API error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

export class TwitterClient {
  constructor(private bearerToken: string) {}

  async getMe(): Promise<any> {
    const url = `${BASE_URL}/users/me?user.fields=id,name,username,created_at,description,public_metrics`;
    return fetchJson(url, this.bearerToken);
  }

  async getUserByUsername(username: string): Promise<any> {
    const url = `${BASE_URL}/users/by/username/${encodeURIComponent(username)}?user.fields=id,name,username,created_at,description,public_metrics`;
    return fetchJson(url, this.bearerToken);
  }

  async getUserTweets(userId: string, limit: number): Promise<any> {
    const url = `${BASE_URL}/users/${encodeURIComponent(userId)}/tweets?max_results=${limit}&tweet.fields=created_at,public_metrics,text,author_id`;
    return fetchJson(url, this.bearerToken);
  }

  async searchRecentTweets(query: string, limit: number): Promise<any> {
    const url = `${BASE_URL}/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${limit}&tweet.fields=created_at,public_metrics,text,author_id`;
    return fetchJson(url, this.bearerToken);
  }
}
