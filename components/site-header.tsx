import { Suspense } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { getSession, type AppSessionUser } from "@/lib/dal";
import { cn } from "@/lib/utils";
import { AdminHeaderMenu } from "@/components/admin-header-menu";
import { SiteHeaderClient } from "@/components/site-header-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

async function getLoggedInAdmin(): Promise<AppSessionUser | null> {
  const session = await getSession();
  if (!session?.user || session.user.role !== "admin") {
    return null;
  }
  return session.user;
}

async function DesktopHeaderAuth() {
  const adminUser = await getLoggedInAdmin();

  if (!adminUser) {
    return (
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
    );
  }

  return <AdminHeaderMenu user={adminUser} mode="desktop" />;
}

async function MobileHeaderAuth() {
  const adminUser = await getLoggedInAdmin();

  if (!adminUser) {
    return (
      <SheetClose asChild>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-center",
          )}
        >
          <LogIn className="size-4" />
          <span>Masuk Portal Admin</span>
        </Link>
      </SheetClose>
    );
  }

  return <AdminHeaderMenu user={adminUser} mode="mobile" />;
}

export function SiteHeader({
  activePath,
  isAdminView: _isAdminView,
}: {
  activePath?: string;
  isAdminView?: boolean;
}) {
  void _isAdminView;

  return (
    <SiteHeaderClient
      activePath={activePath}
      desktopAuthSlot={
        <Suspense
          fallback={<Skeleton className="hidden size-8 rounded-full sm:block" />}
        >
          <DesktopHeaderAuth />
        </Suspense>
      }
      mobileAuthSlot={
        <Suspense fallback={<Skeleton className="h-9 w-full rounded-md" />}>
          <MobileHeaderAuth />
        </Suspense>
      }
    />
  );
}
