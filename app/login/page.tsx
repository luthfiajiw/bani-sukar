'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, TreePine } from 'lucide-react';
import { toast } from 'sonner';
import { loginAction } from '@/features/family/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      const msg = 'Harap isi email dan kata sandi admin.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    let signedIn = false;
    let authError = '';

    try {
      const res = await loginAction(trimmedEmail, password);
      if (res.ok) {
        signedIn = true;
      } else {
        authError = res.error || 'Email atau kata sandi tidak valid.';
      }
    } catch {
      authError = 'Gagal terhubung ke layanan autentikasi.';
    } finally {
      setIsSubmitting(false);
    }

    if (signedIn) {
      toast.success('Berhasil masuk ke Portal Admin Bani Sukar.');
      router.push('/admin/anggota');
      router.refresh();
    } else {
      const finalMsg = authError || 'Email atau kata sandi salah.';
      setErrorMessage(finalMsg);
      toast.error(finalMsg);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(196,151,83,0.12),_transparent_55%)]" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Bagan Silsilah
          </Link>

          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl border border-accent/40 bg-primary text-primary-foreground shadow-sm">
            <TreePine className="size-7" />
          </div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Trah Bani Sukar &amp; Sadirah
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Portal Pengurus Keluarga
          </h1>
        </div>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="space-y-1.5 border-b border-border/70 pb-5">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="size-5" />
              <CardTitle className="text-lg">Bani Sukar — Masuk Portal Admin</CardTitle>
            </div>
            <CardDescription>
              Masuk menggunakan akun admin resmi untuk mengelola direktori anggota, hubungan nasab, dan pengelola silsilah.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
                >
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Alamat Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="admin@banisukar.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Kata Sandi</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Masukkan kata sandi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-9"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  'Masuk ke Portal Admin'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Akses terbatas hanya untuk pengurus trah yang terdaftar. Hubungi koordinator keluarga apabila memerlukan pembaruan akses.
        </p>
      </div>
    </div>
  );
}
