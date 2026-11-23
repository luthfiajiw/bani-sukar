import { inflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { buildGraph } from '@/features/family/graph';
import type { Person, Union } from '@/features/family/types';
import { DEFAULT_EXPORT_SETTINGS } from '../constants';
import { computeBookPagination } from '../paginator-book';
import { generateBookPdfBlob } from '../pdf-book';
import type { ExportSettings, SceneText } from '../types';

function makePerson(
  overrides: Partial<Person> & { id: string; fullName: string },
): Person {
  return {
    nickname: null,
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: '1970-01-01',
    isDeceased: false,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: null,
    birthOrder: null,
    ...overrides,
  };
}

function makeBookSettings(overrides?: Partial<ExportSettings>): ExportSettings {
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    mode: 'book',
    ...overrides,
    cardToggles: {
      ...DEFAULT_EXPORT_SETTINGS.cardToggles,
      ...overrides?.cardToggles,
    },
    scope: {
      ...DEFAULT_EXPORT_SETTINGS.scope,
      ...overrides?.scope,
    },
    paper: {
      ...DEFAULT_EXPORT_SETTINGS.paper,
      ...overrides?.paper,
    },
    scale: {
      ...DEFAULT_EXPORT_SETTINGS.scale,
      ...overrides?.scale,
    },
    meta: {
      ...DEFAULT_EXPORT_SETTINGS.meta,
      ...overrides?.meta,
    },
  };
}

/**
 * Membuat graf 4 generasi dengan beberapa cabang anak & cucu
 * untuk menguji paginasi satu halaman vs pemecahan multi-halaman rekursif.
 */
function buildMultiGenerationTree() {
  const persons: Person[] = [
    makePerson({
      id: 'p-sukar',
      fullName: 'Sukar',
      gender: 'L',
      isDeceased: true,
      deathDate: '1995-01-01',
    }),
    makePerson({
      id: 'p-sadirah',
      fullName: 'Sadirah',
      gender: 'P',
      isDeceased: true,
      deathDate: '2001-01-01',
    }),

    // Gen 2
    makePerson({
      id: 'p-sukijah',
      fullName: 'Sukijah',
      gender: 'P',
      parentUnionId: 'u-root',
      birthOrder: 1,
      isDeceased: true,
      deathDate: '2014-01-01',
    }),
    makePerson({
      id: 'p-sutaji',
      fullName: 'Sutaji',
      gender: 'L',
      isBloodLine: false,
      isDeceased: true,
      deathDate: '2020-01-01',
    }),
    makePerson({
      id: 'p-martono',
      fullName: 'Martono',
      gender: 'L',
      parentUnionId: 'u-root',
      birthOrder: 2,
    }),
    makePerson({
      id: 'p-siti',
      fullName: 'Siti Aminah',
      gender: 'P',
      isBloodLine: false,
    }),
    makePerson({
      id: 'p-kartini',
      fullName: 'Kartini',
      gender: 'P',
      parentUnionId: 'u-root',
      birthOrder: 3,
    }),

    // Gen 3 under Sukijah
    makePerson({
      id: 'p-ali',
      fullName: 'Ali Mahmudi',
      gender: 'L',
      parentUnionId: 'u-sukijah',
      birthOrder: 1,
    }),
    makePerson({
      id: 'p-rini',
      fullName: 'Rini Wati',
      gender: 'P',
      isBloodLine: false,
    }),
    makePerson({
      id: 'p-hartini',
      fullName: 'Hartini',
      gender: 'P',
      parentUnionId: 'u-sukijah',
      birthOrder: 2,
    }),

    // Gen 3 under Martono
    makePerson({
      id: 'p-budi',
      fullName: 'Budi Santoso',
      gender: 'L',
      parentUnionId: 'u-martono',
      birthOrder: 1,
    }),
    makePerson({
      id: 'p-dewi',
      fullName: 'Dewi Lestari',
      gender: 'P',
      isBloodLine: false,
    }),

    // Gen 4 under Ali Mahmudi
    makePerson({
      id: 'p-tegar',
      fullName: 'Tegar Pambudi',
      gender: 'L',
      parentUnionId: 'u-ali',
      birthOrder: 1,
    }),
    makePerson({
      id: 'p-nadia',
      fullName: 'Nadia Putri',
      gender: 'P',
      parentUnionId: 'u-ali',
      birthOrder: 2,
    }),

    // Gen 4 under Budi Santoso
    makePerson({
      id: 'p-rafi',
      fullName: 'Rafi Pratama',
      gender: 'L',
      parentUnionId: 'u-budi',
      birthOrder: 1,
    }),
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
      id: 'u-sukijah',
      husbandId: 'p-sutaji',
      wifeId: 'p-sukijah',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-martono',
      husbandId: 'p-martono',
      wifeId: 'p-siti',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-ali',
      husbandId: 'p-ali',
      wifeId: 'p-rini',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-budi',
      husbandId: 'p-budi',
      wifeId: 'p-dewi',
      status: 'divorced',
      unionOrder: 1,
    },
  ];

  return buildGraph(persons, unions);
}

describe('computeBookPagination', () => {
  it('keeps an entire small subtree on a single page when it fits within capacity', () => {
    const graph = buildMultiGenerationTree();
    const settings = makeBookSettings({
      scope: {
        branchId: null,
        subtreeRootPersonId: 'p-ali',
        minGeneration: 1,
        maxGeneration: 99,
      },
      paper: {
        ...DEFAULT_EXPORT_SETTINGS.paper,
        sizeId: 'A4',
        orientation: 'landscape',
      },
      scale: {
        ...DEFAULT_EXPORT_SETTINGS.scale,
        minFontPt: 8,
      },
    });

    const result = computeBookPagination(graph, settings);
    expect(result.totalPages).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].parentPageNumber).toBeNull();
    expect(result.pages[0].continuations).toEqual([]);
    expect(result.pages[0].includedPersonIds).toEqual(
      new Set(['p-ali', 'p-rini', 'p-tegar', 'p-nadia']),
    );
  });

  it('partitions multi-generation trees across pages with two-pass continuation cross-references and lineage breadcrumbs', () => {
    const graph = buildMultiGenerationTree();
    const settings = makeBookSettings({
      paper: {
        ...DEFAULT_EXPORT_SETTINGS.paper,
        sizeId: 'A4',
        orientation: 'portrait',
        marginMm: 8,
      },
      scale: {
        ...DEFAULT_EXPORT_SETTINGS.scale,
        minFontPt: 10,
      },
    });

    const result = computeBookPagination(graph, settings);
    expect(result.totalPages).toBeGreaterThan(1);

    const pageByNum = new Map(result.pages.map((p) => [p.pageNumber, p]));

    // Every continuation marker on a parent page must match the target page's parentPageNumber
    for (const page of result.pages) {
      expect(page.scene.nodeBounds.size).toBeGreaterThan(0);

      for (const marker of page.continuations) {
        const targetPage = pageByNum.get(marker.targetPageNumber);
        expect(targetPage).toBeDefined();
        expect(targetPage?.parentPageNumber).toBe(page.pageNumber);
        expect(targetPage?.rootPersonId).toBe(marker.personId);

        // Parent scene primitives must contain the "→ hal. X" continuation badge text
        const textPrimitives = page.scene.primitives.filter(
          (p): p is SceneText => p.kind === 'text',
        );
        expect(
          textPrimitives.some((t) => t.text.includes(`→ hal. ${marker.targetPageNumber}`)),
        ).toBe(true);
      }

      // Every card node must fit completely inside the scene bounds (no card cut in half)
      for (const bounds of page.scene.nodeBounds.values()) {
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.scene.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.scene.height);
      }
    }

    // Verify every person in the graph appears in at least one page
    const coveredPersonIds = new Set<string>();
    for (const page of result.pages) {
      for (const pid of page.includedPersonIds) {
        coveredPersonIds.add(pid);
      }
    }
    expect(coveredPersonIds.size).toBe(graph.persons.size);

    // Verify lineage breadcrumb on continuation pages (e.g. Sukar -> Sukijah -> Ali Mahmudi)
    const aliContinuationPage = result.pages.find(
      (p) => p.rootPersonId === 'p-ali' && p.parentPageNumber !== null,
    );
    if (aliContinuationPage) {
      expect(aliContinuationPage.lineageBreadcrumb).toEqual([
        'Sukar',
        'Sukijah',
        'Ali Mahmudi',
      ]);
    } else {
      const sukijahPage = result.pages.find(
        (p) => p.rootPersonId === 'p-sukijah' && p.parentPageNumber !== null,
      );
      expect(sukijahPage).toBeDefined();
      expect(sukijahPage?.lineageBreadcrumb).toEqual(['Sukar', 'Sukijah']);
    }
  });

  it('splits wide sibling lists onto continuation pages when even 2 generations exceed page width', () => {
    const persons: Person[] = [
      makePerson({ id: 'p-root', fullName: 'Leluhur Utama', gender: 'L' }),
      makePerson({
        id: 'p-spouse',
        fullName: 'Pasangan Utama',
        gender: 'P',
        isBloodLine: false,
      }),
    ];
    for (let i = 1; i <= 8; i++) {
      persons.push(
        makePerson({
          id: `p-child-${i}`,
          fullName: `Anak Ke-${i}`,
          gender: i % 2 === 0 ? 'P' : 'L',
          parentUnionId: 'u-root',
          birthOrder: i,
        }),
      );
    }
    const graph = buildGraph(persons, [
      {
        id: 'u-root',
        husbandId: 'p-root',
        wifeId: 'p-spouse',
        status: 'married',
        unionOrder: 1,
      },
    ]);

    const settings = makeBookSettings({
      paper: {
        ...DEFAULT_EXPORT_SETTINGS.paper,
        sizeId: 'A4',
        orientation: 'portrait',
        marginMm: 10,
      },
      scale: {
        ...DEFAULT_EXPORT_SETTINGS.scale,
        minFontPt: 10,
      },
    });

    const result = computeBookPagination(graph, settings);
    expect(result.totalPages).toBeGreaterThan(1);

    const coveredChildren = new Set<string>();
    for (const page of result.pages) {
      for (const pid of page.includedPersonIds) {
        if (pid.startsWith('p-child-')) {
          coveredChildren.add(pid);
        }
      }
    }
    expect(coveredChildren.size).toBe(8);
  });

  it('returns empty pagination when scope yields zero persons', () => {
    const graph = buildMultiGenerationTree();
    const settings = makeBookSettings({
      scope: {
        branchId: null,
        subtreeRootPersonId: 'p-non-existent',
        minGeneration: 1,
        maxGeneration: 99,
      },
    });

    const result = computeBookPagination(graph, settings);
    expect(result.totalPages).toBe(0);
    expect(result.pages).toEqual([]);
  });
});

describe('generateBookPdfBlob', () => {
  it('generates a valid non-empty PDF Blob with cover page, vector pages, and progress callbacks across themes', async () => {
    const graph = buildMultiGenerationTree();

    for (const theme of ['color', 'ink-saver', 'monochrome'] as const) {
      const progressPhases: string[] = [];
      const settings = makeBookSettings({
        theme,
        paper: {
          ...DEFAULT_EXPORT_SETTINGS.paper,
          sizeId: 'A4',
          orientation: 'portrait',
        },
        scale: {
          ...DEFAULT_EXPORT_SETTINGS.scale,
          minFontPt: 10,
        },
        meta: {
          ...DEFAULT_EXPORT_SETTINGS.meta,
          includeCoverPage: true,
          includeLegend: true,
          includeFooter: true,
        },
      });

      const blob = await generateBookPdfBlob(graph, settings, {
        onProgress: (p) => progressPhases.push(p.phase),
      });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(1000);
      expect(blob.type).toContain('pdf');
      expect(progressPhases[0]).toBe('preparing');
      expect(progressPhases).toContain('rendering');
      expect(progressPhases[progressPhases.length - 1]).toBe('done');

      const headerText = await blob.slice(0, 8).text();
      expect(headerText).toContain('%PDF-');

      // Verify continuation markers are sanitized to WinAnsi "-> hal." (not garbled UTF-16BE)
      if (theme === 'color') {
        const rawBytes = Buffer.from(await blob.arrayBuffer());
        const rawStr = rawBytes.toString('latin1');
        const inflatedStreams: string[] = [];
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match: RegExpExecArray | null;
        while ((match = streamRegex.exec(rawStr)) !== null) {
          try {
            const decompressed = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
            inflatedStreams.push(decompressed);
          } catch {
            // Non-zlib stream
          }
        }
        const combinedStreams = inflatedStreams.join('\n');
        expect(combinedStreams).toContain('-> hal.');
        expect(combinedStreams).not.toContain('h a l .');
      }
    }
  });

  it('supports aborting via AbortSignal and generating without cover page', async () => {
    const graph = buildMultiGenerationTree();
    const settings = makeBookSettings({
      meta: {
        ...DEFAULT_EXPORT_SETTINGS.meta,
        includeCoverPage: false,
        includeLegend: false,
        includeFooter: false,
      },
    });

    const noCoverBlob = await generateBookPdfBlob(graph, settings);
    expect(noCoverBlob.size).toBeGreaterThan(500);

    const controller = new AbortController();
    controller.abort();
    const onProgress = vi.fn();

    await expect(
      generateBookPdfBlob(graph, settings, {
        signal: controller.signal,
        onProgress,
      }),
    ).rejects.toThrow();
    expect(onProgress).not.toHaveBeenCalled();
  });
});
