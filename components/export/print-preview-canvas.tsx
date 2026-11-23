'use client';

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Layers,
  Maximize2,
  Minus,
  Plus,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderSceneToSvgString } from '@/features/export/svg-renderer';
import type {
  BookPageDescriptor,
  BookPaginationResult,
  ExportScene,
  ExportSettings,
  PosterPaginationResult,
} from '@/features/export/types';
import { cn } from '@/lib/utils';

interface PrintPreviewCanvasProps {
  settings: ExportSettings;
  posterScene: ExportScene;
  posterPagination: PosterPaginationResult;
  bookPagination: BookPaginationResult | null;
  className?: string;
}

interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 4;

function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

function BookPageThumbnail({
  page,
  settings,
  isActive,
  onSelect,
}: {
  page: BookPageDescriptor;
  settings: ExportSettings;
  isActive: boolean;
  onSelect: () => void;
}) {
  const svgMarkup = React.useMemo(
    () =>
      renderSceneToSvgString(page.scene, {
        theme: settings.theme,
        includeHeader: false,
        includeLegend: false,
        width: '100%',
        height: '100%',
      }),
    [page.scene, settings.theme],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition-all hover:shadow-md',
        isActive
          ? 'border-primary ring-2 ring-primary/25'
          : 'border-border hover:border-primary/50',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            Hal. {page.pageNumber}
          </span>
          <span className="truncate">{page.rootPersonName}</span>
        </span>
        {page.continuations.length > 0 && (
          <span className="shrink-0 rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            {page.continuations.length} lanjut
          </span>
        )}
      </div>

      <div
        className="relative aspect-[4/3] w-full overflow-hidden p-2"
        style={{ backgroundColor: page.scene.backgroundColor }}
      >
        <div
          className="h-full w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>

      <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <p className="truncate">
          {page.parentPageNumber !== null
            ? `Lanjutan hal. ${page.parentPageNumber} • `
            : ''}
          {page.lineageBreadcrumb.join(' › ')}
        </p>
      </div>
    </button>
  );
}

export function PrintPreviewCanvas({
  settings,
  posterScene,
  posterPagination,
  bookPagination,
  className,
}: PrintPreviewCanvasProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [transform, setTransform] = React.useState<ViewTransform>({
    scale: 0.6,
    tx: 24,
    ty: 24,
  });
  const [showTileGrid, setShowTileGrid] = React.useState(true);
  const [bookViewMode, setBookViewMode] = React.useState<'single' | 'grid'>('single');
  const [activeBookPageIdx, setActiveBookPageIdx] = React.useState(0);

  const pointersRef = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = React.useRef<{
    distance: number;
    midpoint: { x: number; y: number };
    transform: ViewTransform;
  } | null>(null);
  const panStartRef = React.useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const totalBookPages = bookPagination?.pages.length ?? 0;
  const safeBookPageIdx =
    totalBookPages > 0 ? Math.min(activeBookPageIdx, totalBookPages - 1) : 0;
  const currentBookPage: BookPageDescriptor | null =
    settings.mode === 'book' && bookPagination && totalBookPages > 0
      ? bookPagination.pages[safeBookPageIdx] ?? null
      : null;

  const activeScene: ExportScene =
    settings.mode === 'book' && currentBookPage ? currentBookPage.scene : posterScene;

  // Compute SVG markup for the active scene (raw coordinates align with tile overlays)
  const activeSvgMarkup = React.useMemo(() => {
    const showSvgHeader =
      settings.mode === 'poster' &&
      !settings.meta.includeCoverPage &&
      Boolean(settings.meta.title.trim() || settings.meta.subtitle.trim());
    // In Poster mode with tile grid overlay, keep raw 0..width x 0..height coordinates
    // so tile crop rectangles match the SVG primitives 1:1.
    return renderSceneToSvgString(activeScene, {
      theme: settings.theme,
      includeHeader: settings.mode === 'poster' ? false : showSvgHeader,
      includeLegend:
        settings.mode === 'book' ? settings.meta.includeLegend : false,
      title: settings.meta.title,
      subtitle: settings.meta.subtitle,
      width: activeScene.width,
      height: activeScene.height,
      ariaLabel: 'Pratinjau bagan silsilah cetak',
    });
  }, [
    activeScene,
    settings.mode,
    settings.theme,
    settings.meta.includeCoverPage,
    settings.meta.includeLegend,
    settings.meta.title,
    settings.meta.subtitle,
  ]);

  const fitToScreen = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const sceneW = Math.max(100, activeScene.width);
    const sceneH = Math.max(100, activeScene.height);
    const padding = 36;
    const availW = Math.max(80, rect.width - padding * 2);
    const availH = Math.max(80, rect.height - padding * 2);

    const scale = clampZoom(Math.min(availW / sceneW, availH / sceneH, 1.25));
    const tx = (rect.width - sceneW * scale) / 2;
    const ty = (rect.height - sceneH * scale) / 2;

    setTransform({ scale, tx, ty });
  }, [activeScene.width, activeScene.height]);

  // Fit on initial mount and whenever scene dimensions change noticeably
  const prevDimKeyRef = React.useRef<string>('');
  React.useEffect(() => {
    const key = `${settings.mode}:${activeScene.width}x${activeScene.height}:${safeBookPageIdx}`;
    if (prevDimKeyRef.current !== key) {
      prevDimKeyRef.current = key;
      const frame = requestAnimationFrame(() => {
        fitToScreen();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [settings.mode, activeScene.width, activeScene.height, safeBookPageIdx, fitToScreen]);

  const zoomAtCenter = React.useCallback((factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    setTransform((prev) => {
      const nextScale = clampZoom(prev.scale * factor);
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        tx: cx - (cx - prev.tx) * ratio,
        ty: cy - (cy - prev.ty) * ratio,
      };
    });
  }, []);

  const handleWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;

    setTransform((prev) => {
      const nextScale = clampZoom(prev.scale * zoomFactor);
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        tx: px - (px - prev.tx) * ratio,
        ty: py - (py - prev.ty) * ratio,
      };
    });
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = viewportRef.current;
    if (!el) return;

    el.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      setIsDragging(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.tx,
        ty: transform.ty,
      };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const distance = Math.hypot(dx, dy);
      const rect = el.getBoundingClientRect();
      pinchStartRef.current = {
        distance: Math.max(10, distance),
        midpoint: {
          x: (pts[0].x + pts[1].x) / 2 - rect.left,
          y: (pts[0].y + pts[1].y) / 2 - rect.top,
        },
        transform,
      };
      panStartRef.current = null;
      setIsDragging(false);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current && viewportRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const rect = viewportRef.current.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;

      const start = pinchStartRef.current;
      const nextScale = clampZoom(start.transform.scale * (dist / start.distance));
      const ratio = nextScale / start.transform.scale;

      setTransform({
        scale: nextScale,
        tx: midX - (start.midpoint.x - start.transform.tx) * ratio,
        ty: midY - (start.midpoint.y - start.transform.ty) * ratio,
      });
      return;
    }

    if (pointersRef.current.size === 1 && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((prev) => ({
        ...prev,
        tx: panStartRef.current ? panStartRef.current.tx + dx : prev.tx,
        ty: panStartRef.current ? panStartRef.current.ty + dy : prev.ty,
      }));
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      pinchStartRef.current = null;
      setIsDragging(false);
    } else if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      panStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        tx: transform.tx,
        ty: transform.ty,
      };
      pinchStartRef.current = null;
    }
  };

  const handleJumpToBookPage = (pageNumber: number) => {
    const idx = pageNumber - 1;
    if (idx >= 0 && idx < totalBookPages) {
      setActiveBookPageIdx(idx);
      setBookViewMode('single');
    }
  };

  const totalCanvasWidth = React.useMemo(() => {
    if (settings.mode !== 'poster' || posterPagination.tiles.length === 0) {
      return activeScene.width;
    }
    const lastTile = posterPagination.tiles[posterPagination.tiles.length - 1];
    return Math.max(
      activeScene.width,
      lastTile.sceneCropRect.x + lastTile.sceneCropRect.width,
    );
  }, [settings.mode, posterPagination.tiles, activeScene.width]);

  const totalCanvasHeight = React.useMemo(() => {
    if (settings.mode !== 'poster' || posterPagination.tiles.length === 0) {
      return activeScene.height;
    }
    const lastTile = posterPagination.tiles[posterPagination.tiles.length - 1];
    return Math.max(
      activeScene.height,
      lastTile.sceneCropRect.y + lastTile.sceneCropRect.height,
    );
  }, [settings.mode, posterPagination.tiles, activeScene.height]);

  const badgeFontSize = React.useMemo(() => {
    const firstTile = posterPagination.tiles[0];
    if (!firstTile) return 22;
    return Math.max(16, Math.min(44, Math.round(firstTile.coreSceneRect.width * 0.085)));
  }, [posterPagination.tiles]);

  return (
    <div className={cn('relative flex flex-1 flex-col overflow-hidden bg-[#f4efe4]', className)}>
      {/* Book mode navigation strip */}
      {settings.mode === 'book' && bookPagination && totalBookPages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={safeBookPageIdx <= 0}
              onClick={() => setActiveBookPageIdx((p) => Math.max(0, p - 1))}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <select
              aria-label="Pilih halaman buku"
              value={safeBookPageIdx}
              onChange={(e) => {
                setActiveBookPageIdx(Number(e.target.value));
                setBookViewMode('single');
              }}
              className="h-8 max-w-[230px] rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus:border-ring"
            >
              {bookPagination.pages.map((page, idx) => (
                <option key={page.pageNumber} value={idx}>
                  Hal. {page.pageNumber} / {totalBookPages} — {page.rootPersonName}
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={safeBookPageIdx >= totalBookPages - 1}
              onClick={() =>
                setActiveBookPageIdx((p) => Math.min(totalBookPages - 1, p + 1))
              }
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {currentBookPage && bookViewMode === 'single' && (
              <span className="hidden text-[11px] text-muted-foreground xl:inline">
                {currentBookPage.parentPageNumber !== null
                  ? `Lanjutan dari hal. ${currentBookPage.parentPageNumber} • `
                  : ''}
                Jalur: {currentBookPage.lineageBreadcrumb.join(' › ')}
              </span>
            )}
            <div className="inline-flex rounded-md border border-border bg-secondary/60 p-0.5">
              <Button
                type="button"
                variant={bookViewMode === 'single' ? 'default' : 'ghost'}
                size="xs"
                onClick={() => setBookViewMode('single')}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <Square className="size-3" />
                <span>1 Hal</span>
              </Button>
              <Button
                type="button"
                variant={bookViewMode === 'grid' ? 'default' : 'ghost'}
                size="xs"
                onClick={() => setBookViewMode('grid')}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <Grid2x2 className="size-3" />
                <span>Semua ({totalBookPages})</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Book Grid View */}
      {settings.mode === 'book' && bookViewMode === 'grid' && bookPagination ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bookPagination.pages.map((page, idx) => (
              <BookPageThumbnail
                key={page.pageNumber}
                page={page}
                settings={settings}
                isActive={idx === safeBookPageIdx}
                onSelect={() => {
                  setActiveBookPageIdx(idx);
                  setBookViewMode('single');
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Interactive Pan & Zoom Viewport */
        <div
          ref={viewportRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          style={{ touchAction: 'none' }}
          className={cn(
            'relative flex-1 overflow-hidden select-none',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
        >
          {/* Subtle dot grid backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage: 'radial-gradient(#cbb9ad 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Book Continuation Breadcrumb Overlay */}
          {settings.mode === 'book' && currentBookPage && (
            <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur-xs">
              {currentBookPage.parentPageNumber !== null ? (
                <button
                  type="button"
                  onClick={() => handleJumpToBookPage(currentBookPage.parentPageNumber!)}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Lanjutan dari hal. {currentBookPage.parentPageNumber}
                </button>
              ) : (
                <span className="font-semibold text-primary">
                  Halaman {currentBookPage.pageNumber}
                </span>
              )}
              <span className="text-muted-foreground">•</span>
              <span className="truncate text-muted-foreground">
                Jalur: {currentBookPage.lineageBreadcrumb.join(' › ')}
              </span>
              {currentBookPage.continuations.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pl-1">
                  {currentBookPage.continuations.slice(0, 4).map((c) => (
                    <button
                      key={c.personId}
                      type="button"
                      onClick={() => handleJumpToBookPage(c.targetPageNumber)}
                      className="rounded-full border border-accent/60 bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent/35"
                      title={`Buka cabang ${c.fullName} di halaman ${c.targetPageNumber}`}
                    >
                      {c.fullName.split(' ')[0]} → hal. {c.targetPageNumber}
                    </button>
                  ))}
                  {currentBookPage.continuations.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{currentBookPage.continuations.length - 4} lagi
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transformed Scene + Tile Overlay */}
          <div
            style={{
              transform: `translate3d(${transform.tx}px, ${transform.ty}px, 0) scale(${transform.scale})`,
              transformOrigin: '0 0',
              width: totalCanvasWidth,
              height: totalCanvasHeight,
            }}
            className="pointer-events-none absolute left-0 top-0"
          >
            {/* Paper sheet shadow card */}
            <div
              style={{
                width: activeScene.width,
                height: activeScene.height,
                backgroundColor: activeScene.backgroundColor,
              }}
              className="rounded-sm shadow-xl ring-1 ring-black/10"
            >
              <div
                style={{ width: activeScene.width, height: activeScene.height }}
                dangerouslySetInnerHTML={{ __html: activeSvgMarkup }}
              />
            </div>

            {/* Poster Mode Live Tile Grid Overlay */}
            {settings.mode === 'poster' &&
              showTileGrid &&
              posterPagination.tiles.length > 0 && (
                <svg
                  width={totalCanvasWidth}
                  height={totalCanvasHeight}
                  viewBox={`0 0 ${totalCanvasWidth} ${totalCanvasHeight}`}
                  className="pointer-events-none absolute left-0 top-0 overflow-visible"
                >
                  <defs>
                    <pattern
                      id="overlap-hatch"
                      width="12"
                      height="12"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="12"
                        stroke="#c49753"
                        strokeWidth="2.5"
                        strokeOpacity="0.32"
                      />
                    </pattern>
                  </defs>

                  {posterPagination.tiles.map((tile) => {
                    const crop = tile.sceneCropRect;
                    const core = tile.coreSceneRect;
                    const overlapRightW = Math.max(0, crop.width - core.width);
                    const overlapBottomH = Math.max(0, crop.height - core.height);
                    const badgeW = Math.max(badgeFontSize * 2.1, 44);
                    const badgeH = Math.max(badgeFontSize * 1.45, 28);

                    return (
                      <g key={tile.coordLabel}>
                        {/* Right glue/overlap strip */}
                        {overlapRightW > 0.5 && (
                          <rect
                            x={core.x + core.width}
                            y={crop.y}
                            width={overlapRightW}
                            height={crop.height}
                            fill="url(#overlap-hatch)"
                          />
                        )}
                        {/* Bottom glue/overlap strip */}
                        {overlapBottomH > 0.5 && (
                          <rect
                            x={crop.x}
                            y={core.y + core.height}
                            width={core.width}
                            height={overlapBottomH}
                            fill="url(#overlap-hatch)"
                          />
                        )}

                        {/* Full printable sheet crop boundary */}
                        <rect
                          x={crop.x}
                          y={crop.y}
                          width={crop.width}
                          height={crop.height}
                          fill="none"
                          stroke="#5c3d2e"
                          strokeOpacity="0.45"
                          strokeWidth={Math.max(1.5, 2 / transform.scale)}
                          strokeDasharray={`${Math.max(6, 8 / transform.scale)} ${Math.max(4, 5 / transform.scale)}`}
                        />

                        {/* Core non-overlapping trim line */}
                        <rect
                          x={core.x}
                          y={core.y}
                          width={core.width}
                          height={core.height}
                          fill="none"
                          stroke="#c49753"
                          strokeOpacity="0.7"
                          strokeWidth={Math.max(1, 1.4 / transform.scale)}
                        />

                        {/* Coordinate badge (A1, A2, B1...) */}
                        {settings.paper.showTileLabels && (
                          <g transform={`translate(${crop.x + 8}, ${crop.y + 8})`}>
                            <rect
                              x={0}
                              y={0}
                              width={badgeW}
                              height={badgeH}
                              rx={6}
                              fill="#5c3d2e"
                              fillOpacity="0.9"
                            />
                            <text
                              x={badgeW / 2}
                              y={badgeH * 0.7}
                              textAnchor="middle"
                              fontSize={badgeFontSize}
                              fontWeight="700"
                              fill="#ffffff"
                            >
                              {tile.coordLabel}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}
          </div>

          {/* Floating Bottom-Left Controls (Zoom & Tile Grid Toggle) */}
          <div className="pointer-events-auto absolute bottom-20 left-3 z-20 flex items-center gap-1.5 lg:bottom-4 lg:left-4">
            <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card/95 shadow-sm backdrop-blur-xs">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomAtCenter(1 / 1.2)}
                aria-label="Perkecil pratinjau"
                title="Perkecil"
                className="rounded-none border-r border-border"
              >
                <Minus className="size-4" />
              </Button>
              <span className="min-w-12 px-2 text-center text-[11px] font-semibold tabular-nums text-foreground">
                {Math.round(transform.scale * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomAtCenter(1.2)}
                aria-label="Perbesar pratinjau"
                title="Perbesar"
                className="rounded-none border-l border-border"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={fitToScreen}
                aria-label="Sesuaikan ke layar"
                title="Pas di layar"
                className="rounded-none border-l border-border"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            </div>

            {settings.mode === 'poster' && (
              <Button
                type="button"
                variant={showTileGrid ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowTileGrid((v) => !v)}
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shadow-sm"
                title="Tampilkan atau sembunyikan garis potongan kertas dan label A1, B2"
              >
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">
                  Grid Lembar ({posterPagination.totalTiles})
                </span>
                <span className="sm:hidden">Grid</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
