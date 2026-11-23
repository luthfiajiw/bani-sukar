import { describe, expect, it } from 'vitest';
import { buildGraph, getGeneration } from '@/features/family/graph';
import {
  computeLayout,
  H,
  ROW_H,
  UNION_H,
  UNION_W,
  W,
} from '@/features/family/layout';
import type {
  Person,
  PersonNodeData,
  TreeLayoutResult,
  Union,
} from '@/features/family/types';
import {
  BASE_NAME_FONT_SIZE_PX,
  CARD_PRESETS,
  DEFAULT_EXPORT_SETTINGS,
  MIN_NAME_FONT_SIZE_PX,
} from '../constants';
import { filterGraphByScope } from '../scope';
import {
  computeFittedMetricsForGraph,
  measureAndFitPersonCard,
} from '../text-fit';

function createExportTestFixture(): { persons: Person[]; unions: Union[] } {
  const persons: Person[] = [
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
      birthOrder: 2,
    },
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
      id: 'p-budi',
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
    },
    {
      id: 'p-tegar',
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
    {
      id: 'p-ayu',
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
      id: 'u-hartini-pariyono',
      husbandId: 'p-pariyono',
      wifeId: 'p-hartini',
      status: 'divorced',
      unionOrder: 1,
    },
    {
      id: 'u-hartini-budi',
      husbandId: 'p-budi',
      wifeId: 'p-hartini',
      status: 'married',
      unionOrder: 2,
    },
  ];

  return { persons, unions };
}

function assertZeroOverlapWithNodeBounds(
  layout: TreeLayoutResult,
  fallbackW = W,
  fallbackH = H,
) {
  const boxes = layout.nodes.map((node) => {
    const width =
      node.width ?? (node.type === 'person' ? fallbackW : UNION_W);
    const height =
      node.height ?? (node.type === 'person' ? fallbackH : UNION_H);
    return {
      id: node.id,
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
        `Nodes ${a.id} and ${b.id} overlap`,
      ).toBe(false);
    }
  }
}

describe('Parameterized computeLayout (TOP_DOWN & LEFT_RIGHT)', () => {
  it('supports LEFT_RIGHT orientation with zero overlaps and horizontal generation flow', () => {
    const { persons, unions } = createExportTestFixture();
    const graph = buildGraph(persons, unions);

    const layout = computeLayout(graph, {
      orientation: 'LEFT_RIGHT',
    });

    expect(layout.nodes).toHaveLength(persons.length + unions.length);
    assertZeroOverlapWithNodeBounds(layout);

    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const sukar = byId.get('p-sukar')!;
    const sadirah = byId.get('p-sadirah')!;
    const sukijah = byId.get('p-sukijah')!;
    const hartini = byId.get('p-hartini')!;
    const tegar = byId.get('p-tegar')!;

    // Same generation shares X column; spouses stack vertically along Y
    expect(sukar.position.x).toBe(sadirah.position.x);
    expect(sukar.position.y).not.toBe(sadirah.position.y);

    // Subsequent generations move strictly right along X
    expect(sukijah.position.x).toBeGreaterThan(sukar.position.x + W);
    expect(hartini.position.x).toBeGreaterThan(sukijah.position.x + W);
    expect(tegar.position.x).toBeGreaterThan(hartini.position.x + W);

    // Child edge handles flow left -> right
    const childEdge = layout.edges.find(
      (e) => e.id === 'edge-child-u-root-p-sukijah',
    );
    expect(childEdge?.sourceHandle).toBe('right');
    expect(childEdge?.targetHandle).toBe('left');
  });

  it('supports custom card dimensions, rowHeightByGeneration, and continuationLabelsByPersonId', () => {
    const { persons, unions } = createExportTestFixture();
    const graph = buildGraph(persons, unions);

    const rowHeightByGeneration = new Map<number, number>([
      [1, 100],
      [2, 160],
      [3, 100],
    ]);
    const cardSizeByPersonId = new Map<
      string,
      { width: number; height: number }
    >([
      ['p-sukijah', { width: 200, height: 160 }],
      ['p-sutaji', { width: 200, height: 160 }],
    ]);
    const continuationLabelsByPersonId = new Map<string, string>([
      ['p-hartini', '→ hal. 4'],
    ]);

    const layout = computeLayout(graph, {
      cardWidth: 200,
      cardHeight: 100,
      cardSizeByPersonId,
      rowHeightByGeneration,
      continuationLabelsByPersonId,
    });

    assertZeroOverlapWithNodeBounds(layout);

    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const sukijah = byId.get('p-sukijah')!;
    const hartini = byId.get('p-hartini')!;

    expect(sukijah.height).toBe(160);
    // Gen 2 sits at ROW_H (210); Gen 2 row height 160 + rowGap (110) = 270 -> Gen 3 at 480
    expect(hartini.position.y).toBe(ROW_H + 160 + (ROW_H - H));
    expect((hartini.data as PersonNodeData).continuationLabel).toBe('→ hal. 4');
  });

  it('handles single-partner union in LEFT_RIGHT without overlap', () => {
    const persons: Person[] = [
      {
        id: 'p-single',
        fullName: 'Ibu Tunggal',
        nickname: null,
        gender: 'P',
        birthPlace: null,
        birthDate: null,
        isDeceased: false,
        deathDate: null,
        isBloodLine: true,
        parentUnionId: null,
        birthOrder: null,
      },
      {
        id: 'p-anak',
        fullName: 'Anak Satu',
        nickname: null,
        gender: 'L',
        birthPlace: null,
        birthDate: null,
        isDeceased: false,
        deathDate: null,
        isBloodLine: true,
        parentUnionId: 'u-single',
        birthOrder: 1,
      },
    ];
    const unions: Union[] = [
      {
        id: 'u-single',
        husbandId: null,
        wifeId: 'p-single',
        status: 'widowed',
        unionOrder: 1,
      },
    ];

    const graph = buildGraph(persons, unions);
    const layout = computeLayout(graph, {
      orientation: 'LEFT_RIGHT',
      cardWidth: CARD_PRESETS.minimal.defaultWidth,
      cardHeight: CARD_PRESETS.minimal.defaultHeight,
      rowGap: 20,
    });

    assertZeroOverlapWithNodeBounds(
      layout,
      CARD_PRESETS.minimal.defaultWidth,
      CARD_PRESETS.minimal.defaultHeight,
    );
  });
});

describe('filterGraphByScope', () => {
  it('filters by subtreeRootPersonId (focal person + spouses + all descendants)', () => {
    const { persons, unions } = createExportTestFixture();
    const graph = buildGraph(persons, unions);

    const scoped = filterGraphByScope(graph, {
      branchId: null,
      subtreeRootPersonId: 'p-hartini',
      minGeneration: 1,
      maxGeneration: 99,
    });

    const ids = new Set(scoped.persons.keys());
    expect(ids).toEqual(
      new Set(['p-hartini', 'p-pariyono', 'p-budi', 'p-tegar', 'p-ayu']),
    );
    // Root parentUnionId is cleared so computeLayout treats Hartini as subtree root
    expect(scoped.persons.get('p-hartini')?.parentUnionId).toBeNull();
    expect(getGeneration(scoped, 'p-hartini')).toBe(1);
    expect(getGeneration(scoped, 'p-tegar')).toBe(2);

    const layout = computeLayout(scoped);
    assertZeroOverlapWithNodeBounds(layout);
    expect(layout.nodes.filter((n) => n.type === 'person')).toHaveLength(5);
  });

  it('filters by minGeneration..maxGeneration and clears cut root parentUnionId', () => {
    const { persons, unions } = createExportTestFixture();
    const graph = buildGraph(persons, unions);

    const scoped = filterGraphByScope(graph, {
      branchId: null,
      subtreeRootPersonId: null,
      minGeneration: 2,
      maxGeneration: 3,
    });

    const ids = new Set(scoped.persons.keys());
    expect(ids.has('p-sukar')).toBe(false);
    expect(ids.has('p-sadirah')).toBe(false);
    expect(ids.has('p-sukijah')).toBe(true);
    expect(ids.has('p-sutaji')).toBe(true);
    expect(ids.has('p-kartini')).toBe(true);
    expect(ids.has('p-hartini')).toBe(true);
    expect(ids.has('p-tegar')).toBe(false);
    expect(ids.has('p-ayu')).toBe(false);

    expect(scoped.persons.get('p-sukijah')?.parentUnionId).toBeNull();
    expect(scoped.persons.get('p-hartini')?.parentUnionId).toBe(
      'u-sukijah-sutaji',
    );

    const layout = computeLayout(scoped);
    assertZeroOverlapWithNodeBounds(layout);
  });

  it('combines branchId and minGeneration..maxGeneration accurately', () => {
    const { persons, unions } = createExportTestFixture();
    const graph = buildGraph(persons, unions);

    const scoped = filterGraphByScope(graph, {
      branchId: 'p-sukijah',
      subtreeRootPersonId: null,
      minGeneration: 2,
      maxGeneration: 3,
    });

    const ids = new Set(scoped.persons.keys());
    expect(ids).toEqual(
      new Set(['p-sukijah', 'p-sutaji', 'p-hartini', 'p-pariyono', 'p-budi']),
    );
    expect(ids.has('p-kartini')).toBe(false);
  });

  it('returns empty graph when subtreeRootPersonId does not exist or minGeneration > maxGeneration', () => {
    const { persons, unions } = createExportTestFixture();
    const graph = buildGraph(persons, unions);

    const missing = filterGraphByScope(graph, {
      branchId: null,
      subtreeRootPersonId: 'p-tidak-ada',
      minGeneration: 1,
      maxGeneration: 99,
    });
    expect(missing.persons.size).toBe(0);

    const invalidRange = filterGraphByScope(graph, {
      branchId: null,
      subtreeRootPersonId: null,
      minGeneration: 4,
      maxGeneration: 2,
    });
    expect(invalidRange.persons.size).toBe(0);
  });
});

describe('Deterministic text-fit & Alm./Almh. badges', () => {
  it('prepends Alm. for deceased males and Almh. for deceased females without † symbol', () => {
    const baseMale: Person = {
      id: 'm1',
      fullName: 'Sukar Hadiwijaya',
      nickname: null,
      gender: 'L',
      birthPlace: 'Pati',
      birthDate: null,
      isDeceased: true,
      deathDate: '1995-01-01',
      isBloodLine: true,
      parentUnionId: null,
      birthOrder: null,
    };
    const baseFemale: Person = {
      ...baseMale,
      id: 'f1',
      fullName: 'Sadirah Kusumawati',
      gender: 'P',
    };
    const livingPerson: Person = {
      ...baseMale,
      id: 'l1',
      isDeceased: false,
      deathDate: null,
    };

    const maleMetric = measureAndFitPersonCard(
      baseMale,
      CARD_PRESETS.full.toggles,
      'full',
    );
    expect(maleMetric.deceasedPrefix).toBe('Alm.');
    expect(maleMetric.nameLines.join(' ')).toBe('Alm. Sukar Hadiwijaya');
    expect(maleMetric.nameLines.join(' ')).not.toContain('†');

    const femaleMetric = measureAndFitPersonCard(
      baseFemale,
      CARD_PRESETS.full.toggles,
      'full',
    );
    expect(femaleMetric.deceasedPrefix).toBe('Almh.');
    expect(femaleMetric.nameLines.join(' ')).toBe('Almh. Sadirah Kusumawati');
    expect(femaleMetric.nameLines.join(' ')).not.toContain('†');

    const hiddenBadgeMetric = measureAndFitPersonCard(
      baseMale,
      { ...CARD_PRESETS.full.toggles, deceasedBadge: false },
      'full',
    );
    expect(hiddenBadgeMetric.deceasedPrefix).toBeNull();
    expect(hiddenBadgeMetric.nameLines.join(' ')).toBe('Sukar Hadiwijaya');

    const livingMetric = measureAndFitPersonCard(
      livingPerson,
      CARD_PRESETS.full.toggles,
      'full',
    );
    expect(livingMetric.deceasedPrefix).toBeNull();
  });

  it('never truncates extra-long names with ellipsis, steps down font size, and grows card height when > 3 lines', () => {
    const longPerson: Person = {
      id: 'p-long',
      fullName:
        'Raden Mas Tumenggung Muhammad Abdurrahman Kusumaningrat Wijaya Kusuma',
      nickname: 'Raden',
      gender: 'L',
      birthPlace: 'Yogyakarta',
      birthDate: '1950-01-01',
      isDeceased: true,
      deathDate: '2020-01-01',
      isBloodLine: true,
      parentUnionId: null,
      birthOrder: null,
    };

    const fitted = measureAndFitPersonCard(
      longPerson,
      CARD_PRESETS.full.toggles,
      'full',
    );

    const joined = fitted.nameLines.join(' ');
    expect(joined).toBe(`Alm. ${longPerson.fullName}`);
    expect(joined).not.toContain('…');
    expect(joined).not.toContain('...');
    expect(fitted.nameFontSizePx).toBe(MIN_NAME_FONT_SIZE_PX);
    expect(fitted.nameLines.length).toBeGreaterThan(3);
    expect(fitted.height).toBeGreaterThan(CARD_PRESETS.full.defaultHeight);

    const shortPerson: Person = {
      ...longPerson,
      id: 'p-short',
      fullName: 'Ali',
      isDeceased: false,
      deathDate: null,
    };
    const shortFitted = measureAndFitPersonCard(
      shortPerson,
      CARD_PRESETS.full.toggles,
      'full',
    );
    expect(shortFitted.nameFontSizePx).toBe(BASE_NAME_FONT_SIZE_PX);
    expect(shortFitted.height).toBe(CARD_PRESETS.full.defaultHeight);
  });

  it('computes graph-wide fitted row heights and passes them into computeLayout with zero overlap', () => {
    const { persons, unions } = createExportTestFixture();
    const updatedPersons = persons.map((p) =>
      p.id === 'p-sukijah'
        ? {
            ...p,
            fullName:
              'Kanjeng Raden Ayu Sukijah Prawirodirjo Kusumowardojo Ningratwati Adipati Sastranegara',
            nickname: 'Mbah Kanjeng',
          }
        : p,
    );
    const graph = buildGraph(updatedPersons, unions);
    const fitted = computeFittedMetricsForGraph(graph, DEFAULT_EXPORT_SETTINGS);

    const gen2RowH = fitted.rowHeightByGeneration.get(2)!;
    expect(gen2RowH).toBeGreaterThan(CARD_PRESETS.full.defaultHeight);
    expect(fitted.cardSizeByPersonId.get('p-sutaji')?.height).toBe(gen2RowH);

    const layout = computeLayout(graph, {
      cardSizeByPersonId: fitted.cardSizeByPersonId,
      rowHeightByGeneration: fitted.rowHeightByGeneration,
    });
    assertZeroOverlapWithNodeBounds(layout);

    const layoutLR = computeLayout(graph, {
      orientation: 'LEFT_RIGHT',
      cardSizeByPersonId: fitted.cardSizeByPersonId,
      rowHeightByGeneration: fitted.rowHeightByGeneration,
    });
    assertZeroOverlapWithNodeBounds(layoutLR);
  });
});
