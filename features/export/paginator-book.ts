import { getGeneration, getLineagePath, getRootUnions } from '@/features/family/graph';
import { computeLayout, UNION_H, UNION_W } from '@/features/family/layout';
import type { FamilyGraph, Person, PersonNodeData, TreeLayoutResult, Union } from '@/features/family/types';
import {
  BASE_NAME_FONT_SIZE_PX,
  CARD_PRESETS,
  PT_TO_MM,
} from './constants';
import { resolvePaperDimensionsMm } from './paginator-poster';
import { buildExportScene } from './scene';
import { filterGraphByScope } from './scope';
import { computeFittedMetricsForGraph, type ComputedGraphCardMetrics } from './text-fit';
import type {
  BookContinuationMarker,
  BookPageDescriptor,
  BookPaginationResult,
  ExportScene,
  ExportSettings,
} from './types';

interface DraftBookPage {
  pageNumber: number;
  rootPersonId: string;
  rootPersonName: string;
  parentPageNumber: number | null;
  lineageBreadcrumb: string[];
  includedPersonIds: Set<string>;
  includedUnionIds: Set<string>;
  continuations: BookContinuationMarker[];
}

interface BookPageTask {
  rootPersonId: string;
  parentPageIndex: number | null;
  continuationHolderPersonId: string | null;
  allowedTopChildIds: Set<string> | null;
  rootGeneration: number;
  lineageRank: number[];
  horizontalChunkIndex: number;
}

interface SubtreeSlice {
  includedPersonIds: Set<string>;
  includedUnionIds: Set<string>;
  cutDescendants: Person[];
  relativeRankByPersonId: Map<string, number[]>;
  maxDepthFound: number;
}

const BOOK_HEADER_RESERVE_MM = 14;
const BOOK_LEGEND_RESERVE_MM = 11;
const BOOK_FOOTER_RESERVE_MM = 7;

function comparePersonsOrder(a: Person, b: Person): number {
  const orderA = a.birthOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.birthOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  if (a.birthDate && b.birthDate && a.birthDate !== b.birthDate) {
    return a.birthDate.localeCompare(b.birthDate);
  }
  return a.fullName.localeCompare(b.fullName, 'id');
}

function getDirectChildrenOrdered(graph: FamilyGraph, personId: string): Person[] {
  const unions = graph.unionsByPerson.get(personId) ?? [];
  const seen = new Set<string>();
  const children: Person[] = [];
  for (const union of unions) {
    for (const child of graph.childrenByUnion.get(union.id) ?? []) {
      if (!seen.has(child.id)) {
        seen.add(child.id);
        children.push(child);
      }
    }
  }
  return children;
}

function addPersonAndSpouses(
  graph: FamilyGraph,
  personId: string,
  includedPersonIds: Set<string>,
  includedUnionIds: Set<string>,
): void {
  if (!graph.persons.has(personId)) return;
  includedPersonIds.add(personId);
  const unions = graph.unionsByPerson.get(personId) ?? [];
  for (const u of unions) {
    includedUnionIds.add(u.id);
    const partnerId = u.husbandId === personId ? u.wifeId : u.husbandId;
    if (partnerId && graph.persons.has(partnerId)) {
      includedPersonIds.add(partnerId);
    }
  }
}

function compareLineageRank(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return a.length - b.length;
}

function compareBookPageTasks(a: BookPageTask, b: BookPageTask): number {
  if (a.rootGeneration !== b.rootGeneration) {
    return a.rootGeneration - b.rootGeneration;
  }
  const rankDiff = compareLineageRank(a.lineageRank, b.lineageRank);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return a.horizontalChunkIndex - b.horizontalChunkIndex;
}

function collectSubtreeSlice(
  graph: FamilyGraph,
  rootPersonId: string,
  maxDepth: number,
  allowedTopChildIds: Set<string> | null,
): SubtreeSlice {
  const includedPersonIds = new Set<string>();
  const includedUnionIds = new Set<string>();
  const visitedLineage = new Set<string>();
  const relativeRankByPersonId = new Map<string, number[]>();

  if (!graph.persons.has(rootPersonId)) {
    return {
      includedPersonIds,
      includedUnionIds,
      cutDescendants: [],
      relativeRankByPersonId,
      maxDepthFound: 0,
    };
  }

  visitedLineage.add(rootPersonId);
  relativeRankByPersonId.set(rootPersonId, []);
  addPersonAndSpouses(graph, rootPersonId, includedPersonIds, includedUnionIds);

  let currentFrontier: Person[] = [];
  const rootPerson = graph.persons.get(rootPersonId);
  if (rootPerson) {
    currentFrontier.push(rootPerson);
  }

  let maxDepthFound = 0;

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextFrontier: Person[] = [];
    for (const parent of currentFrontier) {
      const parentRelRank = relativeRankByPersonId.get(parent.id) ?? [];
      const allChildren = getDirectChildrenOrdered(graph, parent.id);
      for (let childIdx = 0; childIdx < allChildren.length; childIdx++) {
        const child = allChildren[childIdx];
        if (depth === 0 && allowedTopChildIds !== null && !allowedTopChildIds.has(child.id)) {
          continue;
        }
        if (visitedLineage.has(child.id)) continue;
        visitedLineage.add(child.id);
        relativeRankByPersonId.set(child.id, [...parentRelRank, childIdx]);
        addPersonAndSpouses(graph, child.id, includedPersonIds, includedUnionIds);
        nextFrontier.push(child);
      }
    }

    if (nextFrontier.length === 0) {
      break;
    }
    maxDepthFound = depth + 1;
    currentFrontier = nextFrontier;
  }

  // Any frontier person who still has children outside `includedPersonIds` is a cut descendant
  const cutDescendants: Person[] = [];
  for (const candidate of currentFrontier) {
    const allChildren = getDirectChildrenOrdered(graph, candidate.id);
    const hasUnincludedChildren = allChildren.some((c) => !includedPersonIds.has(c.id));
    if (hasUnincludedChildren) {
      cutDescendants.push(candidate);
    }
  }

  return {
    includedPersonIds,
    includedUnionIds,
    cutDescendants,
    relativeRankByPersonId,
    maxDepthFound,
  };
}

function measureSubtreeMaxDepth(
  graph: FamilyGraph,
  rootPersonId: string,
  allowedTopChildIds: Set<string> | null,
): number {
  const full = collectSubtreeSlice(
    graph,
    rootPersonId,
    Number.MAX_SAFE_INTEGER,
    allowedTopChildIds,
  );
  return full.maxDepthFound;
}

function createSubgraphFromIds(
  sourceGraph: FamilyGraph,
  includedPersonIds: Set<string>,
  includedUnionIds: Set<string>,
): FamilyGraph {
  const persons = new Map<string, Person>();
  const unions = new Map<string, Union>();
  const childrenByUnion = new Map<string, Person[]>();
  const unionsByPerson = new Map<string, Union[]>();

  for (const personId of includedPersonIds) {
    const person = sourceGraph.persons.get(personId);
    if (!person) continue;
    const keepParentUnion = Boolean(
      person.parentUnionId && includedUnionIds.has(person.parentUnionId),
    );
    persons.set(personId, {
      ...person,
      parentUnionId: keepParentUnion ? person.parentUnionId : null,
    });
    unionsByPerson.set(personId, []);
  }

  for (const unionId of includedUnionIds) {
    const union = sourceGraph.unions.get(unionId);
    if (!union) continue;
    const keepHusband = Boolean(union.husbandId && persons.has(union.husbandId));
    const keepWife = Boolean(union.wifeId && persons.has(union.wifeId));
    if (!keepHusband && !keepWife) continue;

    const cleanUnion: Union = {
      ...union,
      husbandId: keepHusband ? union.husbandId : null,
      wifeId: keepWife ? union.wifeId : null,
    };
    unions.set(unionId, cleanUnion);
    childrenByUnion.set(unionId, []);

    if (cleanUnion.husbandId) {
      unionsByPerson.get(cleanUnion.husbandId)?.push(cleanUnion);
    }
    if (cleanUnion.wifeId && cleanUnion.wifeId !== cleanUnion.husbandId) {
      unionsByPerson.get(cleanUnion.wifeId)?.push(cleanUnion);
    }
  }

  for (const person of persons.values()) {
    if (person.parentUnionId && childrenByUnion.has(person.parentUnionId)) {
      childrenByUnion.get(person.parentUnionId)?.push(person);
    }
  }

  for (const [uid, list] of childrenByUnion.entries()) {
    list.sort(comparePersonsOrder);
    childrenByUnion.set(uid, list);
  }

  for (const [pid, list] of unionsByPerson.entries()) {
    list.sort((a, b) =>
      a.unionOrder !== b.unionOrder ? a.unionOrder - b.unionOrder : a.id.localeCompare(b.id),
    );
    unionsByPerson.set(pid, list);
  }

  return {
    persons,
    unions,
    childrenByUnion,
    unionsByPerson,
  };
}

function collectComponentIds(
  graph: FamilyGraph,
  startPersonId: string,
  visited: Set<string>,
): void {
  const queue: string[] = [startPersonId];
  visited.add(startPersonId);

  while (queue.length > 0) {
    const pid = queue.shift()!;
    const person = graph.persons.get(pid);
    if (person?.parentUnionId) {
      const pu = graph.unions.get(person.parentUnionId);
      if (pu?.husbandId && !visited.has(pu.husbandId)) {
        visited.add(pu.husbandId);
        queue.push(pu.husbandId);
      }
      if (pu?.wifeId && !visited.has(pu.wifeId)) {
        visited.add(pu.wifeId);
        queue.push(pu.wifeId);
      }
    }

    const unions = graph.unionsByPerson.get(pid) ?? [];
    for (const u of unions) {
      const partnerId = u.husbandId === pid ? u.wifeId : u.husbandId;
      if (partnerId && !visited.has(partnerId)) {
        visited.add(partnerId);
        queue.push(partnerId);
      }
      for (const child of graph.childrenByUnion.get(u.id) ?? []) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          queue.push(child.id);
        }
      }
    }
  }
}

function discoverRootPersonIds(scopedGraph: FamilyGraph): string[] {
  const roots: string[] = [];
  const covered = new Set<string>();

  for (const rootUnion of getRootUnions(scopedGraph)) {
    const husband = rootUnion.husbandId
      ? scopedGraph.persons.get(rootUnion.husbandId)
      : undefined;
    const wife = rootUnion.wifeId
      ? scopedGraph.persons.get(rootUnion.wifeId)
      : undefined;
    const focal = husband ?? wife;
    if (focal && !covered.has(focal.id)) {
      roots.push(focal.id);
      collectComponentIds(scopedGraph, focal.id, covered);
    }
  }

  const remaining = Array.from(scopedGraph.persons.values())
    .filter((p) => !covered.has(p.id))
    .sort((a, b) => {
      if (a.isBloodLine !== b.isBloodLine) return a.isBloodLine ? -1 : 1;
      const genDiff = getGeneration(scopedGraph, a.id) - getGeneration(scopedGraph, b.id);
      if (genDiff !== 0) return genDiff;
      return a.fullName.localeCompare(b.fullName, 'id');
    });

  for (const person of remaining) {
    if (!covered.has(person.id)) {
      roots.push(person.id);
      collectComponentIds(scopedGraph, person.id, covered);
    }
  }

  return roots;
}

function computePageCapacityPx(
  settings: ExportSettings,
  minPageFontPx: number,
): { maxWidthPx: number; maxHeightPx: number } {
  const { paperWidthMm, paperHeightMm } = resolvePaperDimensionsMm(settings.paper);
  const rawMargin = Number.isFinite(settings.paper.marginMm)
    ? Math.max(0, settings.paper.marginMm)
    : 8;
  const maxAllowedMargin = Math.min(paperWidthMm, paperHeightMm) / 2 - 0.5;
  const marginMm = Math.min(rawMargin, Math.max(0, maxAllowedMargin));

  const printableWidthMm = Math.max(1, paperWidthMm - 2 * marginMm);
  const printableHeightMm = Math.max(1, paperHeightMm - 2 * marginMm);

  const legendReserve = settings.meta.includeLegend ? BOOK_LEGEND_RESERVE_MM : 0;
  const footerReserve = settings.meta.includeFooter ? BOOK_FOOTER_RESERVE_MM : 0;
  const availableTreeWidthMm = Math.max(10, printableWidthMm);
  const availableTreeHeightMm = Math.max(
    10,
    printableHeightMm - BOOK_HEADER_RESERVE_MM - legendReserve - footerReserve,
  );

  const minFontPt =
    Number.isFinite(settings.scale.minFontPt) && settings.scale.minFontPt > 0
      ? settings.scale.minFontPt
      : 8;
  const safeFontPx =
    Number.isFinite(minPageFontPx) && minPageFontPx > 0
      ? minPageFontPx
      : BASE_NAME_FONT_SIZE_PX;

  const minScaleMmPerPx = (minFontPt * PT_TO_MM) / safeFontPx;

  return {
    maxWidthPx: availableTreeWidthMm / minScaleMmPerPx,
    maxHeightPx: availableTreeHeightMm / minScaleMmPerPx,
  };
}

function getMinFontPxForPersons(
  personIds: Iterable<string>,
  fitted: ComputedGraphCardMetrics,
): number {
  let minFontPx = BASE_NAME_FONT_SIZE_PX;
  for (const id of personIds) {
    const metric = fitted.metricsByPersonId.get(id);
    if (metric && metric.nameFontSizePx < minFontPx) {
      minFontPx = metric.nameFontSizePx;
    }
  }
  return minFontPx;
}

function buildPageLayoutAndScene(
  fullGraph: FamilyGraph,
  pageGraph: FamilyGraph,
  settings: ExportSettings,
  fitted: ComputedGraphCardMetrics,
  continuationLabelsByPersonId: Map<string, string>,
  photoMap?: Map<string, string>,
): { layout: TreeLayoutResult; scene: ExportScene } {
  const preset = CARD_PRESETS[settings.cardPreset] ?? CARD_PRESETS.full;

  const pageRowHeightByGen = new Map<number, number>();
  for (const person of pageGraph.persons.values()) {
    const localGen = getGeneration(pageGraph, person.id);
    const size = fitted.cardSizeByPersonId.get(person.id);
    const h = size?.height ?? preset.defaultHeight;
    const prev = pageRowHeightByGen.get(localGen) ?? 0;
    if (h > prev) {
      pageRowHeightByGen.set(localGen, h);
    }
  }

  const layout = computeLayout(pageGraph, {
    orientation: settings.treeOrientation,
    cardWidth: preset.defaultWidth,
    cardHeight: preset.defaultHeight,
    cardSizeByPersonId: fitted.cardSizeByPersonId,
    rowHeightByGeneration: pageRowHeightByGen,
    continuationLabelsByPersonId,
  });

  // Preserve true ancestral generation numbers (G1..Gn) from fullGraph on every node
  for (const node of layout.nodes) {
    if (node.type === 'person') {
      const data = node.data as PersonNodeData;
      data.generation = getGeneration(fullGraph, data.person.id);
    } else {
      node.width = node.width ?? UNION_W;
      node.height = node.height ?? UNION_H;
    }
  }

  const scene = buildExportScene(layout, settings, {
    photoMap,
    fittedMetrics: fitted.metricsByPersonId,
    continuationLabels: continuationLabelsByPersonId,
  });

  return { layout, scene };
}

function doesSubgraphFitPage(
  fullGraph: FamilyGraph,
  scopedGraph: FamilyGraph,
  includedPersonIds: Set<string>,
  includedUnionIds: Set<string>,
  cutPersonIds: Iterable<string>,
  settings: ExportSettings,
  fitted: ComputedGraphCardMetrics,
  photoMap?: Map<string, string>,
): boolean {
  const pageGraph = createSubgraphFromIds(
    scopedGraph,
    includedPersonIds,
    includedUnionIds,
  );
  const dummyLabels = new Map<string, string>();
  for (const pid of cutPersonIds) {
    dummyLabels.set(pid, '→ hal. 99');
  }

  const { scene } = buildPageLayoutAndScene(
    fullGraph,
    pageGraph,
    settings,
    fitted,
    dummyLabels,
    photoMap,
  );
  const minFontPx = getMinFontPxForPersons(includedPersonIds, fitted);
  const { maxWidthPx, maxHeightPx } = computePageCapacityPx(settings, minFontPx);

  return scene.width <= maxWidthPx + 0.5 && scene.height <= maxHeightPx + 0.5;
}

function buildLineageBreadcrumb(
  fullGraph: FamilyGraph,
  scopedGraph: FamilyGraph,
  personId: string,
): string[] {
  const fullPath = getLineagePath(fullGraph, personId);
  if (fullPath.length > 0) {
    return fullPath.map((entry) => entry.fullName);
  }
  const scopedPath = getLineagePath(scopedGraph, personId);
  if (scopedPath.length > 0) {
    return scopedPath.map((entry) => entry.fullName);
  }
  const person = scopedGraph.persons.get(personId) ?? fullGraph.persons.get(personId);
  return person ? [person.fullName] : [];
}

/**
 * Memecah graf silsilah menjadi halaman-halaman buku secara rekursif
 * tanpa pernah memotong satu kartu pun di tengah.
 */
export function computeBookPagination(
  graph: FamilyGraph,
  settings: ExportSettings,
  options?: { photoMap?: Map<string, string> },
): BookPaginationResult {
  const scopedGraph = filterGraphByScope(graph, settings.scope);
  if (scopedGraph.persons.size === 0) {
    return { pages: [], totalPages: 0 };
  }

  const fitted = computeFittedMetricsForGraph(scopedGraph, settings);
  const rootPersonIds = discoverRootPersonIds(scopedGraph);
  if (rootPersonIds.length === 0) {
    return { pages: [], totalPages: 0 };
  }

  const draftPages: DraftBookPage[] = [];

  // Fast path: if the entire scoped graph (even with multiple disconnected roots) fits on 1 page
  const allPersonIds = new Set(scopedGraph.persons.keys());
  const allUnionIds = new Set(scopedGraph.unions.keys());
  if (
    rootPersonIds.length > 1 &&
    doesSubgraphFitPage(
      graph,
      scopedGraph,
      allPersonIds,
      allUnionIds,
      [],
      settings,
      fitted,
      options?.photoMap,
    )
  ) {
    const primaryRoot = scopedGraph.persons.get(rootPersonIds[0])!;
    draftPages.push({
      pageNumber: 1,
      rootPersonId: primaryRoot.id,
      rootPersonName: primaryRoot.fullName,
      parentPageNumber: null,
      lineageBreadcrumb: buildLineageBreadcrumb(graph, scopedGraph, primaryRoot.id),
      includedPersonIds: allPersonIds,
      includedUnionIds: allUnionIds,
      continuations: [],
    });
  } else {
    const pendingTasks: BookPageTask[] = rootPersonIds.map((rootPersonId, rootIdx) => ({
      rootPersonId,
      parentPageIndex: null,
      continuationHolderPersonId: null,
      allowedTopChildIds: null,
      rootGeneration: getGeneration(graph, rootPersonId),
      lineageRank: [rootIdx],
      horizontalChunkIndex: 0,
    }));
    const scheduledRoots = new Set<string>();

    while (pendingTasks.length > 0) {
      pendingTasks.sort(compareBookPageTasks);
      const task = pendingTasks.shift()!;
      const rootPerson = scopedGraph.persons.get(task.rootPersonId);
      if (!rootPerson) continue;

      if (task.allowedTopChildIds === null) {
        if (scheduledRoots.has(task.rootPersonId)) {
          continue;
        }
        scheduledRoots.add(task.rootPersonId);
      }

      const currentPageIndex = draftPages.length;
      const currentPageNumber = currentPageIndex + 1;
      const parentPageNumber =
        task.parentPageIndex !== null
          ? draftPages[task.parentPageIndex].pageNumber
          : null;

      if (task.parentPageIndex !== null && task.continuationHolderPersonId) {
        const holder = scopedGraph.persons.get(task.continuationHolderPersonId);
        if (holder) {
          draftPages[task.parentPageIndex].continuations.push({
            personId: holder.id,
            fullName: holder.fullName,
            targetPageNumber: currentPageNumber,
          });
        }
      }

      const maxSubtreeDepth = measureSubtreeMaxDepth(
        scopedGraph,
        task.rootPersonId,
        task.allowedTopChildIds,
      );

      let chosenSlice: SubtreeSlice | null = null;
      let remainingTopChildren: Person[] = [];

      // Try full depth first, then decrease depth down to 1 until it fits on a single page
      for (let d = maxSubtreeDepth; d >= 1; d--) {
        const candidate = collectSubtreeSlice(
          scopedGraph,
          task.rootPersonId,
          d,
          task.allowedTopChildIds,
        );
        if (
          doesSubgraphFitPage(
            graph,
            scopedGraph,
            candidate.includedPersonIds,
            candidate.includedUnionIds,
            candidate.cutDescendants.map((c) => c.id),
            settings,
            fitted,
            options?.photoMap,
          )
        ) {
          chosenSlice = candidate;
          break;
        }
      }

      // If even depth = 1 exceeds single-page capacity, split top-level sibling branches
      if (!chosenSlice) {
        let topChildren = getDirectChildrenOrdered(scopedGraph, task.rootPersonId);
        if (task.allowedTopChildIds !== null) {
          topChildren = topChildren.filter((c) => task.allowedTopChildIds!.has(c.id));
        }

        if (topChildren.length <= 1) {
          chosenSlice = collectSubtreeSlice(
            scopedGraph,
            task.rootPersonId,
            Math.min(1, maxSubtreeDepth),
            task.allowedTopChildIds,
          );
        } else {
          let fittedChunkCount = 1;
          for (let count = topChildren.length - 1; count >= 1; count--) {
            const chunkIds = new Set(topChildren.slice(0, count).map((c) => c.id));
            const candidate = collectSubtreeSlice(
              scopedGraph,
              task.rootPersonId,
              1,
              chunkIds,
            );
            const cutIds = [
              task.rootPersonId,
              ...candidate.cutDescendants.map((c) => c.id),
            ];
            if (
              doesSubgraphFitPage(
                graph,
                scopedGraph,
                candidate.includedPersonIds,
                candidate.includedUnionIds,
                cutIds,
                settings,
                fitted,
                options?.photoMap,
              )
            ) {
              fittedChunkCount = count;
              break;
            }
          }

          const acceptedIds = new Set(
            topChildren.slice(0, fittedChunkCount).map((c) => c.id),
          );
          chosenSlice = collectSubtreeSlice(
            scopedGraph,
            task.rootPersonId,
            1,
            acceptedIds,
          );
          remainingTopChildren = topChildren.slice(fittedChunkCount);
        }
      }

      draftPages.push({
        pageNumber: currentPageNumber,
        rootPersonId: rootPerson.id,
        rootPersonName: rootPerson.fullName,
        parentPageNumber,
        lineageBreadcrumb: buildLineageBreadcrumb(graph, scopedGraph, rootPerson.id),
        includedPersonIds: chosenSlice.includedPersonIds,
        includedUnionIds: chosenSlice.includedUnionIds,
        continuations: [],
      });

      // Enqueue remaining sibling branches with same generation & lineageRank so horizontal chunks stay consecutive
      if (remainingTopChildren.length > 0) {
        pendingTasks.push({
          rootPersonId: rootPerson.id,
          parentPageIndex: currentPageIndex,
          continuationHolderPersonId: rootPerson.id,
          allowedTopChildIds: new Set(remainingTopChildren.map((c) => c.id)),
          rootGeneration: task.rootGeneration,
          lineageRank: task.lineageRank,
          horizontalChunkIndex: task.horizontalChunkIndex + 1,
        });
      }

      // Enqueue every cut descendant who has children beyond the current page
      for (const descendant of chosenSlice.cutDescendants) {
        if (!scheduledRoots.has(descendant.id)) {
          const relativeRank = chosenSlice.relativeRankByPersonId.get(descendant.id) ?? [];
          pendingTasks.push({
            rootPersonId: descendant.id,
            parentPageIndex: currentPageIndex,
            continuationHolderPersonId: descendant.id,
            allowedTopChildIds: null,
            rootGeneration: getGeneration(graph, descendant.id),
            lineageRank: [...task.lineageRank, ...relativeRank],
            horizontalChunkIndex: 0,
          });
        }
      }
    }
  }

  // Pass 2: Build final layout & scene with resolved "→ hal. X" continuation markers
  const pages: BookPageDescriptor[] = draftPages.map((draft) => {
    const continuationLabelsByPersonId = new Map<string, string>();
    for (const marker of draft.continuations) {
      const prev = continuationLabelsByPersonId.get(marker.personId);
      const label = prev
        ? `${prev}, ${marker.targetPageNumber}`
        : `→ hal. ${marker.targetPageNumber}`;
      continuationLabelsByPersonId.set(marker.personId, label);
    }

    const pageGraph = createSubgraphFromIds(
      scopedGraph,
      draft.includedPersonIds,
      draft.includedUnionIds,
    );
    const { layout, scene } = buildPageLayoutAndScene(
      graph,
      pageGraph,
      settings,
      fitted,
      continuationLabelsByPersonId,
      options?.photoMap,
    );

    return {
      pageNumber: draft.pageNumber,
      rootPersonId: draft.rootPersonId,
      rootPersonName: draft.rootPersonName,
      parentPageNumber: draft.parentPageNumber,
      lineageBreadcrumb: draft.lineageBreadcrumb,
      includedPersonIds: draft.includedPersonIds,
      includedUnionIds: draft.includedUnionIds,
      continuations: draft.continuations,
      layout,
      scene,
    };
  });

  return {
    pages,
    totalPages: pages.length,
  };
}
