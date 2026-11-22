'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Crosshair, GitBranch } from 'lucide-react';
import type { Person } from '@/features/family/types';
import { Button } from '@/components/ui/button';
import { TreeSearch } from '@/components/tree/tree-search';

interface BranchFilterProps {
  branches: Array<{ id: string; fullName: string; order: number }>;
  selectedBranchId: string | null;
  persons: Person[];
  onSelectPerson: (personId: string) => void;
  onFitView: () => void;
}

const GENERATION_PILLS = [
  { gen: 1, label: 'G1 Leluhur', dotClass: 'bg-primary' },
  { gen: 2, label: 'G2 Anak', dotClass: 'bg-accent' },
  { gen: 3, label: 'G3 Cucu', dotClass: 'bg-[#795746]' },
  { gen: 4, label: 'G4 Cicit', dotClass: 'bg-[#2d4030]' },
];

export function BranchFilter({
  branches,
  selectedBranchId,
  persons,
  onSelectPerson,
  onFitView,
}: BranchFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('cabang', value);
    } else {
      params.delete('cabang');
    }
    params.delete('fokus');
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="border-b border-border bg-card/95 py-2.5 backdrop-blur-xs">
      <div className="mx-auto flex max-w-360 flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between px-4 sm:px-6">
        {/* Left: Ranting Trah Selector + Search + Pusat */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <GitBranch className="size-3.5 text-primary" />
              RANTING TRAH:
            </span>
            <select
              aria-label="Filter Ranting Trah"
              value={selectedBranchId ?? ''}
              onChange={handleBranchChange}
              className="h-8.5 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 sm:w-auto sm:min-w-[240px] sm:text-sm"
            >
              <option value="">
                Semua Cabang ({branches.length} Anak Sukar &amp; Sadirah)
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.order}. {branch.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <TreeSearch
              persons={persons}
              onSelectPerson={onSelectPerson}
              className="flex-1 sm:flex-initial"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFitView}
              className="h-8.5 shrink-0 gap-1.5 px-3 text-xs font-medium"
              title="Pusatkan kembali seluruh bagan pohon"
            >
              <Crosshair className="size-3.5 text-primary" />
              <span>Pusat</span>
            </Button>
          </div>
        </div>

        {/* Right: Generation Legend Pills */}
        <div className="hidden flex-wrap items-center gap-1.5 xl:flex">
          {GENERATION_PILLS.map((item) => (
            <span
              key={item.gen}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
            >
              <span className={`size-2 rounded-full ${item.dotClass}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
