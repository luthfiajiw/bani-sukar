'use server';

import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { db, isDbAvailable, isDbConfigured } from '@/db';
import { user as userTable } from '@/db/auth-schema';
import { persons as personsTable, unions as unionsTable } from '@/db/schema';
import { auth } from '@/lib/auth';
import { DEV_ADMIN_COOKIE, requireAdmin } from '@/lib/dal';
import { buildGraph } from './graph';
import {
  type FamilyFallbackStore,
  getFallbackStore,
  getFamilyData,
  shouldLatchDbOffline,
} from './queries';
import type {
  ActionResult,
  AdminUserSummary,
  Person,
  Union,
  UnionStatus,
} from './types';
import {
  assertNoCycle,
  assertValidCouple,
  canDeletePerson,
  type PersonInput,
  personInputSchema,
  reorderChildrenSchema,
  type UnionInput,
  unionInputSchema,
} from './validation';

function shouldAttemptDb(store: FamilyFallbackStore): boolean {
  if (process.env.NODE_ENV === 'production' && isDbConfigured()) {
    return true;
  }
  return !store.dbOffline;
}

function handleDbError(store: FamilyFallbackStore): void {
  if (shouldLatchDbOffline()) {
    store.dbOffline = true;
  }
}

function formatZodErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>
): {
  message: string;
  fieldErrors: Record<string, string[]>;
} {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'form';
    const list = fieldErrors[key] ?? [];
    list.push(issue.message);
    fieldErrors[key] = list;
  }
  const firstMessage = issues[0]?.message || 'Data yang dimasukkan tidak valid.';
  return { message: firstMessage, fieldErrors };
}

export async function createPersonAction(
  input: PersonInput
): Promise<ActionResult<Person>> {
  try {
    await requireAdmin();

    const parsed = personInputSchema.safeParse(input);
    if (!parsed.success) {
      const { message, fieldErrors } = formatZodErrors(parsed.error.issues);
      return { ok: false, error: message, fieldErrors };
    }

    const data = parsed.data;
    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);

    let birthOrder = data.birthOrder ?? null;
    if (data.parentUnionId) {
      if (!graph.unions.has(data.parentUnionId)) {
        return {
          ok: false,
          error: 'Data pernikahan orang tua tidak ditemukan.',
        };
      }
      if (birthOrder === null) {
        const siblings = graph.childrenByUnion.get(data.parentUnionId) ?? [];
        const maxOrder = siblings.reduce(
          (max, s) => Math.max(max, s.birthOrder ?? 0),
          0
        );
        birthOrder = maxOrder + 1;
      }
    } else {
      birthOrder = null;
    }

    const store = getFallbackStore();
    const newId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const createdPerson: Person = {
      id: newId,
      fullName: data.fullName,
      nickname: data.nickname,
      gender: data.gender,
      birthPlace: data.birthPlace,
      birthDate: data.birthDate,
      isDeceased: data.isDeceased,
      deathDate: data.isDeceased ? data.deathDate : null,
      isBloodLine: data.isBloodLine,
      parentUnionId: data.parentUnionId,
      birthOrder,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (shouldAttemptDb(store)) {
      try {
        const [inserted] = await db
          .insert(personsTable)
          .values({
            id: createdPerson.id,
            fullName: createdPerson.fullName,
            nickname: createdPerson.nickname,
            gender: createdPerson.gender,
            birthPlace: createdPerson.birthPlace,
            birthDate: createdPerson.birthDate,
            isDeceased: createdPerson.isDeceased,
            deathDate: createdPerson.deathDate,
            isBloodLine: createdPerson.isBloodLine,
            parentUnionId: createdPerson.parentUnionId,
            birthOrder: createdPerson.birthOrder,
          })
          .returning();

        if (inserted) {
          createdPerson.id = inserted.id;
        }
      } catch {
        handleDbError(store);
      }
    }

    store.persons.push(createdPerson);
    updateTag('family');

    return { ok: true, data: createdPerson };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menambahkan anggota keluarga.',
    };
  }
}

export async function updatePersonAction(
  idOrInput: string | ({ id: string } & Partial<PersonInput>),
  maybeInput?: Partial<PersonInput>
): Promise<ActionResult<Person>> {
  try {
    await requireAdmin();

    const id = typeof idOrInput === 'string' ? idOrInput : idOrInput.id;
    const patch =
      typeof idOrInput === 'string' ? (maybeInput ?? {}) : idOrInput;

    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);
    const existing = graph.persons.get(id);

    if (!existing) {
      return { ok: false, error: 'Data anggota keluarga tidak ditemukan.' };
    }

    const mergedInput: PersonInput = {
      fullName: patch.fullName ?? existing.fullName,
      nickname:
        patch.nickname !== undefined ? patch.nickname : existing.nickname,
      gender: patch.gender ?? existing.gender,
      birthPlace:
        patch.birthPlace !== undefined ? patch.birthPlace : existing.birthPlace,
      birthDate:
        patch.birthDate !== undefined ? patch.birthDate : existing.birthDate,
      isDeceased:
        patch.isDeceased !== undefined ? patch.isDeceased : existing.isDeceased,
      deathDate:
        patch.deathDate !== undefined
          ? patch.deathDate
          : patch.isDeceased === false
            ? null
            : existing.deathDate,
      isBloodLine:
        patch.isBloodLine !== undefined
          ? patch.isBloodLine
          : existing.isBloodLine,
      parentUnionId:
        patch.parentUnionId !== undefined
          ? patch.parentUnionId
          : existing.parentUnionId,
      birthOrder:
        patch.birthOrder !== undefined ? patch.birthOrder : existing.birthOrder,
    };

    const parsed = personInputSchema.safeParse(mergedInput);
    if (!parsed.success) {
      const { message, fieldErrors } = formatZodErrors(parsed.error.issues);
      return { ok: false, error: message, fieldErrors };
    }

    const data = parsed.data;

    if (data.parentUnionId !== existing.parentUnionId) {
      assertNoCycle(graph, id, data.parentUnionId);
    }

    if (data.gender !== existing.gender) {
      const personUnions = graph.unionsByPerson.get(id) ?? [];
      if (personUnions.length > 0) {
        return {
          ok: false,
          error:
            'Tidak dapat mengubah jenis kelamin anggota yang sudah memiliki ikatan pernikahan. Hapus ikatan pernikahan terlebih dahulu.',
        };
      }
    }

    const updatedPerson: Person = {
      ...existing,
      fullName: data.fullName,
      nickname: data.nickname,
      gender: data.gender,
      birthPlace: data.birthPlace,
      birthDate: data.birthDate,
      isDeceased: data.isDeceased,
      deathDate: data.isDeceased ? data.deathDate : null,
      isBloodLine: data.isBloodLine,
      parentUnionId: data.parentUnionId,
      birthOrder: data.parentUnionId ? data.birthOrder : null,
      updatedAt: new Date().toISOString(),
    };

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        await db
          .update(personsTable)
          .set({
            fullName: updatedPerson.fullName,
            nickname: updatedPerson.nickname,
            gender: updatedPerson.gender,
            birthPlace: updatedPerson.birthPlace,
            birthDate: updatedPerson.birthDate,
            isDeceased: updatedPerson.isDeceased,
            deathDate: updatedPerson.deathDate,
            isBloodLine: updatedPerson.isBloodLine,
            parentUnionId: updatedPerson.parentUnionId,
            birthOrder: updatedPerson.birthOrder,
            updatedAt: new Date(),
          })
          .where(eq(personsTable.id, id));
      } catch {
        handleDbError(store);
      }
    }

    const idx = store.persons.findIndex((p) => p.id === id);
    if (idx !== -1) {
      store.persons[idx] = updatedPerson;
    } else {
      store.persons.push(updatedPerson);
    }

    updateTag('family');
    return { ok: true, data: updatedPerson };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui data anggota keluarga.',
    };
  }
}

export async function deletePersonAction(
  idOrObj: string | { id: string }
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();

    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj.id;
    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);

    if (!graph.persons.has(id)) {
      return { ok: false, error: 'Anggota keluarga tidak ditemukan.' };
    }

    const check = canDeletePerson(graph, id);
    if (!check.allowed) {
      return {
        ok: false,
        error: check.reason || 'Anggota tidak dapat dihapus.',
      };
    }

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        await db.delete(personsTable).where(eq(personsTable.id, id));
      } catch {
        handleDbError(store);
      }
    }

    store.persons = store.persons.filter((p) => p.id !== id);
    store.unions = store.unions.filter(
      (u) => u.husbandId !== id && u.wifeId !== id
    );

    updateTag('family');
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menghapus anggota keluarga.',
    };
  }
}

export async function createUnionAction(
  input: UnionInput
): Promise<ActionResult<Union>> {
  try {
    await requireAdmin();

    const parsed = unionInputSchema.safeParse(input);
    if (!parsed.success) {
      const { message, fieldErrors } = formatZodErrors(parsed.error.issues);
      return { ok: false, error: message, fieldErrors };
    }

    const data = parsed.data;
    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);

    const husband = data.husbandId
      ? (graph.persons.get(data.husbandId) ?? null)
      : null;
    const wife = data.wifeId ? (graph.persons.get(data.wifeId) ?? null) : null;

    if (data.husbandId && !husband) {
      return { ok: false, error: 'Data suami tidak ditemukan.' };
    }
    if (data.wifeId && !wife) {
      return { ok: false, error: 'Data istri tidak ditemukan.' };
    }

    assertValidCouple(husband, wife);

    const duplicate = unions.find(
      (u) =>
        u.husbandId === (husband?.id ?? null) &&
        u.wifeId === (wife?.id ?? null)
    );
    if (duplicate) {
      return {
        ok: false,
        error: 'Ikatan pernikahan antara pasangan ini sudah terdaftar.',
      };
    }

    const existingForPartners = [
      ...(husband ? (graph.unionsByPerson.get(husband.id) ?? []) : []),
      ...(wife ? (graph.unionsByPerson.get(wife.id) ?? []) : []),
    ];
    const maxOrder = existingForPartners.reduce(
      (max, u) => Math.max(max, u.unionOrder),
      0
    );
    const unionOrder = input.unionOrder ?? maxOrder + 1;

    const nowIso = new Date().toISOString();
    const createdUnion: Union = {
      id: crypto.randomUUID(),
      husbandId: husband?.id ?? null,
      wifeId: wife?.id ?? null,
      status: data.status,
      unionOrder,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        const [inserted] = await db
          .insert(unionsTable)
          .values({
            id: createdUnion.id,
            husbandId: createdUnion.husbandId,
            wifeId: createdUnion.wifeId,
            status: createdUnion.status,
            unionOrder: createdUnion.unionOrder,
          })
          .returning();

        if (inserted) {
          createdUnion.id = inserted.id;
        }
      } catch {
        handleDbError(store);
      }
    }

    store.unions.push(createdUnion);
    updateTag('family');

    return { ok: true, data: createdUnion };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menambahkan ikatan pernikahan.',
    };
  }
}

export async function updateUnionAction(
  idOrInput:
    | string
    | ({
        id?: string;
        unionId?: string;
        status?: UnionStatus;
      } & Partial<UnionInput>),
  statusOrPatch?: UnionStatus | Partial<UnionInput>
): Promise<ActionResult<Union>> {
  try {
    await requireAdmin();

    const unionId =
      typeof idOrInput === 'string'
        ? idOrInput
        : (idOrInput.id ?? idOrInput.unionId ?? '');

    const patch: Partial<UnionInput> =
      typeof idOrInput === 'string'
        ? typeof statusOrPatch === 'string'
          ? { status: statusOrPatch }
          : (statusOrPatch ?? {})
        : idOrInput;

    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);
    const existing = graph.unions.get(unionId);

    if (!existing) {
      return { ok: false, error: 'Data ikatan pernikahan tidak ditemukan.' };
    }

    const merged = {
      husbandId:
        patch.husbandId !== undefined ? patch.husbandId : existing.husbandId,
      wifeId: patch.wifeId !== undefined ? patch.wifeId : existing.wifeId,
      status: patch.status ?? existing.status,
      unionOrder: patch.unionOrder ?? existing.unionOrder,
    };

    const parsed = unionInputSchema.safeParse(merged);
    if (!parsed.success) {
      const { message, fieldErrors } = formatZodErrors(parsed.error.issues);
      return { ok: false, error: message, fieldErrors };
    }

    const husband = parsed.data.husbandId
      ? (graph.persons.get(parsed.data.husbandId) ?? null)
      : null;
    const wife = parsed.data.wifeId
      ? (graph.persons.get(parsed.data.wifeId) ?? null)
      : null;

    assertValidCouple(husband, wife);

    const updatedUnion: Union = {
      ...existing,
      husbandId: parsed.data.husbandId,
      wifeId: parsed.data.wifeId,
      status: parsed.data.status,
      unionOrder: parsed.data.unionOrder,
      updatedAt: new Date().toISOString(),
    };

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        await db
          .update(unionsTable)
          .set({
            husbandId: updatedUnion.husbandId,
            wifeId: updatedUnion.wifeId,
            status: updatedUnion.status,
            unionOrder: updatedUnion.unionOrder,
            updatedAt: new Date(),
          })
          .where(eq(unionsTable.id, unionId));
      } catch {
        handleDbError(store);
      }
    }

    const idx = store.unions.findIndex((u) => u.id === unionId);
    if (idx !== -1) {
      store.unions[idx] = updatedUnion;
    } else {
      store.unions.push(updatedUnion);
    }

    updateTag('family');
    return { ok: true, data: updatedUnion };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memperbarui status pernikahan.',
    };
  }
}

export async function deleteUnionAction(
  idOrObj: string | { id?: string; unionId?: string }
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();

    const unionId =
      typeof idOrObj === 'string'
        ? idOrObj
        : (idOrObj.id ?? idOrObj.unionId ?? '');

    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);

    if (!graph.unions.has(unionId)) {
      return { ok: false, error: 'Data ikatan pernikahan tidak ditemukan.' };
    }

    const children = graph.childrenByUnion.get(unionId) ?? [];
    if (children.length > 0) {
      return {
        ok: false,
        error:
          'Tidak dapat menghapus pernikahan yang sudah memiliki anak terdaftar. Putuskan atau pindahkan relasi anak terlebih dahulu.',
      };
    }

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        await db.delete(unionsTable).where(eq(unionsTable.id, unionId));
      } catch {
        handleDbError(store);
      }
    }

    store.unions = store.unions.filter((u) => u.id !== unionId);
    updateTag('family');

    return { ok: true, data: { id: unionId } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menghapus ikatan pernikahan.',
    };
  }
}

export async function setParentsAction(
  personIdOrObj:
    | string
    | {
        personId: string;
        parentUnionId: string | null;
        birthOrder?: number | null;
      },
  maybeParentUnionId?: string | null,
  maybeBirthOrder?: number | null
): Promise<ActionResult<Person>> {
  try {
    await requireAdmin();

    const personId =
      typeof personIdOrObj === 'string'
        ? personIdOrObj
        : personIdOrObj.personId;
    const rawParentUnionId =
      typeof personIdOrObj === 'string'
        ? (maybeParentUnionId ?? null)
        : personIdOrObj.parentUnionId;
    const parentUnionId =
      rawParentUnionId && rawParentUnionId.trim().length > 0
        ? rawParentUnionId.trim()
        : null;
    const explicitOrder =
      typeof personIdOrObj === 'string'
        ? maybeBirthOrder
        : personIdOrObj.birthOrder;

    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);

    const person = graph.persons.get(personId);
    if (!person) {
      return { ok: false, error: 'Anggota keluarga tidak ditemukan.' };
    }

    assertNoCycle(graph, personId, parentUnionId);

    let nextBirthOrder: number | null = null;
    if (parentUnionId) {
      const existingSiblings = (
        graph.childrenByUnion.get(parentUnionId) ?? []
      ).filter((c) => c.id !== personId);
      const maxOrder = existingSiblings.reduce(
        (max, s) => Math.max(max, s.birthOrder ?? 0),
        0
      );
      nextBirthOrder =
        explicitOrder !== undefined && explicitOrder !== null
          ? explicitOrder
          : person.parentUnionId === parentUnionId && person.birthOrder !== null
            ? person.birthOrder
            : maxOrder + 1;
    }

    const updatedPerson: Person = {
      ...person,
      parentUnionId,
      birthOrder: nextBirthOrder,
      isBloodLine: parentUnionId ? true : person.isBloodLine,
      updatedAt: new Date().toISOString(),
    };

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        await db
          .update(personsTable)
          .set({
            parentUnionId: updatedPerson.parentUnionId,
            birthOrder: updatedPerson.birthOrder,
            isBloodLine: updatedPerson.isBloodLine,
            updatedAt: new Date(),
          })
          .where(eq(personsTable.id, personId));
      } catch {
        handleDbError(store);
      }
    }

    const idx = store.persons.findIndex((p) => p.id === personId);
    if (idx !== -1) {
      store.persons[idx] = updatedPerson;
    }

    updateTag('family');
    return { ok: true, data: updatedPerson };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal mengatur hubungan orang tua.',
    };
  }
}

export async function reorderChildrenAction(
  unionIdOrObj:
    | string
    | { unionId: string; orderedChildIds?: string[]; childIds?: string[] },
  maybeOrderedChildIds?: string[]
): Promise<ActionResult<void>> {
  try {
    await requireAdmin();

    const unionId =
      typeof unionIdOrObj === 'string' ? unionIdOrObj : unionIdOrObj.unionId;
    const orderedChildIds =
      typeof unionIdOrObj === 'string'
        ? (maybeOrderedChildIds ?? [])
        : (unionIdOrObj.orderedChildIds ?? unionIdOrObj.childIds ?? []);

    const parsed = reorderChildrenSchema.safeParse({
      unionId,
      orderedChildIds,
    });
    if (!parsed.success) {
      const { message, fieldErrors } = formatZodErrors(parsed.error.issues);
      return { ok: false, error: message, fieldErrors };
    }

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        await db.transaction(async (tx) => {
          for (let i = 0; i < parsed.data.orderedChildIds.length; i++) {
            const childId = parsed.data.orderedChildIds[i];
            await tx
              .update(personsTable)
              .set({ birthOrder: -(i + 1000) })
              .where(eq(personsTable.id, childId));
          }
          for (let i = 0; i < parsed.data.orderedChildIds.length; i++) {
            const childId = parsed.data.orderedChildIds[i];
            await tx
              .update(personsTable)
              .set({ birthOrder: i + 1, updatedAt: new Date() })
              .where(eq(personsTable.id, childId));
          }
        });
      } catch {
        handleDbError(store);
      }
    }

    const orderMap = new Map<string, number>();
    parsed.data.orderedChildIds.forEach((childId, idx) => {
      orderMap.set(childId, idx + 1);
    });

    store.persons = store.persons.map((p) => {
      if (p.parentUnionId === unionId && orderMap.has(p.id)) {
        return {
          ...p,
          birthOrder: orderMap.get(p.id)!,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    updateTag('family');
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal mengubah urutan kelahiran anak.',
    };
  }
}

export async function devLoginAction(
  emailOrObj: string | { email: string; password: string },
  maybePassword?: string
): Promise<ActionResult<{ email: string; name: string }>> {
  try {
    if (process.env.NODE_ENV === 'production' || (await isDbAvailable())) {
      return {
        ok: false,
        error:
          'Login mode pengembangan dinonaktifkan di production atau saat database aktif.',
      };
    }

    const email = (
      typeof emailOrObj === 'string' ? emailOrObj : emailOrObj.email
    )
      .trim()
      .toLowerCase();
    const password =
      typeof emailOrObj === 'string'
        ? (maybePassword ?? '')
        : emailOrObj.password;

    const store = getFallbackStore();
    const matchedUser = store.adminUsers.find(
      (u) => u.email.toLowerCase() === email && u.password === password
    );

    const seedEmail = (
      process.env.SEED_ADMIN_EMAIL || 'admin@banisukar.id'
    ).toLowerCase();
    const seedPassword =
      process.env.SEED_ADMIN_PASSWORD || 'AdminBaniSukar123!';
    const seedName = process.env.SEED_ADMIN_NAME || 'Admin Bani Sukar';

    const isSeedValid = email === seedEmail && password === seedPassword;

    if (!matchedUser && !isSeedValid) {
      return {
        ok: false,
        error: 'Email atau kata sandi admin tidak sesuai.',
      };
    }

    const cookieStore = await cookies();
    cookieStore.set(DEV_ADMIN_COOKIE, '1', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return {
      ok: true,
      data: {
        email: matchedUser?.email ?? seedEmail,
        name: matchedUser?.name ?? seedName,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Gagal masuk ke portal admin.',
    };
  }
}

export async function devLogoutAction(): Promise<ActionResult<void>> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(DEV_ADMIN_COOKIE);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal keluar dari sesi.',
    };
  }
}

export async function listAdminUsersAction(): Promise<
  ActionResult<AdminUserSummary[]>
> {
  try {
    await requireAdmin();
    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        const rows = await db.select().from(userTable);
        if (rows.length > 0) {
          return {
            ok: true,
            data: rows.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              role: r.role ?? 'admin',
              createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
            })),
          };
        }
      } catch {
        handleDbError(store);
      }
    }

    return {
      ok: true,
      data: store.adminUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal memuat daftar pengguna admin.',
    };
  }
}

export async function createAdminUserAction(input: {
  name: string;
  email: string;
  password: string;
  role?: string;
}): Promise<ActionResult<AdminUserSummary>> {
  try {
    await requireAdmin();

    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!name || name.length < 2) {
      return { ok: false, error: 'Nama admin minimal 2 karakter.' };
    }
    if (!email || !email.includes('@')) {
      return { ok: false, error: 'Alamat email tidak valid.' };
    }
    if (password.length < 8) {
      return { ok: false, error: 'Kata sandi minimal 8 karakter.' };
    }

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        const res = await auth.api.createUser({
          headers: await headers(),
          body: {
            name,
            email,
            password,
            role: 'admin',
          },
        });
        if (res?.user) {
          const created: AdminUserSummary = {
            id: res.user.id,
            name: res.user.name,
            email: res.user.email,
            role: 'admin',
            createdAt: new Date().toISOString(),
          };
          store.adminUsers.push({ ...created, password });
          return { ok: true, data: created };
        }
      } catch {
        handleDbError(store);
      }
    }

    if (store.adminUsers.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: 'Email admin sudah terdaftar.' };
    }

    const created: AdminUserSummary = {
      id: crypto.randomUUID(),
      name,
      email,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    store.adminUsers.push({ ...created, password });

    return { ok: true, data: created };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menambahkan pengguna admin.',
    };
  }
}

export async function deleteAdminUserAction(
  userIdOrObj: string | { id?: string; userId?: string }
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();

    const userId =
      typeof userIdOrObj === 'string'
        ? userIdOrObj
        : (userIdOrObj.userId ?? userIdOrObj.id ?? '');

    const store = getFallbackStore();

    if (store.adminUsers.length <= 1 && store.adminUsers[0]?.id === userId) {
      return {
        ok: false,
        error: 'Tidak dapat menghapus satu-satunya akun admin utama.',
      };
    }

    if (shouldAttemptDb(store)) {
      try {
        await db.delete(userTable).where(eq(userTable.id, userId));
      } catch {
        handleDbError(store);
      }
    }

    store.adminUsers = store.adminUsers.filter((u) => u.id !== userId);
    return { ok: true, data: { id: userId } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menghapus pengguna admin.',
    };
  }
}

export async function resetAdminPasswordAction(
  userIdOrObj:
    | string
    | {
        userId?: string;
        id?: string;
        newPassword?: string;
        password?: string;
      },
  maybeNewPassword?: string
): Promise<ActionResult<void>> {
  try {
    await requireAdmin();

    const userId =
      typeof userIdOrObj === 'string'
        ? userIdOrObj
        : (userIdOrObj.userId ?? userIdOrObj.id ?? '');
    const newPassword =
      typeof userIdOrObj === 'string'
        ? (maybeNewPassword ?? '')
        : (userIdOrObj.newPassword ?? userIdOrObj.password ?? '');

    if (!newPassword || newPassword.length < 8) {
      return { ok: false, error: 'Kata sandi baru minimal 8 karakter.' };
    }

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        await auth.api.setUserPassword({
          headers: await headers(),
          body: {
            userId,
            newPassword,
          },
        });
      } catch {
        handleDbError(store);
      }
    }

    const target = store.adminUsers.find((u) => u.id === userId);
    if (target) {
      target.password = newPassword;
    }

    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal mengatur ulang kata sandi.',
    };
  }
}
