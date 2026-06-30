/** @type {import('next').NextConfig} */
const nextConfig = {
  // 画像はSupabase Storageの公開URLを <img> で直接表示するため、
  // next/image のドメイン設定は不要。
  reactStrictMode: true,
};

module.exports = nextConfig;
