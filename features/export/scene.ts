import type {
  Person,
  PersonNodeData,
  TreeLayoutResult,
  UnionNodeData,
} from '@/features/family/types';
import { formatYearRange, getInitials } from '@/lib/format';
import {
  CARD_PRESETS,
  NAME_FONT_SIZE_STEPS_PX,
  MAX_NAME_LINES_BEFORE_SHRINK,
  SCENE_OUTER_PADDING_PX,
} from './constants';
import { getPrintThemePalette, type PrintThemeTokens } from './theme';
import type {
  CardElementToggles,
  ExportScene,
  ExportSettings,
  FittedPersonCardMetric,
  SceneBoundsRect,
  ScenePrimitive,
  TreeOrientation,
} from './types';

const DEFAULT_UNION_SIZE = 28;

export interface BuildExportSceneOptions {
  photoMap?: Map<string, string>;
  fittedMetrics?: Map<string, FittedPersonCardMetric>;
  continuationLabels?: Map<string, string>;
  outerPaddingPx?: number;
}

type LayoutNodeWithOptionalDimensions = TreeLayoutResult['nodes'][number] & {
  width?: number;
  height?: number;
};

type PersonNodeDataWithOptionalContinuation = PersonNodeData & {
  continuationLabel?: string | null;
};

function normalizeSceneOptions(
  options?: BuildExportSceneOptions | Map<string, string>,
): BuildExportSceneOptions {
  if (!options) return {};
  if (options instanceof Map) {
    return { photoMap: options };
  }
  return options;
}

function resolveDeceasedPrefix(
  person: Person,
  toggles: CardElementToggles,
): 'Alm.' | 'Almh.' | null {
  if (!person.isDeceased || !toggles.deceasedBadge) {
    return null;
  }
  return person.gender === 'L' ? 'Alm.' : 'Almh.';
}

function hasDeceasedPrefix(text: string): boolean {
  return /^\s*Almh?\.\s+/i.test(text);
}

function estimateTextWidthPx(text: string, fontSizePx: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === 'i' || ch === 'l' || ch === 'I' || ch === '.' || ch === ',' || ch === ' ') {
      width += fontSizePx * 0.3;
    } else if (ch === 'm' || ch === 'w' || ch === 'M' || ch === 'W') {
      width += fontSizePx * 0.82;
    } else if (ch >= 'A' && ch <= 'Z') {
      width += fontSizePx * 0.66;
    } else {
      width += fontSizePx * 0.54;
    }
  }
  return width;
}

function wrapWordsToLines(
  text: string,
  maxWidthPx: number,
  fontSizePx: number,
): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return [''];

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  const pushWordHardSplit = (word: string) => {
    let chunk = '';
    for (const char of word) {
      const candidate = chunk + char;
      if (chunk && estimateTextWidthPx(candidate, fontSizePx) > maxWidthPx) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) {
      currentLine = chunk;
    }
  };

  for (const word of words) {
    if (!currentLine) {
      if (estimateTextWidthPx(word, fontSizePx) > maxWidthPx) {
        pushWordHardSplit(word);
      } else {
        currentLine = word;
      }
      continue;
    }

    const candidate = `${currentLine} ${word}`;
    if (estimateTextWidthPx(candidate, fontSizePx) <= maxWidthPx) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = '';
      if (estimateTextWidthPx(word, fontSizePx) > maxWidthPx) {
        pushWordHardSplit(word);
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [clean];
}

function fallbackFitName(
  person: Person,
  toggles: CardElementToggles,
  availableTextWidthPx: number,
): {
  nameFontSizePx: number;
  nameLines: string[];
  deceasedPrefix: 'Alm.' | 'Almh.' | null;
} {
  const deceasedPrefix = resolveDeceasedPrefix(person, toggles);
  const displayName =
    deceasedPrefix && !hasDeceasedPrefix(person.fullName)
      ? `${deceasedPrefix} ${person.fullName}`
      : person.fullName;

  for (const stepSize of NAME_FONT_SIZE_STEPS_PX) {
    const wrapped = wrapWordsToLines(displayName, availableTextWidthPx, stepSize);
    if (wrapped.length <= MAX_NAME_LINES_BEFORE_SHRINK) {
      return {
        nameFontSizePx: stepSize,
        nameLines: wrapped,
        deceasedPrefix,
      };
    }
  }

  const minFont = NAME_FONT_SIZE_STEPS_PX[NAME_FONT_SIZE_STEPS_PX.length - 1];
  return {
    nameFontSizePx: minFont,
    nameLines: wrapWordsToLines(displayName, availableTextWidthPx, minFont),
    deceasedPrefix,
  };
}

function fitMetadataSingleLine(text: string, maxWidthPx: number, fontSizePx: number): string {
  if (estimateTextWidthPx(text, fontSizePx) <= maxWidthPx) {
    return text;
  }
  const ellipsis = '…';
  let result = '';
  for (const ch of text) {
    const next = result + ch;
    if (estimateTextWidthPx(next + ellipsis, fontSizePx) > maxWidthPx) {
      break;
    }
    result = next;
  }
  return result ? `${result}${ellipsis}` : '';
}

function normalizeContinuationLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('→')) return trimmed;
  if (/^\d+$/.test(trimmed)) return `→ hal. ${trimmed}`;
  if (/^hal\.?\s*\d+/i.test(trimmed)) return `→ ${trimmed}`;
  return trimmed;
}

function getHandlePoint(
  rect: SceneBoundsRect,
  handle: string | null | undefined,
  fallbackSide: 'top' | 'bottom' | 'left' | 'right',
): { x: number; y: number } {
  const normalized = (handle ?? fallbackSide).replace(/-target$/, '');
  switch (normalized) {
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    default:
      return getHandlePoint(rect, fallbackSide, fallbackSide);
  }
}

function inferSpouseHandles(
  sourceRect: SceneBoundsRect,
  targetRect: SceneBoundsRect,
): { sourceSide: 'top' | 'bottom' | 'left' | 'right'; targetSide: 'top' | 'bottom' | 'left' | 'right' } {
  const scx = sourceRect.x + sourceRect.width / 2;
  const scy = sourceRect.y + sourceRect.height / 2;
  const tcx = targetRect.x + targetRect.width / 2;
  const tcy = targetRect.y + targetRect.height / 2;
  const dx = tcx - scx;
  const dy = tcy - scy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  }
  return dy >= 0
    ? { sourceSide: 'bottom', targetSide: 'top' }
    : { sourceSide: 'top', targetSide: 'bottom' };
}

function createHeartPath(cx: number, cy: number, scale = 0.45): string {
  // Vector heart centered around (cx, cy), approx 12x11px at scale=0.45
  const x0 = (cx).toFixed(2);
  const topY = (cy - 2.2 * scale * 2).toFixed(2);
  const botY = (cy + 5.5 * scale * 2).toFixed(2);
  const rX = (5.8 * scale * 2).toFixed(2);
  const c1X = (cx - 5.8 * scale * 2).toFixed(2);
  const c2X = (cx + 5.8 * scale * 2).toFixed(2);
  const midY = (cy - 5.8 * scale * 2).toFixed(2);
  const lowY = (cy + 1.5 * scale * 2).toFixed(2);
  void rX;
  return [
    `M ${x0} ${botY}`,
    `C ${(cx - 2.2 * scale * 2).toFixed(2)} ${(cy + 3.6 * scale * 2).toFixed(2)}, ${c1X} ${lowY}, ${c1X} ${(cy - 1.6 * scale * 2).toFixed(2)}`,
    `C ${c1X} ${midY}, ${(cx - 1.4 * scale * 2).toFixed(2)} ${midY}, ${x0} ${topY}`,
    `C ${(cx + 1.4 * scale * 2).toFixed(2)} ${midY}, ${c2X} ${midY}, ${c2X} ${(cy - 1.6 * scale * 2).toFixed(2)}`,
    `C ${c2X} ${lowY}, ${(cx + 2.2 * scale * 2).toFixed(2)} ${(cy + 3.6 * scale * 2).toFixed(2)}, ${x0} ${botY}`,
    'Z',
  ].join(' ');
}

function resolveCardDimensions(
  node: LayoutNodeWithOptionalDimensions,
  settings: ExportSettings,
  metric: FittedPersonCardMetric | undefined,
): { width: number; height: number } {
  if (node.type === 'union') {
    return {
      width: node.width ?? DEFAULT_UNION_SIZE,
      height: node.height ?? DEFAULT_UNION_SIZE,
    };
  }

  const preset = CARD_PRESETS[settings.cardPreset] ?? CARD_PRESETS.full;
  return {
    width: metric?.width ?? node.width ?? preset.defaultWidth,
    height: metric?.height ?? node.height ?? preset.defaultHeight,
  };
}

function emitPersonCardPrimitives(
  primitives: ScenePrimitive[],
  rect: SceneBoundsRect,
  data: PersonNodeDataWithOptionalContinuation,
  settings: ExportSettings,
  palette: PrintThemeTokens,
  options: BuildExportSceneOptions,
): void {
  const { person, generation } = data;
  const toggles = settings.cardToggles;
  const metric = options.fittedMetrics?.get(person.id);
  const isCompactCard = rect.height <= 64;
  const padX = isCompactCard ? 8 : 10;
  const padY = isCompactCard ? 6 : 8;
  const hasFooter =
    toggles.genderIcon || toggles.generationBadge || toggles.birthDeathPlaceYear;
  const footerHeight = hasFooter ? 20 : 0;
  const bodyHeight = Math.max(24, rect.height - padY * 2 - footerHeight);

  // 1. Card background & border
  primitives.push({
    kind: 'rect',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rx: isCompactCard ? 8 : 10,
    fill: person.isBloodLine ? palette.cardBloodBg : palette.cardSpouseBg,
    stroke: person.isBloodLine ? palette.cardBorder : palette.cardSpouseBorder,
    strokeWidth: palette.cardStrokeWidth,
    strokeDasharray: person.isBloodLine ? undefined : '4 3',
  });

  // 2. Avatar / Photo
  const avatarDiameter = toggles.photo ? (isCompactCard ? 26 : 32) : 0;
  const avatarRadius = avatarDiameter / 2;
  const avatarGap = toggles.photo ? 8 : 0;

  if (toggles.photo) {
    const avatarCx = rect.x + padX + avatarRadius;
    const avatarCy = rect.y + padY + bodyHeight / 2;

    primitives.push({
      kind: 'circle',
      cx: avatarCx,
      cy: avatarCy,
      r: avatarRadius,
      fill:
        person.gender === 'L' ? palette.avatarMaleBg : palette.avatarFemaleBg,
      stroke:
        person.gender === 'L'
          ? palette.avatarMaleBorder
          : palette.avatarFemaleBorder,
      strokeWidth: 1.5,
    });

    const photoHref = options.photoMap?.get(person.id)?.trim();
    if (photoHref) {
      primitives.push({
        kind: 'image',
        personId: person.id,
        href: photoHref,
        x: avatarCx - avatarRadius,
        y: avatarCy - avatarRadius,
        width: avatarDiameter,
        height: avatarDiameter,
        clipCircle: true,
      });
    } else {
      primitives.push({
        kind: 'text',
        x: avatarCx,
        y: avatarCy + 3.5,
        text: getInitials(person.fullName),
        fontSize: isCompactCard ? 9.5 : 11,
        fontWeight: 'bold',
        fill:
          person.gender === 'L'
            ? palette.cardAccentMale
            : palette.cardAccentFemale,
        anchor: 'middle',
      });
    }

    if (toggles.deceasedBadge) {
      primitives.push({
        kind: 'circle',
        cx: avatarCx + avatarRadius - 3,
        cy: avatarCy + avatarRadius - 3,
        r: 4,
        fill: person.isDeceased ? palette.deceasedDotFill : palette.aliveDotFill,
        stroke: person.isDeceased
          ? palette.deceasedDotStroke
          : person.isBloodLine
            ? palette.cardBloodBg
            : palette.cardSpouseBg,
        strokeWidth: 1.5,
      });
    }
  } else if (toggles.deceasedBadge) {
    // Status dot at top-right when photo is hidden
    primitives.push({
      kind: 'circle',
      cx: rect.x + rect.width - padX - 4,
      cy: rect.y + padY + 5,
      r: 3.5,
      fill: person.isDeceased ? palette.deceasedDotFill : palette.aliveDotFill,
      stroke: person.isDeceased
        ? palette.deceasedDotStroke
        : person.isBloodLine
          ? palette.cardBloodBg
          : palette.cardSpouseBg,
      strokeWidth: 1.25,
    });
  }

  // 3. Name + optional nickname
  const textX = rect.x + padX + avatarDiameter + avatarGap;
  const rightDotReserve = !toggles.photo && toggles.deceasedBadge ? 12 : 0;
  const availableTextWidth = Math.max(
    40,
    rect.width - padX * 2 - avatarDiameter - avatarGap - rightDotReserve,
  );

  let nameFontSizePx: number;
  let nameLines: string[];

  if (metric && metric.nameLines.length > 0) {
    nameFontSizePx = metric.nameFontSizePx;
    const prefix = resolveDeceasedPrefix(person, toggles);
    const joined = metric.nameLines.join(' ');
    if (prefix && !hasDeceasedPrefix(joined)) {
      const prefixed = `${prefix} ${joined}`;
      nameLines = wrapWordsToLines(prefixed, availableTextWidth, nameFontSizePx);
    } else {
      nameLines = [...metric.nameLines];
    }
  } else {
    const fitted = fallbackFitName(person, toggles, availableTextWidth);
    nameFontSizePx = fitted.nameFontSizePx;
    nameLines = fitted.nameLines;
  }

  const lineHeight = Math.round(nameFontSizePx * 1.22 * 10) / 10;
  const showNickname = Boolean(toggles.nickname && person.nickname?.trim());
  const nicknameHeight = showNickname ? 13 : 0;
  const textBlockHeight = nameLines.length * lineHeight + nicknameHeight;
  const textTop =
    rect.y + padY + Math.max(0, (bodyHeight - textBlockHeight) / 2);

  nameLines.forEach((line, idx) => {
    primitives.push({
      kind: 'text',
      x: textX,
      y: Math.round((textTop + nameFontSizePx * 0.88 + idx * lineHeight) * 10) / 10,
      text: line,
      fontSize: nameFontSizePx,
      fontWeight: 'semibold',
      fill: palette.textPrimary,
      anchor: 'start',
    });
  });

  if (showNickname && person.nickname) {
    const nickText = `"${person.nickname.trim()}"`;
    const fittedNick = fitMetadataSingleLine(nickText, availableTextWidth, 9.5);
    if (fittedNick) {
      primitives.push({
        kind: 'text',
        x: textX,
        y:
          Math.round(
            (textTop + nameFontSizePx * 0.88 + nameLines.length * lineHeight + 1) *
              10,
          ) / 10,
        text: fittedNick,
        fontSize: 9.5,
        fontWeight: 'normal',
        fill: palette.textMuted,
        anchor: 'start',
      });
    }
  }

  // 4. Footer metadata row
  if (hasFooter) {
    const dividerY = rect.y + rect.height - footerHeight;
    primitives.push({
      kind: 'path',
      d: `M ${rect.x + padX} ${dividerY} L ${rect.x + rect.width - padX} ${dividerY}`,
      stroke: palette.cardBorder,
      strokeWidth: 0.6,
    });

    const badgeH = 13;
    const badgeY = dividerY + (footerHeight - badgeH) / 2;
    const textBaselineY = badgeY + 9.5;
    let cursorX = rect.x + padX;

    if (toggles.genderIcon) {
      const genderW = 15;
      const genderAccent =
        person.gender === 'L'
          ? palette.cardAccentMale
          : palette.cardAccentFemale;
      primitives.push({
        kind: 'rect',
        x: cursorX,
        y: badgeY,
        width: genderW,
        height: badgeH,
        rx: 3,
        fill: person.gender === 'L' ? palette.genderMaleBg : palette.genderFemaleBg,
        stroke: settings.theme === 'ink-saver' ? genderAccent : undefined,
        strokeWidth: settings.theme === 'ink-saver' ? 0.6 : undefined,
      });
      primitives.push({
        kind: 'text',
        x: cursorX + genderW / 2,
        y: textBaselineY,
        text: person.gender,
        fontSize: 8.5,
        fontWeight: 'bold',
        fill: genderAccent,
        anchor: 'middle',
      });
      cursorX += genderW + 4;
    }

    if (toggles.generationBadge) {
      const genText = `G${generation}`;
      const genW = Math.max(20, Math.round(estimateTextWidthPx(genText, 8.5) + 8));
      primitives.push({
        kind: 'rect',
        x: cursorX,
        y: badgeY,
        width: genW,
        height: badgeH,
        rx: 3,
        fill: palette.badgeBg,
        stroke: settings.theme === 'ink-saver' ? palette.cardBorder : undefined,
        strokeWidth: settings.theme === 'ink-saver' ? 0.6 : undefined,
      });
      primitives.push({
        kind: 'text',
        x: cursorX + genW / 2,
        y: textBaselineY,
        text: genText,
        fontSize: 8.5,
        fontWeight: 'semibold',
        fill: palette.badgeText,
        anchor: 'middle',
      });
      cursorX += genW + 4;
    }

    if (toggles.birthDeathPlaceYear) {
      const maxMetaWidth = rect.x + rect.width - padX - cursorX - 2;
      if (maxMetaWidth >= 24) {
        const years = formatYearRange(
          person.birthDate,
          person.deathDate,
          person.isDeceased,
        );
        const place = person.birthPlace?.trim();
        const combined = place ? `${place} • ${years}` : years;
        let metaText = combined;
        if (estimateTextWidthPx(combined, 8.5) > maxMetaWidth) {
          if (estimateTextWidthPx(years, 8.5) <= maxMetaWidth) {
            metaText = years;
          } else {
            metaText = fitMetadataSingleLine(combined, maxMetaWidth, 8.5);
          }
        }
        if (metaText) {
          primitives.push({
            kind: 'text',
            x: rect.x + rect.width - padX,
            y: textBaselineY,
            text: metaText,
            fontSize: 8.5,
            fontWeight: 'medium',
            fill: palette.textSecondary,
            anchor: 'end',
          });
        }
      }
    }
  }

  // 5. Continuation badge ("→ hal. X")
  const contLabel = normalizeContinuationLabel(
    options.continuationLabels?.get(person.id) ?? data.continuationLabel,
  );
  if (contLabel) {
    const badgeH = 16;
    const badgeW = Math.max(
      48,
      Math.round(estimateTextWidthPx(contLabel, 8.5) + 12),
    );
    const badgeX = rect.x + rect.width - badgeW - 6;
    const badgeY = rect.y + rect.height - 8;

    primitives.push({
      kind: 'rect',
      x: badgeX,
      y: badgeY,
      width: badgeW,
      height: badgeH,
      rx: 8,
      fill: palette.continuationBg,
      stroke: palette.continuationBorder,
      strokeWidth: 1,
    });
    primitives.push({
      kind: 'text',
      x: badgeX + badgeW / 2,
      y: badgeY + 11,
      text: contLabel,
      fontSize: 8.5,
      fontWeight: 'bold',
      fill: palette.continuationText,
      anchor: 'middle',
    });
  }
}

function emitUnionNodePrimitives(
  primitives: ScenePrimitive[],
  rect: SceneBoundsRect,
  data: UnionNodeData,
  palette: PrintThemeTokens,
): void {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const r = Math.min(rect.width, rect.height) / 2;
  const status = data.union.status;
  const isDivorced = status === 'divorced';
  const isWidowed = status === 'widowed';

  primitives.push({
    kind: 'circle',
    cx,
    cy,
    r,
    fill: isDivorced
      ? palette.cardBloodBg
      : isWidowed
        ? palette.badgeBg
        : palette.unionFill,
    stroke: isDivorced
      ? palette.edgeDivorced
      : isWidowed
        ? palette.edgeWidowed
        : palette.unionStroke,
    strokeWidth: isDivorced ? 1.5 : 1.25,
  });

  if (isDivorced) {
    primitives.push({
      kind: 'text',
      x: cx,
      y: cy + 3.5,
      text: '//',
      fontSize: 10,
      fontWeight: 'bold',
      fill: palette.edgeDivorced,
      anchor: 'middle',
    });
  } else {
    primitives.push({
      kind: 'path',
      d: createHeartPath(cx, cy),
      fill: isWidowed ? palette.heartFillWidowed : palette.heartFillMarried,
      stroke: isWidowed ? palette.heartStrokeWidowed : palette.heartStrokeMarried,
      strokeWidth: 1,
    });
  }
}

export function buildExportScene(
  layout: TreeLayoutResult,
  settings: ExportSettings,
  optionsArg?: BuildExportSceneOptions | Map<string, string>,
): ExportScene {
  const options = normalizeSceneOptions(optionsArg);
  const palette = getPrintThemePalette(settings.theme);
  const padding = options.outerPaddingPx ?? SCENE_OUTER_PADDING_PX;

  const nodes = layout.nodes as LayoutNodeWithOptionalDimensions[];
  if (nodes.length === 0) {
    return {
      width: padding * 2,
      height: padding * 2,
      backgroundColor: palette.backgroundColor,
      primitives: [],
      nodeBounds: new Map(),
    };
  }

  // First pass: collect raw bounding boxes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const rawRects = new Map<string, SceneBoundsRect>();
  for (const node of nodes) {
    const metric =
      node.type === 'person'
        ? options.fittedMetrics?.get(node.id)
        : undefined;
    const { width, height } = resolveCardDimensions(node, settings, metric);
    const rect: SceneBoundsRect = {
      x: node.position.x,
      y: node.position.y,
      width,
      height,
    };
    rawRects.set(node.id, rect);

    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);

    const hasContinuation =
      node.type === 'person' &&
      Boolean(
        normalizeContinuationLabel(
          options.continuationLabels?.get(node.id) ??
            (node.data as PersonNodeDataWithOptionalContinuation)
              .continuationLabel,
        ),
      );
    maxY = Math.max(maxY, rect.y + rect.height + (hasContinuation ? 10 : 0));
  }

  const offsetX = padding - minX;
  const offsetY = padding - minY;
  const sceneWidth = Math.ceil(maxX - minX + padding * 2);
  const sceneHeight = Math.ceil(maxY - minY + padding * 2);

  const nodeBounds = new Map<string, SceneBoundsRect>();
  const nodeTypes = new Map<string, 'person' | 'union'>();

  for (const node of nodes) {
    const raw = rawRects.get(node.id);
    if (!raw) continue;
    nodeBounds.set(node.id, {
      x: Math.round((raw.x + offsetX) * 100) / 100,
      y: Math.round((raw.y + offsetY) * 100) / 100,
      width: raw.width,
      height: raw.height,
    });
    nodeTypes.set(node.id, node.type);
  }

  const primitives: ScenePrimitive[] = [];
  const orientation: TreeOrientation = settings.treeOrientation;

  // Second pass: emit edges first so nodes sit cleanly above endpoints
  for (const edge of layout.edges) {
    const sourceRect = nodeBounds.get(edge.source);
    const targetRect = nodeBounds.get(edge.target);
    if (!sourceRect || !targetRect) continue;

    const edgeKind =
      edge.data?.kind === 'spouse' || edge.type === 'straight'
        ? 'spouse'
        : 'child';

    if (edgeKind === 'spouse') {
      const inferred = inferSpouseHandles(sourceRect, targetRect);
      const start = getHandlePoint(
        sourceRect,
        edge.sourceHandle,
        inferred.sourceSide,
      );
      const end = getHandlePoint(
        targetRect,
        edge.targetHandle,
        inferred.targetSide,
      );

      // Keep spouse lines strictly level with the union node center even if a card grew taller
      const sourceIsUnion = nodeTypes.get(edge.source) === 'union';
      const targetIsUnion = nodeTypes.get(edge.target) === 'union';
      if (orientation === 'TOP_DOWN' && (sourceIsUnion || targetIsUnion)) {
        const unionRect = sourceIsUnion ? sourceRect : targetRect;
        const personRect = sourceIsUnion ? targetRect : sourceRect;
        const unionMidY = unionRect.y + unionRect.height / 2;
        if (
          unionMidY >= personRect.y &&
          unionMidY <= personRect.y + personRect.height
        ) {
          start.y = unionMidY;
          end.y = unionMidY;
        }
      } else if (
        orientation === 'LEFT_RIGHT' &&
        (sourceIsUnion || targetIsUnion)
      ) {
        const unionRect = sourceIsUnion ? sourceRect : targetRect;
        const personRect = sourceIsUnion ? targetRect : sourceRect;
        const unionMidX = unionRect.x + unionRect.width / 2;
        if (
          unionMidX >= personRect.x &&
          unionMidX <= personRect.x + personRect.width
        ) {
          start.x = unionMidX;
          end.x = unionMidX;
        }
      }

      const status = edge.data?.status;
      const isDivorced = status === 'divorced';
      const isWidowed = status === 'widowed';

      primitives.push({
        kind: 'path',
        d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
        stroke: isDivorced
          ? palette.edgeDivorced
          : isWidowed
            ? palette.edgeWidowed
            : palette.edgeMarried,
        strokeWidth: palette.edgeStrokeWidth,
        strokeDasharray: isDivorced ? '6 4' : undefined,
      });
    } else {
      const defaultSource = orientation === 'LEFT_RIGHT' ? 'right' : 'bottom';
      const defaultTarget = orientation === 'LEFT_RIGHT' ? 'left' : 'top';
      const start = getHandlePoint(sourceRect, edge.sourceHandle, defaultSource);
      const end = getHandlePoint(targetRect, edge.targetHandle, defaultTarget);

      const isHorizontalFlow =
        orientation === 'LEFT_RIGHT' ||
        edge.sourceHandle === 'right' ||
        edge.targetHandle === 'left';

      let d: string;
      if (isHorizontalFlow) {
        const midX = (start.x + end.x) / 2;
        d = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
      } else {
        const midY = (start.y + end.y) / 2;
        d = `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
      }

      primitives.push({
        kind: 'path',
        d,
        stroke: palette.edgeNasab,
        strokeWidth: palette.edgeStrokeWidth,
      });
    }
  }

  // Third pass: emit union nodes, then person cards
  for (const node of nodes) {
    if (node.type !== 'union') continue;
    const rect = nodeBounds.get(node.id);
    if (!rect) continue;
    emitUnionNodePrimitives(
      primitives,
      rect,
      node.data as UnionNodeData,
      palette,
    );
  }

  for (const node of nodes) {
    if (node.type !== 'person') continue;
    const rect = nodeBounds.get(node.id);
    if (!rect) continue;
    emitPersonCardPrimitives(
      primitives,
      rect,
      node.data as PersonNodeDataWithOptionalContinuation,
      settings,
      palette,
      options,
    );
  }

  return {
    width: sceneWidth,
    height: sceneHeight,
    backgroundColor: palette.backgroundColor,
    primitives,
    nodeBounds,
  };
}
