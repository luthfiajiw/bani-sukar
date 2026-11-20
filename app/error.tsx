"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-xs">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Terjadi Kendala Sistem
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Gagal Memuat Halaman
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Maaf, terjadi gangguan saat memuat data silsilah keluarga. Silakan
          coba muat ulang atau kembali ke bagan utama.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => retry()}>
            <RotateCcw className="size-4" />
            <span>Coba Lagi</span>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" />
              <span>Kembali ke Bagan</span>
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
