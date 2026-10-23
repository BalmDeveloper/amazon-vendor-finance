import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vendor Finance · Claude × Snowflake",
  description: "Insights, dashboards, chat and action items on governed Snowflake data",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full bg-muted/30 text-foreground">
        <Providers>
          <Nav />
          {/* pt-12 leaves room for the mobile top bar */}
          <main className="h-full min-w-0 flex-1 overflow-hidden pt-12 md:pt-0">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
