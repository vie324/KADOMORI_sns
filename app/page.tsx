"use client";

import { useCallback, useEffect, useState } from "react";
import { Post, PostStatus } from "@/lib/types";
import { themeName } from "@/lib/themes";
import { threadsLength, MAX_LENGTH } from "@/lib/validate";

const TABS: { key: PostStatus; label: string }[] = [
  { key: "draft", label: "下書き" },
  { key: "approved", label: "承認済" },
  { key: "published", label: "投稿済" },
  { key: "failed", label: "失敗" },
];

export default function HomePage() {
  const [tab, setTab] = useState<PostStatus>("draft");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async (status: PostStatus) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts?status=${status}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "読み込みに失敗しました");
      setPosts(json.posts as Post[]);
    } catch (e) {
      setError(String(e));
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert("更新に失敗しました: " + (json.error || res.status));
      return;
    }
    await load(tab);
  }

  async function setStatus(id: string, status: PostStatus) {
    await patch(id, { status });
  }

  async function remove(id: string) {
    if (!confirm("この投稿を削除しますか？")) return;
    const res = await fetch(`/api/posts?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert("削除に失敗しました: " + (json.error || res.status));
      return;
    }
    await load(tab);
  }

  function startEdit(p: Post) {
    setEditingId(p.id);
    setEditBody(p.body);
  }

  async function saveEdit(id: string) {
    await patch(id, { body: editBody });
    setEditingId(null);
    setEditBody("");
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">投稿ストック</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded text-sm border ${
              tab === t.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">読み込み中…</p>}
      {error && (
        <p className="text-sm text-red-600 break-all">エラー: {error}</p>
      )}
      {!loading && !error && posts.length === 0 && (
        <p className="text-sm text-gray-500">投稿がありません。</p>
      )}

      <ul className="space-y-3">
        {posts.map((p) => {
          const len = threadsLength(p.body);
          const over = len > MAX_LENGTH;
          return (
            <li
              key={p.id}
              className="bg-white border border-gray-200 rounded p-3 text-sm"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap text-xs text-gray-500">
                <span className="px-2 py-0.5 bg-gray-100 rounded">
                  {themeName(p.theme)}
                </span>
                <span className={over ? "text-red-600 font-medium" : ""}>
                  {len}字
                </span>
                {p.ng_flagged && (
                  <span className="px-2 py-0.5 bg-red-600 text-white rounded font-medium">
                    要確認
                  </span>
                )}
                {p.thread_id && (
                  <span className="text-gray-400">id: {p.thread_id}</span>
                )}
              </div>

              {editingId === p.id ? (
                <div>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={6}
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {threadsLength(editBody)}字
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => saveEdit(p.id)}
                      className="px-3 py-1 rounded bg-gray-900 text-white text-xs"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditBody("");
                      }}
                      className="px-3 py-1 rounded border border-gray-300 text-xs"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
                  {p.body}
                </p>
              )}

              {editingId !== p.id && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {(p.status === "draft" || p.status === "failed") && (
                    <button
                      onClick={() => setStatus(p.id, "approved")}
                      className="px-3 py-1 rounded bg-green-600 text-white text-xs"
                    >
                      承認
                    </button>
                  )}
                  {p.status === "approved" && (
                    <button
                      onClick={() => setStatus(p.id, "draft")}
                      className="px-3 py-1 rounded border border-gray-300 text-xs"
                    >
                      却下（下書きへ）
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(p)}
                    className="px-3 py-1 rounded border border-gray-300 text-xs"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="px-3 py-1 rounded border border-red-300 text-red-600 text-xs"
                  >
                    削除
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
