const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function parseIsoDateParts(
  dateStr: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function extractYear(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const match = /^(\d{4})/.exec(dateStr.trim());
  if (match) return match[1];
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return String(parsed.getFullYear());
  }
  return null;
}

export function formatDateId(dateStr: string | null | undefined): string {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return "Tidak tercantum";
  const monthName = MONTHS_ID[parts.month - 1];
  if (!monthName) return "Tidak tercantum";
  return `${parts.day} ${monthName} ${parts.year}`;
}

export function formatYearRange(
  birthDate?: string | null,
  deathDate?: string | null,
  isDeceased?: boolean,
): string {
  const birthYear = extractYear(birthDate);
  const deathYear = extractYear(deathDate);

  if (birthYear && deathYear) {
    return `${birthYear} – ${deathYear}`;
  }
  if (birthYear && isDeceased) {
    return `${birthYear} – wafat`;
  }
  if (birthYear) {
    return `${birthYear} – sekarang`;
  }
  if (deathYear) {
    return `Wafat ${deathYear}`;
  }
  return "Tahun tidak tercantum";
}

export function getGenerationLabel(gen: number): string {
  switch (gen) {
    case 1:
      return "Generasi 1 • Leluhur";
    case 2:
      return "Generasi 2 • Anak & Menantu";
    case 3:
      return "Generasi 3 • Cucu (Wayah)";
    case 4:
      return "Generasi 4 • Cicit (Buyut)";
    default:
      return `Generasi ${gen}`;
  }
}

export function getInitials(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function getBirthOrderLabel(
  order: number | null | undefined,
  totalSiblings: number,
): string | null {
  if (order == null || order < 1) return null;
  if (order === 1) return "Sulung";
  if (order === totalSiblings && totalSiblings > 1) return "Bungsu";
  return `Anak ke-${order}`;
}
