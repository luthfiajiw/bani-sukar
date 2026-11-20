export interface SeedPerson {
  id: string;
  fullName: string;
  nickname: string | null;
  gender: 'L' | 'P';
  birthPlace: string | null;
  birthDate: string | null;
  isDeceased: boolean;
  deathDate: string | null;
  isBloodLine: boolean;
  parentUnionId: string | null;
  birthOrder: number | null;
}

export interface SeedUnion {
  id: string;
  husbandId: string | null;
  wifeId: string | null;
  status: 'married' | 'divorced' | 'widowed';
  unionOrder: number;
}

export const SEED_IDS = {
  // Gen 1 Root
  SUKAR: '10000000-0000-4000-8000-000000000001',
  SADIRAH: '10000000-0000-4000-8000-000000000002',
  UNION_SUKAR_SADIRAH: '90000000-0000-4000-8000-000000000001',

  // Gen 2 Children & Spouses
  // 1. Sukijah & Sutaji
  SUKIJAH: '20000000-0000-4000-8000-000000000001',
  SUTAJI: '20000000-0000-4000-8000-000000000101',
  UNION_SUKIJAH_SUTAJI: '90000000-0000-4000-8000-000000000002',

  // 2. Imam Sanadi & Nuharti
  IMAM_SANADI: '20000000-0000-4000-8000-000000000002',
  NUHARTI: '20000000-0000-4000-8000-000000000102',
  UNION_IMAM_NUHARTI: '90000000-0000-4000-8000-000000000003',

  // 3. Kaenah & Sapawi
  KAENAH: '20000000-0000-4000-8000-000000000003',
  SAPAWI: '20000000-0000-4000-8000-000000000103',
  UNION_KAENAH_SAPAWI: '90000000-0000-4000-8000-000000000004',

  // 4. Kartini & Supardi
  KARTINI: '20000000-0000-4000-8000-000000000004',
  SUPARDI: '20000000-0000-4000-8000-000000000104',
  UNION_KARTINI_SUPARDI: '90000000-0000-4000-8000-000000000005',

  // 5. Darkasan & Kami
  DARKASAN: '20000000-0000-4000-8000-000000000005',
  KAMI: '20000000-0000-4000-8000-000000000105',
  UNION_DARKASAN_KAMI: '90000000-0000-4000-8000-000000000006',

  // 6. Warsini & Raji
  WARSINI: '20000000-0000-4000-8000-000000000006',
  RAJI: '20000000-0000-4000-8000-000000000106',
  UNION_WARSINI_RAJI: '90000000-0000-4000-8000-000000000007',
} as const;

export const SEED_PERSONS: SeedPerson[] = [
  // Gen 1 Root
  {
    id: SEED_IDS.SUKAR,
    fullName: 'Sukar',
    nickname: 'Mbah Sukar',
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: null,
    isDeceased: true,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: null,
    birthOrder: null,
  },
  {
    id: SEED_IDS.SADIRAH,
    fullName: 'Sadirah',
    nickname: 'Mbah Sadirah',
    gender: 'P',
    birthPlace: 'Pati',
    birthDate: null,
    isDeceased: true,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: null,
    birthOrder: null,
  },

  // Gen 2 Children & Spouses
  // 1. Sukijah & Sutaji
  {
    id: SEED_IDS.SUKIJAH,
    fullName: 'Sukijah',
    nickname: 'Sukijah',
    gender: 'P',
    birthPlace: 'Pati',
    birthDate: '1948-04-04',
    isDeceased: true,
    deathDate: '2014-09-05',
    isBloodLine: true,
    parentUnionId: SEED_IDS.UNION_SUKAR_SADIRAH,
    birthOrder: 1,
  },
  {
    id: SEED_IDS.SUTAJI,
    fullName: 'Sutaji',
    nickname: 'Sutaji',
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: '1943-04-03',
    isDeceased: true,
    deathDate: '2022-06-25',
    isBloodLine: false,
    parentUnionId: null,
    birthOrder: null,
  },

  // 2. Imam Sanadi & Nuharti
  {
    id: SEED_IDS.IMAM_SANADI,
    fullName: 'Imam Sanadi',
    nickname: 'Imam Sanadi',
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: null,
    isDeceased: true,
    deathDate: '1991-03-27',
    isBloodLine: true,
    parentUnionId: SEED_IDS.UNION_SUKAR_SADIRAH,
    birthOrder: 2,
  },
  {
    id: SEED_IDS.NUHARTI,
    fullName: 'Nuharti',
    nickname: 'Nuharti',
    gender: 'P',
    birthPlace: 'Pati',
    birthDate: '1957-07-01',
    isDeceased: true,
    deathDate: '2021-06-22',
    isBloodLine: false,
    parentUnionId: null,
    birthOrder: null,
  },

  // 3. Kaenah & Sapawi
  {
    id: SEED_IDS.KAENAH,
    fullName: 'Kaenah',
    nickname: 'Kaenah',
    gender: 'P',
    birthPlace: 'Pati',
    birthDate: '1958-07-01',
    isDeceased: false,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: SEED_IDS.UNION_SUKAR_SADIRAH,
    birthOrder: 3,
  },
  {
    id: SEED_IDS.SAPAWI,
    fullName: 'Sapawi',
    nickname: 'Sapawi',
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: '1942-07-01',
    isDeceased: true,
    deathDate: '2021-08-06',
    isBloodLine: false,
    parentUnionId: null,
    birthOrder: null,
  },

  // 4. Kartini & Supardi
  {
    id: SEED_IDS.KARTINI,
    fullName: 'Kartini',
    nickname: 'Kartini',
    gender: 'P',
    birthPlace: 'Pati',
    birthDate: '1958-08-27',
    isDeceased: false,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: SEED_IDS.UNION_SUKAR_SADIRAH,
    birthOrder: 4,
  },
  {
    id: SEED_IDS.SUPARDI,
    fullName: 'Supardi',
    nickname: 'Supardi',
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: '1957-07-01',
    isDeceased: false,
    deathDate: null,
    isBloodLine: false,
    parentUnionId: null,
    birthOrder: null,
  },

  // 5. Darkasan & Kami
  {
    id: SEED_IDS.DARKASAN,
    fullName: 'Darkasan',
    nickname: 'Darkasan',
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: '1963-07-20',
    isDeceased: false,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: SEED_IDS.UNION_SUKAR_SADIRAH,
    birthOrder: 5,
  },
  {
    id: SEED_IDS.KAMI,
    fullName: 'Kami',
    nickname: 'Kami',
    gender: 'P',
    birthPlace: 'Pati',
    birthDate: '1976-09-11',
    isDeceased: false,
    deathDate: null,
    isBloodLine: false,
    parentUnionId: null,
    birthOrder: null,
  },

  // 6. Warsini & Raji
  {
    id: SEED_IDS.WARSINI,
    fullName: 'Warsini',
    nickname: 'Warsini',
    gender: 'P',
    birthPlace: 'Pati',
    birthDate: '1965-10-24',
    isDeceased: false,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: SEED_IDS.UNION_SUKAR_SADIRAH,
    birthOrder: 6,
  },
  {
    id: SEED_IDS.RAJI,
    fullName: 'Raji',
    nickname: 'Raji',
    gender: 'L',
    birthPlace: 'Pati',
    birthDate: '1960-07-01',
    isDeceased: false,
    deathDate: null,
    isBloodLine: false,
    parentUnionId: null,
    birthOrder: null,
  },
];

export const SEED_UNIONS: SeedUnion[] = [
  {
    id: SEED_IDS.UNION_SUKAR_SADIRAH,
    husbandId: SEED_IDS.SUKAR,
    wifeId: SEED_IDS.SADIRAH,
    status: 'married',
    unionOrder: 1,
  },
  {
    id: SEED_IDS.UNION_SUKIJAH_SUTAJI,
    husbandId: SEED_IDS.SUTAJI,
    wifeId: SEED_IDS.SUKIJAH,
    status: 'married',
    unionOrder: 1,
  },
  {
    id: SEED_IDS.UNION_IMAM_NUHARTI,
    husbandId: SEED_IDS.IMAM_SANADI,
    wifeId: SEED_IDS.NUHARTI,
    status: 'married',
    unionOrder: 1,
  },
  {
    id: SEED_IDS.UNION_KAENAH_SAPAWI,
    husbandId: SEED_IDS.SAPAWI,
    wifeId: SEED_IDS.KAENAH,
    status: 'widowed',
    unionOrder: 1,
  },
  {
    id: SEED_IDS.UNION_KARTINI_SUPARDI,
    husbandId: SEED_IDS.SUPARDI,
    wifeId: SEED_IDS.KARTINI,
    status: 'married',
    unionOrder: 1,
  },
  {
    id: SEED_IDS.UNION_DARKASAN_KAMI,
    husbandId: SEED_IDS.DARKASAN,
    wifeId: SEED_IDS.KAMI,
    status: 'married',
    unionOrder: 1,
  },
  {
    id: SEED_IDS.UNION_WARSINI_RAJI,
    husbandId: SEED_IDS.RAJI,
    wifeId: SEED_IDS.WARSINI,
    status: 'married',
    unionOrder: 1,
  },
];
