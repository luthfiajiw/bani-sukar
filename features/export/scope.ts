import { buildGraph, getBranches, getGeneration, getRootUnions } from '@/features/family/graph';
import type { FamilyGraph, Person, Union } from '@/features/family/types';
import type { ExportScopeOptions } from './types';

function collectBranchScope(
  graph: FamilyGraph,
  branchId: string,
): { personIds: Set<string>; unionIds: Set<string> } | null {
  const branches = getBranches(graph);
  if (!branches.some((b) => b.id === branchId)) {
    return null;
  }

  const personIds = new Set<string>();
  const unionIds = new Set<string>();

  // Keep the Gen 1 root union(s) that parent this branch and their partners
  const rootUnions = getRootUnions(graph);
  for (const rootUnion of rootUnions) {
    const children = graph.childrenByUnion.get(rootUnion.id) ?? [];
    if (children.some((c) => c.id === branchId)) {
      unionIds.add(rootUnion.id);
      if (rootUnion.husbandId && graph.persons.has(rootUnion.husbandId)) {
        personIds.add(rootUnion.husbandId);
      }
      if (rootUnion.wifeId && graph.persons.has(rootUnion.wifeId)) {
        personIds.add(rootUnion.wifeId);
      }
    }
  }

  collectSubtreeRecursive(graph, branchId, personIds, unionIds);
  return { personIds, unionIds };
}

function collectSubtreeRecursive(
  graph: FamilyGraph,
  personId: string,
  personIds: Set<string>,
  unionIds: Set<string>,
  visitedDescent: Set<string> = new Set(),
): void {
  if (visitedDescent.has(personId)) return;
  if (!graph.persons.has(personId)) return;

  visitedDescent.add(personId);
  personIds.add(personId);

  const unions = graph.unionsByPerson.get(personId) ?? [];
  for (const u of unions) {
    unionIds.add(u.id);
    const partnerId = u.husbandId === personId ? u.wifeId : u.husbandId;
    if (partnerId && graph.persons.has(partnerId)) {
      personIds.add(partnerId);
    }

    const children = graph.childrenByUnion.get(u.id) ?? [];
    for (const child of children) {
      collectSubtreeRecursive(graph, child.id, personIds, unionIds, visitedDescent);
    }
  }
}

/**
 * Menyaring graf keluarga secara murni berdasarkan cakupan:
 * - `branchId`: ranting trah Gen-2 (tetap menyertakan pasangan leluhur Gen-1 jika masuk rentang generasi)
 * - `subtreeRootPersonId`: tokoh fokus, pasangan, dan seluruh keturunannya secara rekursif
 * - `minGeneration`..`maxGeneration`: memotong graf pada rentang generasi dan menyesuaikan `parentUnionId`
 */
export function filterGraphByScope(
  graph: FamilyGraph,
  scope: ExportScopeOptions,
): FamilyGraph {
  const minGen = scope.minGeneration ?? 1;
  const maxGen = scope.maxGeneration ?? 99;

  if (minGen > maxGen) {
    return buildGraph([], []);
  }

  const origGenerations = new Map<string, number>();
  for (const personId of graph.persons.keys()) {
    origGenerations.set(personId, getGeneration(graph, personId));
  }

  let allowedPersonIds = new Set<string>(graph.persons.keys());
  let allowedUnionIds: Set<string> | null = null;

  if (scope.branchId) {
    const branchScope = collectBranchScope(graph, scope.branchId);
    if (branchScope) {
      allowedPersonIds = new Set(
        Array.from(allowedPersonIds).filter((id) => branchScope.personIds.has(id)),
      );
      allowedUnionIds = branchScope.unionIds;
    }
  }

  if (scope.subtreeRootPersonId) {
    if (!graph.persons.has(scope.subtreeRootPersonId)) {
      return buildGraph([], []);
    }
    const subtreePersons = new Set<string>();
    const subtreeUnions = new Set<string>();
    collectSubtreeRecursive(
      graph,
      scope.subtreeRootPersonId,
      subtreePersons,
      subtreeUnions,
    );

    allowedPersonIds = new Set(
      Array.from(allowedPersonIds).filter((id) => subtreePersons.has(id)),
    );
    allowedUnionIds = allowedUnionIds
      ? new Set(Array.from(allowedUnionIds).filter((id) => subtreeUnions.has(id)))
      : subtreeUnions;
  }

  // Filter by generation range
  allowedPersonIds = new Set(
    Array.from(allowedPersonIds).filter((id) => {
      const gen = origGenerations.get(id) ?? 1;
      return gen >= minGen && gen <= maxGen;
    }),
  );

  if (allowedPersonIds.size === 0) {
    return buildGraph([], []);
  }

  const filteredUnions: Union[] = [];
  const keptUnionIds = new Set<string>();

  for (const union of graph.unions.values()) {
    if (allowedUnionIds && !allowedUnionIds.has(union.id)) {
      continue;
    }
    const keepHusband = Boolean(union.husbandId && allowedPersonIds.has(union.husbandId));
    const keepWife = Boolean(union.wifeId && allowedPersonIds.has(union.wifeId));

    if (!keepHusband && !keepWife) {
      continue;
    }

    keptUnionIds.add(union.id);
    filteredUnions.push({
      ...union,
      husbandId: keepHusband ? union.husbandId : null,
      wifeId: keepWife ? union.wifeId : null,
    });
  }

  const filteredPersons: Person[] = [];
  for (const personId of allowedPersonIds) {
    const person = graph.persons.get(personId);
    if (!person) continue;

    const hasKeptParentUnion = Boolean(
      person.parentUnionId && keptUnionIds.has(person.parentUnionId),
    );
    filteredPersons.push({
      ...person,
      parentUnionId: hasKeptParentUnion ? person.parentUnionId : null,
    });
  }

  return buildGraph(filteredPersons, filteredUnions);
}
