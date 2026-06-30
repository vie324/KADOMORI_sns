import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b bg-white">
      <nav className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4 text-sm">
        <span className="font-semibold text-gray-900">Threads 自動投稿</span>
        <div className="flex gap-3 text-gray-600">
          <Link href="/" className="hover:text-gray-900">
            ストック
          </Link>
          <Link href="/generate" className="hover:text-gray-900">
            生成
          </Link>
          <Link href="/insights" className="hover:text-gray-900">
            分析
          </Link>
        </div>
      </nav>
    </header>
  );
}
