'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserSummary } from '@/features/family/types';
import {
  createAdminUserAction,
  deleteAdminUserAction,
  logoutAction,
  resetAdminPasswordAction,
} from '@/features/family/actions';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateId } from '@/lib/format';

interface UserManagementProps {
  users: AdminUserSummary[];
  currentUserId?: string;
}

export function UserManagement({ users, currentUserId }: UserManagementProps) {
  const router = useRouter();

  // Add admin dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Reset password dialog state
  const [resetUser, setResetUser] = useState<AdminUserSummary | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Delete & signout state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleAddAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newName.trim().length < 2) {
      toast.error('Nama admin minimal 2 karakter.');
      return;
    }
    if (!newUsername.trim()) {
      toast.error('Username wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Kata sandi minimal 8 karakter.');
      return;
    }

    setIsAdding(true);
    try {
      const res = await createAdminUserAction({
        name: newName.trim(),
        username: newUsername.trim(),
        password: newPassword,
      });
      if (!res.ok) {
        toast.error(res.error || 'Gagal menambahkan admin baru.');
        return;
      }
      toast.success(`Admin "${newName.trim()}" berhasil ditambahkan.`);
      setAddOpen(false);
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat membuat akun admin.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetUser) return;
    if (resetPassword.length < 8) {
      toast.error('Kata sandi baru minimal 8 karakter.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetAdminPasswordAction(resetUser.id, resetPassword);
      if (!res.ok) {
        toast.error(res.error || 'Gagal memperbarui kata sandi.');
        return;
      }
      toast.success(`Kata sandi untuk ${resetUser.name} berhasil diatur ulang.`);
      setResetUser(null);
      setResetPassword('');
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat mengatur ulang kata sandi.');
    } finally {
      setIsResetting(false);
    }
  }

  async function handleDeleteAdmin(user: AdminUserSummary) {
    setDeletingId(user.id);
    try {
      const res = await deleteAdminUserAction(user.id);
      if (!res.ok) {
        toast.error(res.error || 'Gagal menghapus akun admin.');
        return;
      }
      toast.success(`Akun admin "${user.name}" berhasil dihapus.`);
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat menghapus akun admin.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await logoutAction();
      toast.success('Anda telah keluar dari Portal Admin.');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Gagal keluar dari sesi admin.');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {users.length} Pengurus Admin Terdaftar
            </p>
            <p className="text-xs text-muted-foreground">
              Semua admin memiliki hak penuh untuk mengelola silsilah keluarga Bani Sukar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dialog
            open={addOpen}
            onOpenChange={(next) => {
              if (!isAdding) {
                setAddOpen(next);
                if (!next) {
                  setNewName('');
                  setNewUsername('');
                  setNewPassword('');
                }
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="size-4" />
                <span>+ Tambah Admin</span>
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Pengurus Admin Baru</DialogTitle>
                <DialogDescription>
                  Buat akun baru agar pengurus keluarga lain dapat ikut merawat data silsilah.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-name">Nama Lengkap</Label>
                  <Input
                    id="admin-name"
                    placeholder="cth. Tegar Pambudi"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={isAdding}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-username">Username</Label>
                  <Input
                    id="admin-username"
                    type="text"
                    autoComplete="username"
                    placeholder="cth. tegar_p"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={isAdding}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">Kata Sandi Awal</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Minimal 8 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isAdding}
                    required
                    minLength={8}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isAdding}
                    onClick={() => setAddOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={isAdding}>
                    {isAdding ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      'Buat Akun Admin'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSigningOut}
            onClick={handleSignOut}
          >
            {isSigningOut ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            <span>Keluar Sesi</span>
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Nama Pengurus</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Terdaftar</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Belum ada data admin tersedia.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isSelf = currentUserId === user.id;
                const createdStr =
                  user.createdAt instanceof Date
                    ? user.createdAt.toISOString().slice(0, 10)
                    : typeof user.createdAt === 'string'
                      ? user.createdAt.slice(0, 10)
                      : null;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{user.name}</span>
                        {isSelf && <Badge variant="accent">Anda</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="size-3.5" />
                        {user.username}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        <ShieldCheck className="size-3" />
                        {user.role === 'admin' || !user.role ? 'Admin' : user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {createdStr ? formatDateId(createdStr) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setResetUser(user);
                            setResetPassword('');
                          }}
                        >
                          <KeyRound className="size-3.5" />
                          Reset Sandi
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={isSelf || deletingId === user.id}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              {deletingId === user.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                              Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Akun Admin?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Akun <strong>{user.name}</strong> ({user.username}) tidak akan lagi dapat mengakses Portal Admin Bani Sukar.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={() => handleDeleteAdmin(user)}
                              >
                                Ya, Hapus Akun
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile Cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {users.map((user) => {
          const isSelf = currentUserId === user.id;
          return (
            <Card key={user.id} className="py-4">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {user.name}
                      {isSelf && <Badge variant="accent">Anda</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      {user.username}
                    </CardDescription>
                  </div>
                  <Badge variant="default">
                    {user.role === 'admin' || !user.role ? 'Admin' : user.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setResetUser(user);
                    setResetPassword('');
                  }}
                >
                  <KeyRound className="size-3.5" />
                  Reset Sandi
                </Button>

                {!isSelf && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={deletingId === user.id}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                        Hapus
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Akun Admin?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Akun <strong>{user.name}</strong> ({user.username}) akan dihapus permanen.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDeleteAdmin(user)}
                        >
                          Ya, Hapus Akun
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reset Password Dialog */}
      <Dialog
        open={Boolean(resetUser)}
        onOpenChange={(next) => {
          if (!isResetting && !next) {
            setResetUser(null);
            setResetPassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Kata Sandi Admin</DialogTitle>
            <DialogDescription>
              Masukkan kata sandi baru untuk{' '}
              <strong className="text-foreground">{resetUser?.name}</strong> (
              {resetUser?.username}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password-input">Kata Sandi Baru</Label>
              <Input
                id="reset-password-input"
                type="password"
                placeholder="Minimal 8 karakter"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                disabled={isResetting}
                required
                minLength={8}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isResetting}
                onClick={() => setResetUser(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isResetting}>
                {isResetting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Kata Sandi Baru'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
