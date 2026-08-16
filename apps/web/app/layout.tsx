import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Co-op Games",
  description: "Simple 2-player co-op games to play online with your partner or friend.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center px-4 py-10">
        <main className="w-full max-w-md flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
