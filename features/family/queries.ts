import { cacheLife, cacheTag } from 'next/cache';
import { db, isDbConfigured } from '@/db';
import { persons as personsTable, unions as unionsTable } from '@/db/schema';
import { getPhotoPublicUrl } from '@/lib/photo';
import {
  buildGraph,
  getDescendantStats,
  getGeneration,
  getLineagePath,
  getRootUnions,
} from './graph';
import { computeLayout } from './layout';
import { SEED_IDS, SEED_PERSONS, SEED_UNIONS } from './seed-data';
import type {
  AdminPersonFilters,
  AdminPersonRow,
  AdminUserSummary,
  Person,
  PersonDetailData,
  RelationEditorData,
  RelationUnionOption,
  TreeLayoutResult,
  Union,
} from './types';

export interface FallbackAdminUser extends AdminUserSummary {
  password: string;
}

export interface FamilyFallbackStore {
  persons: Person[];
  unions: Union[];
  adminUsers: FallbackAdminUser[];
  dbOffline: boolean;
}

const globalForFallback = globalThis as unknown as {
  __baniSukarFallbackStore?: FamilyFallbackStore;
};

export function getFallbackStore(): FamilyFallbackStore {
  if (!globalForFallback.__baniSukarFallbackStore) {
    globalForFallback.__baniSukarFallbackStore = {
      persons: SEED_PERSONS.map((p) => ({
        ...p,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })),
      unions: SEED_UNIONS.map((u) => ({
        ...u,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })),
      adminUsers: [
        {
          id: 'dev-admin',
          name: process.env.SEED_ADMIN_NAME || 'Admin Bani Sukar',
          email: process.env.SEED_ADMIN_EMAIL || 'admin@banisukar.id',
          role: 'admin',
          password: process.env.SEED_ADMIN_PASSWORD || 'AdminBaniSukar123!',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      dbOffline: false,
    };
  }
  return globalForFallback.__baniSukarFallbackStore;
}

function normalizePersonRow(row: typeof personsTable.$inferSelect): Person {
  return {
    id: row.id,
    fullName: row.fullName,
    nickname: row.nickname ?? null,
    gender: row.gender,
    birthPlace: row.birthPlace ?? null,
    birthDate: row.birthDate ?? null,
    isDeceased: Boolean(row.isDeceased),
    deathDate: row.deathDate ?? null,
    isBloodLine: Boolean(row.isBloodLine),
    parentUnionId: row.parentUnionId ?? null,
    birthOrder: row.birthOrder ?? null,
    photoPath: row.photoPath ?? null,
    photoUrl: getPhotoPublicUrl(row.photoPath),
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

function normalizeUnionRow(row: typeof unionsTable.$inferSelect): Union {
  return {
    id: row.id,
    husbandId: row.husbandId ?? null,
    wifeId: row.wifeId ?? null,
    status: row.status,
    unionOrder: row.unionOrder ?? 1,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function shouldLatchDbOffline(): boolean {
  return process.env.NODE_ENV !== 'production' || !isDbConfigured();
}

export async function getFamilyData(): Promise<{
  persons: Person[];
  unions: Union[];
}> {
  'use cache';
  cacheLife('max');
  cacheTag('family');

  const store = getFallbackStore();
  const alwaysTryDbInProd =
    process.env.NODE_ENV === 'production' && isDbConfigured();

  if (!store.dbOffline || alwaysTryDbInProd) {
    try {
      const [personRows, unionRows] = await Promise.all([
        db.select().from(personsTable),
        db.select().from(unionsTable),
      ]);

      if (personRows.length > 0 || unionRows.length > 0) {
        return {
          persons: personRows.map(normalizePersonRow),
          unions: unionRows.map(normalizeUnionRow),
        };
      }
    } catch {
      if (shouldLatchDbOffline()) {
        store.dbOffline = true;
      }
    }
  }

  return {
    persons: store.persons.map((p) => {
      const photoPath = p.photoPath ?? null;
      return {
        ...p,
        photoPath,
        photoUrl: p.photoUrl ?? getPhotoPublicUrl(photoPath),
      };
    }),
    unions: store.unions.map((u) => ({ ...u })),
  };
}

export async function getLayoutData(
  branchId?: string | null
): Promise<TreeLayoutResult> {
  'use cache';
  cacheLife('max');
  cacheTag('family');

  const { persons, unions } = await getFamilyData();
  const graph = buildGraph(persons, unions);
  return computeLayout(graph, { branchId: branchId ?? null });
}

function resolveFocalPersonId(
  personId: string,
  persons: Person[],
  unions: Union[]
): string | null {
  if (personId !== 'root') {
    return personId;
  }

  const graph = buildGraph(persons, unions);
  if (graph.persons.has(SEED_IDS.SUKAR)) {
    return SEED_IDS.SUKAR;
  }

  const rootUnions = getRootUnions(graph);
  if (rootUnions.length > 0) {
    const u = rootUnions[0];
    if (u.husbandId && graph.persons.has(u.husbandId)) return u.husbandId;
    if (u.wifeId && graph.persons.has(u.wifeId)) return u.wifeId;
  }

  return persons[0]?.id ?? null;
}

export async function getPersonDetail(
  id: string
): Promise<PersonDetailData | null> {
  'use cache';
  cacheLife('max');
  cacheTag('family');

  const { persons, unions } = await getFamilyData();
  const resolvedId = resolveFocalPersonId(id, persons, unions);
  if (!resolvedId) return null;

  const graph = buildGraph(persons, unions);
  const person = graph.persons.get(resolvedId);
  if (!person) return null;

  const generation = getGeneration(graph, person.id);
  const parentUnion = person.parentUnionId
    ? (graph.unions.get(person.parentUnionId) ?? null)
    : null;
  const father = parentUnion?.husbandId
    ? (graph.persons.get(parentUnion.husbandId) ?? null)
    : null;
  const mother = parentUnion?.wifeId
    ? (graph.persons.get(parentUnion.wifeId) ?? null)
    : null;

  const personUnions = graph.unionsByPerson.get(person.id) ?? [];
  const spouses = personUnions.map((union) => {
    const partnerId =
      union.husbandId === person.id ? union.wifeId : union.husbandId;
    const spouse = partnerId ? (graph.persons.get(partnerId) ?? null) : null;
    const unionChildren = graph.childrenByUnion.get(union.id) ?? [];
    return {
      union,
      spouse,
      children: unionChildren,
    };
  });

  const childrenMap = new Map<string, Person>();
  for (const s of spouses) {
    for (const c of s.children) {
      childrenMap.set(c.id, c);
    }
  }
  const children = Array.from(childrenMap.values());

  const siblings = parentUnion
    ? (graph.childrenByUnion.get(parentUnion.id) ?? []).filter(
        (c) => c.id !== person.id
      )
    : [];

  const stats = getDescendantStats(graph, person.id);
  const lineagePath = getLineagePath(graph, person.id);

  return {
    person,
    generation,
    parents: {
      father,
      mother,
      union: parentUnion,
    },
    spouses,
    children,
    siblings,
    stats,
    lineagePath,
  };
}

export async function listPersonsAdmin(
  filters?: AdminPersonFilters
): Promise<AdminPersonRow[]> {
  'use cache';
  cacheLife('max');
  cacheTag('family');

  const { persons, unions } = await getFamilyData();
  const graph = buildGraph(persons, unions);

  const rows: AdminPersonRow[] = persons.map((person) => {
    const generation = getGeneration(graph, person.id);
    const parentUnion = person.parentUnionId
      ? (graph.unions.get(person.parentUnionId) ?? null)
      : null;
    const father = parentUnion?.husbandId
      ? (graph.persons.get(parentUnion.husbandId) ?? null)
      : null;
    const mother = parentUnion?.wifeId
      ? (graph.persons.get(parentUnion.wifeId) ?? null)
      : null;
    const parentNames = [father?.fullName, mother?.fullName].filter(
      (n): n is string => Boolean(n)
    );

    const personUnions = graph.unionsByPerson.get(person.id) ?? [];
    const spouses = personUnions.map((union) => {
      const partnerId =
        union.husbandId === person.id ? union.wifeId : union.husbandId;
      const spouse = partnerId ? (graph.persons.get(partnerId) ?? null) : null;
      const unionChildren = graph.childrenByUnion.get(union.id) ?? [];
      return {
        union,
        spouse,
        children: unionChildren,
      };
    });

    const spouseNames = spouses
      .map((s) => s.spouse?.fullName)
      .filter((n): n is string => Boolean(n));

    const childrenMap = new Map<string, Person>();
    for (const s of spouses) {
      for (const c of s.children) {
        childrenMap.set(c.id, c);
      }
    }
    const children = Array.from(childrenMap.values());

    return {
      ...person,
      person,
      generation,
      parents: {
        father,
        mother,
        union: parentUnion,
      },
      parentNames,
      spouses,
      spouseNames,
      children,
      childrenCount: children.length,
    };
  });

  const q = filters?.q?.trim().toLowerCase() || '';
  const genderFilter = filters?.gender?.trim().toUpperCase() || '';
  const statusFilter = filters?.status?.trim().toLowerCase() || '';

  const filtered = rows.filter((row) => {
    if (q) {
      const matchName = row.fullName.toLowerCase().includes(q);
      const matchNickname = row.nickname?.toLowerCase().includes(q) ?? false;
      const matchPlace = row.birthPlace?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchNickname && !matchPlace) {
        return false;
      }
    }

    if (genderFilter === 'L' || genderFilter === 'P') {
      if (row.gender !== genderFilter) {
        return false;
      }
    }

    if (
      statusFilter === 'alive' ||
      statusFilter === 'hidup' ||
      statusFilter === 'living'
    ) {
      if (row.isDeceased) return false;
    } else if (
      statusFilter === 'deceased' ||
      statusFilter === 'wafat' ||
      statusFilter === 'meninggal'
    ) {
      if (!row.isDeceased) return false;
    } else if (statusFilter === 'bloodline' || statusFilter === 'keturunan') {
      if (!row.isBloodLine) return false;
    } else if (statusFilter === 'spouse' || statusFilter === 'menantu') {
      if (row.isBloodLine) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    if (a.generation !== b.generation) {
      return a.generation - b.generation;
    }
    if (a.isBloodLine !== b.isBloodLine) {
      return a.isBloodLine ? -1 : 1;
    }
    const orderA = a.birthOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.birthOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.fullName.localeCompare(b.fullName, 'id');
  });

  return filtered;
}

export async function getRelationEditorData(
  personId: string
): Promise<RelationEditorData | null> {
  'use cache';
  cacheLife('max');
  cacheTag('family');

  const { persons, unions } = await getFamilyData();
  const resolvedId = resolveFocalPersonId(personId, persons, unions);
  if (!resolvedId) return null;

  const detail = await getPersonDetail(resolvedId);
  if (!detail) return null;

  const graph = buildGraph(persons, unions);
  const allPersons = [...persons].sort((a, b) => {
    const genA = getGeneration(graph, a.id);
    const genB = getGeneration(graph, b.id);
    if (genA !== genB) return genA - genB;
    return a.fullName.localeCompare(b.fullName, 'id');
  });

  const allUnions: RelationUnionOption[] = unions.map((union) => {
    const husband = union.husbandId
      ? (graph.persons.get(union.husbandId) ?? null)
      : null;
    const wife = union.wifeId ? (graph.persons.get(union.wifeId) ?? null) : null;
    const husbandName = husband?.fullName ?? 'Tidak diketahui';
    const wifeName = wife?.fullName ?? 'Tidak diketahui';
    const gen = husband
      ? getGeneration(graph, husband.id)
      : wife
        ? getGeneration(graph, wife.id)
        : 1;

    return {
      id: union.id,
      union,
      husband,
      wife,
      husbandName,
      wifeName,
      label: `Gen ${gen} • ${husbandName} & ${wifeName}`,
    };
  });

  return {
    person: detail.person,
    generation: detail.generation,
    parents: detail.parents,
    spouses: detail.spouses,
    unions: detail.spouses,
    children: detail.children,
    siblings: detail.siblings,
    allPersons,
    persons: allPersons,
    allUnions,
    availableUnions: allUnions,
  };
}
