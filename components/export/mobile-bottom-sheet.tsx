'use client';

import * as React from 'react';
import { ChevronUp, Download, Share2, SlidersHorizontal } from 'lucide-react';
import {
  PrintSettingsControls,
  type PrintSettingsControlsProps,
} from '@/components/export/print-sidebar';
import { Button } from '@/components/ui/button';
import { CARD_PRESETS } from '@/features/export/constants';
import { cn } from '@/lib/utils';

type SheetSnap = 'ringkas' | 'setengah' | 'penuh';

interface MobileBottomSheetProps extends PrintSettingsControlsProps {
  summaryText: string;
  isExporting: boolean;
  canShareFiles: boolean;
  primaryButtonLabel: string;
  onExport: (preferShare: boolean) => void;
}

const SNAP_HEIGHT_CLASS: Record<SheetSnap, string> = {
  ringkas: 'h-auto',
  setengah: 'h-[54dvh]',
  penuh: 'h-[85dvh]',
};

export function MobileBottomSheet({
  settings,
  onUpdateSettings,
  branches,
  persons,
  maxAvailableGeneration,
  onResetAutoSubtitle,
  summaryText,
  isExporting,
  canShareFiles,
  primaryButtonLabel,
  onExport,
}: MobileBottomSheetProps) {
  const [snap, setSnap] = React.useState<SheetSnap>('ringkas');
  const dragStartYRef = React.useRef<number | null>(null);

  const cycleSnap = () => {
    setSnap((prev) =>
      prev === 'ringkas' ? 'setengah' : prev === 'setengah' ? 'penuh' : 'ringkas',
    );
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = e.clientY - dragStartYRef.current;
    dragStartYRef.current = null;

    if (Math.abs(dy) < 24) {
      cycleSnap();
      return;
    }

    if (dy < -30) {
      // Dragged up
      setSnap((prev) => (prev === 'ringkas' ? 'setengah' : 'penuh'));
    } else if (dy > 30) {
      // Dragged down
      setSnap((prev) => (prev === 'penuh' ? 'setengah' : 'ringkas'));
    }
  };

  const applyQuickPreset = (preset: 'poster-a4' | 'book-a4' | 'wa-image') => {
    if (preset === 'poster-a4') {
      onUpdateSettings((prev) => ({
        ...prev,
        mode: 'poster',
        format: 'pdf',
        paper: { ...prev.paper, sizeId: 'A4', orientation: 'landscape' },
        scale: { ...prev.scale, mode: 'min-font', minFontPt: 8 },
      }));
    } else if (preset === 'book-a4') {
      onUpdateSettings((prev) => ({
        ...prev,
        mode: 'book',
        format: 'pdf',
        paper: { ...prev.paper, sizeId: 'A4', orientation: 'portrait' },
        scale: { ...prev.scale, mode: 'min-font', minFontPt: 8 },
      }));
    } else {
      onUpdateSettings((prev) => ({
        ...prev,
        mode: 'poster',
        format: 'zip-jpg',
        pngDpi: 150,
        cardPreset: 'compact',
        cardToggles: { ...CARD_PRESETS.compact.toggles },
        paper: { ...prev.paper, sizeId: 'A4', orientation: 'landscape' },
      }));
    }
  };

  return (
    <div className="lg:hidden">
      {/* Backdrop when sheet is open half/full */}
      {snap !== 'ringkas' && (
        <div
          onClick={() => setSnap('ringkas')}
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px]"
          aria-hidden="true"
        />
      )}

      {/* Draggable / Snapping Bottom Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl transition-[height] duration-200 ease-out',
          SNAP_HEIGHT_CLASS[snap],
        )}
      >
        {/* Drag Handle + Header Summary */}
        <div
          onPointerDown={handleDragStart}
          onPointerUp={handleDragEnd}
          className="flex shrink-0 cursor-grab touch-none flex-col gap-1.5 border-b border-border px-4 pb-2.5 pt-2 active:cursor-grabbing"
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <SlidersHorizontal className="size-3.5" />
              </span>
              <span className="truncate rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                {summaryText}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {(
                [
                  { id: 'ringkas', label: 'Ringkas' },
                  { id: 'setengah', label: 'Sedang' },
                  { id: 'penuh', label: 'Penuh' },
                ] as Array<{ id: SheetSnap; label: string }>
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setSnap(s.id)}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                    snap === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={cycleSnap}
                aria-label="Ubah ukuran panel pengaturan"
                className="ml-0.5 rounded p-1 text-muted-foreground hover:bg-secondary"
              >
                <ChevronUp
                  className={cn(
                    'size-4 transition-transform',
                    snap === 'penuh' && 'rotate-180',
                  )}
                />
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
          >
            <button
              type="button"
              onClick={() => applyQuickPreset('poster-a4')}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                settings.mode === 'poster' && settings.format === 'pdf'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground',
              )}
            >
              Poster A4
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('book-a4')}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                settings.mode === 'book' && settings.format === 'pdf'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground',
              )}
            >
              Buku A4
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('wa-image')}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                settings.format === 'zip-jpg'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground',
              )}
            >
              Gambar WA
            </button>
          </div>
        </div>

        {/* Full Accordion Settings Body */}
        {snap !== 'ringkas' && (
          <div className="flex-1 overflow-y-auto pb-4">
            <PrintSettingsControls
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              branches={branches}
              persons={persons}
              maxAvailableGeneration={maxAvailableGeneration}
              onResetAutoSubtitle={onResetAutoSubtitle}
            />
          </div>
        )}

        {/* Floating Action Bar */}
        <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-border bg-card/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-xs">
          <Button
            type="button"
            onClick={() => onExport(false)}
            disabled={isExporting}
            className="h-10 flex-1 gap-2 text-xs font-semibold sm:text-sm"
          >
            <Download className="size-4" />
            <span>{isExporting ? 'Memproses...' : primaryButtonLabel}</span>
          </Button>
          {(canShareFiles || typeof navigator !== 'undefined') && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onExport(true)}
              disabled={isExporting}
              className="h-10 shrink-0 gap-1.5 px-3 text-xs font-semibold"
            >
              <Share2 className="size-4 text-primary" />
              <span>Bagikan (WA)</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
