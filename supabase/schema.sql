-- 投稿ストック兼実績。statusで状態管理
create table posts (
  id            uuid primary key default gen_random_uuid(),
  theme         text,         -- '1'〜'6' どのテーマの型か
  body          text not null,-- 投稿本文（500字以内）
  image_url     text,         -- 公開URL（任意）
  status        text default 'draft',  -- draft / approved / published / failed
  ng_flagged    boolean default false, -- NGワード検知フラグ
  scheduled_for timestamptz,
  thread_id     text,         -- 公開後にThreadsが返す投稿ID
  published_at  timestamptz,
  created_at    timestamptz default now()
);

-- 反応データ
create table post_insights (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references posts(id) on delete cascade,
  views       int,
  likes       int,
  replies     int,
  reposts     int,
  fetched_at  timestamptz default now()
);

-- long-livedトークンを1行で保管
create table threads_token (
  id            int primary key default 1,
  access_token  text not null,
  user_id       text not null,  -- Threads user id
  expires_at    timestamptz,    -- 60日後
  updated_at    timestamptz default now()
);

-- RLS：全テーブルとも一般公開を禁止。service role のみ読み書き。
alter table posts enable row level security;
alter table post_insights enable row level security;
alter table threads_token enable row level security;
-- （ポリシーは作らない＝anon/authenticatedからは触れない。サーバーからservice roleで操作）
