import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calify Trip Calendar",
  description: "A readable calendar view generated from app/data/events.csv.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
