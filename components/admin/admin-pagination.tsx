'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ALLOWED_PAGE_SIZES,
  buildPaginationHref,
  type AllowedPageSize,
} from '@/lib/pagination';

interface AdminPaginationProps {
  basePath: string;
  currentPage: number;
  pageSize: AllowedPageSize;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  pageNumbers: Array<number | 'ellipsis'>;
  queryParams?: Record<string, string | undefined>;
  itemLabel?: string;
}

export function AdminPagination({
  basePath,
  currentPage,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  hasPrevPage,
  hasNextPage,
  pageNumbers,
  queryParams = {},
  itemLabel = 'anggota',
}: AdminPaginationProps) {
  const router = useRouter();

  if (totalItems === 0) {
    return null;
  }

  const buildHref = (nextPage: number, nextSize: AllowedPageSize = pageSize) =>
    buildPaginationHref(basePath, queryParams, nextPage, nextSize);

  const handlePageSizeChange = (value: string) => {
    const nextSize = Number(value) as AllowedPageSize;
    router.push(buildHref(1, nextSize));
  };

  return (
    <Card className="py-3.5">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Range summary & page size selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Menampilkan{' '}
            <span className="font-semibold text-foreground">
              {startIndex}–{endIndex}
            </span>{' '}
            dari{' '}
            <span className="font-semibold text-foreground">{totalItems}</span>{' '}
            {itemLabel}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Per halaman:</span>
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger
                aria-label="Jumlah data per halaman"
                className="h-8 w-[76px] px-2.5 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Page navigation controls */}
        <nav
          aria-label="Navigasi halaman tabel"
          className="flex flex-wrap items-center justify-between gap-1.5 sm:justify-end"
        >
          {hasPrevPage ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={buildHref(currentPage - 1)}
                prefetch={false}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="size-4" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
          )}

          <div className="flex items-center gap-1">
            {pageNumbers.map((entry, idx) =>
              entry === 'ellipsis' ? (
                <span
                  key={`ellipsis-${idx}`}
                  aria-hidden="true"
                  className="px-1.5 text-xs text-muted-foreground select-none"
                >
                  …
                </span>
              ) : entry === currentPage ? (
                <Button
                  key={entry}
                  variant="default"
                  size="sm"
                  aria-current="page"
                  aria-label={`Halaman ${entry}`}
                  className="min-w-8 px-2.5"
                >
                  {entry}
                </Button>
              ) : (
                <Button
                  key={entry}
                  variant="outline"
                  size="sm"
                  asChild
                  className="min-w-8 px-2.5"
                >
                  <Link
                    href={buildHref(entry)}
                    prefetch={false}
                    aria-label={`Ke halaman ${entry}`}
                  >
                    {entry}
                  </Link>
                </Button>
              )
            )}
          </div>

          {hasNextPage ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={buildHref(currentPage + 1)}
                prefetch={false}
                aria-label="Halaman berikutnya"
              >
                <span className="hidden sm:inline">Berikutnya</span>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-label="Halaman berikutnya"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRight className="size-4" />
            </Button>
          )}
        </nav>
      </CardContent>
    </Card>
  );
}
