import { db } from "@workspace/db";
import {
  muallimProfiliTable,
  pretplateTable,
  grupeTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { deleteUsersWithAdminTransaction } from "./admin-user-deletion.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TICK_MS = DAY_MS;

interface CleanupUser {
  id: number;
  role: string;
  isActive: boolean;
  trialUntil: Date | null;
  billingOverride: string | null;
  termsAcceptedAt: Date | null;
  privacyAcknowledgedAt: Date | null;
  parentAcknowledgedAt: Date | null;
}

interface CleanupSubscription {
  planType: string;
  status: string;
  paidAt: Date | null;
  activatedAt: Date | null;
  stripeSessionId: string | null;
  stripeSubscriptionId: string | null;
}

interface CleanupProfile {
  exists: boolean;
  isArchived?: boolean;
  mektebId?: number | null;
  muallimId?: number | null;
  teacherProfileExists?: boolean;
  teacherMektebId?: number | null;
  isOnlineMektebGroup?: boolean;
}

interface ParentCreatedChildFacts {
  user: CleanupUser | null;
  subscriptions: CleanupSubscription[];
  profile: CleanupProfile;
  linkStatus: string;
  approvedBy: number | null;
  relatedFamilyLinks: number;
}

export interface StandaloneTrialCleanupFacts {
  user: CleanupUser;
  subscriptions: CleanupSubscription[];
  profile: CleanupProfile;
  relatedFamilyLinks: number;
  familyChildren?: ParentCreatedChildFacts[];
}

export function parentCreatedChildSkipReason(
  parent: CleanupUser,
  childFacts: ParentCreatedChildFacts,
  now = new Date(),
): string | null {
  const child = childFacts.user;
  if (!child) return "linked_child_missing";
  if (child.role !== "ucenik") return "linked_account_not_student";
  if (child.isActive) return "linked_child_active";
  if (!child.trialUntil || child.trialUntil.getTime() !== parent.trialUntil?.getTime()) return "linked_child_trial_mismatch";
  if (child.trialUntil.getTime() + DAY_MS > now.getTime()) return "linked_child_trial_grace_period";
  if (child.billingOverride) return "linked_child_billing_override";
  if (childFacts.subscriptions.length > 0) return "linked_child_has_own_subscription";
  if (childFacts.relatedFamilyLinks !== 1) return "linked_child_shared_or_ambiguous";
  if (childFacts.linkStatus !== "approved" || childFacts.approvedBy !== parent.id) return "linked_child_not_parent_created";
  if (!childFacts.profile.exists) return "linked_child_profile_missing";
  if (childFacts.profile.isArchived) return "linked_child_archived";
  if (
    childFacts.profile.mektebId
    || childFacts.profile.teacherMektebId
    || !childFacts.profile.teacherProfileExists
    || !childFacts.profile.isOnlineMektebGroup
  ) return "linked_child_school_or_group_ambiguous";
  return null;
}

/** Returns a manual-review skip reason, or null when deletion is safe. */
export function standaloneTrialCleanupSkipReason(
  facts: StandaloneTrialCleanupFacts,
  now = new Date(),
): string | null {
  const { user, subscriptions, profile, relatedFamilyLinks } = facts;
  if (user.role !== "ucenik" && user.role !== "roditelj") return "unsupported_role";
  if (!user.termsAcceptedAt || !user.privacyAcknowledgedAt) return "registration_acknowledgement_missing";
  if (user.role === "roditelj" && !user.parentAcknowledgedAt) return "parent_acknowledgement_missing";
  if (!user.trialUntil) return "missing_trial_expiry";
  if (user.trialUntil.getTime() + DAY_MS > now.getTime()) return "trial_grace_period_not_elapsed";
  if (user.isActive) return "account_active";
  if (user.billingOverride) return "billing_override";
  if (subscriptions.length !== 1) return "subscription_count_ambiguous";

  const subscription = subscriptions[0];
  const expectedPlan = user.role === "ucenik" ? "individual" : "family";
  if (subscription.planType !== expectedPlan) return "subscription_plan_mismatch";
  if (subscription.status !== "pending") return "subscription_not_pending";
  if (
    subscription.paidAt
    || subscription.activatedAt
    || subscription.stripeSessionId
    || subscription.stripeSubscriptionId
  ) return "payment_or_activation_evidence";
  if (!profile.exists) return "missing_registration_profile";
  if (user.role === "roditelj") {
    const children = facts.familyChildren ?? [];
    if (children.length !== relatedFamilyLinks) return "family_links_ambiguous";
    for (const childFacts of children) {
      const childReason = parentCreatedChildSkipReason(user, childFacts, now);
      if (childReason) return `linked_child_requires_manual_review:${childReason}`;
    }
  } else if (relatedFamilyLinks > 0) {
    return "linked_family_requires_manual_review";
  }
  if (user.role === "ucenik") {
    if (profile.isArchived) return "student_archived";
    if (profile.mektebId || profile.teacherMektebId) return "school_linked";
    if (profile.muallimId && !profile.teacherProfileExists) return "teacher_link_ambiguous";
  }
  return null;
}

async function factsForUser(
  queryDb: Pick<typeof db, "select"> | Parameters<Parameters<typeof db.transaction>[0]>[0],
  user: CleanupUser,
): Promise<StandaloneTrialCleanupFacts> {
  const subscriptions = await queryDb.select({
    planType: pretplateTable.planType,
    status: pretplateTable.status,
    paidAt: pretplateTable.paidAt,
    activatedAt: pretplateTable.activatedAt,
    stripeSessionId: pretplateTable.stripeSessionId,
    stripeSubscriptionId: pretplateTable.stripeSubscriptionId,
  }).from(pretplateTable).where(eq(pretplateTable.userId, user.id));
  const familyLinks = await queryDb.select({
    ucenikId: roditeljUcenikTable.ucenikId,
    status: roditeljUcenikTable.status,
    approvedBy: roditeljUcenikTable.approvedBy,
  }).from(roditeljUcenikTable)
    .where(eq(roditeljUcenikTable.roditeljId, user.id));
  const childLinks = await queryDb.select({ roditeljId: roditeljUcenikTable.roditeljId }).from(roditeljUcenikTable)
    .where(eq(roditeljUcenikTable.ucenikId, user.id));

  if (user.role === "roditelj") {
    const [profile] = await queryDb.select({ userId: roditeljProfiliTable.userId }).from(roditeljProfiliTable)
      .where(eq(roditeljProfiliTable.userId, user.id)).limit(1);
    const familyChildren: ParentCreatedChildFacts[] = [];
    for (const link of familyLinks) {
      const [child] = await queryDb.select({
        id: usersTable.id,
        role: usersTable.role,
        isActive: usersTable.isActive,
        trialUntil: usersTable.trialUntil,
        billingOverride: usersTable.billingOverride,
        termsAcceptedAt: usersTable.termsAcceptedAt,
        privacyAcknowledgedAt: usersTable.privacyAcknowledgedAt,
        parentAcknowledgedAt: usersTable.parentAcknowledgedAt,
      }).from(usersTable).where(eq(usersTable.id, link.ucenikId)).limit(1);
      const [student] = await queryDb.select({
        isArchived: ucenikProfiliTable.isArchived,
        mektebId: ucenikProfiliTable.mektebId,
        muallimId: ucenikProfiliTable.muallimId,
        grupaId: ucenikProfiliTable.grupaId,
      }).from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, link.ucenikId)).limit(1);
      const [teacher] = student?.muallimId
        ? await queryDb.select({ mektebId: muallimProfiliTable.mektebId }).from(muallimProfiliTable)
          .where(eq(muallimProfiliTable.userId, student.muallimId)).limit(1)
        : [];
      const [group] = student?.grupaId
        ? await queryDb.select({ naziv: grupeTable.naziv, muallimId: grupeTable.muallimId }).from(grupeTable)
          .where(eq(grupeTable.id, student.grupaId)).limit(1)
        : [];
      const childSubscriptions = child
        ? await queryDb.select({
          planType: pretplateTable.planType,
          status: pretplateTable.status,
          paidAt: pretplateTable.paidAt,
          activatedAt: pretplateTable.activatedAt,
          stripeSessionId: pretplateTable.stripeSessionId,
          stripeSubscriptionId: pretplateTable.stripeSubscriptionId,
        }).from(pretplateTable).where(eq(pretplateTable.userId, child.id))
        : [];
      const childFamilyLinks = await queryDb.select({ id: roditeljUcenikTable.id }).from(roditeljUcenikTable)
        .where(eq(roditeljUcenikTable.ucenikId, link.ucenikId));
      familyChildren.push({
        user: child ?? null,
        subscriptions: childSubscriptions,
        profile: {
          exists: Boolean(student),
          isArchived: student?.isArchived,
          mektebId: student?.mektebId,
          muallimId: student?.muallimId,
          teacherProfileExists: Boolean(teacher),
          teacherMektebId: teacher?.mektebId,
          isOnlineMektebGroup: Boolean(
            group?.naziv === "Online Mekteb"
            && group.muallimId === student?.muallimId,
          ),
        },
        linkStatus: link.status,
        approvedBy: link.approvedBy,
        relatedFamilyLinks: childFamilyLinks.length,
      });
    }
    return {
      user,
      subscriptions,
      profile: { exists: Boolean(profile) },
      relatedFamilyLinks: familyLinks.length,
      familyChildren,
    };
  }

  const [student] = await queryDb.select({
    isArchived: ucenikProfiliTable.isArchived,
    mektebId: ucenikProfiliTable.mektebId,
    muallimId: ucenikProfiliTable.muallimId,
  }).from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, user.id)).limit(1);
  const [teacher] = student?.muallimId
    ? await queryDb.select({ mektebId: muallimProfiliTable.mektebId }).from(muallimProfiliTable)
      .where(eq(muallimProfiliTable.userId, student.muallimId)).limit(1)
    : [];
  return {
    user,
    subscriptions,
    profile: {
      exists: Boolean(student),
      isArchived: student?.isArchived,
      mektebId: student?.mektebId,
      muallimId: student?.muallimId,
      teacherProfileExists: Boolean(teacher),
      teacherMektebId: teacher?.mektebId,
    },
    relatedFamilyLinks: childLinks.length,
  };
}

export async function runUnpaidStandaloneTrialCleanup(now = new Date()): Promise<{ deleted: number; skipped: number }> {
  const candidates = await db.select({
    id: usersTable.id,
    role: usersTable.role,
    isActive: usersTable.isActive,
    trialUntil: usersTable.trialUntil,
    billingOverride: usersTable.billingOverride,
    termsAcceptedAt: usersTable.termsAcceptedAt,
    privacyAcknowledgedAt: usersTable.privacyAcknowledgedAt,
    parentAcknowledgedAt: usersTable.parentAcknowledgedAt,
  }).from(usersTable);
  let deleted = 0;
  let skipped = 0;

  for (const user of candidates) {
    if (user.role !== "ucenik" && user.role !== "roditelj") continue;
    if (!user.trialUntil || user.trialUntil.getTime() + DAY_MS > now.getTime()) continue;

    const facts = await factsForUser(db, user);
    const skipReason = standaloneTrialCleanupSkipReason(facts, now);
    if (skipReason) {
      skipped++;
      logger.warn({ userId: user.id, role: user.role, reason: skipReason }, "Standalone trial cleanup skipped; manual review required");
      continue;
    }
    const childIds = (facts.familyChildren ?? [])
      .map((child) => child.user?.id)
      .filter((id): id is number => id !== undefined);
    const deletionIds = [...childIds, user.id];

    // Recheck inside the same transaction as deletion to avoid deleting a user
    // whose subscription, school assignment, or family links changed meanwhile.
    let removed: Awaited<ReturnType<typeof deleteUsersWithAdminTransaction>>;
    try {
      removed = await deleteUsersWithAdminTransaction(deletionIds, async (tx) => {
        const [current] = await tx.select({
          id: usersTable.id,
          role: usersTable.role,
          isActive: usersTable.isActive,
          trialUntil: usersTable.trialUntil,
          billingOverride: usersTable.billingOverride,
          termsAcceptedAt: usersTable.termsAcceptedAt,
          privacyAcknowledgedAt: usersTable.privacyAcknowledgedAt,
          parentAcknowledgedAt: usersTable.parentAcknowledgedAt,
        }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
        if (!current) return false;
        const currentFacts = await factsForUser(tx, current);
        if (standaloneTrialCleanupSkipReason(currentFacts, new Date()) !== null) return false;
        const currentChildIds = (currentFacts.familyChildren ?? [])
          .map((child) => child.user?.id)
          .filter((id): id is number => id !== undefined);
        return currentChildIds.length === childIds.length
          && currentChildIds.every((id, index) => id === childIds[index]);
      });
    } catch (err) {
      skipped++;
      logger.error({ err, userId: user.id, role: user.role }, "Standalone trial deletion failed; manual review required");
      continue;
    }
    if (!removed) {
      skipped++;
      logger.warn({ userId: user.id, role: user.role, reason: "eligibility_changed_during_cleanup" }, "Standalone trial cleanup skipped; manual review required");
      continue;
    }
    deleted++;
    logger.info({ userId: user.id, role: user.role }, "Expired unpaid standalone trial account deleted");
  }
  return { deleted, skipped };
}

export function startUnpaidStandaloneTrialCleanupCron(): void {
  const tick = async () => {
    try {
      const result = await runUnpaidStandaloneTrialCleanup();
      if (result.deleted || result.skipped) logger.info(result, "Unpaid standalone trial cleanup completed");
    } catch (err) {
      logger.error({ err }, "Unpaid standalone trial cleanup failed");
    }
  };
  void tick();
  const handle = setInterval(tick, TICK_MS);
  if (typeof handle.unref === "function") handle.unref();
  logger.info({ tickMs: TICK_MS }, "Unpaid standalone trial cleanup started");
}