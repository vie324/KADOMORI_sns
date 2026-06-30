import { createClient, SupabaseClient } from "@supabase/supabase-js";

// サーバー専用クライアント。service role キーを使うため、
// 絶対にクライアントサイド（"use client" のコンポーネント）から import しないこと。

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に設定してください。"
    );
  }

  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
