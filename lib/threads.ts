// Threads API（Instagram Graph APIとは別系統）。
// ベースURL: https://graph.threads.net/v1.0/
// スコープ: threads_basic + threads_content_publish

const BASE = "https://graph.threads.net/v1.0";
const ROOT = "https://graph.threads.net"; // refresh / token exchange はバージョン無し

// ---- 投稿（2ステップ）----------------------------------------------------

export async function publishToThreads(
  userId: string,
  token: string,
  text: string,
  imageUrl?: string
): Promise<string> {
  // ① コンテナ作成: POST /{user-id}/threads
  const createParams = new URLSearchParams({
    access_token: token,
    media_type: imageUrl ? "IMAGE" : "TEXT",
    text,
    ...(imageUrl ? { image_url: imageUrl } : {}),
  });
  const created = await fetch(`${BASE}/${userId}/threads`, {
    method: "POST",
    body: createParams,
  }).then((r) => r.json());

  if (!created.id) {
    throw new Error("container creation failed: " + JSON.stringify(created));
  }

  // 画像/動画はMeta側の非同期処理待ち（テキストのみは待ち不要）。
  if (imageUrl) {
    await new Promise((r) => setTimeout(r, 30000));
  }

  // ② 公開: POST /{user-id}/threads_publish
  const publishParams = new URLSearchParams({
    access_token: token,
    creation_id: created.id,
  });
  const published = await fetch(`${BASE}/${userId}/threads_publish`, {
    method: "POST",
    body: publishParams,
  }).then((r) => r.json());

  if (!published.id) {
    throw new Error("publish failed: " + JSON.stringify(published));
  }

  return published.id as string;
}

// ---- インサイト取得 ------------------------------------------------------

export interface ThreadsInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
}

// GET /{thread-id}/insights?metric=views,likes,replies,reposts&access_token=...
// レスポンスは metric ごとに total_value.value または values[0].value を持つ。
export async function fetchInsights(
  threadId: string,
  token: string
): Promise<ThreadsInsights> {
  const params = new URLSearchParams({
    metric: "views,likes,replies,reposts",
    access_token: token,
  });
  const json = await fetch(`${BASE}/${threadId}/insights?${params.toString()}`).then(
    (r) => r.json()
  );

  if (!json.data || !Array.isArray(json.data)) {
    throw new Error("insights fetch failed: " + JSON.stringify(json));
  }

  const out: ThreadsInsights = { views: 0, likes: 0, replies: 0, reposts: 0 };
  for (const m of json.data) {
    const name = m?.name as keyof ThreadsInsights;
    const value: number =
      m?.total_value?.value ?? m?.values?.[0]?.value ?? 0;
    if (name in out) {
      out[name] = typeof value === "number" ? value : 0;
    }
  }
  return out;
}

// ---- トークン延命（long-lived の更新）------------------------------------

export interface RefreshResult {
  access_token: string;
  token_type?: string;
  expires_in: number; // 秒
}

// GET /refresh_access_token?grant_type=th_refresh_token&access_token=...
export async function refreshAccessToken(token: string): Promise<RefreshResult> {
  const params = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: token,
  });
  const json = await fetch(`${ROOT}/refresh_access_token?${params.toString()}`).then(
    (r) => r.json()
  );
  if (!json.access_token || typeof json.expires_in !== "number") {
    throw new Error("token refresh failed: " + JSON.stringify(json));
  }
  return json as RefreshResult;
}

// ---- OAuth（初回のトークン取得用）---------------------------------------

// 短命トークン取得: POST /oauth/access_token （authorization_code grant）
// → { access_token, user_id }
export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ access_token: string; user_id: string }> {
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const json = await fetch(`${ROOT}/oauth/access_token`, {
    method: "POST",
    body,
  }).then((r) => r.json());

  if (!json.access_token) {
    throw new Error("code exchange failed: " + JSON.stringify(json));
  }
  return {
    access_token: json.access_token,
    user_id: String(json.user_id ?? ""),
  };
}

// 短命 → long-lived（60日）への交換:
// GET /access_token?grant_type=th_exchange_token&client_secret=...&access_token=...
export async function exchangeForLongLivedToken(
  shortToken: string,
  appSecret: string
): Promise<RefreshResult> {
  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: appSecret,
    access_token: shortToken,
  });
  const json = await fetch(`${ROOT}/access_token?${params.toString()}`).then((r) =>
    r.json()
  );
  if (!json.access_token || typeof json.expires_in !== "number") {
    throw new Error("long-lived token exchange failed: " + JSON.stringify(json));
  }
  return json as RefreshResult;
}
