"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitFork,
  LogIn,
  Menu,
  Network,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  {
    label: "Bagan Silsilah",
    href: "/",
    icon: Network,
    match: (path: string) => path === "/" || path.startsWith("/anggota/"),
  },
  {
    label: "Direktori Anggota",
    href: "/admin/anggota",
    icon: Users,
    match: (path: string) =>
      path === "/admin/anggota" ||
      (path.startsWith("/admin/anggota/") && path !== "/admin/anggota/baru"),
  },
  {
    label: "Hubung Relasi",
    href: "/admin/relasi/root",
    icon: GitFork,
    match: (path: string) => path.startsWith("/admin/relasi"),
  },
  {
    label: "Tambah Anggota",
    href: "/admin/anggota/baru",
    icon: UserPlus,
    match: (path: string) => path === "/admin/anggota/baru",
  },
  {
    label: "Kelola Admin",
    href: "/admin/pengguna",
    icon: ShieldCheck,
    match: (path: string) => path.startsWith("/admin/pengguna"),
  },
] as const;

function SiteHeaderShell({
  currentPath,
  isAdminView,
}: {
  currentPath: string;
  isAdminView?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Network className="size-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground">
              Bani Sukar
            </span>
            <span className="mt-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              TRAH BANI SUKAR &amp; SADIRAH
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav
          aria-label="Navigasi utama"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.match(currentPath);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors lg:text-sm",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/admin/anggota/baru">
              <Plus className="size-4" />
              <span>Tambah Jiwa</span>
            </Link>
          </Button>

          {isAdminView ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/admin/anggota">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Portal Admin</span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/login">
                <LogIn className="size-3.5" />
                <span>Masuk</span>
              </Link>
            </Button>
          )}

          {/* Mobile Drawer Trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="md:hidden"
                aria-label="Buka menu navigasi"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[290px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Network className="size-4" />
                  </span>
                  <span>Bani Sukar</span>
                </SheetTitle>
                <SheetDescription className="text-[11px] font-medium tracking-wider uppercase">
                  Trah Bani Sukar &amp; Sadirah
                </SheetDescription>
              </SheetHeader>

              <div className="mt-2 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const active = item.match(currentPath);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground hover:bg-secondary",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                <Button asChild className="w-full justify-center">
                  <Link
                    href="/admin/anggota/baru"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Plus className="size-4" />
                    <span>+ Tambah Jiwa</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-center"
                >
                  <Link
                    href={isAdminView ? "/admin/anggota" : "/login"}
                    onClick={() => setMobileOpen(false)}
                  >
                    {isAdminView ? (
                      <>
                        <ShieldCheck className="size-4 text-primary" />
                        <span>Direktori Admin</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="size-4" />
                        <span>Masuk Portal Admin</span>
                      </>
                    )}
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function SiteHeaderWithPathname({ isAdminView }: { isAdminView?: boolean }) {
  const pathname = usePathname();
  return (
    <SiteHeaderShell
      currentPath={pathname ?? "/"}
      isAdminView={isAdminView}
    />
  );
}

export function SiteHeader({
  activePath,
  isAdminView,
}: {
  activePath?: string;
  isAdminView?: boolean;
}) {
  if (activePath !== undefined) {
    return (
      <SiteHeaderShell currentPath={activePath} isAdminView={isAdminView} />
    );
  }

  return (
    <React.Suspense
      fallback={<SiteHeaderShell currentPath="/" isAdminView={isAdminView} />}
    >
      <SiteHeaderWithPathname isAdminView={isAdminView} />
    </React.Suspense>
  );
}
