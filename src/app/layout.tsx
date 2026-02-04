import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Edit App",
  description: "AI-powered image editing with background removal, AI edits, and upscaling",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
