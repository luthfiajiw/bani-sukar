import { getGeneration } from '@/features/family/graph';
import {
  BASE_NAME_FONT_SIZE_PX,
  CARD_PRESETS,
  MAX_NAME_LINES_BEFORE_SHRINK,
  MIN_NAME_FONT_SIZE_PX,
  NAME_FONT_SIZE_STEPS_PX,
} from './constants';
import type {
  CardElementToggles,
  CardPresetDefinition,
  CardPresetId,
  ExportSettings,
  FamilyGraph,
  FittedPersonCardMetric,
  Person,
} from './types';

const NARROW_CHARS = new Set([
  'i',
  'l',
  'I',
  'j',
  't',
  'f',
  'r',
  '.',
  ',',
  ':',
  ';',
  "'",
  '"',
  '!',
  '|',
  ' ',
  '-',
  '(',
  ')',
  '/',
]);

const WIDE_CHARS = new Set(['m', 'w', 'M', 'W', 'G', 'O', 'Q', '@', '%', '&']);

/**
 * Mengestimasi lebar teks secara deterministik (tanpa dependensi DOM/canvas)
 * untuk font sans-serif proporsional (Inter).
 */
export function estimateTextWidthPx(
  text: string,
  fontSizePx: number,
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold' = 'semibold',
): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (NARROW_CHARS.has(ch)) {
      units += ch === ' ' ? 0.28 : 0.34;
    } else if (WIDE_CHARS.has(ch)) {
      units += 0.84;
    } else if (ch >= 'A' && ch <= 'Z') {
      units += 0.65;
    } else if (ch >= '0' && ch <= '9') {
      units += 0.56;
    } else {
      units += 0.53;
    }
  }
  const weightScale =
    fontWeight === 'bold' ? 1.05 : fontWeight === 'semibold' ? 1.03 : 1;
  return units * fontSizePx * weightScale;
}

function splitLongWordToFit(
  word: string,
  maxWidthPx: number,
  fontSizePx: number,
): string[] {
  const chunks: string[] = [];
  let current = '';
  for (let i = 0; i < word.length; i++) {
    const candidate = current + word[i];
    if (
      current.length > 0 &&
      estimateTextWidthPx(candidate, fontSizePx, 'semibold') > maxWidthPx
    ) {
      chunks.push(current);
      current = word[i];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * Membungkus teks menjadi baris-baris tanpa pernah memotong atau menambahkan elipsis (`…`).
 */
export function wrapTextDeterministic(
  text: string,
  maxWidthPx: number,
  fontSizePx: number,
): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (estimateTextWidthPx(candidate, fontSizePx, 'semibold') <= maxWidthPx) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }

    if (estimateTextWidthPx(word, fontSizePx, 'semibold') <= maxWidthPx) {
      currentLine = word;
    } else {
      const broken = splitLongWordToFit(word, maxWidthPx, fontSizePx);
      for (let i = 0; i < broken.length - 1; i++) {
        lines.push(broken[i]);
      }
      currentLine = broken[broken.length - 1] ?? '';
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function resolvePresetDefinition(
  preset: CardPresetId | CardPresetDefinition,
): CardPresetDefinition {
  return typeof preset === 'string' ? CARD_PRESETS[preset] : preset;
}

export function getDeceasedPrefix(
  person: Pick<Person, 'isDeceased' | 'gender'>,
  toggles: Pick<CardElementToggles, 'deceasedBadge'>,
): 'Alm.' | 'Almh.' | null {
  if (!person.isDeceased || !toggles.deceasedBadge) {
    return null;
  }
  return person.gender === 'P' ? 'Almh.' : 'Alm.';
}

/**
 * Mengukur dan membungkus nama lengkap tanpa pernah memotongnya dengan elipsis:
 * 1. Menambahkan awalan `"Alm. "` (L) atau `"Almh. "` (P) bila wafat & toggle aktif.
 * 2. Mencoba font 12px -> 11px -> 10px -> 9.5px agar muat maksimal 3 baris.
 * 3. Jika pada 9.5px masih > 3 baris, menambah tinggi kartu secara proporsional.
 */
export function measureAndFitPersonCard(
  person: Person,
  toggles: CardElementToggles,
  preset: CardPresetId | CardPresetDefinition = 'full',
): FittedPersonCardMetric {
  const presetDef = resolvePresetDefinition(preset);
  const width = presetDef.defaultWidth;
  const baseHeight = presetDef.defaultHeight;

  const deceasedPrefix = getDeceasedPrefix(person, toggles);
  const displayName = deceasedPrefix
    ? `${deceasedPrefix} ${person.fullName.trim()}`
    : person.fullName.trim();

  // Ruang horizontal tersedia di dalam kartu (strip kiri + padding + opsional avatar)
  const avatarAllowance = toggles.photo ? 46 : 0;
  const availableTextWidth = Math.max(56, width - 26 - avatarAllowance);

  let chosenFontSize = BASE_NAME_FONT_SIZE_PX;
  let chosenLines = wrapTextDeterministic(
    displayName,
    availableTextWidth,
    chosenFontSize,
  );

  if (chosenLines.length > MAX_NAME_LINES_BEFORE_SHRINK) {
    chosenFontSize = MIN_NAME_FONT_SIZE_PX;
    for (const stepFontSize of NAME_FONT_SIZE_STEPS_PX) {
      const candidateLines = wrapTextDeterministic(
        displayName,
        availableTextWidth,
        stepFontSize,
      );
      chosenFontSize = stepFontSize;
      chosenLines = candidateLines;
      if (candidateLines.length <= MAX_NAME_LINES_BEFORE_SHRINK) {
        break;
      }
    }
  }

  const lineHeight = Math.ceil(chosenFontSize * 1.25);
  const nameBlockHeight = chosenLines.length * lineHeight;
  const headerArea = toggles.generationBadge || toggles.genderIcon ? 20 : 10;
  const hasNicknameLine = toggles.nickname && Boolean(person.nickname);
  const hasPlaceYearLine =
    toggles.birthDeathPlaceYear &&
    Boolean(person.birthPlace || person.birthDate || person.deathDate);
  const footerArea =
    (hasNicknameLine ? 13 : 0) + (hasPlaceYearLine ? 13 : 0) + 9;

  const neededHeight = headerArea + nameBlockHeight + footerArea;
  const height = Math.max(baseHeight, Math.ceil(neededHeight));

  return {
    personId: person.id,
    width,
    height,
    nameFontSizePx: chosenFontSize,
    nameLines: chosenLines,
    deceasedPrefix,
  };
}

export interface ComputedGraphCardMetrics {
  metricsByPersonId: Map<string, FittedPersonCardMetric>;
  cardSizeByPersonId: Map<string, { width: number; height: number }>;
  rowHeightByGeneration: Map<number, number>;
  minFontSizePx: number;
}

/**
 * Menghitung ukuran kartu dan tinggi baris per generasi untuk seluruh graf
 * agar tidak ada kartu atau baris generasi yang saling bertabrakan.
 */
export function computeFittedMetricsForGraph(
  graph: FamilyGraph,
  settings: Pick<ExportSettings, 'cardPreset' | 'cardToggles'>,
): ComputedGraphCardMetrics {
  const metricsByPersonId = new Map<string, FittedPersonCardMetric>();
  const rowHeightByGeneration = new Map<number, number>();
  const generationByPersonId = new Map<string, number>();

  let minFontSizePx = BASE_NAME_FONT_SIZE_PX;

  for (const person of graph.persons.values()) {
    const metric = measureAndFitPersonCard(
      person,
      settings.cardToggles,
      settings.cardPreset,
    );
    metricsByPersonId.set(person.id, metric);

    if (metric.nameFontSizePx < minFontSizePx) {
      minFontSizePx = metric.nameFontSizePx;
    }

    const gen = getGeneration(graph, person.id);
    generationByPersonId.set(person.id, gen);

    const currentMaxH = rowHeightByGeneration.get(gen) ?? 0;
    if (metric.height > currentMaxH) {
      rowHeightByGeneration.set(gen, metric.height);
    }
  }

  const cardSizeByPersonId = new Map<string, { width: number; height: number }>();
  for (const [personId, metric] of metricsByPersonId.entries()) {
    const gen = generationByPersonId.get(personId) ?? 1;
    const rowHeight = rowHeightByGeneration.get(gen) ?? metric.height;
    cardSizeByPersonId.set(personId, {
      width: metric.width,
      height: rowHeight,
    });
  }

  return {
    metricsByPersonId,
    cardSizeByPersonId,
    rowHeightByGeneration,
    minFontSizePx,
  };
}
