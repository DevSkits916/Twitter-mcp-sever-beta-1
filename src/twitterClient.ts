import fetch, { Response } from "node-fetch";

export interface TweetSummary {
  id: string;
  text: string;
  author?: UserSummary;
  createdAt?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  url: string;
}

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  description?: string;
  followersCount?: number;
  followingCount?: number;
  tweetCount?: number;
  listedCount?: number;
  createdAt?: string;
  profileUrl: string;
}

export interface TwitterApiError {
  status: number;
  title: string;
  detail?: string;
}

interface TwitterApiResponse<T> {
  data?: T;
  includes?: { users?: TwitterUser[] };
  errors?: TwitterApiError[];
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  created_at?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
    listed_count?: number;
  };
}

interface TwitterTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    quote_count?: number;
  };
}

export class TwitterClient {
  constructor(private bearerToken: string, private baseUrl: string) {}

  private buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json"
      }
    });

    const data = (await response.json().catch(() => undefined)) as TwitterApiResponse<T> | undefined;

    if (!response.ok) {
      const reason = this.buildErrorMessage(response, data);
      throw new Error(reason);
    }

    if (data?.errors?.length) {
      const [firstError] = data.errors;
      throw new Error(firstError?.detail || firstError?.title || "Twitter API returned an error");
    }

    if (!data || data.data === undefined) {
      throw new Error("Malformed response from Twitter API");
    }

    return data as unknown as T;
  }

  private buildErrorMessage(response: Response, body?: TwitterApiResponse<unknown>): string {
    const statusPart = `Twitter API error (${response.status})`;
    const detail = body?.errors?.[0]?.detail || body?.errors?.[0]?.title;
    if (detail) {
      return `${statusPart}: ${detail}`;
    }
    return `${statusPart}: ${response.statusText}`;
  }

  private normalizeUser(user: TwitterUser): UserSummary {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      description: user.description,
      followersCount: user.public_metrics?.followers_count,
      followingCount: user.public_metrics?.following_count,
      tweetCount: user.public_metrics?.tweet_count,
      listedCount: user.public_metrics?.listed_count,
      createdAt: user.created_at,
      profileUrl: `https://twitter.com/${user.username}`
    };
  }

  private normalizeTweet(tweet: TwitterTweet, authors?: Map<string, UserSummary>): TweetSummary {
    const trimmed = tweet.text.length > 560 ? `${tweet.text.slice(0, 557)}...` : tweet.text;
    const author = tweet.author_id ? authors?.get(tweet.author_id) : undefined;
    return {
      id: tweet.id,
      text: trimmed,
      author,
      createdAt: tweet.created_at,
      likeCount: tweet.public_metrics?.like_count,
      replyCount: tweet.public_metrics?.reply_count,
      retweetCount: tweet.public_metrics?.retweet_count,
      quoteCount: tweet.public_metrics?.quote_count,
      url: `https://twitter.com/${author?.username ?? "twitter"}/status/${tweet.id}`
    };
  }

  async getMe(): Promise<UserSummary> {
    const url = this.buildUrl("/users/me", {
      "user.fields": "id,name,username,created_at,description,public_metrics"
    });
    const response = await this.fetchJson<TwitterApiResponse<TwitterUser>>(url);
    if (!response.data) {
      throw new Error("Missing user data in response");
    }
    return this.normalizeUser(response.data);
  }

  async getUserByUsername(username: string): Promise<UserSummary> {
    const url = this.buildUrl(`/users/by/username/${encodeURIComponent(username)}`, {
      "user.fields": "id,name,username,created_at,description,public_metrics"
    });
    const response = await this.fetchJson<TwitterApiResponse<TwitterUser>>(url);
    if (!response.data) {
      throw new Error("User not found");
    }
    return this.normalizeUser(response.data);
  }

  async getUserTweets(userId: string, limit: number): Promise<TweetSummary[]> {
    const url = this.buildUrl(`/users/${encodeURIComponent(userId)}/tweets`, {
      max_results: limit,
      "tweet.fields": "created_at,public_metrics,text,author_id",
      expansions: "author_id",
      "user.fields": "id,name,username"
    });
    const response = await this.fetchJson<TwitterApiResponse<TwitterTweet[]>>(url);
    const authors = new Map<string, UserSummary>();
    response.includes?.users?.forEach((user) => {
      authors.set(user.id, this.normalizeUser(user));
    });
    return (response.data ?? []).map((tweet) => this.normalizeTweet(tweet, authors));
  }

  async searchRecentTweets(query: string, limit: number): Promise<TweetSummary[]> {
    const url = this.buildUrl("/tweets/search/recent", {
      query,
      max_results: limit,
      "tweet.fields": "created_at,public_metrics,text,author_id",
      expansions: "author_id",
      "user.fields": "id,name,username"
    });
    const response = await this.fetchJson<TwitterApiResponse<TwitterTweet[]>>(url);
    const authors = new Map<string, UserSummary>();
    response.includes?.users?.forEach((user) => {
      authors.set(user.id, this.normalizeUser(user));
    });
    return (response.data ?? []).map((tweet) => this.normalizeTweet(tweet, authors));
  }

  async getTweetById(id: string): Promise<TweetSummary> {
    const url = this.buildUrl(`/tweets/${encodeURIComponent(id)}`, {
      expansions: "author_id",
      "tweet.fields": "created_at,public_metrics,text,author_id",
      "user.fields": "id,name,username,created_at,public_metrics"
    });
    const response = await this.fetchJson<TwitterApiResponse<TwitterTweet>>(url);
    const authors = new Map<string, UserSummary>();
    response.includes?.users?.forEach((user) => {
      authors.set(user.id, this.normalizeUser(user));
    });
    if (!response.data) {
      throw new Error("Tweet not found");
    }
    return this.normalizeTweet(response.data, authors);
  }

  async searchUsers(query: string, limit: number): Promise<UserSummary[]> {
    const url = this.buildUrl("/users/search", {
      query,
      max_results: limit,
      "user.fields": "id,name,username,description,created_at,public_metrics"
    });
    const response = await this.fetchJson<TwitterApiResponse<TwitterUser[]>>(url);
    return (response.data ?? []).map((user) => this.normalizeUser(user));
  }
}
