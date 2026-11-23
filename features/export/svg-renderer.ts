import { getPrintThemePalette, PRINT_THEMES, type PrintThemeTokens } from './theme';
import type {
  PrintThemeId,
  SceneBoundsRect,
  SceneImage,
  ScenePrimitive,
  ExportScene,
} from './types';

export interface SvgRenderOptions {
  title?: string;
  subtitle?: string;
  includeHeader?: boolean;
  includeLegend?: boolean;
  theme?: PrintThemeId;
  width?: number | string;
  height?: number | string;
  fontFamily?: string;
  ariaLabel?: string;
}

const DEFAULT_FONT_FAMILY =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

const FONT_WEIGHT_MAP = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeSvgId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || 'node';
}

function inferThemeFromScene(scene: ExportScene, explicitTheme?: PrintThemeId): PrintThemeTokens {
  if (explicitTheme) {
    return getPrintThemePalette(explicitTheme);
  }
  const bg = scene.backgroundColor.toLowerCase();
  if (bg === PRINT_THEMES['ink-saver'].backgroundColor.toLowerCase()) {
    return PRINT_THEMES['ink-saver'];
  }
  return PRINT_THEMES.color;
}

function renderPrimitive(
  prim: ScenePrimitive,
  clipIdMap: Map<SceneImage, string>,
): string {
  switch (prim.kind) {
    case 'rect': {
      const attrs = [
        `x="${prim.x}"`,
        `y="${prim.y}"`,
        `width="${prim.width}"`,
        `height="${prim.height}"`,
        prim.rx !== undefined ? `rx="${prim.rx}"` : '',
        `fill="${escapeXml(prim.fill)}"`,
        prim.stroke ? `stroke="${escapeXml(prim.stroke)}"` : '',
        prim.strokeWidth !== undefined ? `stroke-width="${prim.strokeWidth}"` : '',
        prim.strokeDasharray
          ? `stroke-dasharray="${escapeXml(prim.strokeDasharray)}"`
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<rect ${attrs} />`;
    }
    case 'circle': {
      const attrs = [
        `cx="${prim.cx}"`,
        `cy="${prim.cy}"`,
        `r="${prim.r}"`,
        `fill="${escapeXml(prim.fill)}"`,
        prim.stroke ? `stroke="${escapeXml(prim.stroke)}"` : '',
        prim.strokeWidth !== undefined ? `stroke-width="${prim.strokeWidth}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<circle ${attrs} />`;
    }
    case 'path': {
      const attrs = [
        `d="${escapeXml(prim.d)}"`,
        `fill="${escapeXml(prim.fill ?? 'none')}"`,
        `stroke="${escapeXml(prim.stroke)}"`,
        `stroke-width="${prim.strokeWidth}"`,
        'stroke-linecap="round"',
        'stroke-linejoin="round"',
        prim.strokeDasharray
          ? `stroke-dasharray="${escapeXml(prim.strokeDasharray)}"`
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<path ${attrs} />`;
    }
    case 'text': {
      const attrs = [
        `x="${prim.x}"`,
        `y="${prim.y}"`,
        `font-size="${prim.fontSize}"`,
        `font-weight="${FONT_WEIGHT_MAP[prim.fontWeight]}"`,
        `fill="${escapeXml(prim.fill)}"`,
        prim.anchor ? `text-anchor="${prim.anchor}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<text ${attrs}>${escapeXml(prim.text)}</text>`;
    }
    case 'image': {
      const clipId = clipIdMap.get(prim);
      const attrs = [
        `href="${escapeXml(prim.href)}"`,
        `x="${prim.x}"`,
        `y="${prim.y}"`,
        `width="${prim.width}"`,
        `height="${prim.height}"`,
        'preserveAspectRatio="xMidYMid slice"',
        clipId ? `clip-path="url(#${clipId})"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<image ${attrs} />`;
    }
  }
}

function buildAvatarClipDefs(
  primitives: ScenePrimitive[],
  idPrefix: string,
): { defs: string; clipIdMap: Map<SceneImage, string> } {
  const clipIdMap = new Map<SceneImage, string>();
  const clipPaths: string[] = [];
  let idx = 0;

  for (const prim of primitives) {
    if (prim.kind === 'image' && prim.clipCircle) {
      const clipId = `${idPrefix}-${idx}-${sanitizeSvgId(prim.personId)}`;
      idx += 1;
      clipIdMap.set(prim, clipId);
      const cx = prim.x + prim.width / 2;
      const cy = prim.y + prim.height / 2;
      const r = Math.min(prim.width, prim.height) / 2;
      clipPaths.push(
        `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}" /></clipPath>`,
      );
    }
  }

  return {
    defs: clipPaths.join(''),
    clipIdMap,
  };
}

function renderHeaderGroup(
  width: number,
  headerHeight: number,
  title: string | undefined,
  subtitle: string | undefined,
  palette: PrintThemeTokens,
): string {
  const parts: string[] = [];
  if (title) {
    parts.push(
      `<text x="24" y="28" font-size="18" font-weight="700" fill="${escapeXml(palette.textPrimary)}">${escapeXml(title)}</text>`,
    );
  }
  if (subtitle) {
    parts.push(
      `<text x="24" y="${title ? 46 : 28}" font-size="12" font-weight="500" fill="${escapeXml(palette.textSecondary)}">${escapeXml(subtitle)}</text>`,
    );
  }
  parts.push(
    `<line x1="24" y1="${headerHeight - 6}" x2="${width - 24}" y2="${headerHeight - 6}" stroke="${escapeXml(palette.legendBorder)}" stroke-width="1" />`,
  );
  return `<g data-role="document-header">${parts.join('')}</g>`;
}

function renderLegendGroup(
  yOffset: number,
  width: number,
  legendHeight: number,
  palette: PrintThemeTokens,
): string {
  const cy = yOffset + legendHeight / 2;
  const textY = cy + 3.5;
  const parts: string[] = [
    `<line x1="24" y1="${yOffset + 2}" x2="${width - 24}" y2="${yOffset + 2}" stroke="${escapeXml(palette.legendBorder)}" stroke-width="1" />`,
  ];

  let x = 24;

  // 1. Nasab (solid card)
  parts.push(
    `<rect x="${x}" y="${cy - 6}" width="16" height="12" rx="3" fill="${escapeXml(palette.cardBloodBg)}" stroke="${escapeXml(palette.cardBorder)}" stroke-width="1.2" />`,
  );
  parts.push(
    `<text x="${x + 22}" y="${textY}" font-size="10.5" font-weight="500" fill="${escapeXml(palette.textSecondary)}">Keturunan (Nasab)</text>`,
  );
  x += 132;

  // 2. Menantu (dashed card)
  parts.push(
    `<rect x="${x}" y="${cy - 6}" width="16" height="12" rx="3" fill="${escapeXml(palette.cardSpouseBg)}" stroke="${escapeXml(palette.cardSpouseBorder)}" stroke-width="1.2" stroke-dasharray="3 2" />`,
  );
  parts.push(
    `<text x="${x + 22}" y="${textY}" font-size="10.5" font-weight="500" fill="${escapeXml(palette.textSecondary)}">Pasangan / Menantu</text>`,
  );
  x += 144;

  // 3. Menikah (solid line)
  parts.push(
    `<line x1="${x}" y1="${cy}" x2="${x + 20}" y2="${cy}" stroke="${escapeXml(palette.edgeMarried)}" stroke-width="1.75" />`,
  );
  parts.push(
    `<text x="${x + 26}" y="${textY}" font-size="10.5" font-weight="500" fill="${escapeXml(palette.textSecondary)}">Menikah</text>`,
  );
  x += 84;

  // 4. Bercerai (dashed line + //)
  parts.push(
    `<line x1="${x}" y1="${cy}" x2="${x + 20}" y2="${cy}" stroke="${escapeXml(palette.edgeDivorced)}" stroke-width="1.75" stroke-dasharray="4 3" />`,
  );
  parts.push(
    `<text x="${x + 10}" y="${cy - 4}" font-size="8.5" font-weight="700" text-anchor="middle" fill="${escapeXml(palette.edgeDivorced)}">//</text>`,
  );
  parts.push(
    `<text x="${x + 26}" y="${textY}" font-size="10.5" font-weight="500" fill="${escapeXml(palette.textSecondary)}">Bercerai</text>`,
  );
  x += 84;

  // 5. Hidup vs Wafat (Alm./Almh.)
  parts.push(
    `<circle cx="${x + 5}" cy="${cy}" r="4" fill="${escapeXml(palette.aliveDotFill)}" />`,
  );
  parts.push(
    `<text x="${x + 14}" y="${textY}" font-size="10.5" font-weight="500" fill="${escapeXml(palette.textSecondary)}">Hidup</text>`,
  );
  x += 58;

  parts.push(
    `<circle cx="${x + 5}" cy="${cy}" r="4" fill="${escapeXml(palette.deceasedDotFill)}" stroke="${escapeXml(palette.deceasedDotStroke)}" stroke-width="1.2" />`,
  );
  parts.push(
    `<text x="${x + 14}" y="${textY}" font-size="10.5" font-weight="500" fill="${escapeXml(palette.textSecondary)}">Wafat (Alm./Almh.)</text>`,
  );

  return `<g data-role="legend">${parts.join('')}</g>`;
}

export function renderSceneToSvgString(
  scene: ExportScene,
  options?: SvgRenderOptions,
): string {
  const palette = inferThemeFromScene(scene, options?.theme);
  const fontFamily = options?.fontFamily ?? DEFAULT_FONT_FAMILY;

  const hasTitle = Boolean(options?.title?.trim());
  const hasSubtitle = Boolean(options?.subtitle?.trim());
  const showHeader = Boolean(options?.includeHeader && (hasTitle || hasSubtitle));
  const showLegend = Boolean(options?.includeLegend);

  const headerHeight = showHeader ? (hasTitle && hasSubtitle ? 60 : 42) : 0;
  const legendHeight = showLegend ? 40 : 0;

  const totalWidth = showLegend ? Math.max(scene.width, 660) : scene.width;
  const totalHeight = scene.height + headerHeight + legendHeight;
  const sceneShiftX = totalWidth > scene.width ? (totalWidth - scene.width) / 2 : 0;

  const { defs, clipIdMap } = buildAvatarClipDefs(scene.primitives, 'clip-avatar');
  const bodyPrimitives = scene.primitives
    .map((prim) => renderPrimitive(prim, clipIdMap))
    .join('');

  const widthAttr = options?.width ?? totalWidth;
  const heightAttr = options?.height ?? totalHeight;
  const ariaAttr = options?.ariaLabel
    ? ` role="img" aria-label="${escapeXml(options.ariaLabel)}"`
    : '';

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${widthAttr}" height="${heightAttr}"${ariaAttr}>`,
    `<defs>`,
    `<style>text { font-family: ${escapeXml(fontFamily)}; }</style>`,
    defs,
    `</defs>`,
    `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${escapeXml(scene.backgroundColor)}" />`,
  ];

  if (showHeader) {
    parts.push(
      renderHeaderGroup(
        totalWidth,
        headerHeight,
        options?.title?.trim(),
        options?.subtitle?.trim(),
        palette,
      ),
    );
  }

  if (headerHeight > 0 || sceneShiftX > 0) {
    parts.push(
      `<g data-role="scene-content" transform="translate(${sceneShiftX}, ${headerHeight})">${bodyPrimitives}</g>`,
    );
  } else {
    parts.push(`<g data-role="scene-content">${bodyPrimitives}</g>`);
  }

  if (showLegend) {
    parts.push(
      renderLegendGroup(
        headerHeight + scene.height,
        totalWidth,
        legendHeight,
        palette,
      ),
    );
  }

  parts.push(`</svg>`);
  return parts.join('');
}

function primitiveIntersectsCrop(
  prim: ScenePrimitive,
  cropRect: SceneBoundsRect,
): boolean {
  const margin = 12;
  const minX = cropRect.x - margin;
  const minY = cropRect.y - margin;
  const maxX = cropRect.x + cropRect.width + margin;
  const maxY = cropRect.y + cropRect.height + margin;

  switch (prim.kind) {
    case 'rect':
    case 'image':
      return (
        prim.x + prim.width >= minX &&
        prim.x <= maxX &&
        prim.y + prim.height >= minY &&
        prim.y <= maxY
      );
    case 'circle':
      return (
        prim.cx + prim.r >= minX &&
        prim.cx - prim.r <= maxX &&
        prim.cy + prim.r >= minY &&
        prim.cy - prim.r <= maxY
      );
    case 'text': {
      const approxWidth = Math.max(24, prim.text.length * prim.fontSize * 0.7);
      const startX =
        prim.anchor === 'end'
          ? prim.x - approxWidth
          : prim.anchor === 'middle'
            ? prim.x - approxWidth / 2
            : prim.x;
      const endX = startX + approxWidth;
      return (
        endX >= minX &&
        startX <= maxX &&
        prim.y + prim.fontSize >= minY &&
        prim.y - prim.fontSize * 1.5 <= maxY
      );
    }
    case 'path':
      // Always keep paths so long bezier edges crossing through a tile are never clipped out
      return true;
  }
}

export function renderTileCropToSvgString(
  scene: ExportScene,
  cropRect: SceneBoundsRect,
  options?: Pick<SvgRenderOptions, 'width' | 'height' | 'fontFamily' | 'ariaLabel'>,
): string {
  const fontFamily = options?.fontFamily ?? DEFAULT_FONT_FAMILY;
  const visiblePrimitives = scene.primitives.filter((prim) =>
    primitiveIntersectsCrop(prim, cropRect),
  );
  const { defs, clipIdMap } = buildAvatarClipDefs(
    visiblePrimitives,
    'clip-tile-avatar',
  );
  const body = visiblePrimitives
    .map((prim) => renderPrimitive(prim, clipIdMap))
    .join('');

  const widthAttr = options?.width ?? cropRect.width;
  const heightAttr = options?.height ?? cropRect.height;
  const ariaAttr = options?.ariaLabel
    ? ` role="img" aria-label="${escapeXml(options.ariaLabel)}"`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cropRect.x} ${cropRect.y} ${cropRect.width} ${cropRect.height}" width="${widthAttr}" height="${heightAttr}" preserveAspectRatio="xMidYMid meet"${ariaAttr}>`,
    `<defs>`,
    `<style>text { font-family: ${escapeXml(fontFamily)}; }</style>`,
    defs,
    `</defs>`,
    `<rect x="${cropRect.x}" y="${cropRect.y}" width="${cropRect.width}" height="${cropRect.height}" fill="${escapeXml(scene.backgroundColor)}" />`,
    `<g data-role="tile-crop">${body}</g>`,
    `</svg>`,
  ].join('');
}
