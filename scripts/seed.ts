import './load-env';
import { db, client } from '../db';
import { persons, unions } from '../db/schema';
import { adminUsers } from '../db/auth-schema';
import { hashPassword } from '../lib/auth';
import { SEED_PERSONS, SEED_UNIONS } from '../features/family/seed-data';
import { eq, sql } from 'drizzle-orm';

async function main() {
  console.log('🌱 Memulai proses seed database Bani Sukar...');

  await db.transaction(async (tx) => {
    // 1. Insert all persons first WITH parentUnionId = null to satisfy circular FK (persons <-> unions)
    console.log(`👤 Menyimpan ${SEED_PERSONS.length} data anggota keluarga (Gen 1 - Gen 2)...`);
    for (const p of SEED_PERSONS) {
      await tx
        .insert(persons)
        .values({
          id: p.id,
          fullName: p.fullName,
          nickname: p.nickname,
          gender: p.gender,
          birthPlace: p.birthPlace,
          birthDate: p.birthDate,
          isDeceased: p.isDeceased,
          deathDate: p.deathDate,
          isBloodLine: p.isBloodLine,
          parentUnionId: null,
          birthOrder: null,
        })
        .onConflictDoUpdate({
          target: persons.id,
          set: {
            fullName: sql`excluded.full_name`,
            nickname: sql`excluded.nickname`,
            gender: sql`excluded.gender`,
            birthPlace: sql`excluded.birth_place`,
            birthDate: sql`excluded.birth_date`,
            isDeceased: sql`excluded.is_deceased`,
            deathDate: sql`excluded.death_date`,
            isBloodLine: sql`excluded.is_blood_line`,
            updatedAt: new Date(),
          },
        });
    }

    // 2. Insert all unions
    console.log(`💍 Menyimpan ${SEED_UNIONS.length} data pernikahan...`);
    for (const u of SEED_UNIONS) {
      await tx
        .insert(unions)
        .values({
          id: u.id,
          husbandId: u.husbandId,
          wifeId: u.wifeId,
          status: u.status,
          unionOrder: u.unionOrder,
        })
        .onConflictDoUpdate({
          target: unions.id,
          set: {
            husbandId: sql`excluded.husband_id`,
            wifeId: sql`excluded.wife_id`,
            status: sql`excluded.status`,
            unionOrder: sql`excluded.union_order`,
            updatedAt: new Date(),
          },
        });
    }

    // 3. Link children to their parentUnionId & birthOrder
    console.log('🔗 Menghubungkan anak-anak dengan pernikahan orang tua...');
    for (const p of SEED_PERSONS) {
      if (p.parentUnionId) {
        await tx
          .update(persons)
          .set({
            parentUnionId: p.parentUnionId,
            birthOrder: p.birthOrder,
            updatedAt: new Date(),
          })
          .where(eq(persons.id, p.id));
      }
    }
  });

  // 4. Seed initial admin user into admin_users (JWT auth)
  const adminUsername = (
    process.env.SEED_ADMIN_USERNAME ||
    process.env.SEED_ADMIN_EMAIL ||
    'admin@banisukar.id'
  )
    .trim()
    .toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminBaniSukar123!';
  const adminName = process.env.SEED_ADMIN_NAME || 'Admin Bani Sukar';

  const existingAdmin = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.username, adminUsername))
    .limit(1);

  if (existingAdmin.length === 0) {
    console.log(`🔐 Membuat akun admin awal (${adminUsername})...`);
    await db
      .insert(adminUsers)
      .values({
        name: adminName,
        username: adminUsername,
        passwordHash: hashPassword(adminPassword),
        role: 'admin',
      })
      .onConflictDoNothing({ target: adminUsers.username });
    console.log('✅ Akun admin berhasil dibuat.');
  } else {
    console.log(`ℹ️ Akun admin (${adminUsername}) sudah terdaftar.`);
  }

  console.log('🎉 Proses seed selesai dengan sukses!');
  await client.end();
}

main().catch(async (err) => {
  console.error('❌ Gagal menjalankan seed:', err);
  await client.end();
  process.exit(1);
});
