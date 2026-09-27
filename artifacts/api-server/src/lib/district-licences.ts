import { db } from "@workspace/db";
import { muallimProfiliTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class LicenceLimitError extends Error {}

export function allowedDistrictStudents(
  capacity: number,
  trialUntil: Date | string | null,
  subscriptionStatus: string | null,
  subscriptionExpiresAt: Date | string | null,
  now = new Date(),
): number {
  const hasPaidLicence = subscriptionStatus === "active"
    && Boolean(subscriptionExpiresAt && new Date(subscriptionExpiresAt).getTime() > now.getTime());
  if (hasPaidLicence) return capacity;
  if (!trialUntil) return capacity; // Existing districts without recorded trials keep their limit.
  return new Date(trialUntil).getTime() > now.getTime() ? Math.min(20, capacity) : 0;
}

// Non-archived students hold a seat even when their login is deactivated.
// Serialize admissions on the district row so simultaneous requests cannot
// both see the last free seat. Legacy students with no mekteb_id are included
// through their assigned teacher.
export async function assertStudentCapacity(tx: Tx, teacherId: number, additional = 1): Promise<number | null> {
  const [teacher] = await tx.select().from(muallimProfiliTable)
    .where(eq(muallimProfiliTable.userId, teacherId)).limit(1);
  if (!teacher) throw new Error("Muallim profil nije pronađen");

  if (teacher.mektebId == null) {
    const result = await tx.execute(sql`
      SELECT count(*)::int AS used FROM ucenik_profili
      WHERE muallim_id = ${teacherId} AND is_archived = false
    `);
    if (Number(result.rows[0]?.used ?? 0) + additional > teacher.licenceCount) {
      throw new LicenceLimitError("Dostigli ste maksimalan broj učenika (limit licenci)");
    }
    return null;
  }

  const districtId = teacher.mektebId;
  const locked = await tx.execute(sql`SELECT id FROM mektebi WHERE id = ${districtId} FOR UPDATE`);
  if (!locked.rows.length) throw new Error("Džemat nije pronađen");
  const [{ capacity, used, trialUntil, subscriptionStatus, subscriptionExpiresAt }] = (await tx.execute(sql`
    SELECT
      COALESCE(
        subscription.licences_purchased,
        (SELECT sum(mp.licence_count)::int FROM muallim_profili mp WHERE mp.mekteb_id = m.id),
        0
      )::int AS capacity,
      owner.trial_until AS "trialUntil",
      subscription.status AS "subscriptionStatus",
      subscription.expires_at AS "subscriptionExpiresAt",
      (SELECT count(DISTINCT up.user_id)::int FROM ucenik_profili up
       LEFT JOIN muallim_profili owner ON owner.user_id = up.muallim_id
       WHERE up.is_archived = false AND
         (up.mekteb_id = m.id OR (up.mekteb_id IS NULL AND owner.mekteb_id = m.id))) AS used
    FROM mektebi m
    LEFT JOIN users owner ON owner.id = COALESCE(m.glavni_muallim_id,
      (SELECT mp.user_id FROM muallim_profili mp WHERE mp.mekteb_id = m.id AND mp.is_glavni LIMIT 1))
    LEFT JOIN LATERAL (
      SELECT p.licences_purchased, p.status, p.expires_at
      FROM pretplate p WHERE p.user_id = owner.id
      ORDER BY p.created_at DESC NULLS LAST, p.id DESC LIMIT 1
    ) subscription ON true
    WHERE m.id = ${districtId}
  `)).rows as Array<{ capacity: number; used: number; trialUntil: Date | string | null; subscriptionStatus: string | null; subscriptionExpiresAt: Date | string | null }>;
  const hasPaidLicence = subscriptionStatus === "active"
    && Boolean(subscriptionExpiresAt && new Date(subscriptionExpiresAt).getTime() > Date.now());
  const trialExpiry = trialUntil ? new Date(trialUntil).getTime() : null;
  const allowed = allowedDistrictStudents(Number(capacity), trialUntil, subscriptionStatus, subscriptionExpiresAt);
  if (Number(used) + additional > allowed) {
    throw new LicenceLimitError(trialExpiry !== null && !hasPaidLicence
      ? trialExpiry <= Date.now()
        ? "Probni period džemata je istekao. Aktivirajte pretplatu za dodavanje učenika."
        : `Tokom probnog perioda džemat može imati najviše 20 učenika (${used}/20).`
      : `Džemat je iskoristio sve licence (${used}/${allowed})`);
  }
  return districtId;
}