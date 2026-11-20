import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-xs">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
            <SearchX className="size-7" />
          </div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Halaman Tidak Ditemukan
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Data atau Halaman Tidak Tersedia
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Maaf, data anggota keluarga atau halaman yang Anda tuju tidak
            ditemukan dalam catatan silsilah Trah Bani Sukar &amp; Sadirah.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="size-4" />
                <span>Kembali ke Bagan Silsilah</span>
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
