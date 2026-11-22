'use server';

import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { db, isDbConfigured } from '@/db';
import { adminUsers as adminUsersTable } from '@/db/auth-schema';
import { persons as personsTable, unions as unionsTable } from '@/db/schema';
import {
  AUTH_COOKIE_NAME,
  JWT_MAX_AGE_SECONDS,
  hashPassword,
  signJwtToken,
  verifyPassword,
} from '@/lib/auth';
import { requireAdmin } from '@/lib/dal';
import {
  PHOTO_MAX_UPLOAD_BYTES,
  getPhotoPublicUrl,
  sniffImageType,
  validatePhotoFile,
} from '@/lib/photo';
import {
  deleteStorageObject,
  isStorageConfigured,
  uploadPersonPhoto,
} from '@/lib/storage';
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
      photoPath: null,
      photoUrl: null,
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

    const existingPerson = graph.persons.get(id);
    if (!existingPerson) {
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

    if (existingPerson.photoPath) {
      await deleteStorageObject(existingPerson.photoPath);
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

export async function uploadPersonPhotoAction(
  formData: FormData
): Promise<ActionResult<Person>> {
  let uploadedKey: string | null = null;

  try {
    await requireAdmin();

    if (!isStorageConfigured()) {
      return {
        ok: false,
        error: 'Penyimpanan foto S3 Supabase belum dikonfigurasi pada server.',
      };
    }

    const personId = String(formData.get('personId') ?? '').trim();
    if (!personId) {
      return { ok: false, error: 'ID anggota tidak valid.' };
    }

    const file = formData.get('file');
    if (
      !file ||
      typeof file === 'string' ||
      typeof file.arrayBuffer !== 'function'
    ) {
      return { ok: false, error: 'File foto wajib dipilih.' };
    }

    const fileError = validatePhotoFile(
      { type: file.type || '', size: file.size },
      PHOTO_MAX_UPLOAD_BYTES
    );
    if (fileError) {
      return { ok: false, error: fileError };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffedType = sniffImageType(bytes);
    if (!sniffedType) {
      return {
        ok: false,
        error: 'Isi file bukan gambar JPG, PNG, atau WebP yang valid.',
      };
    }

    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);
    const existing = graph.persons.get(personId);

    if (!existing) {
      return { ok: false, error: 'Data anggota keluarga tidak ditemukan.' };
    }

    uploadedKey = await uploadPersonPhoto(personId, bytes, sniffedType);

    const store = getFallbackStore();
    const now = new Date();

    if (shouldAttemptDb(store)) {
      try {
        await db
          .update(personsTable)
          .set({
            photoPath: uploadedKey,
            updatedAt: now,
          })
          .where(eq(personsTable.id, personId));
      } catch {
        handleDbError(store);
        if (process.env.NODE_ENV === 'production') {
          await deleteStorageObject(uploadedKey);
          return {
            ok: false,
            error: 'Gagal menyimpan referensi foto ke database.',
          };
        }
      }
    }

    if (existing.photoPath && existing.photoPath !== uploadedKey) {
      await deleteStorageObject(existing.photoPath);
    }

    const updatedPerson: Person = {
      ...existing,
      photoPath: uploadedKey,
      photoUrl: getPhotoPublicUrl(uploadedKey),
      updatedAt: now.toISOString(),
    };

    const idx = store.persons.findIndex((p) => p.id === personId);
    if (idx !== -1) {
      store.persons[idx] = updatedPerson;
    } else {
      store.persons.push(updatedPerson);
    }

    updateTag('family');
    return { ok: true, data: updatedPerson };
  } catch (err) {
    if (uploadedKey) {
      await deleteStorageObject(uploadedKey);
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal mengunggah foto profil anggota.',
    };
  }
}

export async function removePersonPhotoAction(
  personId: string
): Promise<ActionResult<Person>> {
  try {
    await requireAdmin();

    const id = personId?.trim();
    if (!id) {
      return { ok: false, error: 'ID anggota tidak valid.' };
    }

    const { persons, unions } = await getFamilyData();
    const graph = buildGraph(persons, unions);
    const existing = graph.persons.get(id);

    if (!existing) {
      return { ok: false, error: 'Data anggota keluarga tidak ditemukan.' };
    }

    const store = getFallbackStore();
    const now = new Date();

    if (shouldAttemptDb(store)) {
      try {
        await db
          .update(personsTable)
          .set({
            photoPath: null,
            updatedAt: now,
          })
          .where(eq(personsTable.id, id));
      } catch {
        handleDbError(store);
        if (process.env.NODE_ENV === 'production') {
          return {
            ok: false,
            error: 'Gagal menghapus referensi foto di database.',
          };
        }
      }
    }

    if (existing.photoPath) {
      await deleteStorageObject(existing.photoPath);
    }

    const updatedPerson: Person = {
      ...existing,
      photoPath: null,
      photoUrl: null,
      updatedAt: now.toISOString(),
    };

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
          : 'Gagal menghapus foto profil anggota.',
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

export async function loginAction(
  usernameOrObj: string | { username?: string; email?: string; password: string },
  maybePassword?: string
): Promise<ActionResult<{ username: string; name: string }>> {
  try {
    const username = (
      typeof usernameOrObj === 'string'
        ? usernameOrObj
        : (usernameOrObj.username ?? usernameOrObj.email ?? '')
    )
      .trim()
      .toLowerCase();
    const password =
      typeof usernameOrObj === 'string'
        ? (maybePassword ?? '')
        : usernameOrObj.password;

    if (!username || !password) {
      return {
        ok: false,
        error: 'Harap isi username dan kata sandi admin.',
      };
    }

    const store = getFallbackStore();
    let authenticatedUser: {
      id: string;
      username: string;
      name: string;
      role: string;
    } | null = null;
    let dbQueriedSuccessfully = false;

    if (shouldAttemptDb(store)) {
      try {
        const [row] = await db
          .select()
          .from(adminUsersTable)
          .where(eq(adminUsersTable.username, username))
          .limit(1);
        dbQueriedSuccessfully = true;

        if (row && verifyPassword(password, row.passwordHash)) {
          authenticatedUser = {
            id: row.id,
            username: row.username,
            name: row.name,
            role: row.role || 'admin',
          };
        }
      } catch {
        handleDbError(store);
        if (process.env.NODE_ENV === 'production') {
          return {
            ok: false,
            error: 'Gagal terhubung ke database autentikasi.',
          };
        }
      }
    }

    if (!dbQueriedSuccessfully && process.env.NODE_ENV !== 'production') {
      const matchedUser = store.adminUsers.find(
        (u) => u.username.toLowerCase() === username && u.password === password
      );

      const seedUsername = (
        process.env.SEED_ADMIN_USERNAME ||
        process.env.SEED_ADMIN_EMAIL ||
        'admin@banisukar.id'
      )
        .trim()
        .toLowerCase();
      const seedPassword =
        process.env.SEED_ADMIN_PASSWORD || 'AdminBaniSukar123!';
      const seedName = process.env.SEED_ADMIN_NAME || 'Admin Bani Sukar';

      if (matchedUser) {
        authenticatedUser = {
          id: matchedUser.id,
          username: matchedUser.username,
          name: matchedUser.name,
          role: matchedUser.role || 'admin',
        };
      } else if (username === seedUsername && password === seedPassword) {
        authenticatedUser = {
          id: 'dev-admin',
          username: seedUsername,
          name: seedName,
          role: 'admin',
        };
      }
    }

    if (!authenticatedUser) {
      return {
        ok: false,
        error: 'Username atau kata sandi admin tidak sesuai.',
      };
    }

    const token = await signJwtToken({
      sub: authenticatedUser.id,
      username: authenticatedUser.username,
      name: authenticatedUser.name,
      role: authenticatedUser.role,
    });

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: JWT_MAX_AGE_SECONDS,
    });

    return {
      ok: true,
      data: {
        username: authenticatedUser.username,
        name: authenticatedUser.name,
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

export async function logoutAction(): Promise<ActionResult<void>> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
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
        const rows = await db
          .select({
            id: adminUsersTable.id,
            name: adminUsersTable.name,
            username: adminUsersTable.username,
            role: adminUsersTable.role,
            createdAt: adminUsersTable.createdAt,
          })
          .from(adminUsersTable);
        return {
          ok: true,
          data: rows.map((r) => ({
            id: r.id,
            name: r.name,
            username: r.username,
            role: r.role ?? 'admin',
            createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
          })),
        };
      } catch {
        handleDbError(store);
      }
    }

    return {
      ok: true,
      data: store.adminUsers.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
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
  username: string;
  password: string;
  role?: string;
}): Promise<ActionResult<AdminUserSummary>> {
  try {
    await requireAdmin();

    const name = input.name?.trim();
    const username = input.username?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!name || name.length < 2) {
      return { ok: false, error: 'Nama admin minimal 2 karakter.' };
    }
    if (!username) {
      return { ok: false, error: 'Username wajib diisi.' };
    }
    if (password.length < 8) {
      return { ok: false, error: 'Kata sandi minimal 8 karakter.' };
    }

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        const existing = await db
          .select({ id: adminUsersTable.id })
          .from(adminUsersTable)
          .where(eq(adminUsersTable.username, username))
          .limit(1);

        if (existing.length > 0) {
          return { ok: false, error: 'Username admin sudah terdaftar.' };
        }

        const [inserted] = await db
          .insert(adminUsersTable)
          .values({
            name,
            username,
            passwordHash: hashPassword(password),
            role: 'admin',
          })
          .returning({
            id: adminUsersTable.id,
            name: adminUsersTable.name,
            username: adminUsersTable.username,
            role: adminUsersTable.role,
            createdAt: adminUsersTable.createdAt,
          });

        if (inserted) {
          const created: AdminUserSummary = {
            id: inserted.id,
            name: inserted.name,
            username: inserted.username,
            role: inserted.role ?? 'admin',
            createdAt: inserted.createdAt.toISOString(),
          };
          store.adminUsers.push({ ...created, password });
          return { ok: true, data: created };
        }
      } catch {
        handleDbError(store);
        if (process.env.NODE_ENV === 'production') {
          return {
            ok: false,
            error: 'Gagal menyimpan akun admin baru ke database.',
          };
        }
      }
    }

    if (store.adminUsers.some((u) => u.username.toLowerCase() === username)) {
      return { ok: false, error: 'Username admin sudah terdaftar.' };
    }

    const created: AdminUserSummary = {
      id: crypto.randomUUID(),
      name,
      username,
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
    const session = await requireAdmin();

    const userId =
      typeof userIdOrObj === 'string'
        ? userIdOrObj
        : (userIdOrObj.userId ?? userIdOrObj.id ?? '');

    if (!userId) {
      return { ok: false, error: 'ID admin tidak valid.' };
    }

    if (session.user.id === userId) {
      return {
        ok: false,
        error: 'Anda tidak dapat menghapus akun admin yang sedang digunakan.',
      };
    }

    const store = getFallbackStore();

    if (shouldAttemptDb(store)) {
      try {
        const allAdmins = await db
          .select({ id: adminUsersTable.id })
          .from(adminUsersTable);
        if (allAdmins.length <= 1) {
          return {
            ok: false,
            error: 'Tidak dapat menghapus satu-satunya akun admin utama.',
          };
        }
        await db.delete(adminUsersTable).where(eq(adminUsersTable.id, userId));
        store.adminUsers = store.adminUsers.filter((u) => u.id !== userId);
        return { ok: true, data: { id: userId } };
      } catch {
        handleDbError(store);
        if (process.env.NODE_ENV === 'production') {
          return {
            ok: false,
            error: 'Gagal menghapus pengguna admin dari database.',
          };
        }
      }
    }

    if (store.adminUsers.length <= 1 && store.adminUsers[0]?.id === userId) {
      return {
        ok: false,
        error: 'Tidak dapat menghapus satu-satunya akun admin utama.',
      };
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
        await db
          .update(adminUsersTable)
          .set({
            passwordHash: hashPassword(newPassword),
            updatedAt: new Date(),
          })
          .where(eq(adminUsersTable.id, userId));
      } catch {
        handleDbError(store);
        if (process.env.NODE_ENV === 'production') {
          return {
            ok: false,
            error: 'Gagal memperbarui kata sandi di database.',
          };
        }
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
