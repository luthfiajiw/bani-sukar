export const ALLOWED_PAGE_SIZES = [10, 20, 50] as const;
export type AllowedPageSize = (typeof ALLOWED_PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: AllowedPageSize = 10;

export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  pageSize: AllowedPageSize;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  pageNumbers: Array<number | 'ellipsis'>;
}

/**
 * Parses a raw pageSize value and restricts it to ALLOWED_PAGE_SIZES (10, 20, 50).
 */
export function parsePageSize(
  raw?: string | number | null
): AllowedPageSize {
  const num =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;

  if (Number.isInteger(num) && (ALLOWED_PAGE_SIZES as readonly number[]).includes(num)) {
    return num as AllowedPageSize;
  }
  return DEFAULT_PAGE_SIZE;
}

/**
 * Parses a raw 1-based page number, clamping invalid or non-positive values to 1.
 */
export function parsePageNumber(raw?: string | number | null): number {
  const num =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;

  if (Number.isInteger(num) && num >= 1) {
    return num;
  }
  return 1;
}

/**
 * Generates compact page number sequence with ellipsis markers when totalPages > 7.
 */
export function buildPageNumbers(
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis'> {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  // Keep edge ranges balanced near the start or end
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 3);
    pages.add(totalPages - 2);
    pages.add(totalPages - 1);
  }

  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i];
    const prev = sorted[i - 1];
    if (prev !== undefined && page - prev > 1) {
      result.push('ellipsis');
    }
    result.push(page);
  }

  return result;
}

/**
 * Slices an array into a single page and computes pagination metadata.
 * Clamps out-of-range page numbers to [1, totalPages].
 */
export function paginateItems<T>(
  allItems: readonly T[],
  rawPage?: string | number | null,
  rawPageSize?: string | number | null
): PaginationResult<T> {
  const pageSize = parsePageSize(rawPageSize);
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parsePageNumber(rawPage);
  const currentPage = Math.min(requestedPage, totalPages);

  if (totalItems === 0) {
    return {
      items: [],
      currentPage: 1,
      pageSize,
      totalItems: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      hasPrevPage: false,
      hasNextPage: false,
      pageNumbers: [1],
    };
  }

  const offset = (currentPage - 1) * pageSize;
  const items = allItems.slice(offset, offset + pageSize);
  const startIndex = offset + 1;
  const endIndex = offset + items.length;

  return {
    items,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    pageNumbers: buildPageNumbers(currentPage, totalPages),
  };
}

/**
 * Builds a URL string preserving existing filter query parameters while updating page/pageSize.
 */
export function buildPaginationHref(
  basePath: string,
  params: Record<string, string | undefined | null>,
  nextPage: number,
  nextPageSize: AllowedPageSize
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || key === 'pageSize') continue;
    const trimmed = value?.trim();
    if (trimmed) {
      search.set(key, trimmed);
    }
  }

  if (nextPage > 1) {
    search.set('page', String(nextPage));
  }
  if (nextPageSize !== DEFAULT_PAGE_SIZE) {
    search.set('pageSize', String(nextPageSize));
  }

  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
