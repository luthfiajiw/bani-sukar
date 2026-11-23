'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { MobileBottomSheet } from '@/components/export/mobile-bottom-sheet';
import { PrintPreviewCanvas } from '@/components/export/print-preview-canvas';
import { PrintSidebar } from '@/components/export/print-sidebar';
import { Button } from '@/components/ui/button';
import {
  CARD_PRESETS,
  DEFAULT_EXPORT_SETTINGS,
  MM_TO_PT,
  PT_TO_MM,
} from '@/features/export/constants';
import { computeBookPagination } from '@/features/export/paginator-book';
import { computePosterPagination } from '@/features/export/paginator-poster';
import { checkSinglePngCanvasSafety } from '@/features/export/raster-exporter';
import { buildExportScene } from '@/features/export/scene';
import { filterGraphByScope } from '@/features/export/scope';
import { canUseWebShareForFiles, shareOrDownloadBlob } from '@/features/export/share-helper';
import { computeFittedMetricsForGraph } from '@/features/export/text-fit';
import type {
  BookPaginationResult,
  ExportProgress,
  ExportSettings,
  ExportSummaryStats,
} from '@/features/export/types';
import {
  buildExportFilename,
  parseExportSettingsFromSearchParams,
  serializeExportSettingsToSearchParams,
} from '@/features/export/url-state';
import { buildGraph, getBranches, getGeneration } from '@/features/family/graph';
import { computeLayout } from '@/features/family/layout';
import type { Person, PersonNodeData, Union } from '@/features/family/types';

interface PrintStudioProps {
  persons: Person[];
  unions: Union[];
}

function buildAutoSubtitle(
  settings: ExportSettings,
  branches: Array<{ id: string; fullName: string; order: number }>,
  personMap: Map<string, Person>,
  maxAvailableGeneration: number,
): string {
  const parts: string[] = [];

  if (settings.scope.branchId) {
    const branch = branches.find((b) => b.id === settings.scope.branchId);
    if (branch) {
      parts.push(`Ranting ${branch.order}. ${branch.fullName}`);
    }
  }

  if (settings.scope.subtreeRootPersonId) {
    const rootPerson = personMap.get(settings.scope.subtreeRootPersonId);
    if (rootPerson) {
      parts.push(`Subtree ${rootPerson.fullName}`);
    }
  }

  if (parts.length === 0) {
    parts.push('Seluruh Bagan');
  }

  const minGen = settings.scope.minGeneration;
  const maxGen = settings.scope.maxGeneration;
  if (minGen > 1 || maxGen < maxAvailableGeneration) {
    const effectiveMax = maxGen >= 99 ? maxAvailableGeneration : maxGen;
    parts.push(`G${minGen}–G${effectiveMax}`);
  }

  return parts.join(' • ');
}

function getFormatButtonLabel(settings: ExportSettings): string {
  switch (settings.format) {
    case 'pdf':
      return settings.mode === 'book' ? 'Unduh PDF Buku' : 'Unduh PDF Poster';
    case 'png':
      return `Unduh PNG (${settings.pngDpi} DPI)`;
    case 'zip-png':
      return 'Unduh ZIP (PNG)';
    case 'zip-jpg':
      return 'Unduh ZIP (JPG)';
    case 'svg':
      return 'Unduh SVG Vektor';
  }
}

function getFormatExtension(format: ExportSettings['format']): string {
  switch (format) {
    case 'pdf':
      return 'pdf';
    case 'png':
      return 'png';
    case 'zip-png':
    case 'zip-jpg':
      return 'zip';
    case 'svg':
      return 'svg';
  }
}

const emptySubscribe = () => () => {};

function subscribeResize(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

export function PrintStudio({ persons, unions }: PrintStudioProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fullGraph = React.useMemo(
    () => buildGraph(persons, unions),
    [persons, unions],
  );
  const branches = React.useMemo(() => getBranches(fullGraph), [fullGraph]);

  const maxAvailableGeneration = React.useMemo(() => {
    let maxGen = 1;
    for (const p of persons) {
      const g = getGeneration(fullGraph, p.id);
      if (g > maxGen) maxGen = g;
    }
    return Math.max(4, maxGen);
  }, [persons, fullGraph]);

  const [settings, setSettings] = React.useState<ExportSettings>(() => {
    const parsed = parseExportSettingsFromSearchParams(searchParams);
    if (!searchParams.has('subjudul')) {
      parsed.meta.subtitle = buildAutoSubtitle(
        parsed,
        branches,
        fullGraph.persons,
        maxAvailableGeneration,
      );
    }
    return parsed;
  });

  const hasCustomSubtitleRef = React.useRef<boolean>(
    searchParams.has('subjudul'),
  );
  const canShareFiles = React.useSyncExternalStore(
    emptySubscribe,
    () => canUseWebShareForFiles(),
    () => false,
  );
  const isMobileViewport = React.useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth < 1024,
    () => false,
  );

  const [isExporting, setIsExporting] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState<ExportProgress | null>(
    null,
  );
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Sync URL query parameters when settings change
  const lastSyncedQueryRef = React.useRef<string>(searchParams.toString());
  React.useEffect(() => {
    const nextParams = serializeExportSettingsToSearchParams(settings);
    const nextQuery = nextParams.toString();
    if (nextQuery !== lastSyncedQueryRef.current) {
      lastSyncedQueryRef.current = nextQuery;
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [settings, pathname, router]);

  const handleUpdateSettings = React.useCallback(
    (updater: (prev: ExportSettings) => ExportSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        const scopeChanged =
          next.scope.branchId !== prev.scope.branchId ||
          next.scope.subtreeRootPersonId !== prev.scope.subtreeRootPersonId ||
          next.scope.minGeneration !== prev.scope.minGeneration ||
          next.scope.maxGeneration !== prev.scope.maxGeneration;

        if (next.meta.subtitle !== prev.meta.subtitle) {
          hasCustomSubtitleRef.current = true;
        } else if (scopeChanged && !hasCustomSubtitleRef.current) {
          next.meta = {
            ...next.meta,
            subtitle: buildAutoSubtitle(
              next,
              branches,
              fullGraph.persons,
              maxAvailableGeneration,
            ),
          };
        }
        return next;
      });
    },
    [branches, fullGraph.persons, maxAvailableGeneration],
  );

  const handleResetAutoSubtitle = React.useCallback(() => {
    hasCustomSubtitleRef.current = false;
    setSettings((prev) => ({
      ...prev,
      meta: {
        ...prev.meta,
        subtitle: buildAutoSubtitle(
          prev,
          branches,
          fullGraph.persons,
          maxAvailableGeneration,
        ),
      },
    }));
  }, [branches, fullGraph.persons, maxAvailableGeneration]);

  const handleResetSettings = React.useCallback(() => {
    hasCustomSubtitleRef.current = false;
    setSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      cardToggles: { ...DEFAULT_EXPORT_SETTINGS.cardToggles },
      scope: { ...DEFAULT_EXPORT_SETTINGS.scope },
      paper: { ...DEFAULT_EXPORT_SETTINGS.paper },
      scale: { ...DEFAULT_EXPORT_SETTINGS.scale },
      meta: { ...DEFAULT_EXPORT_SETTINGS.meta },
    });
  }, []);

  // Scoped graph & metrics
  const filteredGraph = React.useMemo(
    () => filterGraphByScope(fullGraph, settings.scope),
    [fullGraph, settings.scope],
  );

  const fittedMetrics = React.useMemo(
    () => computeFittedMetricsForGraph(filteredGraph, settings),
    [filteredGraph, settings],
  );

  const presetDef = CARD_PRESETS[settings.cardPreset] ?? CARD_PRESETS.full;

  const posterLayout = React.useMemo(() => {
    const rawLayout = computeLayout(filteredGraph, {
      orientation: settings.treeOrientation,
      cardWidth: presetDef.defaultWidth,
      cardHeight: presetDef.defaultHeight,
      cardSizeByPersonId: fittedMetrics.cardSizeByPersonId,
      rowHeightByGeneration: fittedMetrics.rowHeightByGeneration,
    });

    // Preserve true ancestral generation numbers (G1..Gn) from fullGraph
    return {
      ...rawLayout,
      nodes: rawLayout.nodes.map((node) => {
        if (node.type !== 'person') return node;
        const data = node.data as PersonNodeData;
        return {
          ...node,
          data: {
            ...data,
            generation: getGeneration(fullGraph, data.person.id),
          },
        };
      }),
    };
  }, [
    filteredGraph,
    fullGraph,
    settings.treeOrientation,
    presetDef.defaultWidth,
    presetDef.defaultHeight,
    fittedMetrics.cardSizeByPersonId,
    fittedMetrics.rowHeightByGeneration,
  ]);

  const posterScene = React.useMemo(
    () =>
      buildExportScene(posterLayout, settings, {
        fittedMetrics: fittedMetrics.metricsByPersonId,
      }),
    [posterLayout, settings, fittedMetrics.metricsByPersonId],
  );

  const posterPagination = React.useMemo(
    () =>
      computePosterPagination(
        posterScene.width,
        posterScene.height,
        settings.paper,
        settings.scale,
        fittedMetrics.minFontSizePx,
      ),
    [
      posterScene.width,
      posterScene.height,
      settings.paper,
      settings.scale,
      fittedMetrics.minFontSizePx,
    ],
  );

  const bookPagination: BookPaginationResult | null = React.useMemo(() => {
    if (settings.mode !== 'book') return null;
    return computeBookPagination(fullGraph, settings);
  }, [fullGraph, settings]);

  // Summary statistics for cover page & live pills
  const summaryStats: ExportSummaryStats = React.useMemo(() => {
    let minGen = Infinity;
    let maxGen = 0;
    for (const p of filteredGraph.persons.values()) {
      const g = getGeneration(fullGraph, p.id);
      if (g < minGen) minGen = g;
      if (g > maxGen) maxGen = g;
    }
    return {
      personCount: filteredGraph.persons.size,
      unionCount: filteredGraph.unions.size,
      minGeneration: Number.isFinite(minGen) ? minGen : 1,
      maxGeneration: maxGen || 1,
    };
  }, [filteredGraph, fullGraph]);

  // Effective text readability in pt
  const effectiveMinFontPt = React.useMemo(() => {
    if (settings.mode === 'book') {
      return settings.scale.minFontPt;
    }
    return posterPagination.effectiveMinFontPt;
  }, [settings.mode, settings.scale.minFontPt, posterPagination.effectiveMinFontPt]);

  // PNG canvas pixel limit check
  const pngSafety = React.useMemo(() => {
    if (settings.format !== 'png') return null;
    const targetScene =
      settings.mode === 'book' && bookPagination?.pages[0]
        ? bookPagination.pages[0].scene
        : posterScene;
    return checkSinglePngCanvasSafety(
      targetScene,
      settings.pngDpi,
      isMobileViewport,
    );
  }, [
    settings.format,
    settings.mode,
    settings.pngDpi,
    bookPagination,
    posterScene,
    isMobileViewport,
  ]);

  const handleCancelExport = React.useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleExport = React.useCallback(
    async (preferShare: boolean) => {
      if (filteredGraph.persons.size === 0) {
        toast.error('Tidak ada anggota dalam cakupan yang dipilih.');
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsExporting(true);
      setExportProgress({
        phase: 'preparing',
        current: 0,
        total: 1,
        message: 'Menyiapkan data silsilah...',
      });

      try {
        // 1. Preload photos as CORS-safe data URLs if photo toggle is active
        let photoMap: Map<string, string> | undefined;
        if (settings.cardToggles.photo) {
          const scopedPersons = Array.from(filteredGraph.persons.values());
          const personsWithPhoto = scopedPersons.filter((p) => Boolean(p.photoUrl));
          if (personsWithPhoto.length > 0) {
            const { preloadPhotosAsDataUrls } = await import(
              '@/features/export/photo-loader'
            );
            photoMap = await preloadPhotosAsDataUrls(scopedPersons, {
              maxSizePx: 96,
              signal: controller.signal,
              onProgress: (loaded, total) => {
                setExportProgress({
                  phase: 'photos',
                  current: loaded,
                  total: Math.max(1, total),
                  message: `Memuat foto anggota (${loaded}/${total})...`,
                });
              },
            });
          }
        }

        if (controller.signal.aborted) {
          throw new DOMException('Ekspor dibatalkan', 'AbortError');
        }

        // 2. Rebuild scene/pagination with preloaded photoMap so photos embed cleanly
        const exportPosterScene = buildExportScene(posterLayout, settings, {
          photoMap,
          fittedMetrics: fittedMetrics.metricsByPersonId,
        });

        const exportBookPagination =
          settings.mode === 'book'
            ? computeBookPagination(fullGraph, settings, { photoMap })
            : undefined;

        const execOptions = {
          signal: controller.signal,
          onProgress: (progress: ExportProgress) => setExportProgress(progress),
        };

        let outputBlob: Blob;

        if (settings.format === 'svg') {
          const { generateSvgBlob } = await import(
            '@/features/export/raster-exporter'
          );
          const sceneForSvg =
            settings.mode === 'book' && exportBookPagination?.pages[0]
              ? exportBookPagination.pages[0].scene
              : exportPosterScene;
          outputBlob = generateSvgBlob(sceneForSvg, settings);
        } else if (settings.format === 'png') {
          const { generateSinglePngBlob } = await import(
            '@/features/export/raster-exporter'
          );
          const sceneForPng =
            settings.mode === 'book' && exportBookPagination?.pages[0]
              ? exportBookPagination.pages[0].scene
              : exportPosterScene;
          const result = await generateSinglePngBlob(sceneForPng, settings, {
            ...execOptions,
            isMobile: isMobileViewport,
          });
          if (!result.ok) {
            toast.error(
              `Ukuran gambar (${result.widthPx}×${result.heightPx} px) melampaui batas aman browser. Gunakan ZIP Gambar per Halaman.`,
            );
            return;
          }
          outputBlob = result.blob;
        } else if (settings.format === 'zip-png' || settings.format === 'zip-jpg') {
          const { generateTiledZipBlob } = await import(
            '@/features/export/zip-exporter'
          );
          outputBlob = await generateTiledZipBlob({
            scene: exportPosterScene,
            settings,
            posterPagination:
              settings.mode === 'poster' ? posterPagination : undefined,
            bookPagination: exportBookPagination,
            format: settings.format === 'zip-png' ? 'png' : 'jpg',
            options: execOptions,
          });
        } else if (settings.mode === 'book') {
          const { generateBookPdfBlob } = await import(
            '@/features/export/pdf-book'
          );
          outputBlob = await generateBookPdfBlob(fullGraph, settings, {
            ...execOptions,
            photoMap,
            bookPagination: exportBookPagination,
          });
        } else {
          const { generatePosterPdfBlob } = await import(
            '@/features/export/pdf-poster'
          );
          outputBlob = await generatePosterPdfBlob(
            exportPosterScene,
            posterPagination,
            settings,
            {
              ...execOptions,
              stats: summaryStats,
            },
          );
        }

        if (controller.signal.aborted) {
          throw new DOMException('Ekspor dibatalkan', 'AbortError');
        }

        const selectedBranch = branches.find(
          (b) => b.id === settings.scope.branchId,
        );
        const filename = buildExportFilename(
          settings,
          getFormatExtension(settings.format),
          new Date(),
          selectedBranch?.fullName,
        );

        const delivery = await shareOrDownloadBlob(outputBlob, filename, {
          title: settings.meta.title,
          text: settings.meta.subtitle,
          preferShare,
        });

        setExportProgress({
          phase: 'done',
          current: 1,
          total: 1,
          message: 'Selesai!',
        });
        toast.success(
          delivery === 'shared'
            ? `Berhasil membagikan ${filename}`
            : `Berhasil mengunduh ${filename}`,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          toast.info('Proses ekspor dibatalkan.');
        } else {
          const message =
            err instanceof Error ? err.message : 'Terjadi kesalahan saat mengekspor.';
          toast.error(message);
        }
      } finally {
        abortControllerRef.current = null;
        setIsExporting(false);
        setExportProgress(null);
      }
    },
    [
      branches,
      filteredGraph.persons,
      fittedMetrics.metricsByPersonId,
      fullGraph,
      isMobileViewport,
      posterLayout,
      posterPagination,
      settings,
      summaryStats,
    ],
  );

  // Build concise live summary string for mobile & top bar
  const sheetCountSummary =
    settings.mode === 'book'
      ? `${bookPagination?.totalPages ?? 1} Hal. Buku ${settings.paper.sizeId}`
      : `${posterPagination.cols}×${posterPagination.rows} = ${posterPagination.totalTiles} Lembar ${settings.paper.sizeId}`;

  const posterDimCmText = `${Math.round(posterPagination.posterWidthCm)} × ${Math.round(posterPagination.posterHeightCm)} cm`;
  const readabilityLabel =
    effectiveMinFontPt >= 7.5
      ? 'Terbaca jelas'
      : effectiveMinFontPt >= 6
        ? 'Cukup kecil'
        : 'Sangat kecil';

  const mobileBadgeSummary = `${
    settings.mode === 'book'
      ? `${bookPagination?.totalPages ?? 1} Hal.`
      : `${posterPagination.totalTiles} Lembar`
  } ${settings.paper.sizeId} • Teks ${effectiveMinFontPt.toFixed(1)}pt`;

  const primaryButtonLabel = getFormatButtonLabel(settings);

  // Unused constant guard: keep PT_TO_MM / MM_TO_PT reference consistent if needed
  void PT_TO_MM;
  void MM_TO_PT;

  return (
    <div className="flex h-[calc(100dvh-65px)] flex-col overflow-hidden bg-background lg:flex-row">
      {/* Desktop Left Sidebar */}
      <PrintSidebar
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        branches={branches}
        persons={persons}
        maxAvailableGeneration={maxAvailableGeneration}
        onResetAutoSubtitle={handleResetAutoSubtitle}
        isExporting={isExporting}
        canShareFiles={canShareFiles}
        primaryButtonLabel={primaryButtonLabel}
        onExport={handleExport}
        onResetSettings={handleResetSettings}
      />

      {/* Right / Main Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Live Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <Button
              asChild
              variant="ghost"
              size="xs"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link
                href={
                  settings.scope.branchId
                    ? `/?cabang=${encodeURIComponent(settings.scope.branchId)}`
                    : '/'
                }
              >
                <ArrowLeft className="size-3.5" />
                <span className="hidden sm:inline">Kembali ke Bagan</span>
                <span className="sm:hidden">Bagan</span>
              </Link>
            </Button>

            <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              {summaryStats.personCount} Anggota
            </span>

            <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              {sheetCountSummary}
            </span>

            {settings.mode === 'poster' && (
              <span className="hidden rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
                Ukuran Poster: {posterDimCmText}
              </span>
            )}

            <span
              className={
                effectiveMinFontPt >= 7.5
                  ? 'inline-flex items-center gap-1 rounded-full border border-[#2d4030]/25 bg-[#2d4030]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#2d4030]'
                  : 'inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800'
              }
            >
              {effectiveMinFontPt >= 7.5 ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <AlertTriangle className="size-3" />
              )}
              <span>
                Teks {effectiveMinFontPt.toFixed(1)} pt ({readabilityLabel})
              </span>
            </span>
          </div>
        </div>

        {/* PNG Canvas Pixel Limit Warning Banner */}
        {pngSafety && !pngSafety.safe && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-700" />
              <span>
                Bagan pada {settings.pngDpi} DPI berukuran{' '}
                <strong>
                  {pngSafety.widthPx.toLocaleString('id-ID')} ×{' '}
                  {pngSafety.heightPx.toLocaleString('id-ID')} px
                </strong>{' '}
                dan melebihi batas aman kanvas browser.
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {settings.pngDpi === 300 && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    handleUpdateSettings((prev) => ({ ...prev, pngDpi: 150 }))
                  }
                  className="border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
                >
                  Turunkan ke 150 DPI
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                onClick={() =>
                  handleUpdateSettings((prev) => ({ ...prev, format: 'zip-png' }))
                }
                className="bg-amber-700 text-white hover:bg-amber-800"
              >
                Alihkan ke ZIP Tiling
              </Button>
            </div>
          </div>
        )}

        {/* Cancelable Export Progress Banner */}
        {isExporting && exportProgress && (
          <div className="flex items-center justify-between gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2.5">
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {exportProgress.message ?? 'Sedang memproses ekspor...'}
                </p>
                <div className="mt-1 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-secondary sm:w-64">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-150"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (exportProgress.current /
                            Math.max(1, exportProgress.total)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleCancelExport}
              className="shrink-0 gap-1"
            >
              <X className="size-3" />
              <span>Batal</span>
            </Button>
          </div>
        )}

        {/* Empty scope state */}
        {filteredGraph.persons.size === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold text-foreground">
              Tidak ada anggota pada cakupan yang dipilih.
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              Coba perluas rentang generasi atau reset filter Ranting Trah / Subtree.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleResetSettings}>
              Reset Cakupan
            </Button>
          </div>
        ) : (
          <PrintPreviewCanvas
            settings={settings}
            posterScene={posterScene}
            posterPagination={posterPagination}
            bookPagination={bookPagination}
          />
        )}
      </div>

      {/* Mobile Bottom Sheet & FAB */}
      <MobileBottomSheet
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        branches={branches}
        persons={persons}
        maxAvailableGeneration={maxAvailableGeneration}
        onResetAutoSubtitle={handleResetAutoSubtitle}
        summaryText={mobileBadgeSummary}
        isExporting={isExporting}
        canShareFiles={canShareFiles}
        primaryButtonLabel={primaryButtonLabel}
        onExport={handleExport}
      />
    </div>
  );
}
