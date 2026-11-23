'use client';

import * as React from 'react';
import {
  BookOpen,
  ChevronDown,
  Download,
  FileCode2,
  FileImage,
  FileText,
  FolderArchive,
  Palette,
  RotateCcw,
  Ruler,
  Scissors,
  Search,
  Share2,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  CARD_PRESETS,
  PAPER_SIZES,
} from '@/features/export/constants';
import { PRINT_THEMES } from '@/features/export/theme';
import type {
  CardElementToggles,
  CardPresetId,
  ExportFormat,
  ExportMode,
  ExportSettings,
  PaperOrientation,
  PaperSizeId,
  PrintThemeId,
  ScaleMode,
  TreeOrientation,
} from '@/features/export/types';
import type { Person } from '@/features/family/types';
import { cn } from '@/lib/utils';

export interface PrintSettingsControlsProps {
  settings: ExportSettings;
  onUpdateSettings: (updater: (prev: ExportSettings) => ExportSettings) => void;
  branches: Array<{ id: string; fullName: string; order: number }>;
  persons: Person[];
  maxAvailableGeneration: number;
  onResetAutoSubtitle?: () => void;
}

interface AccordionSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({
  title,
  icon,
  badge,
  open,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold tracking-wide text-foreground uppercase">
          <span className="text-primary">{icon}</span>
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className="max-w-[120px] truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              {badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>
      {open && <div className="space-y-3.5 px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
}

const FORMAT_OPTIONS: Array<{
  id: ExportFormat;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'pdf',
    label: 'PDF Vektor',
    hint: 'Siap cetak tajam (400% zoom)',
    icon: <FileText className="size-3.5" />,
  },
  {
    id: 'png',
    label: 'PNG Utuh',
    hint: '1 gambar utuh resolusi tinggi',
    icon: <FileImage className="size-3.5" />,
  },
  {
    id: 'zip-png',
    label: 'ZIP Gambar per Halaman (PNG)',
    hint: 'Aman memori HP & cetak satuan',
    icon: <FolderArchive className="size-3.5" />,
  },
  {
    id: 'zip-jpg',
    label: 'ZIP Gambar per Halaman (JPG)',
    hint: 'Ukuran kecil untuk kirim WA',
    icon: <FolderArchive className="size-3.5" />,
  },
  {
    id: 'svg',
    label: 'SVG Vektor',
    hint: 'Untuk CorelDRAW / Illustrator',
    icon: <FileCode2 className="size-3.5" />,
  },
];

const CARD_TOGGLE_ITEMS: Array<{
  key: keyof CardElementToggles;
  label: string;
}> = [
  { key: 'photo', label: 'Foto Profil' },
  { key: 'nickname', label: 'Nama Panggilan' },
  { key: 'birthDeathPlaceYear', label: 'Tempat & Tahun Lahir/Wafat' },
  { key: 'generationBadge', label: 'Badge Generasi (G1..Gn)' },
  { key: 'genderIcon', label: 'Simbol Gender (L/P)' },
  { key: 'deceasedBadge', label: 'Penanda Wafat (Alm./Almh.)' },
];

function detectMatchingPreset(toggles: CardElementToggles): CardPresetId {
  const presetIds: Array<'full' | 'compact' | 'minimal'> = [
    'full',
    'compact',
    'minimal',
  ];
  for (const id of presetIds) {
    const p = CARD_PRESETS[id].toggles;
    if (
      p.photo === toggles.photo &&
      p.nickname === toggles.nickname &&
      p.birthDeathPlaceYear === toggles.birthDeathPlaceYear &&
      p.generationBadge === toggles.generationBadge &&
      p.genderIcon === toggles.genderIcon &&
      p.deceasedBadge === toggles.deceasedBadge
    ) {
      return id;
    }
  }
  return 'custom';
}

function SubtreePersonCombobox({
  persons,
  selectedPersonId,
  onSelect,
}: {
  persons: Person[];
  selectedPersonId: string | null;
  onSelect: (personId: string | null) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedPerson = React.useMemo(
    () => persons.find((p) => p.id === selectedPersonId) ?? null,
    [persons, selectedPersonId],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? persons.filter(
          (p) =>
            p.fullName.toLowerCase().includes(q) ||
            (p.nickname && p.nickname.toLowerCase().includes(q)),
        )
      : persons;
    return list.slice(0, 12);
  }, [persons, query]);

  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={open ? query : selectedPerson?.fullName ?? query}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Mulai dari tokoh tertentu (opsional)..."
          aria-label="Pilih akar subtree tokoh"
          className="h-8.5 bg-background pl-8 pr-8 text-xs"
        />
        {(selectedPersonId || query) && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onSelect(null);
              setOpen(false);
            }}
            aria-label="Hapus pilihan akar tokoh"
            className="absolute right-2 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery('');
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
              selectedPersonId === null
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
            )}
          >
            <span>Semua (Mengikuti Ranting Trah)</span>
          </button>
          {filtered.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">
              Nama tidak ditemukan.
            </div>
          ) : (
            filtered.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  onSelect(person.id);
                  setQuery(person.fullName);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  selectedPersonId === person.id
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-foreground hover:bg-secondary/60',
                )}
              >
                <span className="truncate">{person.fullName}</span>
                {person.nickname && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    ({person.nickname})
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PrintSettingsControls({
  settings,
  onUpdateSettings,
  branches,
  persons,
  maxAvailableGeneration,
  onResetAutoSubtitle,
}: PrintSettingsControlsProps) {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    mode: true,
    scope: true,
    card: false,
    layout: true,
    paper: false,
    theme: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const genOptions = React.useMemo(
    () =>
      Array.from({ length: Math.max(1, maxAvailableGeneration) }, (_, i) => i + 1),
    [maxAvailableGeneration],
  );

  const selectedBranch = branches.find((b) => b.id === settings.scope.branchId);
  const scopeBadge = selectedBranch
    ? `${selectedBranch.order}. ${selectedBranch.fullName}`
    : settings.scope.subtreeRootPersonId
      ? 'Subtree'
      : 'Semua';

  const paperDef = PAPER_SIZES[settings.paper.sizeId] ?? PAPER_SIZES.A4;
  const paperBadge = `${settings.paper.sizeId === 'CUSTOM' ? `${settings.paper.customWidthMm}×${settings.paper.customHeightMm}` : settings.paper.sizeId} ${settings.paper.orientation === 'landscape' ? 'L' : 'P'}`;

  const needsDpi =
    settings.format === 'png' ||
    settings.format === 'zip-png' ||
    settings.format === 'zip-jpg';

  return (
    <div className="divide-y divide-border">
      {/* a) Mode & Format Keluaran */}
      <AccordionSection
        id="mode"
        title="Mode & Format Keluaran"
        icon={<BookOpen className="size-3.5" />}
        badge={`${settings.mode === 'poster' ? 'Poster' : 'Buku'} • ${settings.format.toUpperCase()}`}
        open={Boolean(openSections.mode)}
        onToggle={() => toggleSection('mode')}
      >
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Mode Dokumen</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                {
                  id: 'poster',
                  title: 'Poster Tiling',
                  sub: 'Sambung Kertas',
                },
                {
                  id: 'book',
                  title: 'Buku Silsilah',
                  sub: 'Per Cabang',
                },
              ] as Array<{ id: ExportMode; title: string; sub: string }>
            ).map((opt) => {
              const active = settings.mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings((prev) => ({ ...prev, mode: opt.id }))
                  }
                  className={cn(
                    'flex cursor-pointer flex-col rounded-lg border px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/8 text-foreground ring-1 ring-primary/30'
                      : 'border-border bg-background hover:bg-secondary/50',
                  )}
                >
                  <span className="text-xs font-semibold">{opt.title}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Format Berkas</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {FORMAT_OPTIONS.map((fmt) => {
              const active = settings.format === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings((prev) => ({ ...prev, format: fmt.id }))
                  }
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/8 text-foreground ring-1 ring-primary/30'
                      : 'border-border bg-background hover:bg-secondary/50',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={active ? 'text-primary' : 'text-muted-foreground'}>
                      {fmt.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {fmt.label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {fmt.hint}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {needsDpi && (
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Resolusi Gambar (DPI)
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {([150, 300] as const).map((dpi) => (
                <button
                  key={dpi}
                  type="button"
                  onClick={() =>
                    onUpdateSettings((prev) => ({ ...prev, pngDpi: dpi }))
                  }
                  className={cn(
                    'cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    settings.pngDpi === dpi
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-secondary/60',
                  )}
                >
                  {dpi} DPI {dpi === 150 ? '(Cepat)' : '(Tajam)'}
                </button>
              ))}
            </div>
          </div>
        )}
      </AccordionSection>

      {/* b) Cakupan Silsilah */}
      <AccordionSection
        id="scope"
        title="Cakupan Silsilah"
        icon={<Users className="size-3.5" />}
        badge={scopeBadge}
        open={Boolean(openSections.scope)}
        onToggle={() => toggleSection('scope')}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cetak-branch-select" className="text-[11px] text-muted-foreground">
            Ranting Trah
          </Label>
          <select
            id="cetak-branch-select"
            value={settings.scope.branchId ?? ''}
            onChange={(e) => {
              const val = e.target.value || null;
              onUpdateSettings((prev) => ({
                ...prev,
                scope: { ...prev.scope, branchId: val },
              }));
            }}
            className="h-8.5 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Semua Cabang ({branches.length} Anak Sukar &amp; Sadirah)</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.order}. {branch.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">
            Subtree dari Tokoh Tertentu
          </Label>
          <SubtreePersonCombobox
            persons={persons}
            selectedPersonId={settings.scope.subtreeRootPersonId}
            onSelect={(personId) =>
              onUpdateSettings((prev) => ({
                ...prev,
                scope: { ...prev.scope, subtreeRootPersonId: personId },
              }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="cetak-gen-min" className="text-[11px] text-muted-foreground">
              Dari Generasi
            </Label>
            <select
              id="cetak-gen-min"
              value={settings.scope.minGeneration}
              onChange={(e) => {
                const minGen = Number(e.target.value);
                onUpdateSettings((prev) => ({
                  ...prev,
                  scope: {
                    ...prev.scope,
                    minGeneration: minGen,
                    maxGeneration: Math.max(minGen, prev.scope.maxGeneration),
                  },
                }));
              }}
              className="h-8.5 w-full rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus:border-ring"
            >
              {genOptions.map((g) => (
                <option key={g} value={g}>
                  G{g}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cetak-gen-max" className="text-[11px] text-muted-foreground">
              Sampai Generasi
            </Label>
            <select
              id="cetak-gen-max"
              value={
                settings.scope.maxGeneration >= 99
                  ? maxAvailableGeneration
                  : Math.min(settings.scope.maxGeneration, maxAvailableGeneration)
              }
              onChange={(e) => {
                const val = Number(e.target.value);
                const normalized = val >= maxAvailableGeneration ? 99 : val;
                onUpdateSettings((prev) => ({
                  ...prev,
                  scope: {
                    ...prev.scope,
                    minGeneration: Math.min(prev.scope.minGeneration, val),
                    maxGeneration: normalized,
                  },
                }));
              }}
              className="h-8.5 w-full rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus:border-ring"
            >
              {genOptions.map((g) => (
                <option key={g} value={g}>
                  G{g} {g === maxAvailableGeneration ? '(Terakhir)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AccordionSection>

      {/* c) Isi Kartu Anggota */}
      <AccordionSection
        id="card"
        title="Isi Kartu Anggota"
        icon={<SlidersHorizontal className="size-3.5" />}
        badge={CARD_PRESETS[settings.cardPreset].label}
        open={Boolean(openSections.card)}
        onToggle={() => toggleSection('card')}
      >
        <div className="grid grid-cols-3 gap-1.5">
          {(['full', 'compact', 'minimal'] as const).map((presetId) => {
            const preset = CARD_PRESETS[presetId];
            const active = settings.cardPreset === presetId;
            return (
              <button
                key={presetId}
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    cardPreset: presetId,
                    cardToggles: { ...preset.toggles },
                  }))
                }
                className={cn(
                  'cursor-pointer rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-secondary/60',
                )}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5 pt-1">
          {CARD_TOGGLE_ITEMS.map((item) => {
            const checked = settings.cardToggles[item.key];
            return (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-xs text-foreground transition-colors hover:bg-secondary/50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const nextChecked = e.target.checked;
                    onUpdateSettings((prev) => {
                      const nextToggles: CardElementToggles = {
                        ...prev.cardToggles,
                        [item.key]: nextChecked,
                      };
                      return {
                        ...prev,
                        cardToggles: nextToggles,
                        cardPreset: detectMatchingPreset(nextToggles),
                      };
                    });
                  }}
                  className="size-3.5 accent-primary"
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </AccordionSection>

      {/* d) Tata Letak & Skala */}
      <AccordionSection
        id="layout"
        title="Tata Letak & Skala"
        icon={<Ruler className="size-3.5" />}
        badge={settings.treeOrientation === 'TOP_DOWN' ? 'Atas→Bawah' : 'Kiri→Kanan'}
        open={Boolean(openSections.layout)}
        onToggle={() => toggleSection('layout')}
      >
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Orientasi Bagan</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'TOP_DOWN', label: 'Atas → Bawah' },
                { id: 'LEFT_RIGHT', label: 'Kiri → Kanan' },
              ] as Array<{ id: TreeOrientation; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({ ...prev, treeOrientation: opt.id }))
                }
                className={cn(
                  'cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  settings.treeOrientation === opt.id
                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                    : 'border-border bg-background text-foreground hover:bg-secondary/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">
            Mode Skala {settings.mode === 'book' ? '(Minimum Teks Buku)' : ''}
          </Label>

          {settings.mode === 'poster' && (
            <div className="grid grid-cols-1 gap-1.5">
              {(
                [
                  { id: 'min-font', label: 'Ukuran Teks Minimum (pt)' },
                  { id: 'fit-grid', label: 'Muat dalam N × M Halaman' },
                  { id: 'percentage', label: 'Persentase Manual (%)' },
                ] as Array<{ id: ScaleMode; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      scale: { ...prev.scale, mode: m.id },
                    }))
                  }
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    settings.scale.mode === m.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-secondary/50',
                  )}
                >
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          )}

          {(settings.mode === 'book' || settings.scale.mode === 'min-font') && (
            <div className="rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Teks Terkecil</span>
                <span className="font-semibold tabular-nums text-primary">
                  {settings.scale.minFontPt} pt
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={14}
                step={0.5}
                value={settings.scale.minFontPt}
                aria-label="Ukuran teks minimum dalam poin"
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    scale: { ...prev.scale, minFontPt: Number(e.target.value) },
                  }))
                }
                className="w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>5 pt (Padat)</span>
                <span>8 pt (Standar)</span>
                <span>14 pt (Besar)</span>
              </div>
            </div>
          )}

          {settings.mode === 'poster' && settings.scale.mode === 'fit-grid' && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="space-y-1">
                <Label htmlFor="cetak-fit-cols" className="text-[11px] text-muted-foreground">
                  Kolom (N)
                </Label>
                <Input
                  id="cetak-fit-cols"
                  type="number"
                  min={1}
                  max={25}
                  value={settings.scale.fitCols}
                  onChange={(e) =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      scale: {
                        ...prev.scale,
                        fitCols: Math.max(1, Math.min(25, Number(e.target.value) || 1)),
                      },
                    }))
                  }
                  className="h-8 bg-background text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cetak-fit-rows" className="text-[11px] text-muted-foreground">
                  Baris (M)
                </Label>
                <Input
                  id="cetak-fit-rows"
                  type="number"
                  min={1}
                  max={25}
                  value={settings.scale.fitRows}
                  onChange={(e) =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      scale: {
                        ...prev.scale,
                        fitRows: Math.max(1, Math.min(25, Number(e.target.value) || 1)),
                      },
                    }))
                  }
                  className="h-8 bg-background text-xs"
                />
              </div>
            </div>
          )}

          {settings.mode === 'poster' && settings.scale.mode === 'percentage' && (
            <div className="rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Skala Cetak</span>
                <span className="font-semibold tabular-nums text-primary">
                  {settings.scale.percentage}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={250}
                step={5}
                value={settings.scale.percentage}
                aria-label="Persentase skala cetak"
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    scale: { ...prev.scale, percentage: Number(e.target.value) },
                  }))
                }
                className="w-full accent-primary"
              />
            </div>
          )}
        </div>
      </AccordionSection>

      {/* e) Kertas & Sambungan Poster */}
      <AccordionSection
        id="paper"
        title="Kertas & Sambungan Poster"
        icon={<Scissors className="size-3.5" />}
        badge={paperBadge}
        open={Boolean(openSections.paper)}
        onToggle={() => toggleSection('paper')}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cetak-paper-size" className="text-[11px] text-muted-foreground">
            Ukuran Kertas
          </Label>
          <select
            id="cetak-paper-size"
            value={settings.paper.sizeId}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                paper: { ...prev.paper, sizeId: e.target.value as PaperSizeId },
              }))
            }
            className="h-8.5 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-ring"
          >
            {Object.values(PAPER_SIZES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {settings.paper.sizeId === 'CUSTOM' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cetak-custom-w" className="text-[11px] text-muted-foreground">
                Lebar (mm)
              </Label>
              <Input
                id="cetak-custom-w"
                type="number"
                min={50}
                max={2000}
                value={settings.paper.customWidthMm}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    paper: {
                      ...prev.paper,
                      customWidthMm: Math.max(50, Number(e.target.value) || paperDef.widthMm),
                    },
                  }))
                }
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cetak-custom-h" className="text-[11px] text-muted-foreground">
                Tinggi (mm)
              </Label>
              <Input
                id="cetak-custom-h"
                type="number"
                min={50}
                max={2000}
                value={settings.paper.customHeightMm}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    paper: {
                      ...prev.paper,
                      customHeightMm: Math.max(50, Number(e.target.value) || paperDef.heightMm),
                    },
                  }))
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Orientasi Kertas</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'portrait', label: 'Portrait' },
                { id: 'landscape', label: 'Landscape' },
              ] as Array<{ id: PaperOrientation; label: string }>
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    paper: { ...prev.paper, orientation: o.id },
                  }))
                }
                className={cn(
                  'cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  settings.paper.orientation === o.id
                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                    : 'border-border bg-background text-foreground hover:bg-secondary/50',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="cetak-margin-mm" className="text-[11px] text-muted-foreground">
              Margin Aman (mm)
            </Label>
            <Input
              id="cetak-margin-mm"
              type="number"
              min={0}
              max={35}
              value={settings.paper.marginMm}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  paper: {
                    ...prev.paper,
                    marginMm: Math.max(0, Math.min(35, Number(e.target.value) || 0)),
                  },
                }))
              }
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cetak-overlap-mm" className="text-[11px] text-muted-foreground">
              Overlap Lem (mm)
            </Label>
            <Input
              id="cetak-overlap-mm"
              type="number"
              min={0}
              max={30}
              disabled={settings.mode !== 'poster'}
              value={settings.paper.overlapMm}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  paper: {
                    ...prev.paper,
                    overlapMm: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                  },
                }))
              }
              className="h-8 text-xs"
            />
          </div>
        </div>

        {settings.mode === 'poster' && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span>Tanda Potong (Crop Marks)</span>
              <Switch
                checked={settings.paper.showCutMarks}
                onCheckedChange={(checked) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    paper: { ...prev.paper, showCutMarks: checked },
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Label Koordinat (A1, B2)</span>
              <Switch
                checked={settings.paper.showTileLabels}
                onCheckedChange={(checked) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    paper: { ...prev.paper, showTileLabels: checked },
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Halaman Peta Susunan</span>
              <Switch
                checked={settings.paper.includeAssemblyMap}
                onCheckedChange={(checked) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    paper: { ...prev.paper, includeAssemblyMap: checked },
                  }))
                }
              />
            </div>
          </div>
        )}
      </AccordionSection>

      {/* f) Tema & Informasi Dokumen */}
      <AccordionSection
        id="theme"
        title="Tema & Informasi Dokumen"
        icon={<Palette className="size-3.5" />}
        badge={PRINT_THEMES[settings.theme].label}
        open={Boolean(openSections.theme)}
        onToggle={() => toggleSection('theme')}
      >
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Tema Cetak</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                {
                  id: 'color',
                  label: 'Warna Klasik',
                  swatchBg: '#fdf9f1',
                  swatchStroke: '#5c3d2e',
                },
                {
                  id: 'ink-saver',
                  label: 'Hemat Tinta',
                  swatchBg: '#ffffff',
                  swatchStroke: '#8a7265',
                },
                {
                  id: 'monochrome',
                  label: 'Hitam-Putih',
                  swatchBg: '#ffffff',
                  swatchStroke: '#111111',
                },
              ] as Array<{
                id: PrintThemeId;
                label: string;
                swatchBg: string;
                swatchStroke: string;
              }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({ ...prev, theme: t.id }))
                }
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-[11px] font-medium transition-colors',
                  settings.theme === t.id
                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                    : 'border-border bg-background text-foreground hover:bg-secondary/50',
                )}
              >
                <span
                  className="size-4 rounded-full border-2"
                  style={{
                    backgroundColor: t.swatchBg,
                    borderColor: t.swatchStroke,
                  }}
                />
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cetak-doc-title" className="text-[11px] text-muted-foreground">
            Judul Dokumen
          </Label>
          <Input
            id="cetak-doc-title"
            value={settings.meta.title}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                meta: { ...prev.meta, title: e.target.value },
              }))
            }
            placeholder="Silsilah Trah Bani Sukar & Sadirah"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="cetak-doc-subtitle"
              className="text-[11px] text-muted-foreground"
            >
              Subjudul Cakupan
            </Label>
            {onResetAutoSubtitle && (
              <button
                type="button"
                onClick={onResetAutoSubtitle}
                className="text-[10px] font-medium text-primary hover:underline"
              >
                Otomatis
              </button>
            )}
          </div>
          <Input
            id="cetak-doc-subtitle"
            value={settings.meta.subtitle}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                meta: { ...prev.meta, subtitle: e.target.value },
              }))
            }
            placeholder="Seluruh Bagan"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span>Halaman Sampul (PDF)</span>
            <Switch
              checked={settings.meta.includeCoverPage}
              onCheckedChange={(checked) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  meta: { ...prev.meta, includeCoverPage: checked },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Legenda Simbol</span>
            <Switch
              checked={settings.meta.includeLegend}
              onCheckedChange={(checked) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  meta: { ...prev.meta, includeLegend: checked },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Footer Halaman</span>
            <Switch
              checked={settings.meta.includeFooter}
              onCheckedChange={(checked) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  meta: { ...prev.meta, includeFooter: checked },
                }))
              }
            />
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}

interface PrintSidebarProps extends PrintSettingsControlsProps {
  isExporting: boolean;
  canShareFiles: boolean;
  primaryButtonLabel: string;
  onExport: (preferShare: boolean) => void;
  onResetSettings: () => void;
}

export function PrintSidebar({
  settings,
  onUpdateSettings,
  branches,
  persons,
  maxAvailableGeneration,
  onResetAutoSubtitle,
  isExporting,
  canShareFiles,
  primaryButtonLabel,
  onExport,
  onResetSettings,
}: PrintSidebarProps) {
  return (
    <aside className="hidden w-[348px] shrink-0 flex-col border-r border-border bg-card lg:flex xl:w-[376px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-sm font-bold text-foreground">Pengaturan Cetak</h1>
          <p className="text-[11px] text-muted-foreground">
            Atur tata letak sebelum mengunduh
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onResetSettings}
          title="Kembalikan ke pengaturan awal"
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          <span>Reset</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <PrintSettingsControls
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          branches={branches}
          persons={persons}
          maxAvailableGeneration={maxAvailableGeneration}
          onResetAutoSubtitle={onResetAutoSubtitle}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-card p-3.5">
        <Button
          type="button"
          onClick={() => onExport(false)}
          disabled={isExporting}
          className="h-10 flex-1 gap-2 font-semibold"
        >
          <Download className="size-4" />
          <span>{isExporting ? 'Memproses...' : primaryButtonLabel}</span>
        </Button>
        {canShareFiles && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onExport(true)}
            disabled={isExporting}
            title="Bagikan berkas"
            aria-label="Bagikan berkas"
            className="h-10 w-10 shrink-0"
          >
            <Share2 className="size-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}
