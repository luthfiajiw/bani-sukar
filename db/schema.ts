import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const genderEnum = pgEnum('gender', ['L', 'P']);
export const unionStatusEnum = pgEnum('union_status', ['married', 'divorced', 'widowed']);

export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    nickname: text('nickname'),
    gender: genderEnum('gender').notNull(),
    birthPlace: text('birth_place'),
    birthDate: date('birth_date', { mode: 'string' }),
    isDeceased: boolean('is_deceased').notNull().default(false),
    deathDate: date('death_date', { mode: 'string' }),
    isBloodLine: boolean('is_blood_line').notNull().default(true),
    parentUnionId: uuid('parent_union_id').references((): AnyPgColumn => unions.id, {
      onDelete: 'restrict',
    }),
    birthOrder: integer('birth_order'),
    photoPath: text('photo_path'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('persons_parent_union_id_idx').on(table.parentUnionId),
    index('persons_full_name_idx').on(table.fullName),
    uniqueIndex('persons_parent_union_birth_order_uniq').on(table.parentUnionId, table.birthOrder),
  ]
);

export const unions = pgTable(
  'unions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    husbandId: uuid('husband_id').references((): AnyPgColumn => persons.id, {
      onDelete: 'cascade',
    }),
    wifeId: uuid('wife_id').references((): AnyPgColumn => persons.id, {
      onDelete: 'cascade',
    }),
    status: unionStatusEnum('status').notNull().default('married'),
    unionOrder: integer('union_order').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('unions_husband_id_idx').on(table.husbandId),
    index('unions_wife_id_idx').on(table.wifeId),
    check(
      'unions_at_least_one_partner_chk',
      sql`${table.husbandId} IS NOT NULL OR ${table.wifeId} IS NOT NULL`
    ),
  ]
);

export const personsRelations = relations(persons, ({ one, many }) => ({
  parentUnion: one(unions, {
    fields: [persons.parentUnionId],
    references: [unions.id],
    relationName: 'union_children',
  }),
  unionsAsHusband: many(unions, { relationName: 'husband_unions' }),
  unionsAsWife: many(unions, { relationName: 'wife_unions' }),
}));

export const unionsRelations = relations(unions, ({ one, many }) => ({
  husband: one(persons, {
    fields: [unions.husbandId],
    references: [persons.id],
    relationName: 'husband_unions',
  }),
  wife: one(persons, {
    fields: [unions.wifeId],
    references: [persons.id],
    relationName: 'wife_unions',
  }),
  children: many(persons, { relationName: 'union_children' }),
}));
