import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  getAncestors,
  getBranches,
  getDescendantStats,
  getGeneration,
  getLineagePath,
  getRootUnions,
} from '../graph';
import {
  computeLayout,
  H,
  ROW_H,
  UNION_H,
  UNION_W,
  W,
} from '../layout';
import type { Person, TreeLayoutResult, Union } from '../types';
import {
  assertNoCycle,
  assertNotSelfParent,
  assertValidCouple,
  canDeletePerson,
  personInputSchema,
  reorderChildrenSchema,
  unionInputSchema,
} from '../validation';

function createBaniSukarGen1To4Fixture(): {
  persons: Person[];
  unions: Union[];
} {
  const persons: Person[] = [
    // Gen 1 Root: Sukar & Sadirah
    {
      id: 'p-sukar',
      fullName: 'Sukar',
      nickname: 'Mbah Sukar',
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1920-01-01',
      isDeceased: true,
      deathDate: '1995-05-10',
      isBloodLine: true,
      parentUnionId: null,
      birthOrder: null,
    },
    {
      id: 'p-sadirah',
      fullName: 'Sadirah',
      nickname: 'Mbah Sadirah',
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1925-01-01',
      isDeceased: true,
      deathDate: '2001-08-15',
      isBloodLine: true,
      parentUnionId: null,
      birthOrder: null,
    },

    // Gen 2 (6 children + spouses)
    {
      id: 'p-sukijah',
      fullName: 'Sukijah',
      nickname: null,
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1948-04-04',
      isDeceased: true,
      deathDate: '2014-09-05',
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 1,
    },
    {
      id: 'p-sutaji',
      fullName: 'Sutaji',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1943-04-03',
      isDeceased: true,
      deathDate: '2022-06-25',
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    },
    {
      id: 'p-imam-sanadi',
      fullName: 'Imam Sanadi',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: null,
      isDeceased: true,
      deathDate: '1991-03-27',
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 2,
    },
    {
      id: 'p-nuharti',
      fullName: 'Nuharti',
      nickname: null,
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1957-07-01',
      isDeceased: true,
      deathDate: '2021-06-22',
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    },
    {
      id: 'p-kaenah',
      fullName: 'Kaenah',
      nickname: null,
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1958-07-01',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 3,
    },
    {
      id: 'p-sapawi',
      fullName: 'Sapawi',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1942-07-01',
      isDeceased: true,
      deathDate: '2021-08-06',
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    },
    {
      id: 'p-kartini',
      fullName: 'Kartini',
      nickname: null,
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1958-08-27',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 4,
    },
    {
      id: 'p-supardi',
      fullName: 'Supardi',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1957-07-01',
      isDeceased: false,
      deathDate: null,
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    },
    {
      id: 'p-darkasan',
      fullName: 'Darkasan',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1963-07-20',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 5,
    },
    {
      id: 'p-kami',
      fullName: 'Kami',
      nickname: null,
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1976-09-11',
      isDeceased: false,
      deathDate: null,
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    },
    {
      id: 'p-warsini',
      fullName: 'Warsini',
      nickname: null,
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1965-10-24',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 6,
    },
    {
      id: 'p-raji',
      fullName: 'Raji',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1960-07-01',
      isDeceased: false,
      deathDate: null,
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    },

    // Gen 3: Hartini (daughter of Sukijah & Sutaji) & Pariyono (divorced) + second spouse Budi (remarriage)
    {
      id: 'p-hartini',
      fullName: 'Hartini',
      nickname: 'Tini',
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1972-03-12',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-sukijah-sutaji',
      birthOrder: 1,
    },
    {
      id: 'p-pariyono',
      fullName: 'Pariyono',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1970-05-19',
      isDeceased: false,
      deathDate: null,
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    },
    {
      id: 'p-haryanto',
      fullName: 'Haryanto',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1975-08-09',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-sukijah-sutaji',
      birthOrder: 2,
    },

    // Gen 4: Tegar Pambudi (son of Hartini & Pariyono)
    {
      id: 'p-tegar-pambudi',
      fullName: 'Tegar Pambudi',
      nickname: 'Tegar',
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: '1998-11-21',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-hartini-pariyono',
      birthOrder: 1,
    },
  ];

  const unions: Union[] = [
    {
      id: 'u-root',
      husbandId: 'p-sukar',
      wifeId: 'p-sadirah',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-sukijah-sutaji',
      husbandId: 'p-sutaji',
      wifeId: 'p-sukijah',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-imam-nuharti',
      husbandId: 'p-imam-sanadi',
      wifeId: 'p-nuharti',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-kaenah-sapawi',
      husbandId: 'p-sapawi',
      wifeId: 'p-kaenah',
      status: 'widowed',
      unionOrder: 1,
    },
    {
      id: 'u-kartini-supardi',
      husbandId: 'p-supardi',
      wifeId: 'p-kartini',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-darkasan-kami',
      husbandId: 'p-darkasan',
      wifeId: 'p-kami',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-warsini-raji',
      husbandId: 'p-raji',
      wifeId: 'p-warsini',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-hartini-pariyono',
      husbandId: 'p-pariyono',
      wifeId: 'p-hartini',
      status: 'divorced',
      unionOrder: 1,
    },
  ];

  return { persons, unions };
}

function assertZeroBoundingBoxOverlap(layout: TreeLayoutResult) {
  const boxes = layout.nodes.map((node) => {
    const width = node.type === 'person' ? W : UNION_W;
    const height = node.type === 'person' ? H : UNION_H;
    return {
      id: node.id,
      type: node.type,
      left: node.position.x,
      right: node.position.x + width,
      top: node.position.y,
      bottom: node.position.y + height,
    };
  });

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapsX = a.left < b.right && a.right > b.left;
      const overlapsY = a.top < b.bottom && a.bottom > b.top;
      expect(
        overlapsX && overlapsY,
        `Nodes ${a.id} (${a.left},${a.top}->${a.right},${a.bottom}) and ${b.id} (${b.left},${b.top}->${b.right},${b.bottom}) overlap!`
      ).toBe(false);
    }
  }
}

describe('Bani Sukar Domain — Graph Functions', () => {
  it('builds graph and sorts children by birthOrder ascending', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    // Shuffle persons order to ensure buildGraph sorts deterministically
    const reversed = [...persons].reverse();
    const graph = buildGraph(reversed, unions);

    const rootChildren = graph.childrenByUnion.get('u-root') ?? [];
    expect(rootChildren.map((c) => c.fullName)).toEqual([
      'Sukijah',
      'Imam Sanadi',
      'Kaenah',
      'Kartini',
      'Darkasan',
      'Warsini',
    ]);
  });

  it('computes accurate generations for bloodline and non-bloodline spouses across Gen 1-4', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    expect(getGeneration(graph, 'p-sukar')).toBe(1);
    expect(getGeneration(graph, 'p-sadirah')).toBe(1);
    expect(getGeneration(graph, 'p-sukijah')).toBe(2);
    expect(getGeneration(graph, 'p-sutaji')).toBe(2); // non-bloodline spouse inherits Gen 2
    expect(getGeneration(graph, 'p-hartini')).toBe(3);
    expect(getGeneration(graph, 'p-pariyono')).toBe(3); // non-bloodline spouse inherits Gen 3
    expect(getGeneration(graph, 'p-tegar-pambudi')).toBe(4);
  });

  it('retrieves all ancestors of a Gen 4 descendant', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    const ancestors = getAncestors(graph, 'p-tegar-pambudi');
    expect(ancestors.has('p-hartini')).toBe(true);
    expect(ancestors.has('p-pariyono')).toBe(true);
    expect(ancestors.has('p-sukijah')).toBe(true);
    expect(ancestors.has('p-sutaji')).toBe(true);
    expect(ancestors.has('p-sukar')).toBe(true);
    expect(ancestors.has('p-sadirah')).toBe(true);
    expect(ancestors.has('p-tegar-pambudi')).toBe(false);
    expect(ancestors.has('p-kartini')).toBe(false);
  });

  it('calculates descendant statistics (spouses, children, grandchildren, greatGrandchildren)', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    const sukarStats = getDescendantStats(graph, 'p-sukar');
    expect(sukarStats).toEqual({
      spouses: 1,
      children: 6,
      grandchildren: 2, // Hartini & Haryanto
      greatGrandchildren: 1, // Tegar Pambudi
    });
  });

  it('identifies root unions, 6 Gen-2 branches, and lineage path to Gen 4', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    const roots = getRootUnions(graph);
    expect(roots.map((u) => u.id)).toEqual(['u-root']);

    const branches = getBranches(graph);
    expect(branches).toHaveLength(6);
    expect(branches[0]).toEqual({
      id: 'p-sukijah',
      fullName: 'Sukijah',
      order: 1,
    });
    expect(branches[5]).toEqual({
      id: 'p-warsini',
      fullName: 'Warsini',
      order: 6,
    });

    const lineage = getLineagePath(graph, 'p-tegar-pambudi');
    expect(lineage.map((l) => ({ name: l.fullName, gen: l.generation }))).toEqual([
      { name: 'Sukar', gen: 1 },
      { name: 'Sukijah', gen: 2 },
      { name: 'Hartini', gen: 3 },
      { name: 'Tegar Pambudi', gen: 4 },
    ]);
  });
});

describe('Bani Sukar Domain — Validation & Invariants', () => {
  it('enforces personInputSchema rules (min 2 chars, deathDate only if deceased, deathDate >= birthDate)', () => {
    const tooShort = personInputSchema.safeParse({
      fullName: 'A',
      gender: 'L',
      isDeceased: false,
      isBloodLine: true,
    });
    expect(tooShort.success).toBe(false);

    const deathWhenAlive = personInputSchema.safeParse({
      fullName: 'Budi Santoso',
      gender: 'L',
      isDeceased: false,
      deathDate: '2020-01-01',
      isBloodLine: true,
    });
    expect(deathWhenAlive.success).toBe(false);

    const deathBeforeBirth = personInputSchema.safeParse({
      fullName: 'Budi Santoso',
      gender: 'L',
      birthDate: '2000-05-10',
      isDeceased: true,
      deathDate: '1999-05-10',
      isBloodLine: true,
    });
    expect(deathBeforeBirth.success).toBe(false);

    const validPerson = personInputSchema.safeParse({
      fullName: 'Sukijah',
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1948-04-04',
      isDeceased: true,
      deathDate: '2014-09-05',
      isBloodLine: true,
    });
    expect(validPerson.success).toBe(true);
  });

  it('validates unionInputSchema and reorderChildrenSchema', () => {
    expect(
      unionInputSchema.safeParse({
        husbandId: null,
        wifeId: null,
        status: 'married',
      }).success
    ).toBe(false);

    expect(
      unionInputSchema.safeParse({
        husbandId: 'p-1',
        wifeId: 'p-1',
        status: 'married',
      }).success
    ).toBe(false);

    expect(
      reorderChildrenSchema.safeParse({
        unionId: 'u-root',
        orderedChildIds: ['p-sukijah', 'p-imam-sanadi'],
      }).success
    ).toBe(true);
  });

  it('rejects same-gender couples and self-parenting', () => {
    const { persons } = createBaniSukarGen1To4Fixture();
    const sukar = persons.find((p) => p.id === 'p-sukar')!;
    const sutaji = persons.find((p) => p.id === 'p-sutaji')!;
    const sadirah = persons.find((p) => p.id === 'p-sadirah')!;

    expect(() => assertValidCouple(sukar, sutaji)).toThrow();
    expect(() => assertValidCouple(sukar, sukar)).toThrow();
    expect(() => assertValidCouple(sadirah, sukar)).toThrow(); // husband must be L, wife must be P
    expect(() => assertValidCouple(sukar, sadirah)).not.toThrow();

    expect(() =>
      assertNotSelfParent('p-sukar', 'p-sukar', 'p-sadirah')
    ).toThrow();
  });

  it('detects and blocks genealogical cycles in assertNoCycle', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    // Sukar (Gen 1) cannot become a child of Hartini & Pariyono (Gen 3)
    expect(() =>
      assertNoCycle(graph, 'p-sukar', 'u-hartini-pariyono')
    ).toThrow(/siklus/i);

    // Sukijah (Gen 2) cannot become a child of her own marriage u-sukijah-sutaji
    expect(() =>
      assertNoCycle(graph, 'p-sukijah', 'u-sukijah-sutaji')
    ).toThrow();

    // Valid parenting assignment does not throw
    expect(() =>
      assertNoCycle(graph, 'p-tegar-pambudi', 'u-hartini-pariyono')
    ).not.toThrow();
  });

  it('blocks deleting a person who has children and allows deleting childless leaf persons', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    const sukarCheck = canDeletePerson(graph, 'p-sukar');
    expect(sukarCheck.allowed).toBe(false);
    expect(sukarCheck.reason).toBeTruthy();

    const hartiniCheck = canDeletePerson(graph, 'p-hartini');
    expect(hartiniCheck.allowed).toBe(false);

    // Tegar Pambudi (Gen 4 leaf) and Warsini (Gen 2 without children in fixture) can be deleted
    expect(canDeletePerson(graph, 'p-tegar-pambudi').allowed).toBe(true);
    expect(canDeletePerson(graph, 'p-warsini').allowed).toBe(true);
  });
});

describe('Bani Sukar Domain — Deterministic Family-Block Layout Engine', () => {
  it('computes deterministic layout with zero bounding-box overlaps across Gen 1-4', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    const layout1 = computeLayout(graph);
    const layout2 = computeLayout(graph);

    expect(layout1).toEqual(layout2);
    expect(layout1.nodes.length).toBe(persons.length + unions.length);
    assertZeroBoundingBoxOverlap(layout1);
  });

  it('places children strictly below parent union and styles divorced edges with dashed stroke', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);
    const layout = computeLayout(graph);

    const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));

    const rootUnionNode = nodeById.get('u-root')!;
    const sukijahNode = nodeById.get('p-sukijah')!;
    const hartiniUnionNode = nodeById.get('u-hartini-pariyono')!;
    const tegarNode = nodeById.get('p-tegar-pambudi')!;

    expect(sukijahNode.position.y).toBeGreaterThan(rootUnionNode.position.y);
    expect(tegarNode.position.y).toBeGreaterThan(hartiniUnionNode.position.y);
    expect(tegarNode.position.y).toBe(3 * ROW_H); // Gen 4 -> (4 - 1) * ROW_H

    // Divorced edge check for Hartini & Pariyono
    const divorcedEdges = layout.edges.filter(
      (e) => e.target === 'u-hartini-pariyono'
    );
    expect(divorcedEdges).toHaveLength(2);
    for (const edge of divorcedEdges) {
      expect(edge.style?.strokeDasharray).toBe('6 4');
    }
  });

  it('handles polygamy / remarriage with multiple spouses and children without node overlaps', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const secondHusband: Person = {
      id: 'p-budi-remarriage',
      fullName: 'Budi Santoso',
      nickname: null,
      gender: 'L',
      birthPlace: 'Kudus',
      birthDate: '1971-02-14',
      isDeceased: false,
      deathDate: null,
      isBloodLine: false,
      parentUnionId: null,
      birthOrder: null,
    };
    const secondChild: Person = {
      id: 'p-ayu-lestari',
      fullName: 'Ayu Lestari',
      nickname: null,
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '2004-06-10',
      isDeceased: false,
      deathDate: null,
      isBloodLine: true,
      parentUnionId: 'u-hartini-budi',
      birthOrder: 1,
    };
    const secondUnion: Union = {
      id: 'u-hartini-budi',
      husbandId: 'p-budi-remarriage',
      wifeId: 'p-hartini',
      status: 'married',
      unionOrder: 2,
    };

    const graph = buildGraph(
      [...persons, secondHusband, secondChild],
      [...unions, secondUnion]
    );
    const layout = computeLayout(graph);

    assertZeroBoundingBoxOverlap(layout);
    expect(layout.nodes.some((n) => n.id === 'p-budi-remarriage')).toBe(true);
    expect(layout.nodes.some((n) => n.id === 'p-ayu-lestari')).toBe(true);
  });

  it('filters layout by Gen 2 branchId while keeping Gen 1 root union (Sukar & Sadirah)', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);

    const filtered = computeLayout(graph, { branchId: 'p-sukijah' });
    assertZeroBoundingBoxOverlap(filtered);

    const renderedPersonIds = new Set(
      filtered.nodes.filter((n) => n.type === 'person').map((n) => n.id)
    );

    // Keeps Gen 1 root couple
    expect(renderedPersonIds.has('p-sukar')).toBe(true);
    expect(renderedPersonIds.has('p-sadirah')).toBe(true);

    // Keeps selected Gen 2 branch and its Gen 3-4 descendants
    expect(renderedPersonIds.has('p-sukijah')).toBe(true);
    expect(renderedPersonIds.has('p-sutaji')).toBe(true);
    expect(renderedPersonIds.has('p-hartini')).toBe(true);
    expect(renderedPersonIds.has('p-pariyono')).toBe(true);
    expect(renderedPersonIds.has('p-tegar-pambudi')).toBe(true);

    // Excludes other Gen 2 branches
    expect(renderedPersonIds.has('p-kartini')).toBe(false);
    expect(renderedPersonIds.has('p-darkasan')).toBe(false);
    expect(renderedPersonIds.has('p-warsini')).toBe(false);

    // Still returns full list of 6 branches for the selector toolbar
    expect(filtered.branches).toHaveLength(6);
  });

  it('aligns couple union vertical center with partner horizontal handle anchor (H / 2)', () => {
    const { persons, unions } = createBaniSukarGen1To4Fixture();
    const graph = buildGraph(persons, unions);
    const layout = computeLayout(graph);

    const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
    const rootUnionNode = nodeById.get('u-root')!;
    const sukarNode = nodeById.get('p-sukar')!;
    const sadirahNode = nodeById.get('p-sadirah')!;

    expect(rootUnionNode.position.y + UNION_H / 2).toBe(
      sukarNode.position.y + H / 2
    );
    expect(rootUnionNode.position.y + UNION_H / 2).toBe(
      sadirahNode.position.y + H / 2
    );
  });
});
