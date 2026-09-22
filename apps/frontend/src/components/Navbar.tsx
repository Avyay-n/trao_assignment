"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, LogOut, User as UserIcon, PlusCircle, ShieldCheck } from "lucide-react";
import { User, clearStoredToken } from "@/lib/api";

interface NavbarProps {
  user: User | null;
  onOpenNewKit: () => void;
  onDemoLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenNewKit,
  onDemoLogin,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                PrepKit <span className="text-indigo-400 text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">AI</span>
              </span>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider">FS-AI-INTERVIEW-01</p>
            </div>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button
                onClick={onOpenNewKit}
                className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Prep Kit</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-sm text-slate-300">
                <UserIcon className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline font-medium">{user.name}</span>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onDemoLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Evaluator Demo Login</span>
              </button>
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
