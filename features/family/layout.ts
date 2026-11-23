import { filterGraphByScope } from '../export/scope';
import {
  getBranches,
  getBranchRootId,
  getGeneration,
  getRootUnions,
} from './graph';
import type {
  FamilyGraph,
  Person,
  PersonNodeData,
  TreeLayoutResult,
  Union,
  UnionNodeData,
} from './types';

export const W = 200;
export const H = 100;
export const UNION_W = 28;
export const UNION_H = 28;
export const GAP_SPOUSE = 56;
export const GAP_SIBLING = 36;
export const GAP_FAMILY = 72;
export const ROW_H = 210;

export interface ComputeLayoutOptions {
  branchId?: string | null;
  subtreeRootPersonId?: string | null;
  minGeneration?: number;
  maxGeneration?: number;
  orientation?: 'TOP_DOWN' | 'LEFT_RIGHT';
  cardWidth?: number;
  cardHeight?: number;
  cardSizeByPersonId?: Map<string, { width: number; height: number }>;
  rowHeightByGeneration?: Map<number, number>;
  gapSpouse?: number;
  gapSibling?: number;
  gapFamily?: number;
  rowGap?: number;
  continuationLabelsByPersonId?: Map<string, string>;
}

interface HeaderPersonPlacement {
  person: Person;
  relCross: number;
  relPrimary: number;
}

interface HeaderUnionPlacement {
  union: Union;
  spouse: Person | null;
  leftPartnerId: string | null;
  rightPartnerId: string | null;
  singlePartnerId: string | null;
  relCross: number;
  relPrimary: number;
}

interface UnionChildrenGroup {
  union: Union;
  childrenBlocks: FamilyBlock[];
  groupCrossSpan: number;
}

interface FamilyBlock {
  focalPerson: Person;
  generation: number;
  headerPersons: HeaderPersonPlacement[];
  headerUnions: HeaderUnionPlacement[];
  headerCrossSpan: number;
  unionGroups: UnionChildrenGroup[];
  totalChildrenCrossSpan: number;
  crossSpan: number;
}

export function computeLayout(
  graph: FamilyGraph,
  options?: ComputeLayoutOptions,
): TreeLayoutResult {
  const branches = getBranches(graph);

  const hasSubtreeFilter = Boolean(options?.subtreeRootPersonId);
  const hasGenFilter =
    options?.minGeneration !== undefined ||
    options?.maxGeneration !== undefined;

  const activeGraph =
    hasSubtreeFilter || hasGenFilter
      ? filterGraphByScope(graph, {
          branchId: options?.branchId ?? null,
          subtreeRootPersonId: options?.subtreeRootPersonId ?? null,
          minGeneration: options?.minGeneration ?? 1,
          maxGeneration: options?.maxGeneration ?? 99,
        })
      : graph;

  const orientation = options?.orientation ?? 'TOP_DOWN';
  const isTopDown = orientation === 'TOP_DOWN';

  const defaultCardW = options?.cardWidth ?? W;
  const defaultCardH = options?.cardHeight ?? H;
  const gapSpouse = options?.gapSpouse ?? GAP_SPOUSE;
  const gapSibling = options?.gapSibling ?? GAP_SIBLING;
  const gapFamily = options?.gapFamily ?? GAP_FAMILY;
  const rowGap = options?.rowGap ?? ROW_H - H;

  const unionCross = isTopDown ? UNION_W : UNION_H;
  const unionPrimary = isTopDown ? UNION_H : UNION_W;

  function getPersonSize(personId: string): { width: number; height: number } {
    const custom = options?.cardSizeByPersonId?.get(personId);
    return {
      width: custom?.width ?? defaultCardW,
      height: custom?.height ?? defaultCardH,
    };
  }

  function getCrossSpan(personId: string): number {
    const s = getPersonSize(personId);
    return isTopDown ? s.width : s.height;
  }

  function getPrimarySpan(personId: string): number {
    const s = getPersonSize(personId);
    return isTopDown ? s.height : s.width;
  }

  const rootUnions = getRootUnions(activeGraph);
  const rootUnionIds = new Set(rootUnions.map((u) => u.id));

  // When scope filtering already stripped non-branch nodes, branch filter is already applied,
  // unless we are running directly on the unfiltered graph with only `branchId`.
  const activeBranchId =
    !hasSubtreeFilter &&
    !hasGenFilter &&
    options?.branchId &&
    branches.some((b) => b.id === options.branchId)
      ? options.branchId
      : null;

  const visitedPersons = new Set<string>();
  const visitedUnions = new Set<string>();

  function buildBlock(focalPerson: Person, generation: number): FamilyBlock {
    visitedPersons.add(focalPerson.id);

    const rawUnions = activeGraph.unionsByPerson.get(focalPerson.id) ?? [];
    const blockUnions = rawUnions.filter((u) => !visitedUnions.has(u.id));

    for (const u of blockUnions) {
      visitedUnions.add(u.id);
    }

    const headerPersons: HeaderPersonPlacement[] = [];
    const headerUnions: HeaderUnionPlacement[] = [];
    let headerCrossSpan = getCrossSpan(focalPerson.id);

    if (blockUnions.length === 0) {
      headerPersons.push({
        person: focalPerson,
        relCross: 0,
        relPrimary: 0,
      });
      headerCrossSpan = getCrossSpan(focalPerson.id);
    } else if (blockUnions.length === 1) {
      const u = blockUnions[0];
      const spouseId = u.husbandId === focalPerson.id ? u.wifeId : u.husbandId;
      const spouse =
        spouseId && !visitedPersons.has(spouseId)
          ? (activeGraph.persons.get(spouseId) ?? null)
          : null;

      if (spouse) {
        visitedPersons.add(spouse.id);
        const focalIsFirst =
          u.husbandId === focalPerson.id ||
          (focalPerson.gender === 'L' && spouse.gender === 'P');

        const firstPerson = focalIsFirst ? focalPerson : spouse;
        const secondPerson = focalIsFirst ? spouse : focalPerson;

        const firstCross = getCrossSpan(firstPerson.id);
        const secondCross = getCrossSpan(secondPerson.id);
        const maxPrimary = Math.max(
          getPrimarySpan(firstPerson.id),
          getPrimarySpan(secondPerson.id),
        );

        headerPersons.push({
          person: firstPerson,
          relCross: 0,
          relPrimary: 0,
        });
        headerUnions.push({
          union: u,
          spouse,
          leftPartnerId: firstPerson.id,
          rightPartnerId: secondPerson.id,
          singlePartnerId: null,
          relCross: firstCross + (gapSpouse - unionCross) / 2,
          relPrimary: (maxPrimary - unionPrimary) / 2,
        });
        headerPersons.push({
          person: secondPerson,
          relCross: firstCross + gapSpouse,
          relPrimary: 0,
        });
        headerCrossSpan = firstCross + gapSpouse + secondCross;
      } else {
        const focalCross = getCrossSpan(focalPerson.id);
        const focalPrimary = getPrimarySpan(focalPerson.id);
        headerPersons.push({
          person: focalPerson,
          relCross: 0,
          relPrimary: 0,
        });
        headerUnions.push({
          union: u,
          spouse: null,
          leftPartnerId: null,
          rightPartnerId: null,
          singlePartnerId: focalPerson.id,
          relCross: (focalCross - unionCross) / 2,
          relPrimary: focalPrimary + 16,
        });
        headerCrossSpan = focalCross;
      }
    } else {
      // Polygamy / remarriage (2+ unions): place first spouse before focalPerson, remaining spouses after
      let cursorCross = 0;
      const firstUnion = blockUnions[0];
      const firstSpouseId =
        firstUnion.husbandId === focalPerson.id
          ? firstUnion.wifeId
          : firstUnion.husbandId;
      const firstSpouse =
        firstSpouseId && !visitedPersons.has(firstSpouseId)
          ? (activeGraph.persons.get(firstSpouseId) ?? null)
          : null;

      const focalCross = getCrossSpan(focalPerson.id);
      const focalPrimary = getPrimarySpan(focalPerson.id);
      let focalRelCross = 0;

      if (firstSpouse) {
        visitedPersons.add(firstSpouse.id);
        const firstSpouseCross = getCrossSpan(firstSpouse.id);
        const maxPrimary = Math.max(
          getPrimarySpan(firstSpouse.id),
          focalPrimary,
        );

        headerPersons.push({
          person: firstSpouse,
          relCross: cursorCross,
          relPrimary: 0,
        });
        const unionRelCross =
          cursorCross + firstSpouseCross + (gapSpouse - unionCross) / 2;
        cursorCross += firstSpouseCross + gapSpouse;
        focalRelCross = cursorCross;
        headerPersons.push({
          person: focalPerson,
          relCross: focalRelCross,
          relPrimary: 0,
        });
        headerUnions.push({
          union: firstUnion,
          spouse: firstSpouse,
          leftPartnerId: firstSpouse.id,
          rightPartnerId: focalPerson.id,
          singlePartnerId: null,
          relCross: unionRelCross,
          relPrimary: (maxPrimary - unionPrimary) / 2,
        });
        cursorCross += focalCross;
      } else {
        focalRelCross = cursorCross;
        headerPersons.push({
          person: focalPerson,
          relCross: focalRelCross,
          relPrimary: 0,
        });
        headerUnions.push({
          union: firstUnion,
          spouse: null,
          leftPartnerId: null,
          rightPartnerId: null,
          singlePartnerId: focalPerson.id,
          relCross: focalRelCross + (focalCross - unionCross) / 2,
          relPrimary: focalPrimary + 16,
        });
        cursorCross += focalCross;
      }

      for (let i = 1; i < blockUnions.length; i++) {
        const u = blockUnions[i];
        const spouseId = u.husbandId === focalPerson.id ? u.wifeId : u.husbandId;
        const spouse =
          spouseId && !visitedPersons.has(spouseId)
            ? (activeGraph.persons.get(spouseId) ?? null)
            : null;

        if (spouse) {
          visitedPersons.add(spouse.id);
          const spouseCross = getCrossSpan(spouse.id);
          const maxPrimary = Math.max(focalPrimary, getPrimarySpan(spouse.id));
          const unionRelCross = cursorCross + (gapSpouse - unionCross) / 2;
          const spouseRelCross = cursorCross + gapSpouse;
          headerUnions.push({
            union: u,
            spouse,
            leftPartnerId: focalPerson.id,
            rightPartnerId: spouse.id,
            singlePartnerId: null,
            relCross: unionRelCross,
            relPrimary: (maxPrimary - unionPrimary) / 2,
          });
          headerPersons.push({
            person: spouse,
            relCross: spouseRelCross,
            relPrimary: 0,
          });
          cursorCross += gapSpouse + spouseCross;
        } else {
          const unionRelCross = cursorCross + (gapSpouse - unionCross) / 2;
          headerUnions.push({
            union: u,
            spouse: null,
            leftPartnerId: null,
            rightPartnerId: null,
            singlePartnerId: focalPerson.id,
            relCross: unionRelCross,
            relPrimary: focalPrimary + 16,
          });
          cursorCross += gapSpouse;
        }
      }

      headerCrossSpan = cursorCross;
    }

    const unionGroups: UnionChildrenGroup[] = [];
    for (const u of blockUnions) {
      let children = (activeGraph.childrenByUnion.get(u.id) ?? []).filter(
        (c) => !visitedPersons.has(c.id),
      );

      if (activeBranchId && rootUnionIds.has(u.id)) {
        children = children.filter((c) => c.id === activeBranchId);
      }

      const childrenBlocks = children.map((child) =>
        buildBlock(child, generation + 1),
      );

      const groupCrossSpan =
        childrenBlocks.length > 0
          ? childrenBlocks.reduce((acc, b) => acc + b.crossSpan, 0) +
            (childrenBlocks.length - 1) * gapSibling
          : 0;

      unionGroups.push({
        union: u,
        childrenBlocks,
        groupCrossSpan,
      });
    }

    const nonEmptyGroups = unionGroups.filter((g) => g.childrenBlocks.length > 0);
    const totalChildrenCrossSpan =
      nonEmptyGroups.length > 0
        ? nonEmptyGroups.reduce((acc, g) => acc + g.groupCrossSpan, 0) +
          (nonEmptyGroups.length - 1) * gapFamily
        : 0;

    const crossSpan = Math.max(headerCrossSpan, totalChildrenCrossSpan);

    return {
      focalPerson,
      generation,
      headerPersons,
      headerUnions,
      headerCrossSpan,
      unionGroups,
      totalChildrenCrossSpan,
      crossSpan,
    };
  }

  const rootBlocks: FamilyBlock[] = [];

  for (const rootUnion of rootUnions) {
    if (visitedUnions.has(rootUnion.id)) continue;
    const husband = rootUnion.husbandId
      ? activeGraph.persons.get(rootUnion.husbandId)
      : undefined;
    const wife = rootUnion.wifeId
      ? activeGraph.persons.get(rootUnion.wifeId)
      : undefined;
    const focal = husband ?? wife;
    if (focal && !visitedPersons.has(focal.id)) {
      rootBlocks.push(buildBlock(focal, 1));
    }
  }

  // If no branch filter is active on the full graph, include any remaining unvisited root/disconnected persons
  if (!activeBranchId) {
    const remainingPersons = Array.from(activeGraph.persons.values()).filter(
      (p) => !visitedPersons.has(p.id),
    );
    remainingPersons.sort((a, b) => {
      if (a.isBloodLine !== b.isBloodLine) return a.isBloodLine ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'id');
    });

    for (const person of remainingPersons) {
      if (!visitedPersons.has(person.id)) {
        const gen = getGeneration(activeGraph, person.id);
        rootBlocks.push(buildBlock(person, gen));
      }
    }
  }

  // Compute primary-axis coordinates per generation using rowHeightByGeneration and actual card spans
  const maxPersonPrimaryByGen = new Map<number, number>();
  const maxUnionExtentByGen = new Map<number, number>();
  let minGen = Number.POSITIVE_INFINITY;
  let maxGen = 0;

  function collectGenMetrics(block: FamilyBlock) {
    if (block.generation < minGen) minGen = block.generation;
    if (block.generation > maxGen) maxGen = block.generation;

    for (const hp of block.headerPersons) {
      const span = hp.relPrimary + getPrimarySpan(hp.person.id);
      const prev = maxPersonPrimaryByGen.get(block.generation) ?? 0;
      if (span > prev) maxPersonPrimaryByGen.set(block.generation, span);
    }

    for (const hu of block.headerUnions) {
      const extent = hu.relPrimary + unionPrimary;
      const prev = maxUnionExtentByGen.get(block.generation) ?? 0;
      if (extent > prev) maxUnionExtentByGen.set(block.generation, extent);
    }

    for (const group of block.unionGroups) {
      for (const childBlock of group.childrenBlocks) {
        collectGenMetrics(childBlock);
      }
    }
  }

  for (const rb of rootBlocks) {
    collectGenMetrics(rb);
  }

  const genPrimaryStart = new Map<number, number>();
  if (rootBlocks.length > 0 && Number.isFinite(minGen)) {
    let cursorPrimary = 0;
    for (let g = minGen; g <= maxGen; g++) {
      genPrimaryStart.set(g, cursorPrimary);
      const defaultSpan = isTopDown ? defaultCardH : defaultCardW;
      const configuredRowH = isTopDown
        ? (options?.rowHeightByGeneration?.get(g) ?? defaultSpan)
        : defaultSpan;
      const actualCardSpan = maxPersonPrimaryByGen.get(g) ?? defaultSpan;
      const cardRowSpan = Math.max(defaultSpan, configuredRowH, actualCardSpan);
      const unionExtent = maxUnionExtentByGen.get(g) ?? 0;
      const step = Math.max(cardRowSpan + rowGap, unionExtent + 24);
      cursorPrimary += step;
    }
  }

  const nodes: TreeLayoutResult['nodes'] = [];
  const edges: TreeLayoutResult['edges'] = [];
  const renderedPersons: Person[] = [];

  function getSpouseNamesForPerson(personId: string): string[] {
    const pUnions = activeGraph.unionsByPerson.get(personId) ?? [];
    const names: string[] = [];
    for (const u of pUnions) {
      const partnerId = u.husbandId === personId ? u.wifeId : u.husbandId;
      const partner = partnerId ? activeGraph.persons.get(partnerId) : undefined;
      if (partner) {
        names.push(partner.fullName);
      }
    }
    return names;
  }

  function placeBlock(block: FamilyBlock, startCross: number) {
    const basePrimary = genPrimaryStart.get(block.generation) ?? 0;
    const headerStartCross =
      startCross + (block.crossSpan - block.headerCrossSpan) / 2;

    for (const hp of block.headerPersons) {
      const person = hp.person;
      renderedPersons.push(person);

      const size = getPersonSize(person.id);
      const continuationLabel =
        options?.continuationLabelsByPersonId?.get(person.id);

      const nodeData: PersonNodeData = {
        person,
        generation:
          hasSubtreeFilter || hasGenFilter
            ? getGeneration(graph, person.id)
            : block.generation,
        spouseNames: getSpouseNamesForPerson(person.id),
        branchRootId: getBranchRootId(graph, person.id),
        ...(continuationLabel !== undefined ? { continuationLabel } : {}),
      };

      const crossCoord = Math.round(headerStartCross + hp.relCross);
      const primaryCoord = Math.round(basePrimary + hp.relPrimary);

      nodes.push({
        id: person.id,
        type: 'person',
        position: isTopDown
          ? { x: crossCoord, y: primaryCoord }
          : { x: primaryCoord, y: crossCoord },
        width: size.width,
        height: size.height,
        data: nodeData,
      });
    }

    for (const hu of block.headerUnions) {
      const u = hu.union;
      const husband = u.husbandId
        ? activeGraph.persons.get(u.husbandId)
        : undefined;
      const wife = u.wifeId ? activeGraph.persons.get(u.wifeId) : undefined;

      const unionData: UnionNodeData = {
        union: u,
        husbandName: husband?.fullName,
        wifeName: wife?.fullName,
      };

      const crossCoord = Math.round(headerStartCross + hu.relCross);
      const primaryCoord = Math.round(basePrimary + hu.relPrimary);

      nodes.push({
        id: u.id,
        type: 'union',
        position: isTopDown
          ? { x: crossCoord, y: primaryCoord }
          : { x: primaryCoord, y: crossCoord },
        width: UNION_W,
        height: UNION_H,
        data: unionData,
      });

      const isDivorced = u.status === 'divorced';
      const spouseEdgeStyle: Record<string, unknown> = isDivorced
        ? {
            stroke: '#ba1a1a',
            strokeWidth: 1.75,
            strokeDasharray: '6 4',
          }
        : {
            stroke: '#795746',
            strokeWidth: 1.75,
          };

      if (hu.leftPartnerId && hu.rightPartnerId) {
        edges.push({
          id: `edge-spouse-${hu.leftPartnerId}-${u.id}`,
          source: hu.leftPartnerId,
          target: u.id,
          sourceHandle: isTopDown ? 'right' : 'bottom',
          targetHandle: isTopDown ? 'left' : 'top',
          type: 'straight',
          style: { ...spouseEdgeStyle },
          data: { kind: 'spouse', status: u.status },
        });
        edges.push({
          id: `edge-spouse-${hu.rightPartnerId}-${u.id}`,
          source: hu.rightPartnerId,
          target: u.id,
          sourceHandle: isTopDown ? 'left' : 'top',
          targetHandle: isTopDown ? 'right' : 'bottom',
          type: 'straight',
          style: { ...spouseEdgeStyle },
          data: { kind: 'spouse', status: u.status },
        });
      } else if (hu.singlePartnerId) {
        edges.push({
          id: `edge-spouse-${hu.singlePartnerId}-${u.id}`,
          source: hu.singlePartnerId,
          target: u.id,
          sourceHandle: isTopDown ? 'bottom' : 'right',
          targetHandle: isTopDown ? 'top' : 'left',
          type: 'straight',
          style: { ...spouseEdgeStyle },
          data: { kind: 'spouse', status: u.status },
        });
      }
    }

    const nonEmptyGroups = block.unionGroups.filter(
      (g) => g.childrenBlocks.length > 0,
    );
    if (nonEmptyGroups.length > 0) {
      let groupCursorCross =
        startCross + (block.crossSpan - block.totalChildrenCrossSpan) / 2;

      for (let gIdx = 0; gIdx < nonEmptyGroups.length; gIdx++) {
        const group = nonEmptyGroups[gIdx];
        let childCursorCross = groupCursorCross;

        for (let cIdx = 0; cIdx < group.childrenBlocks.length; cIdx++) {
          const childBlock = group.childrenBlocks[cIdx];
          placeBlock(childBlock, childCursorCross);

          edges.push({
            id: `edge-child-${group.union.id}-${childBlock.focalPerson.id}`,
            source: group.union.id,
            target: childBlock.focalPerson.id,
            sourceHandle: isTopDown ? 'bottom' : 'right',
            targetHandle: isTopDown ? 'top' : 'left',
            type: 'default',
            style: {
              stroke: '#8a7265',
              strokeWidth: 1.75,
            },
            data: { kind: 'child', unionId: group.union.id },
          });

          childCursorCross += childBlock.crossSpan + gapSibling;
        }

        groupCursorCross += group.groupCrossSpan + gapFamily;
      }
    }
  }

  let rootCursorCross = 0;
  for (const rootBlock of rootBlocks) {
    placeBlock(rootBlock, rootCursorCross);
    rootCursorCross += rootBlock.crossSpan + gapFamily;
  }

  return {
    nodes,
    edges,
    branches,
    persons: renderedPersons,
  };
}
