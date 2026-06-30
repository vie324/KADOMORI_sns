// DBの行に対応するTypeScript型。schema.sql と一致させること。

export type PostStatus = "draft" | "approved" | "published" | "failed";

export const POST_STATUSES: PostStatus[] = [
  "draft",
  "approved",
  "published",
  "failed",
];

export interface Post {
  id: string;
  theme: string | null;
  body: string;
  image_url: string | null;
  status: PostStatus;
  ng_flagged: boolean;
  scheduled_for: string | null;
  thread_id: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PostInsight {
  id: string;
  post_id: string;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  fetched_at: string;
}

export interface ThreadsToken {
  id: number;
  access_token: string;
  user_id: string;
  expires_at: string | null;
  updated_at: string;
}
