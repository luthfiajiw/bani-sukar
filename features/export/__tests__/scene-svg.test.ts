import { describe, expect, it } from 'vitest';
import { buildGraph } from '@/features/family/graph';
import { computeLayout } from '@/features/family/layout';
import type { Person, TreeLayoutResult, Union } from '@/features/family/types';
import { CARD_PRESETS, DEFAULT_EXPORT_SETTINGS } from '../constants';
import { buildExportScene } from '../scene';
import {
  renderSceneToSvgString,
  renderTileCropToSvgString,
} from '../svg-renderer';
import { getPrintThemePalette, PRINT_THEMES } from '../theme';
import type {
  ExportSettings,
  FittedPersonCardMetric,
  PrintThemeId,
  SceneCircle,
  SceneImage,
  ScenePath,
  SceneRect,
  SceneText,
} from '../types';

function makePerson(overrides: Partial<Person> & { id: string; fullName: string }): Person {
  return {
    nickname: null,
    gender: 'L',
    birthPlace: null,
    birthDate: null,
    isDeceased: false,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: null,
    birthOrder: null,
    photoPath: null,
    photoUrl: null,
    ...overrides,
  };
}

function makeSampleFamily() {
  const persons: Person[] = [
    makePerson({
      id: 'p-sukar',
      fullName: 'Sukar Hadiwijaya',
      nickname: 'Mbah Sukar',
      gender: 'L',
      birthPlace: 'Klaten',
      birthDate: '1930-01-01',
      deathDate: '1998-05-12',
      isDeceased: true,
      isBloodLine: true,
    }),
    makePerson({
      id: 'p-sadirah',
      fullName: 'Sadirah',
      nickname: 'Mbah Dirah',
      gender: 'P',
      birthPlace: 'Solo',
      birthDate: '1935-04-02',
      deathDate: '2010-08-20',
      isDeceased: true,
      isBloodLine: false,
    }),
    makePerson({
      id: 'p-ali',
      fullName: 'Ali Mahmudi Kusuma Negara',
      nickname: 'Mas Ali',
      gender: 'L',
      birthPlace: 'Yogyakarta',
      birthDate: '1965-03-15',
      isDeceased: false,
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 1,
    }),
    makePerson({
      id: 'p-siti',
      fullName: 'Siti Aminah',
      gender: 'P',
      birthDate: '1968-07-07',
      isDeceased: false,
      isBloodLine: false,
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
      id: 'u-div',
      husbandId: 'p-ali',
      wifeId: 'p-siti',
      status: 'divorced',
      unionOrder: 1,
    },
  ];

  const graph = buildGraph(persons, unions);
  const layout = computeLayout(graph);
  return { persons, unions, graph, layout };
}

function makeSettings(overrides?: Partial<ExportSettings>): ExportSettings {
  return {
    ...DEFAULT_EXPORT_SETTINGS,
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

describe('theme palettes', () => {
  it('defines distinct palettes for color, ink-saver, and monochrome', () => {
    const color = getPrintThemePalette('color');
    const inkSaver = getPrintThemePalette('ink-saver');
    const mono = getPrintThemePalette('monochrome');

    expect(color.backgroundColor).toBe('#fdf9f1');
    expect(color.cardBloodBg).toBe('#ffffff');
    expect(color.cardSpouseBg).toBe('#f7f3eb');
    expect(color.edgeNasab).toBe('#8a7265');
    expect(color.edgeDivorced).toBe('#ba1a1a');

    expect(inkSaver.backgroundColor).toBe('#ffffff');
    expect(inkSaver.cardBloodBg).toBe('#ffffff');
    expect(inkSaver.cardSpouseBg).toBe('#ffffff');
    expect(inkSaver.cardStrokeWidth).toBeLessThan(color.cardStrokeWidth);

    expect(mono.backgroundColor).toBe('#ffffff');
    expect(mono.aliveDotFill).toBe('#111111');
    expect(mono.deceasedDotFill).toBe('#ffffff');
    expect(mono.deceasedDotStroke).toBe('#111111');
    expect(Object.keys(PRINT_THEMES)).toEqual(['color', 'ink-saver', 'monochrome']);
  });
});

describe('buildExportScene', () => {
  it('normalizes bounding boxes and builds primitives across all 3 themes', () => {
    const { layout } = makeSampleFamily();

    for (const theme of ['color', 'ink-saver', 'monochrome'] as PrintThemeId[]) {
      const settings = makeSettings({ theme });
      const scene = buildExportScene(layout, settings);

      expect(scene.width).toBeGreaterThan(0);
      expect(scene.height).toBeGreaterThan(0);
      expect(scene.backgroundColor).toBe(getPrintThemePalette(theme).backgroundColor);
      expect(scene.nodeBounds.size).toBe(layout.nodes.length);

      const rects = scene.primitives.filter((p): p is SceneRect => p.kind === 'rect');
      const texts = scene.primitives.filter((p): p is SceneText => p.kind === 'text');
      const paths = scene.primitives.filter((p): p is ScenePath => p.kind === 'path');
      const circles = scene.primitives.filter((p): p is SceneCircle => p.kind === 'circle');

      expect(rects.length).toBeGreaterThanOrEqual(4);
      expect(paths.length).toBeGreaterThan(0);
      expect(circles.length).toBeGreaterThanOrEqual(2);

      // Alm. for male deceased, Almh. for female deceased, never cross symbol
      const allText = texts.map((t) => t.text).join(' ');
      expect(allText).toContain('Alm.');
      expect(allText).toContain('Almh.');
      expect(allText).not.toContain('†');

      // Divorced union renders // marker and dashed edge
      expect(texts.some((t) => t.text === '//')).toBe(true);
      expect(paths.some((p) => p.strokeDasharray === '6 4')).toBe(true);

      // Non-bloodline card has dashed border
      const sadiBounds = scene.nodeBounds.get('p-sadirah');
      expect(sadiBounds).toBeDefined();
      const sadiCardRect = rects.find(
        (r) =>
          r.x === sadiBounds?.x &&
          r.y === sadiBounds?.y &&
          r.width === sadiBounds?.width,
      );
      expect(sadiCardRect?.strokeDasharray).toBe('4 3');
    }
  });

  it('supports card presets and toggles (full, compact, minimal, custom)', () => {
    const { layout } = makeSampleFamily();

    const minimalSettings = makeSettings({
      cardPreset: 'minimal',
      cardToggles: { ...CARD_PRESETS.minimal.toggles },
    });
    const minimalScene = buildExportScene(layout, minimalSettings);
    const minimalTexts = minimalScene.primitives
      .filter((p): p is SceneText => p.kind === 'text')
      .map((t) => t.text);

    // Minimal hides nickname, generation badge, gender icon, birthPlace/year
    expect(minimalTexts.some((t) => t.includes('Mbah Sukar'))).toBe(false);
    expect(minimalTexts.some((t) => t === 'G1')).toBe(false);
    expect(minimalTexts.some((t) => t.includes('Klaten'))).toBe(false);
    // Minimal still shows Alm. / Almh. and full name
    expect(minimalTexts.join(' ')).toContain('Alm. Sukar');

    // No-deceased-badge toggle removes Alm. / Almh.
    const noDeceased = makeSettings({
      cardToggles: {
        ...DEFAULT_EXPORT_SETTINGS.cardToggles,
        deceasedBadge: false,
      },
    });
    const noDeceasedScene = buildExportScene(layout, noDeceased);
    const noDeceasedText = noDeceasedScene.primitives
      .filter((p): p is SceneText => p.kind === 'text')
      .map((t) => t.text)
      .join(' ');
    expect(noDeceasedText).not.toContain('Alm.');
    expect(noDeceasedText).not.toContain('Almh.');
  });

  it('embeds photo SceneImage when photoMap provides URL and falls back to initials otherwise', () => {
    const { layout } = makeSampleFamily();
    const photoMap = new Map<string, string>([
      ['p-sukar', 'data:image/png;base64,AAAA'],
    ]);

    const scene = buildExportScene(layout, makeSettings(), { photoMap });
    const images = scene.primitives.filter((p): p is SceneImage => p.kind === 'image');
    expect(images).toHaveLength(1);
    expect(images[0].personId).toBe('p-sukar');
    expect(images[0].clipCircle).toBe(true);

    // Sadirah without photo renders initials "SA"
    const texts = scene.primitives.filter((p): p is SceneText => p.kind === 'text');
    expect(texts.some((t) => t.text === 'SA')).toBe(true);
  });

  it('uses fittedMetrics when provided and never truncates long names with ellipsis', () => {
    const { layout } = makeSampleFamily();
    const fittedMetrics = new Map<string, FittedPersonCardMetric>([
      [
        'p-ali',
        {
          personId: 'p-ali',
          width: 200,
          height: 118,
          nameFontSizePx: 10,
          nameLines: ['Ali Mahmudi', 'Kusuma Negara'],
          deceasedPrefix: null,
        },
      ],
    ]);

    const scene = buildExportScene(layout, makeSettings(), { fittedMetrics });
    expect(scene.nodeBounds.get('p-ali')?.height).toBe(118);

    const texts = scene.primitives
      .filter((p): p is SceneText => p.kind === 'text')
      .map((t) => t.text);
    expect(texts).toContain('Ali Mahmudi');
    expect(texts).toContain('Kusuma Negara');
    expect(texts.some((t) => t.includes('…'))).toBe(false);
  });

  it('renders LEFT_RIGHT horizontal bezier curves and continuation badges', () => {
    const { layout } = makeSampleFamily();
    // Simulate a LEFT_RIGHT layout node with continuationLabel
    const lrLayout: TreeLayoutResult = {
      ...layout,
      nodes: layout.nodes.map((node) => {
        const flipped = {
          ...node,
          position: { x: node.position.y, y: node.position.x },
        };
        if (node.id === 'p-ali') {
          return {
            ...flipped,
            data: {
              ...(node.data as TreeLayoutResult['nodes'][number]['data']),
              continuationLabel: '→ hal. 7',
            },
          };
        }
        return flipped;
      }),
      edges: layout.edges.map((edge) => ({
        ...edge,
        sourceHandle:
          edge.sourceHandle === 'bottom'
            ? 'right'
            : edge.sourceHandle === 'right'
              ? 'bottom'
              : edge.sourceHandle === 'left'
                ? 'top'
                : edge.sourceHandle,
        targetHandle:
          edge.targetHandle === 'top'
            ? 'left'
            : edge.targetHandle === 'left'
              ? 'top'
              : edge.targetHandle === 'right'
                ? 'bottom'
                : edge.targetHandle,
      })),
    };

    const scene = buildExportScene(
      lrLayout,
      makeSettings({ treeOrientation: 'LEFT_RIGHT' }),
    );
    const texts = scene.primitives.filter((p): p is SceneText => p.kind === 'text');
    expect(texts.some((t) => t.text === '→ hal. 7')).toBe(true);

    const paths = scene.primitives.filter((p): p is ScenePath => p.kind === 'path');
    const cubicEdge = paths.find((p) => p.d.includes(' C '));
    expect(cubicEdge).toBeDefined();
  });

  it('places continuation pill below card footer without overlap or bottom clipping', () => {
    const person = makePerson({
      id: 'p-cont',
      fullName: 'Siti Aminah',
      gender: 'P',
      birthPlace: 'Pati',
      birthDate: '1948-01-01',
      deathDate: '2014-05-05',
      isDeceased: true,
      isBloodLine: true,
    });
    const graph = buildGraph([person], []);
    const layout = computeLayout(graph);

    const scene = buildExportScene(layout, makeSettings(), {
      outerPaddingPx: 0,
      continuationLabels: new Map([['p-cont', '→ hal. 7']]),
    });

    const cardBounds = scene.nodeBounds.get('p-cont');
    expect(cardBounds).toBeDefined();
    if (!cardBounds) return;

    const rects = scene.primitives.filter((p): p is SceneRect => p.kind === 'rect');
    const texts = scene.primitives.filter((p): p is SceneText => p.kind === 'text');

    const badgeText = texts.find((t) => t.text === '→ hal. 7');
    expect(badgeText).toBeDefined();
    if (!badgeText) return;

    const badgeRect = rects.find((r) => r.rx === 8 && r.height === 16);
    expect(badgeRect).toBeDefined();
    if (!badgeRect) return;

    const footerMetaText = texts.find((t) => t.text.includes('1948'));
    expect(footerMetaText).toBeDefined();
    if (!footerMetaText) return;

    // Pill sits below the card bottom border and well below footer text baseline
    expect(badgeRect.y).toBeGreaterThanOrEqual(cardBounds.y + cardBounds.height);
    expect(badgeRect.y).toBeGreaterThan(footerMetaText.y);

    // Badge label sits inside the pill rect
    expect(badgeText.y).toBeGreaterThan(badgeRect.y);
    expect(badgeText.y).toBeLessThan(badgeRect.y + badgeRect.height);

    // Pill is not clipped by scene.height even with outerPaddingPx: 0
    expect(badgeRect.y + badgeRect.height).toBeLessThanOrEqual(scene.height);
  });

  it('uses monochrome hollow circle for deceased vs solid circle for alive', () => {
    const { layout } = makeSampleFamily();
    const scene = buildExportScene(layout, makeSettings({ theme: 'monochrome' }));
    const circles = scene.primitives.filter((p): p is SceneCircle => p.kind === 'circle');

    // Deceased status dot in monochrome: hollow (#ffffff fill with #111111 stroke)
    expect(
      circles.some((c) => c.r <= 4 && c.fill === '#ffffff' && c.stroke === '#111111'),
    ).toBe(true);
    // Alive status dot in monochrome: solid (#111111 fill)
    expect(circles.some((c) => c.r <= 4 && c.fill === '#111111')).toBe(true);
  });
});

describe('renderSceneToSvgString & renderTileCropToSvgString', () => {
  it('produces valid standalone SVG with clipPaths, escaped XML, header, and legend', () => {
    const persons: Person[] = [
      makePerson({
        id: 'p-xml',
        fullName: 'Budi <Santoso> & "Putra"',
        nickname: "O'Connor",
        gender: 'L',
        isDeceased: true,
        isBloodLine: true,
      }),
    ];
    const graph = buildGraph(persons, []);
    const layout = computeLayout(graph);
    const photoMap = new Map([['p-xml', 'https://example.com/photo.jpg?a=1&b=2']]);

    const scene = buildExportScene(layout, makeSettings({ theme: 'ink-saver' }), {
      photoMap,
      continuationLabels: new Map([['p-xml', '→ hal. 3']]),
    });

    const svg = renderSceneToSvgString(scene, {
      title: 'Silsilah Bani Sukar & Sadirah',
      subtitle: 'Ranting 1. Sukijah • G1–G3',
      includeHeader: true,
      includeLegend: true,
      theme: 'ink-saver',
    });

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).toContain('<clipPath id="clip-avatar-0-p-xml">');
    expect(svg).toContain('clip-path="url(#clip-avatar-0-p-xml)"');
    expect(svg).toContain('&lt;Santoso&gt; &amp;');
    expect(svg).toContain('&quot;Putra&quot;');
    expect(svg).toContain('&apos;Connor');
    expect(svg).toContain('https://example.com/photo.jpg?a=1&amp;b=2');
    expect(svg).toContain('Silsilah Bani Sukar &amp; Sadirah');
    expect(svg).toContain('data-role="legend"');
    expect(svg).toContain('→ hal. 3');
  });

  it('renders tile crop SVG with matching viewBox for cropRect', () => {
    const { layout } = makeSampleFamily();
    const scene = buildExportScene(layout, makeSettings({ theme: 'color' }));

    const cropSvg = renderTileCropToSvgString(scene, {
      x: 20,
      y: 10,
      width: 300,
      height: 200,
    });

    expect(cropSvg).toContain('viewBox="20 10 300 200"');
    expect(cropSvg).toContain('width="300"');
    expect(cropSvg).toContain('height="200"');
    expect(cropSvg).toContain('data-role="tile-crop"');
  });
});
