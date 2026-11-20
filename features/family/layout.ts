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
export const H = 84;
export const UNION_W = 28;
export const UNION_H = 28;
export const GAP_SPOUSE = 56;
export const GAP_SIBLING = 36;
export const GAP_FAMILY = 72;
export const ROW_H = 210;

interface HeaderPersonPlacement {
  person: Person;
  relX: number;
  relY: number;
}

interface HeaderUnionPlacement {
  union: Union;
  spouse: Person | null;
  leftPartnerId: string | null;
  rightPartnerId: string | null;
  singlePartnerId: string | null;
  relX: number;
  relY: number;
}

interface UnionChildrenGroup {
  union: Union;
  childrenBlocks: FamilyBlock[];
  groupWidth: number;
}

interface FamilyBlock {
  focalPerson: Person;
  generation: number;
  headerPersons: HeaderPersonPlacement[];
  headerUnions: HeaderUnionPlacement[];
  headerWidth: number;
  unionGroups: UnionChildrenGroup[];
  totalChildrenWidth: number;
  width: number;
}

export function computeLayout(
  graph: FamilyGraph,
  options?: { branchId?: string | null }
): TreeLayoutResult {
  const branches = getBranches(graph);
  const rootUnions = getRootUnions(graph);
  const rootUnionIds = new Set(rootUnions.map((u) => u.id));

  const activeBranchId =
    options?.branchId && branches.some((b) => b.id === options.branchId)
      ? options.branchId
      : null;

  const visitedPersons = new Set<string>();
  const visitedUnions = new Set<string>();

  function buildBlock(focalPerson: Person, generation: number): FamilyBlock {
    visitedPersons.add(focalPerson.id);

    const rawUnions = graph.unionsByPerson.get(focalPerson.id) ?? [];
    const blockUnions = rawUnions.filter((u) => !visitedUnions.has(u.id));

    for (const u of blockUnions) {
      visitedUnions.add(u.id);
    }

    const headerPersons: HeaderPersonPlacement[] = [];
    const headerUnions: HeaderUnionPlacement[] = [];
    let headerWidth = W;

    if (blockUnions.length === 0) {
      headerPersons.push({
        person: focalPerson,
        relX: 0,
        relY: 0,
      });
      headerWidth = W;
    } else if (blockUnions.length === 1) {
      const u = blockUnions[0];
      const spouseId =
        u.husbandId === focalPerson.id ? u.wifeId : u.husbandId;
      const spouse =
        spouseId && !visitedPersons.has(spouseId)
          ? (graph.persons.get(spouseId) ?? null)
          : null;

      if (spouse) {
        visitedPersons.add(spouse.id);
        const focalIsLeft =
          u.husbandId === focalPerson.id ||
          (focalPerson.gender === 'L' && spouse.gender === 'P');

        const leftPerson = focalIsLeft ? focalPerson : spouse;
        const rightPerson = focalIsLeft ? spouse : focalPerson;

        headerPersons.push({
          person: leftPerson,
          relX: 0,
          relY: 0,
        });
        headerUnions.push({
          union: u,
          spouse,
          leftPartnerId: leftPerson.id,
          rightPartnerId: rightPerson.id,
          singlePartnerId: null,
          relX: W + (GAP_SPOUSE - UNION_W) / 2,
          relY: (H - UNION_H) / 2,
        });
        headerPersons.push({
          person: rightPerson,
          relX: W + GAP_SPOUSE,
          relY: 0,
        });
        headerWidth = W + GAP_SPOUSE + W;
      } else {
        headerPersons.push({
          person: focalPerson,
          relX: 0,
          relY: 0,
        });
        headerUnions.push({
          union: u,
          spouse: null,
          leftPartnerId: null,
          rightPartnerId: null,
          singlePartnerId: focalPerson.id,
          relX: (W - UNION_W) / 2,
          relY: H + 16,
        });
        headerWidth = W;
      }
    } else {
      // Polygamy / remarriage (2+ unions): place first spouse on left of focalPerson, remaining spouses on right
      let cursorX = 0;
      const firstUnion = blockUnions[0];
      const firstSpouseId =
        firstUnion.husbandId === focalPerson.id
          ? firstUnion.wifeId
          : firstUnion.husbandId;
      const firstSpouse =
        firstSpouseId && !visitedPersons.has(firstSpouseId)
          ? (graph.persons.get(firstSpouseId) ?? null)
          : null;

      let focalRelX = 0;

      if (firstSpouse) {
        visitedPersons.add(firstSpouse.id);
        headerPersons.push({
          person: firstSpouse,
          relX: cursorX,
          relY: 0,
        });
        const unionRelX = cursorX + W + (GAP_SPOUSE - UNION_W) / 2;
        cursorX += W + GAP_SPOUSE;
        focalRelX = cursorX;
        headerPersons.push({
          person: focalPerson,
          relX: focalRelX,
          relY: 0,
        });
        headerUnions.push({
          union: firstUnion,
          spouse: firstSpouse,
          leftPartnerId: firstSpouse.id,
          rightPartnerId: focalPerson.id,
          singlePartnerId: null,
          relX: unionRelX,
          relY: (H - UNION_H) / 2,
        });
        cursorX += W;
      } else {
        focalRelX = cursorX;
        headerPersons.push({
          person: focalPerson,
          relX: focalRelX,
          relY: 0,
        });
        headerUnions.push({
          union: firstUnion,
          spouse: null,
          leftPartnerId: null,
          rightPartnerId: null,
          singlePartnerId: focalPerson.id,
          relX: focalRelX + (W - UNION_W) / 2,
          relY: H + 16,
        });
        cursorX += W;
      }

      for (let i = 1; i < blockUnions.length; i++) {
        const u = blockUnions[i];
        const spouseId =
          u.husbandId === focalPerson.id ? u.wifeId : u.husbandId;
        const spouse =
          spouseId && !visitedPersons.has(spouseId)
            ? (graph.persons.get(spouseId) ?? null)
            : null;

        if (spouse) {
          visitedPersons.add(spouse.id);
          const unionRelX = cursorX + (GAP_SPOUSE - UNION_W) / 2;
          const spouseRelX = cursorX + GAP_SPOUSE;
          headerUnions.push({
            union: u,
            spouse,
            leftPartnerId: focalPerson.id,
            rightPartnerId: spouse.id,
            singlePartnerId: null,
            relX: unionRelX,
            relY: (H - UNION_H) / 2,
          });
          headerPersons.push({
            person: spouse,
            relX: spouseRelX,
            relY: 0,
          });
          cursorX += GAP_SPOUSE + W;
        } else {
          const unionRelX = cursorX + (GAP_SPOUSE - UNION_W) / 2;
          headerUnions.push({
            union: u,
            spouse: null,
            leftPartnerId: null,
            rightPartnerId: null,
            singlePartnerId: focalPerson.id,
            relX: unionRelX,
            relY: H + 16,
          });
          cursorX += GAP_SPOUSE;
        }
      }

      headerWidth = cursorX;
    }

    const unionGroups: UnionChildrenGroup[] = [];
    for (const u of blockUnions) {
      let children = (graph.childrenByUnion.get(u.id) ?? []).filter(
        (c) => !visitedPersons.has(c.id)
      );

      // Apply branch filtering at the root union level
      if (activeBranchId && rootUnionIds.has(u.id)) {
        children = children.filter((c) => c.id === activeBranchId);
      }

      const childrenBlocks = children.map((child) =>
        buildBlock(child, generation + 1)
      );

      const groupWidth =
        childrenBlocks.length > 0
          ? childrenBlocks.reduce((acc, b) => acc + b.width, 0) +
            (childrenBlocks.length - 1) * GAP_SIBLING
          : 0;

      unionGroups.push({
        union: u,
        childrenBlocks,
        groupWidth,
      });
    }

    const nonEmptyGroups = unionGroups.filter(
      (g) => g.childrenBlocks.length > 0
    );
    const totalChildrenWidth =
      nonEmptyGroups.length > 0
        ? nonEmptyGroups.reduce((acc, g) => acc + g.groupWidth, 0) +
          (nonEmptyGroups.length - 1) * GAP_FAMILY
        : 0;

    const width = Math.max(headerWidth, totalChildrenWidth);

    return {
      focalPerson,
      generation,
      headerPersons,
      headerUnions,
      headerWidth,
      unionGroups,
      totalChildrenWidth,
      width,
    };
  }

  const rootBlocks: FamilyBlock[] = [];

  for (const rootUnion of rootUnions) {
    if (visitedUnions.has(rootUnion.id)) continue;
    const husband = rootUnion.husbandId
      ? graph.persons.get(rootUnion.husbandId)
      : undefined;
    const wife = rootUnion.wifeId
      ? graph.persons.get(rootUnion.wifeId)
      : undefined;
    const focal = husband ?? wife;
    if (focal && !visitedPersons.has(focal.id)) {
      rootBlocks.push(buildBlock(focal, 1));
    }
  }

  // If no branch filter is active, include any remaining unvisited root/disconnected persons
  if (!activeBranchId) {
    const remainingPersons = Array.from(graph.persons.values()).filter(
      (p) => !visitedPersons.has(p.id)
    );
    // Prioritize persons without parentUnionId who are bloodline
    remainingPersons.sort((a, b) => {
      if (a.isBloodLine !== b.isBloodLine) return a.isBloodLine ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'id');
    });

    for (const person of remainingPersons) {
      if (!visitedPersons.has(person.id)) {
        const gen = getGeneration(graph, person.id);
        rootBlocks.push(buildBlock(person, gen));
      }
    }
  }

  const nodes: TreeLayoutResult['nodes'] = [];
  const edges: TreeLayoutResult['edges'] = [];
  const renderedPersons: Person[] = [];

  function getSpouseNamesForPerson(personId: string): string[] {
    const pUnions = graph.unionsByPerson.get(personId) ?? [];
    const names: string[] = [];
    for (const u of pUnions) {
      const partnerId = u.husbandId === personId ? u.wifeId : u.husbandId;
      const partner = partnerId ? graph.persons.get(partnerId) : undefined;
      if (partner) {
        names.push(partner.fullName);
      }
    }
    return names;
  }

  function placeBlock(block: FamilyBlock, leftX: number) {
    const baseY = (block.generation - 1) * ROW_H;
    const headerStartX = leftX + (block.width - block.headerWidth) / 2;

    for (const hp of block.headerPersons) {
      const person = hp.person;
      renderedPersons.push(person);

      const nodeData: PersonNodeData = {
        person,
        generation: block.generation,
        spouseNames: getSpouseNamesForPerson(person.id),
        branchRootId: getBranchRootId(graph, person.id),
      };

      nodes.push({
        id: person.id,
        type: 'person',
        position: {
          x: Math.round(headerStartX + hp.relX),
          y: Math.round(baseY + hp.relY),
        },
        data: nodeData,
      });
    }

    for (const hu of block.headerUnions) {
      const u = hu.union;
      const husband = u.husbandId ? graph.persons.get(u.husbandId) : undefined;
      const wife = u.wifeId ? graph.persons.get(u.wifeId) : undefined;

      const unionData: UnionNodeData = {
        union: u,
        husbandName: husband?.fullName,
        wifeName: wife?.fullName,
      };

      nodes.push({
        id: u.id,
        type: 'union',
        position: {
          x: Math.round(headerStartX + hu.relX),
          y: Math.round(baseY + hu.relY),
        },
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
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'straight',
          style: { ...spouseEdgeStyle },
          data: { kind: 'spouse', status: u.status },
        });
        edges.push({
          id: `edge-spouse-${hu.rightPartnerId}-${u.id}`,
          source: hu.rightPartnerId,
          target: u.id,
          sourceHandle: 'left',
          targetHandle: 'right',
          type: 'straight',
          style: { ...spouseEdgeStyle },
          data: { kind: 'spouse', status: u.status },
        });
      } else if (hu.singlePartnerId) {
        edges.push({
          id: `edge-spouse-${hu.singlePartnerId}-${u.id}`,
          source: hu.singlePartnerId,
          target: u.id,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'straight',
          style: { ...spouseEdgeStyle },
          data: { kind: 'spouse', status: u.status },
        });
      }
    }

    const nonEmptyGroups = block.unionGroups.filter(
      (g) => g.childrenBlocks.length > 0
    );
    if (nonEmptyGroups.length > 0) {
      let groupCursorX = leftX + (block.width - block.totalChildrenWidth) / 2;

      for (let gIdx = 0; gIdx < nonEmptyGroups.length; gIdx++) {
        const group = nonEmptyGroups[gIdx];
        let childCursorX = groupCursorX;

        for (let cIdx = 0; cIdx < group.childrenBlocks.length; cIdx++) {
          const childBlock = group.childrenBlocks[cIdx];
          placeBlock(childBlock, childCursorX);

          edges.push({
            id: `edge-child-${group.union.id}-${childBlock.focalPerson.id}`,
            source: group.union.id,
            target: childBlock.focalPerson.id,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'default',
            style: {
              stroke: '#8a7265',
              strokeWidth: 1.75,
            },
            data: { kind: 'child', unionId: group.union.id },
          });

          childCursorX += childBlock.width + GAP_SIBLING;
        }

        groupCursorX += group.groupWidth + GAP_FAMILY;
      }
    }
  }

  let rootCursorX = 0;
  for (const rootBlock of rootBlocks) {
    placeBlock(rootBlock, rootCursorX);
    rootCursorX += rootBlock.width + GAP_FAMILY;
  }

  return {
    nodes,
    edges,
    branches,
    persons: renderedPersons,
  };
}
