"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Shared layout for /dashboard routes
 * Provides navigation between Stats and Videos pages
 */
export default function DashboardLayout({ children }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Stats & Users", icon: ChartIcon },
    { href: "/dashboard/videos", label: "Videos", icon: VideoIcon },
    { href: "/dashboard/messagerie", label: "Messagerie", icon: MessageIcon },
    { href: "/dashboard/challenges/relaunch", label: "Relance Challenges", icon: ReloadIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 lg:px-8">
          <span className="text-lg font-semibold text-slate-50">
            Admin Dashboard
          </span>
          <div className="flex gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sky-500/20 text-sky-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {children}
    </div>
  );
}

function ChartIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function VideoIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function MessageIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ReloadIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 4V10H17" />
      <path d="M1 20V14H7" />
      <path d="M3.51 9A9 9 0 0 1 20.49 4.61L23 7" />
      <path d="M20.49 15A9 9 0 0 1 3.51 19.39L1 17" />
    </svg>
  );
}

