import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DotCraft | 思考の種を生むテクノロジーメディア",
  description:
    "AI技術の本質、社会への影響、働き方や創造性の変化を多角的に考えるチャンネルサイトです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
