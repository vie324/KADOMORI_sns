"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/themes";

export default function GeneratePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(["1"]));
  const [count, setCount] = useState(3);
  const [min, setMin] = useState(120);
  const [max, setMax] = useState(300);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(num: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  async function generate() {
    if (selected.size === 0) {
      setMessage("テーマを1つ以上選択してください。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: Array.from(selected),
          count,
          min,
          max,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "生成に失敗しました");

      if (json.errors && json.errors.length > 0) {
        setMessage(
          `${json.inserted}件を下書き保存しました（一部のテーマでエラー）。一覧へ移動します…`
        );
      }
      // 生成後は一覧（下書き）へ遷移
      router.push("/");
    } catch (e) {
      setMessage("エラー: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">投稿を一括生成</h1>

      <section className="bg-white border border-gray-200 rounded p-4 mb-4">
        <h2 className="text-sm font-medium mb-2">テーマ（複数選択可）</h2>
        <div className="space-y-2">
          {THEMES.map((t) => (
            <label key={t.number} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(t.number)}
                onChange={() => toggle(t.number)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">
                  {t.number}. {t.name}
                </span>
                <span className="text-gray-500 block text-xs">{t.aim}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded p-4 mb-4 grid grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">本数 / テーマ</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full border border-gray-300 rounded p-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">最小文字数</span>
          <input
            type="number"
            min={1}
            max={500}
            value={min}
            onChange={(e) => setMin(Number(e.target.value))}
            className="w-full border border-gray-300 rounded p-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">最大文字数</span>
          <input
            type="number"
            min={1}
            max={500}
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
            className="w-full border border-gray-300 rounded p-1.5"
          />
        </label>
      </section>

      <button
        onClick={generate}
        disabled={loading}
        className="px-4 py-2 rounded bg-gray-900 text-white text-sm disabled:opacity-50"
      >
        {loading ? "生成中…" : "生成"}
      </button>

      {message && (
        <p className="text-sm text-gray-600 mt-3 break-all">{message}</p>
      )}

      <p className="text-xs text-gray-400 mt-4">
        生成された投稿は「下書き」として保存されます。NGワードや文字数超過は「要確認」フラグが付きます。
      </p>
    </div>
  );
}
