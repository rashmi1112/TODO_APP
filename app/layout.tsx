import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Things To-do",
  description: "A simple To-Do list app built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
