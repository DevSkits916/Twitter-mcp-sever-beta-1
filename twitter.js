import fetch from "node-fetch";

async function twitterRequest(path, params = {}) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error("TWITTER_BEARER_TOKEN environment variable is not set.");
  }

  const url = new URL(`https://api.twitter.com/2${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error(`Twitter API returned non-JSON response: ${text}`);
  }

  if (!response.ok) {
    const msg =
      json && json.error
        ? json.error
        : json && json.title
          ? `${json.title}: ${json.detail || ""}`
          : text;

    throw new Error(`Twitter API error (${response.status}): ${msg}`);
  }

  return json;
}

export async function searchRecentTweets(query, maxResults = 20) {
  const clamped = Math.max(10, Math.min(100, maxResults ?? 20));
  return twitterRequest("/tweets/search/recent", {
    query,
    max_results: clamped,
    "tweet.fields": "id,text,author_id,created_at,public_metrics",
  });
}

export async function getUserTweets(username, maxResults = 20) {
  const user = await twitterRequest(`/users/by/username/${username}`, {
    "user.fields": "id,name,username,created_at,public_metrics",
  });

  const userId = user?.data?.id;
  if (!userId) {
    throw new Error(`User not found for username: ${username}`);
  }

  const clamped = Math.max(5, Math.min(100, maxResults ?? 20));
  const tweets = await twitterRequest(`/users/${userId}/tweets`, {
    max_results: clamped,
    "tweet.fields": "id,text,created_at,public_metrics",
  });

  return { user, tweets };
}
