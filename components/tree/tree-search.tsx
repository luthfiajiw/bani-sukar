'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import type { Person } from '@/features/family/types';
import { GenderBadge } from '@/components/gender-icon';
import { Input } from '@/components/ui/input';
import { formatYearRange } from '@/lib/format';
import { cn } from '@/lib/utils';

interface TreeSearchProps {
  persons: Person[];
  onSelectPerson: (personId: string) => void;
  className?: string;
}

export function TreeSearch({
  persons,
  onSelectPerson,
  className,
}: TreeSearchProps) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? persons.filter(
          (p) =>
            p.fullName.toLowerCase().includes(q) ||
            (p.nickname && p.nickname.toLowerCase().includes(q)),
        )
      : persons;
    return list.slice(0, 15);
  }, [persons, query]);

  const safeActiveIndex =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = React.useCallback(
    (person: Person) => {
      onSelectPerson(person.id);
      setQuery(person.fullName);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onSelectPerson],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0 ? 0 : (prev + 1) % filtered.length,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0
          ? 0
          : (prev - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[safeActiveIndex];
      if (target) {
        handleSelect(target);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full sm:w-64 lg:w-72', className)}>
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="tree-search-listbox"
          aria-autocomplete="list"
          aria-label="Cari anggota keluarga"
          placeholder="Cari nama atau panggilan..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-8.5 bg-card pl-8 pr-8 text-xs sm:text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setActiveIndex(0);
              setOpen(true);
              inputRef.current?.focus();
            }}
            aria-label="Hapus pencarian"
            className="absolute right-2 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          id="tree-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Tidak ada anggota yang cocok dengan &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((person, index) => {
              const isSelected = index === safeActiveIndex;
              const years = formatYearRange(
                person.birthDate,
                person.deathDate,
                person.isDeceased,
              );
              return (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(person)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-secondary text-foreground'
                      : 'text-foreground hover:bg-secondary/60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-block size-2 shrink-0 rounded-full',
                          person.isDeceased ? 'bg-destructive' : 'bg-[#2d4030]',
                        )}
                        title={person.isDeceased ? 'Almarhum / Wafat' : 'Masih Hidup'}
                      />
                      <span className="truncate font-medium">
                        {person.fullName}
                      </span>
                      {person.nickname && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          ({person.nickname})
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 pl-3.5 text-[11px] text-muted-foreground">
                      <GenderBadge gender={person.gender} size="xs" />
                      <span>• {years}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                      person.isBloodLine
                        ? 'bg-primary/10 text-primary'
                        : 'bg-accent/20 text-accent-foreground',
                    )}
                  >
                    {person.isBloodLine ? 'Nasab' : 'Menantu'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
