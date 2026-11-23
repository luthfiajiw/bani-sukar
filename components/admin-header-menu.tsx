"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/features/family/actions";
import type { AppSessionUser } from "@/lib/dal";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SheetClose } from "@/components/ui/sheet";

function getAdminInitials(user: AppSessionUser): string {
  const nameInitials = getInitials(user.name);
  if (nameInitials !== "?") {
    return nameInitials;
  }
  const usernamePrefix = user.username.split("@")[0] ?? "";
  const usernameInitials = getInitials(usernamePrefix);
  return usernameInitials !== "?" ? usernameInitials : "AD";
}

function AdminInitialsCircle({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-[#cbb4a3] bg-[#efe5dc] font-semibold tracking-tight text-[#5c3d2e] select-none shadow-xs",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function AdminHeaderMenu({
  user,
  mode,
}: {
  user: AppSessionUser;
  mode: "desktop" | "mobile";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const initials = getAdminInitials(user);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const res = await logoutAction();
      if (!res.ok) {
        toast.error(res.error || "Gagal keluar dari sesi admin.");
        return;
      }
      toast.success("Anda telah keluar dari sesi admin.");
      if (pathname?.startsWith("/admin")) {
        router.push("/login");
      }
      router.refresh();
    } catch {
      toast.error("Gagal keluar dari sesi admin.");
    } finally {
      setIsSigningOut(false);
    }
  }

  if (mode === "mobile") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <AdminInitialsCircle initials={initials} className="size-9 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.username}
            </p>
          </div>
        </div>

        <SheetClose asChild>
          <Link
            href="/admin/pengguna"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full justify-center",
            )}
          >
            <Users className="size-4 text-primary" />
            <span>Kelola Admin</span>
          </Link>
        </SheetClose>

        <Button
          type="button"
          variant="outline"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          <span>{isSigningOut ? "Keluar..." : "Keluar Sesi"}</span>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu admin ${user.name}`}
        title={`${user.name} (${user.username})`}
        className="hidden size-8 cursor-pointer items-center justify-center rounded-full border border-[#cbb4a3] bg-[#efe5dc] text-xs font-semibold tracking-tight text-[#5c3d2e] shadow-xs transition-colors outline-none select-none hover:bg-[#e7d8ca] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
          <AdminInitialsCircle initials={initials} className="size-8 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.username}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/anggota">
            <ShieldCheck className="size-4 text-primary" />
            <span>Portal Admin</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/pengguna">
            <Users className="size-4 text-muted-foreground" />
            <span>Kelola Admin</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut className="size-4" />
          <span>{isSigningOut ? "Keluar..." : "Keluar Sesi"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
