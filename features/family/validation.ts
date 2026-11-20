import { z } from 'zod';
import { getAncestors } from './graph';
import type { FamilyGraph, Person } from './types';

const nullableTrimmedString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined || val === null) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const dateStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined || val === null) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((val) => val === null || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: 'Format tanggal harus YYYY-MM-DD.',
  });

export const personInputSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Nama lengkap minimal 2 karakter.')
      .max(160, 'Nama lengkap terlalu panjang.'),
    nickname: nullableTrimmedString,
    gender: z.enum(['L', 'P'], {
      message: 'Jenis kelamin harus L (Laki-laki) atau P (Perempuan).',
    }),
    birthPlace: nullableTrimmedString,
    birthDate: dateStringSchema,
    isDeceased: z.boolean().default(false),
    deathDate: dateStringSchema,
    isBloodLine: z.boolean().default(true),
    parentUnionId: nullableTrimmedString,
    birthOrder: z.number().int().min(1).nullable().optional().default(null),
  })
  .superRefine((data, ctx) => {
    if (!data.isDeceased && data.deathDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deathDate'],
        message: 'Tanggal wafat hanya boleh diisi jika anggota telah wafat.',
      });
    }

    if (data.birthDate && data.deathDate && data.deathDate < data.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deathDate'],
        message: 'Tanggal wafat tidak boleh lebih awal dari tanggal lahir.',
      });
    }
  });

export type PersonInput = z.input<typeof personInputSchema>;
export type ParsedPersonInput = z.output<typeof personInputSchema>;

export const unionInputSchema = z
  .object({
    husbandId: nullableTrimmedString,
    wifeId: nullableTrimmedString,
    status: z.enum(['married', 'divorced', 'widowed']).default('married'),
    unionOrder: z.number().int().min(1).optional().default(1),
  })
  .superRefine((data, ctx) => {
    if (!data.husbandId && !data.wifeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['husbandId'],
        message: 'Minimal salah satu pasangan (suami atau istri) harus dipilih.',
      });
    }

    if (data.husbandId && data.wifeId && data.husbandId === data.wifeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wifeId'],
        message: 'Suami dan istri tidak boleh orang yang sama.',
      });
    }
  });

export type UnionInput = z.input<typeof unionInputSchema>;
export type ParsedUnionInput = z.output<typeof unionInputSchema>;

export const reorderChildrenSchema = z.object({
  unionId: z.string().trim().min(1, 'ID pernikahan wajib diisi.'),
  orderedChildIds: z
    .array(z.string().trim().min(1))
    .min(1, 'Daftar urutan anak tidak boleh kosong.'),
});

export type ReorderChildrenInput = z.infer<typeof reorderChildrenSchema>;

export function assertNotSelfParent(
  personId: string,
  husbandId?: string | null,
  wifeId?: string | null
): void {
  if (personId === husbandId || personId === wifeId) {
    throw new Error(
      'Seseorang tidak dapat menjadi orang tua bagi dirinya sendiri.'
    );
  }
}

export function assertValidCouple(
  husband?: Person | null,
  wife?: Person | null
): void {
  if (!husband && !wife) {
    throw new Error('Pasangan pernikahan harus memiliki minimal satu anggota.');
  }

  if (husband && wife) {
    if (husband.id === wife.id) {
      throw new Error('Suami dan istri tidak boleh orang yang sama.');
    }
    if (husband.gender === wife.gender) {
      throw new Error(
        'Pasangan pernikahan harus berbeda jenis kelamin (Laki-laki dan Perempuan).'
      );
    }
  }

  if (husband && husband.gender !== 'L') {
    throw new Error('Suami harus berjenis kelamin Laki-laki (L).');
  }

  if (wife && wife.gender !== 'P') {
    throw new Error('Istri harus berjenis kelamin Perempuan (P).');
  }
}

export function assertNoCycle(
  graph: FamilyGraph,
  childId: string,
  targetUnionId: string | null
): void {
  if (!targetUnionId) return;

  const targetUnion = graph.unions.get(targetUnionId);
  if (!targetUnion) {
    throw new Error('Data pernikahan orang tua tidak ditemukan.');
  }

  assertNotSelfParent(childId, targetUnion.husbandId, targetUnion.wifeId);

  const parentIds = [targetUnion.husbandId, targetUnion.wifeId].filter(
    (id): id is string => Boolean(id)
  );

  for (const parentId of parentIds) {
    const ancestorsOfParent = getAncestors(graph, parentId);
    if (ancestorsOfParent.has(childId)) {
      throw new Error(
        'Terdeteksi siklus silsilah: anggota tidak dapat dijadikan anak dari keturunannya sendiri.'
      );
    }
  }
}

export function canDeletePerson(
  graph: FamilyGraph,
  personId: string
): { allowed: boolean; reason?: string } {
  const unions = graph.unionsByPerson.get(personId) ?? [];

  for (const union of unions) {
    const children = graph.childrenByUnion.get(union.id) ?? [];
    if (children.length > 0) {
      return {
        allowed: false,
        reason:
          'Anggota tidak dapat dihapus karena masih memiliki anak pada garis keturunan. Lepaskan atau pindahkan relasi anak terlebih dahulu.',
      };
    }
  }

  return { allowed: true };
}
