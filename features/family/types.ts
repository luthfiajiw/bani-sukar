export type Gender = 'L' | 'P';
export type UnionStatus = 'married' | 'divorced' | 'widowed';

export interface Person {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: Gender;
  birthPlace: string | null;
  birthDate: string | null;
  isDeceased: boolean;
  deathDate: string | null;
  isBloodLine: boolean;
  parentUnionId: string | null;
  birthOrder: number | null;
  photoPath?: string | null;
  photoUrl?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Union {
  id: string;
  husbandId: string | null;
  wifeId: string | null;
  status: UnionStatus;
  unionOrder: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface FamilyGraph {
  persons: Map<string, Person>;
  unions: Map<string, Union>;
  childrenByUnion: Map<string, Person[]>;
  unionsByPerson: Map<string, Union[]>;
}

export interface PersonNodeData extends Record<string, unknown> {
  person: Person;
  generation: number;
  spouseNames: string[];
  branchRootId: string | null;
  isHighlighted?: boolean;
}

export interface UnionNodeData extends Record<string, unknown> {
  union: Union;
  husbandName?: string;
  wifeName?: string;
}

export interface TreeLayoutResult {
  nodes: Array<{
    id: string;
    type: 'person' | 'union';
    position: { x: number; y: number };
    data: PersonNodeData | UnionNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string;
    animated?: boolean;
    style?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }>;
  branches: Array<{
    id: string;
    fullName: string;
    order: number;
  }>;
  persons: Person[];
}

export interface PersonDetailData {
  person: Person;
  generation: number;
  parents: {
    father: Person | null;
    mother: Person | null;
    union: Union | null;
  };
  spouses: Array<{
    union: Union;
    spouse: Person | null;
    children: Person[];
  }>;
  children: Person[];
  siblings: Person[];
  stats: {
    spouses: number;
    children: number;
    grandchildren: number;
    greatGrandchildren: number;
  };
  lineagePath: Array<{
    id: string;
    fullName: string;
    generation: number;
  }>;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export interface AdminPersonFilters {
  q?: string | null;
  gender?: string | null;
  status?: string | null;
}

export interface AdminPersonRow extends Person {
  person: Person;
  generation: number;
  parents: {
    father: Person | null;
    mother: Person | null;
    union: Union | null;
  };
  parentNames: string[];
  spouses: Array<{
    union: Union;
    spouse: Person | null;
    children: Person[];
  }>;
  spouseNames: string[];
  children: Person[];
  childrenCount: number;
}

export interface RelationUnionOption {
  id: string;
  union: Union;
  husband: Person | null;
  wife: Person | null;
  husbandName: string;
  wifeName: string;
  label: string;
}

export interface RelationEditorData {
  person: Person;
  generation: number;
  parents: {
    father: Person | null;
    mother: Person | null;
    union: Union | null;
  };
  spouses: Array<{
    union: Union;
    spouse: Person | null;
    children: Person[];
  }>;
  unions: Array<{
    union: Union;
    spouse: Person | null;
    children: Person[];
  }>;
  children: Person[];
  siblings: Person[];
  allPersons: Person[];
  persons: Person[];
  allUnions: RelationUnionOption[];
  availableUnions: RelationUnionOption[];
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: Date | string;
}
