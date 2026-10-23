import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  title: "Sales Intelligence Hub",
  description: "Claude + Snowflake Cortex Agent: chat, dashboards and action items",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex bg-muted/30 text-foreground">
        <TooltipProvider>
          <Nav />
          <main className="flex-1 min-w-0 h-full overflow-hidden">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
