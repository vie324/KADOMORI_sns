# Threads 自動投稿システム

銀座の高単価鍼灸サロン向けの Threads 自動投稿システムです。
コンセプト起点で生成した投稿文を Supabase に「ストック」し、承認したものを
**1日2回（JST 8:00 / 19:00）自動で Threads に投稿**します。

- 管理画面で投稿の生成・承認・実績確認ができる
- 反応データ（閲覧/いいね/返信）を蓄積し、テーマ別の傾向を見られる

## 技術スタック

- Next.js（App Router, TypeScript）
- Supabase（PostgreSQL + Storage）
- Vercel Cron（スケジューラ）
- Threads API（`https://graph.threads.net/v1.0/`）
- Anthropic Claude API（`claude-sonnet-4-6`）で文章生成
- Tailwind CSS
- パッケージマネージャ: pnpm

---

## 1. セットアップ手順

### 1-1. 依存関係のインストール

```bash
pnpm install
```

### 1-2. Supabase でテーブル作成

Supabase プロジェクトを作成し、SQL Editor で `supabase/schema.sql` をそのまま実行します。
`posts` / `post_insights` / `threads_token` の3テーブルが作成され、RLS が有効になります
（ポリシーは作らないため、anon / authenticated からは触れません。サーバーから service role
キーでのみ読み書きします）。

### 1-3. 環境変数

`.env.example` をコピーして `.env.local` を作成し、各値を埋めます。

```bash
cp .env.example .env.local
```

| 変数 | 説明 |
|---|---|
| `SUPABASE_URL` | Supabase プロジェクトURL（サーバー用） |
| `SUPABASE_SERVICE_ROLE_KEY` | service role キー。**サーバーのみ**で使用。絶対にクライアントへ露出させない |
| `NEXT_PUBLIC_SUPABASE_URL` | （将来のクライアント利用向け。現状は未使用でも可） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | （同上） |
| `THREADS_APP_ID` | Meta / Threads アプリのID |
| `THREADS_APP_SECRET` | Threads アプリのシークレット。**サーバーのみ** |
| `THREADS_REDIRECT_URI` | OAuth コールバックURL（例: `https://<your-domain>/api/auth/callback`） |
| `ANTHROPIC_API_KEY` | Claude API キー。**サーバーのみ** |
| `CRON_SECRET` | Cron ルート保護用のシークレット（任意の長いランダム文字列） |
| `ADMIN_USER` / `ADMIN_PASSWORD` | 管理画面の Basic 認証。**本番では必ず設定**（未設定だと管理画面が無防備） |

> `SUPABASE_SERVICE_ROLE_KEY` / `THREADS_APP_SECRET` / `ANTHROPIC_API_KEY` / `CRON_SECRET`
> はサーバーサイドのみで参照され、クライアントには露出しません。

### 1-4. 開発サーバー起動

```bash
pnpm dev
```

`http://localhost:3000` で管理画面が開きます。

---

## 2. Threads / Meta App Review の手順

Threads API で投稿するには Meta の審査が必要です。

1. [Meta for Developers](https://developers.facebook.com/) で開発者登録
2. アプリを作成し、Threads API（Threads use case）を追加
3. 権限 `threads_basic` + `threads_content_publish` を申請
4. **テストユーザー**でまず先行検証（テストユーザーは審査前でも API を叩ける）
5. 本番審査を提出

> 審査には日数がかかります。その間に **Phase 3（生成）** を進めて投稿ストックを貯めておくと、
> 審査通過後すぐに運用を開始できます。

### Threads API の重要仕様（実装で守っていること）

1. **投稿は2ステップ**: ①コンテナ作成 `POST /{user-id}/threads` → ②公開 `POST /{user-id}/threads_publish`
2. ネイティブの予約機能は無い → **Cron がスケジューラの役割**
3. 画像は直接アップロード不可。Meta が**公開URL**からフェッチする（Supabase Storage の公開バケットを使う）
4. 画像/動画はコンテナ作成→公開の間に **30秒以上待つ**（テキストのみは待ち不要）
5. 文字数は **500字**（URL・絵文字は UTF-8 バイト長でカウント）
6. 投稿上限は 250投稿/24時間。1日2投稿なので問題なし
7. long-lived トークンの寿命は **60日**。24時間経過後〜失効前にリフレッシュ可能
8. コンテナは作成後 **24時間で失効**
9. ベースURLは `https://graph.threads.net/v1.0/`（Instagram Graph API とは別系統）

---

## 3. OAuth で long-lived トークンを取得し threads_token に初期登録する

初回は手動でトークンを登録します。本リポジトリにはそのための一回限りのルートを用意しています。

1. `THREADS_APP_ID` / `THREADS_APP_SECRET` / `THREADS_REDIRECT_URI` を設定し、デプロイ
   （または `THREADS_REDIRECT_URI` をローカルに向けて `pnpm dev`）
2. ブラウザで **`/api/auth/login`** を開く
3. Threads の認可画面で承認すると **`/api/auth/callback`** に戻る
4. コールバックが自動で
   - 認可コード → 短命トークン（`POST /oauth/access_token`）
   - 短命 → long-lived（60日、`GET /access_token?grant_type=th_exchange_token`）
   に交換し、`threads_token`（`id=1`）に保存します
5. `{ ok: true, user_id, expires_at }` が返れば登録完了

> `THREADS_REDIRECT_URI` は Meta アプリ側の許可リストにも登録しておく必要があります。

### テキスト投稿が1本通ることの確認

トークン登録後、最短で end-to-end を確認するには:

1. 管理画面 `/generate` で1本生成 → `/`（下書き）で **承認**
2. Cron ルートを手動で叩く（`CRON_SECRET` を Bearer で付与）:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/publish
```

`{ ok: true, thread_id: ... }` が返り、Threads に投稿されれば成功です。

---

## 4. 運用フロー（生成 → 承認 → 自動投稿 → 分析のループ）

1. **生成**: `/generate` でテーマ・本数・文字数を指定し一括生成 → `draft` で保存
2. **承認**: `/`（ストック）の「下書き」タブで内容を確認し、問題なければ「承認」
   - `要確認`（赤バッジ）は NGワード or 文字数超過。必ず人間が確認・修正
   - スマホでも承認操作ができるようレスポンシブ対応（移動中に承認可能）
3. **自動投稿**: Cron が JST 8:00 / 19:00 に `approved` かつ `ng_flagged=false` の最古を1件投稿
4. **分析**: `/insights` で published 投稿のテーマ別平均 views/いいね/返信を確認

---

## 5. Cron の時刻換算と Vercel プランの注意

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/publish", "schedule": "0 23 * * *" },
    { "path": "/api/cron/publish", "schedule": "0 10 * * *" },
    { "path": "/api/cron/refresh-token", "schedule": "0 3 * * 0" }
  ]
}
```

- **Cron は常に UTC**。JST 8:00 = UTC 23:00、JST 19:00 = UTC 10:00
- トークン延命は毎週日曜 UTC 3:00 に実行
- 反応データ取得 `/api/cron/insights` は任意。必要なら `vercel.json` の `crons` に追加する
  （例: 1日数回 `{ "path": "/api/cron/insights", "schedule": "0 */6 * * *" }`）

### Cron ルートの保護

Vercel で `CRON_SECRET` 環境変数を設定すると、Vercel Cron はリクエストに
`Authorization: Bearer <CRON_SECRET>` を自動付与します。各 Cron ルートはこのヘッダを
検証し、不一致なら 401 を返します。

### Vercel プランの注意

> Vercel Hobby プランは Cron の実行回数・頻度に制限がある場合があります。
> **1日2回を確実に動かすなら Pro 前提**です。もしくは外部スケジューラ
> （GitHub Actions / cron-job.org など）から API ルートを `Authorization: Bearer <CRON_SECRET>`
> 付きで叩く構成にしてください。

---

## 6. セキュリティ

- **管理画面と管理用API（`/`, `/generate`, `/insights`, `/api/posts`, `/api/generate`,
  `/api/auth/*`）は `middleware.ts` の Basic 認証で保護**します。`ADMIN_USER` /
  `ADMIN_PASSWORD` を設定すると有効になります。これらの API は service role キーで
  動作し RLS をバイパスするため、**本番では必ず Basic 認証を設定**してください
  （未設定だと誰でも投稿の生成・承認・削除・公開ができてしまいます）。
- **Cron（`/api/cron/*`）は Basic 認証から除外**し、`CRON_SECRET` の Bearer トークンで
  別途保護しています（Vercel Cron からのアクセス用）。
- **OAuth は `state` パラメータで CSRF 対策**しています（`/api/auth/login` が発行し
  `/api/auth/callback` が検証）。
- `SUPABASE_SERVICE_ROLE_KEY` / `THREADS_APP_SECRET` / `ANTHROPIC_API_KEY` /
  `CRON_SECRET` / `ADMIN_PASSWORD` は**サーバーサイドのみ**で参照され、クライアントには
  露出しません。
- 生成APIは1リクエストあたりテーマ数 × 本数（最大10本）に上限を設けています。
  さらに堅牢にするなら、`/api/generate` に IP/ユーザー単位のレート制限
  （Upstash Ratelimit 等）を追加してください。

---

## ディレクトリ構成

```
/
├── app/
│   ├── page.tsx                      # 管理画面：投稿ストック一覧・承認
│   ├── generate/page.tsx             # 生成画面：テーマ選択→一括生成
│   ├── insights/page.tsx             # 反応データの簡易ダッシュボード
│   └── api/
│       ├── posts/route.ts            # 投稿のCRUD（一覧/承認/編集/削除）
│       ├── generate/route.ts         # Claude APIで投稿一括生成→draft保存
│       ├── auth/login/route.ts       # OAuth開始（認可画面へリダイレクト）
│       ├── auth/callback/route.ts    # OAuthコールバック→トークン保存
│       └── cron/
│           ├── publish/route.ts      # ★Cron：approvedを1件投稿
│           ├── refresh-token/route.ts# ★Cron：トークン延命（週1）
│           └── insights/route.ts     # ★Cron：反応データ取得（任意）
├── components/Nav.tsx
├── lib/
│   ├── supabase.ts                   # サーバー用クライアント（service role）
│   ├── threads.ts                    # Threads投稿（2ステップ）・インサイト・OAuth
│   ├── anthropic.ts                  # Claude API呼び出し＋プロンプト組み立て
│   ├── validate.ts                   # 薬機法NGワードのバリデーション
│   ├── themes.ts                     # テーマ定義（1〜6）
│   └── types.ts                      # DB行の型
├── supabase/schema.sql               # テーブル定義
├── vercel.json                       # Cronスケジュール
├── .env.example                      # 必要な環境変数の雛形
└── README.md
```

---

## 拡張余地（今は未実装、構造で意識）

- `threads_token` を複数行＋ `posts` に `account_id` を持たせれば**マルチアカウント／複数ブランド**に拡張可能
- `post_insights` の集計で**勝ちテーマに生成本数を寄せる**自動最適化につなげられる
