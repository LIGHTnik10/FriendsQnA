import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Friends Q&A Game",
  description: "A fun multiplayer guessing game for friends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
