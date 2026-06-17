import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        <title>火星殖民 - Mars Colony</title>
        <meta name="description" content="多人回合制火星殖民资源竞赛策略游戏" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔴</text></svg>" />
      </Head>
      <body className="bg-[#0a0a0f] text-white min-h-screen">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
