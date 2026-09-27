import { db } from "@workspace/db";
import {
  usersTable,
  posjeteTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  pretplateTable,
  kvizRezultatiTable,
  korisnikNapredakTable,
  studentProgressTable,
  exerciseSessionsTable,
  certifikatiTable,
  priustvoTable,
  ocjeneTable,
  napametUcenikOverrideTable,
  porukeTable,
  grupeTable,
  mektebKalendarTable,
  planLekcijaTable,
  zadaceTable,
  prilozi,
  mektebDokumentiTable,
  h5pPokusajiTable,
  zadaceStatusTable,
  zadaceUceniciTable,
  pogresniOdgovoriTable,
  interaktivniBlokPokusajiTable,
  lessonPauseAnswersTable,
  misijaProgressTable,
  medenaVidjenaPitanjaTable,
  embedCompletionsTable,
  staticVjezbaPokusajiTable,
  etapaPokusajOdobrenjaTable,
  etapaPolaganjaTable,
  studentKrunisanjaTable,
  studentMedaljoniTable,
  pushTokensTable,
  ocjeneSadrzajaTable,
  type User,
} from "@workspace/db/schema";
import { eq, inArray, or, sql } from "drizzle-orm";
import { invalidateUserStatusCache } from "../middlewares/auth.js";

type DeletionTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DeletionGuard = (tx: DeletionTx) => Promise<boolean>;

/**
 * Reusable equivalent of the admin user deletion transaction.
 * Callers perform their own eligibility checks; this service refuses admins
 * and re-reads the account to avoid deleting a concurrently removed user.
 */
export async function deleteUsersWithAdminTransaction(userIds: number[], guard?: DeletionGuard): Promise<User[] | null> {
  if (userIds.length === 0) return [];
  const foundUsers = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  const usersById = new Map(foundUsers.map((user) => [user.id, user]));
  if (userIds.some((id) => !usersById.has(id) || usersById.get(id)!.role === "admin")) return null;
  const users = userIds.map((id) => usersById.get(id)!);
  const deleted = await db.transaction(async (tx) => {
    await tx.select({ id: usersTable.id }).from(usersTable)
      .where(inArray(usersTable.id, userIds)).for("update");
    if (guard && !(await guard(tx))) return false;
    for (const user of users) {
      const userId = user.id;
      if (user.role === "ucenik") {
      const [profil] = await tx.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
      if (profil?.muallimId && !profil.isArchived) {
        await tx.update(muallimProfiliTable)
          .set({ licencesUsed: sql`GREATEST(${muallimProfiliTable.licencesUsed} - 1, 0)` })
          .where(eq(muallimProfiliTable.userId, profil.muallimId));
      }
      await tx.delete(h5pPokusajiTable).where(eq(h5pPokusajiTable.userId, userId));
      await tx.delete(zadaceStatusTable).where(eq(zadaceStatusTable.ucenikId, userId));
      await tx.delete(zadaceUceniciTable).where(eq(zadaceUceniciTable.ucenikId, userId));
      await tx.delete(pogresniOdgovoriTable).where(eq(pogresniOdgovoriTable.userId, userId));
      await tx.delete(interaktivniBlokPokusajiTable).where(eq(interaktivniBlokPokusajiTable.userId, userId));
      await tx.delete(lessonPauseAnswersTable).where(eq(lessonPauseAnswersTable.userId, userId));
      await tx.delete(misijaProgressTable).where(eq(misijaProgressTable.userId, userId));
      await tx.delete(medenaVidjenaPitanjaTable).where(eq(medenaVidjenaPitanjaTable.userId, userId));
      await tx.delete(embedCompletionsTable).where(eq(embedCompletionsTable.studentId, String(userId)));
      await tx.delete(staticVjezbaPokusajiTable).where(eq(staticVjezbaPokusajiTable.userId, userId));
      await tx.delete(etapaPokusajOdobrenjaTable).where(eq(etapaPokusajOdobrenjaTable.studentId, String(userId)));
      await tx.delete(etapaPolaganjaTable).where(eq(etapaPolaganjaTable.studentId, String(userId)));
      await tx.delete(studentKrunisanjaTable).where(eq(studentKrunisanjaTable.studentId, String(userId)));
      await tx.delete(studentMedaljoniTable).where(eq(studentMedaljoniTable.studentId, String(userId)));
      await tx.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));
      await tx.delete(ocjeneSadrzajaTable).where(eq(ocjeneSadrzajaTable.userId, userId));
      await tx.execute(sql`DELETE FROM game_sessions WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM grupe_arhiva_clanovi WHERE ucenik_id = ${userId}`);
      await tx.execute(sql`DELETE FROM zvjezdice_log WHERE ucenik_id = ${userId}`);
      // Shared learning material remains available, but no longer identifies this account.
      await tx.update(prilozi).set({ uploadedByUserId: null }).where(eq(prilozi.uploadedByUserId, userId));
      await tx.update(mektebDokumentiTable).set({ uploadedByUserId: null })
        .where(eq(mektebDokumentiTable.uploadedByUserId, userId));
    }

    await tx.delete(kvizRezultatiTable).where(eq(kvizRezultatiTable.userId, userId));
    await tx.delete(korisnikNapredakTable).where(eq(korisnikNapredakTable.userId, userId));
    try { await tx.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(userId))); } catch {}
    try { await tx.delete(exerciseSessionsTable).where(eq(exerciseSessionsTable.studentId, String(userId))); } catch {}
    await tx.delete(certifikatiTable).where(eq(certifikatiTable.ucenikId, userId));
    await tx.delete(priustvoTable).where(eq(priustvoTable.ucenikId, userId));
    await tx.delete(ocjeneTable).where(eq(ocjeneTable.ucenikId, userId));
    await tx.delete(napametUcenikOverrideTable).where(eq(napametUcenikOverrideTable.ucenikId, userId));
    await tx.delete(porukeTable).where(or(eq(porukeTable.posiljateljId, userId), eq(porukeTable.primateljId, userId)));
    await tx.delete(roditeljUcenikTable).where(or(eq(roditeljUcenikTable.roditeljId, userId), eq(roditeljUcenikTable.ucenikId, userId)));
    await tx.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
    await tx.delete(roditeljProfiliTable).where(eq(roditeljProfiliTable.userId, userId));
    await tx.delete(pretplateTable).where(eq(pretplateTable.userId, userId));

      if (user.role === "muallim") {
      const muallimGrupe = await tx.select({ id: grupeTable.id }).from(grupeTable).where(eq(grupeTable.muallimId, userId));
      const grupaIds = muallimGrupe.map((g) => g.id);
      if (grupaIds.length > 0) {
        await tx.update(ucenikProfiliTable).set({ grupaId: null, muallimId: null }).where(inArray(ucenikProfiliTable.grupaId, grupaIds));
        await tx.update(ocjeneTable).set({ grupaId: null }).where(inArray(ocjeneTable.grupaId, grupaIds));
      }
      await tx.update(ocjeneTable).set({ muallimId: 0 }).where(eq(ocjeneTable.muallimId, userId));
      await tx.update(priustvoTable).set({ muallimId: 0 }).where(eq(priustvoTable.muallimId, userId));
      await tx.delete(mektebKalendarTable).where(eq(mektebKalendarTable.muallimId, userId));
      await tx.delete(planLekcijaTable).where(eq(planLekcijaTable.muallimId, userId));
      await tx.delete(zadaceTable).where(eq(zadaceTable.muallimId, userId));
      await tx.delete(grupeTable).where(eq(grupeTable.muallimId, userId));
      await tx.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));
    }

      try { await tx.delete(posjeteTable).where(eq(posjeteTable.userId, userId)); } catch {}
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    }
    return true;
  });

  if (!deleted) return null;
  users.forEach((user) => invalidateUserStatusCache(user.id));
  return users;
}

export async function deleteUserWithAdminTransaction(userId: number, guard?: DeletionGuard): Promise<User | null> {
  const deleted = await deleteUsersWithAdminTransaction([userId], guard);
  return deleted?.[0] ?? null;
}