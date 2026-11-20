import type { FamilyGraph, Person, Union } from './types';

function compareChildren(a: Person, b: Person): number {
  const orderA = a.birthOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.birthOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  if (a.birthDate && b.birthDate && a.birthDate !== b.birthDate) {
    return a.birthDate.localeCompare(b.birthDate);
  }
  if (a.birthDate && !b.birthDate) return -1;
  if (!a.birthDate && b.birthDate) return 1;

  return a.fullName.localeCompare(b.fullName, 'id');
}

function compareUnions(a: Union, b: Union): number {
  if (a.unionOrder !== b.unionOrder) {
    return a.unionOrder - b.unionOrder;
  }
  return a.id.localeCompare(b.id);
}

export function buildGraph(persons: Person[], unions: Union[]): FamilyGraph {
  const personMap = new Map<string, Person>();
  const unionMap = new Map<string, Union>();
  const childrenByUnion = new Map<string, Person[]>();
  const unionsByPerson = new Map<string, Union[]>();

  for (const person of persons) {
    personMap.set(person.id, person);
    unionsByPerson.set(person.id, []);
  }

  const sortedUnions = [...unions].sort(compareUnions);
  for (const union of sortedUnions) {
    unionMap.set(union.id, union);
    childrenByUnion.set(union.id, []);

    if (union.husbandId) {
      const list = unionsByPerson.get(union.husbandId) ?? [];
      list.push(union);
      unionsByPerson.set(union.husbandId, list);
    }
    if (union.wifeId && union.wifeId !== union.husbandId) {
      const list = unionsByPerson.get(union.wifeId) ?? [];
      list.push(union);
      unionsByPerson.set(union.wifeId, list);
    }
  }

  for (const person of persons) {
    if (person.parentUnionId) {
      const list = childrenByUnion.get(person.parentUnionId) ?? [];
      list.push(person);
      childrenByUnion.set(person.parentUnionId, list);
    }
  }

  for (const [unionId, children] of childrenByUnion.entries()) {
    children.sort(compareChildren);
    childrenByUnion.set(unionId, children);
  }

  for (const [personId, personUnions] of unionsByPerson.entries()) {
    personUnions.sort(compareUnions);
    unionsByPerson.set(personId, personUnions);
  }

  return {
    persons: personMap,
    unions: unionMap,
    childrenByUnion,
    unionsByPerson,
  };
}

export function getAncestors(graph: FamilyGraph, personId: string): Set<string> {
  const ancestors = new Set<string>();
  const visited = new Set<string>();

  function traverse(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const person = graph.persons.get(currentId);
    if (!person || !person.parentUnionId) return;

    const parentUnion = graph.unions.get(person.parentUnionId);
    if (!parentUnion) return;

    if (parentUnion.husbandId && parentUnion.husbandId !== personId) {
      ancestors.add(parentUnion.husbandId);
      traverse(parentUnion.husbandId);
    }
    if (parentUnion.wifeId && parentUnion.wifeId !== personId) {
      ancestors.add(parentUnion.wifeId);
      traverse(parentUnion.wifeId);
    }
  }

  traverse(personId);
  return ancestors;
}

function getDirectChildrenOfPerson(graph: FamilyGraph, personId: string): Person[] {
  const unions = graph.unionsByPerson.get(personId) ?? [];
  const seen = new Set<string>();
  const result: Person[] = [];

  for (const union of unions) {
    const children = graph.childrenByUnion.get(union.id) ?? [];
    for (const child of children) {
      if (!seen.has(child.id)) {
        seen.add(child.id);
        result.push(child);
      }
    }
  }

  return result;
}

export function getDescendantStats(
  graph: FamilyGraph,
  personId: string
): {
  spouses: number;
  children: number;
  grandchildren: number;
  greatGrandchildren: number;
} {
  const unions = graph.unionsByPerson.get(personId) ?? [];
  const spouseIds = new Set<string>();
  let unionWithoutNamedPartnerCount = 0;

  for (const union of unions) {
    const partnerId =
      union.husbandId === personId ? union.wifeId : union.husbandId;
    if (partnerId) {
      spouseIds.add(partnerId);
    } else {
      unionWithoutNamedPartnerCount += 1;
    }
  }

  const children = getDirectChildrenOfPerson(graph, personId);

  const grandchildrenMap = new Map<string, Person>();
  for (const child of children) {
    for (const gc of getDirectChildrenOfPerson(graph, child.id)) {
      grandchildrenMap.set(gc.id, gc);
    }
  }
  const grandchildren = Array.from(grandchildrenMap.values());

  const greatGrandchildrenMap = new Map<string, Person>();
  for (const gc of grandchildren) {
    for (const ggc of getDirectChildrenOfPerson(graph, gc.id)) {
      greatGrandchildrenMap.set(ggc.id, ggc);
    }
  }

  return {
    spouses: spouseIds.size + unionWithoutNamedPartnerCount,
    children: children.length,
    grandchildren: grandchildren.length,
    greatGrandchildren: greatGrandchildrenMap.size,
  };
}

function getBloodlineGeneration(
  graph: FamilyGraph,
  personId: string,
  visited: Set<string>
): number | null {
  if (visited.has(personId)) return 1;
  visited.add(personId);

  const person = graph.persons.get(personId);
  if (!person) return 1;

  if (person.parentUnionId) {
    const parentUnion = graph.unions.get(person.parentUnionId);
    if (!parentUnion) return 1;

    const parentCandidates = [parentUnion.husbandId, parentUnion.wifeId]
      .filter((id): id is string => Boolean(id) && !visited.has(id!))
      .map((id) => graph.persons.get(id))
      .filter((p): p is Person => Boolean(p));

    if (parentCandidates.length === 0) return 2;

    const bloodParents = parentCandidates.filter(
      (p) => Boolean(p.parentUnionId) || p.isBloodLine
    );
    const activeParents =
      bloodParents.length > 0 ? bloodParents : parentCandidates;

    let maxParentGen = 1;
    for (const parent of activeParents) {
      const gen = getBloodlineGeneration(graph, parent.id, new Set(visited));
      if (gen !== null && gen > maxParentGen) {
        maxParentGen = gen;
      }
    }
    return maxParentGen + 1;
  }

  if (person.isBloodLine) {
    return 1;
  }

  return null;
}

export function getGeneration(graph: FamilyGraph, personId: string): number {
  const person = graph.persons.get(personId);
  if (!person) return 1;

  const directGen = getBloodlineGeneration(graph, personId, new Set());
  if (directGen !== null) {
    return directGen;
  }

  // Non-bloodline spouse without parentUnionId inherits generation from spouse
  const unions = graph.unionsByPerson.get(personId) ?? [];
  for (const union of unions) {
    const partnerId =
      union.husbandId === personId ? union.wifeId : union.husbandId;
    if (partnerId) {
      const partnerGen = getBloodlineGeneration(graph, partnerId, new Set());
      if (partnerGen !== null) {
        return partnerGen;
      }
    }
  }

  return 1;
}

export function getRootUnions(graph: FamilyGraph): Union[] {
  const roots: Union[] = [];

  for (const union of graph.unions.values()) {
    const husband = union.husbandId
      ? graph.persons.get(union.husbandId)
      : undefined;
    const wife = union.wifeId ? graph.persons.get(union.wifeId) : undefined;

    const husbandHasParents = Boolean(husband?.parentUnionId);
    const wifeHasParents = Boolean(wife?.parentUnionId);

    if (husbandHasParents || wifeHasParents) {
      continue;
    }

    const hasBloodlineRoot =
      Boolean(husband?.isBloodLine) || Boolean(wife?.isBloodLine);
    if (hasBloodlineRoot) {
      roots.push(union);
    }
  }

  roots.sort(compareUnions);
  return roots;
}

export function getBranches(
  graph: FamilyGraph
): Array<{ id: string; fullName: string; order: number }> {
  const rootUnions = getRootUnions(graph);
  const branches: Array<{ id: string; fullName: string; order: number }> = [];
  const seen = new Set<string>();

  for (const rootUnion of rootUnions) {
    const children = graph.childrenByUnion.get(rootUnion.id) ?? [];
    children.forEach((child, idx) => {
      if (!seen.has(child.id)) {
        seen.add(child.id);
        branches.push({
          id: child.id,
          fullName: child.fullName,
          order: child.birthOrder ?? idx + 1,
        });
      }
    });
  }

  return branches;
}

function choosePrimaryParent(graph: FamilyGraph, union: Union): Person | null {
  const husband = union.husbandId
    ? (graph.persons.get(union.husbandId) ?? null)
    : null;
  const wife = union.wifeId ? (graph.persons.get(union.wifeId) ?? null) : null;

  if (husband && wife) {
    // Prefer the parent who descends from an earlier union in the tree
    if (husband.parentUnionId && !wife.parentUnionId) return husband;
    if (wife.parentUnionId && !husband.parentUnionId) return wife;
    // Next prefer bloodline marker
    if (husband.isBloodLine && !wife.isBloodLine) return husband;
    if (wife.isBloodLine && !husband.isBloodLine) return wife;
    return husband;
  }

  return husband ?? wife;
}

export function getLineagePath(
  graph: FamilyGraph,
  personId: string
): Array<{ id: string; fullName: string; generation: number }> {
  const person = graph.persons.get(personId);
  if (!person) return [];

  const path: Array<{ id: string; fullName: string; generation: number }> = [];
  const visited = new Set<string>();

  let current: Person | null = person;

  // If focal person is a non-bloodline spouse without parentUnionId, start with them and trace their bloodline spouse's ancestors
  if (!current.parentUnionId && !current.isBloodLine) {
    const gen = getGeneration(graph, current.id);
    path.push({
      id: current.id,
      fullName: current.fullName,
      generation: gen,
    });
    visited.add(current.id);

    const unions = graph.unionsByPerson.get(current.id) ?? [];
    let bloodSpouse: Person | null = null;
    for (const u of unions) {
      const partnerId = u.husbandId === current.id ? u.wifeId : u.husbandId;
      const partner = partnerId ? graph.persons.get(partnerId) : null;
      if (partner && (partner.parentUnionId || partner.isBloodLine)) {
        bloodSpouse = partner;
        break;
      }
    }

    if (bloodSpouse && bloodSpouse.parentUnionId) {
      const parentUnion = graph.unions.get(bloodSpouse.parentUnionId);
      current = parentUnion ? choosePrimaryParent(graph, parentUnion) : null;
    } else {
      current = null;
    }
  }

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.push({
      id: current.id,
      fullName: current.fullName,
      generation: getGeneration(graph, current.id),
    });

    if (!current.parentUnionId) {
      break;
    }
    const parentUnion = graph.unions.get(current.parentUnionId);
    if (!parentUnion) {
      break;
    }
    current = choosePrimaryParent(graph, parentUnion);
  }

  return path.reverse();
}

export function getBranchRootId(
  graph: FamilyGraph,
  personId: string
): string | null {
  const branchIds = new Set(getBranches(graph).map((b) => b.id));
  if (branchIds.has(personId)) {
    return personId;
  }

  const person = graph.persons.get(personId);
  if (!person) return null;

  // Check if person is a spouse of a branch root or descendant
  let targetId = personId;
  if (!person.parentUnionId && !person.isBloodLine) {
    const unions = graph.unionsByPerson.get(personId) ?? [];
    for (const u of unions) {
      const partnerId = u.husbandId === personId ? u.wifeId : u.husbandId;
      if (partnerId) {
        if (branchIds.has(partnerId)) return partnerId;
        targetId = partnerId;
        break;
      }
    }
  }

  const lineage = getLineagePath(graph, targetId);
  for (const item of lineage) {
    if (branchIds.has(item.id)) {
      return item.id;
    }
  }

  return null;
}
