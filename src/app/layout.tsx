import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Elevated Stag CRM",
  description: "Luxury men's custom clothier client management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
