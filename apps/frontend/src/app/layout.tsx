import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrepKit AI | Intelligent Interview Preparation Kits",
  description:
    "AI-powered personalized interview preparation kits with automated research, deep crawling, coverage validation, day-by-day scheduling, and mock interviews.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 min-h-screen selection:bg-indigo-500 selection:text-white antialiased">
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))]" />
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
