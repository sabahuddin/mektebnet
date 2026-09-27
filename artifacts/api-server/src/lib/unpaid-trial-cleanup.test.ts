import assert from "node:assert/strict";
import test from "node:test";
import {
  standaloneTrialCleanupSkipReason,
  type StandaloneTrialCleanupFacts,
} from "./unpaid-trial-cleanup.js";

const now = new Date("2026-04-01T00:00:00.000Z");
const trialUntil = new Date(now.getTime() - 24 * 60 * 60 * 1000);

function eligibleStudent(overrides: Partial<StandaloneTrialCleanupFacts> = {}): StandaloneTrialCleanupFacts {
  return {
    user: {
      id: 11,
      role: "ucenik",
      isActive: false,
      trialUntil,
      billingOverride: null,
      termsAcceptedAt: now,
      privacyAcknowledgedAt: now,
      parentAcknowledgedAt: null,
    },
    subscriptions: [{
      planType: "individual",
      status: "pending",
      paidAt: null,
      activatedAt: null,
      stripeSessionId: null,
      stripeSubscriptionId: null,
    }],
    profile: { exists: true, isArchived: false, mektebId: null, muallimId: 21, teacherProfileExists: true, teacherMektebId: null },
    relatedFamilyLinks: 0,
    ...overrides,
  };
}

test("accepts only expired, unpaid standalone pending individual registration", () => {
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent(), now), null);
});

test("waits through the full extra day after the trial expires", () => {
  const facts = eligibleStudent({ user: { ...eligibleStudent().user, trialUntil: new Date(now.getTime() - 12 * 60 * 60 * 1000) } });
  assert.equal(standaloneTrialCleanupSkipReason(facts, now), "trial_grace_period_not_elapsed");
});

test("keeps active, paid, school-linked, and family-linked accounts for manual review", () => {
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({
    user: { ...eligibleStudent().user, isActive: true },
  }), now), "account_active");
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({
    subscriptions: [{ ...eligibleStudent().subscriptions[0], status: "active" }],
  }), now), "subscription_not_pending");
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({
    subscriptions: [{ ...eligibleStudent().subscriptions[0], paidAt: now }],
  }), now), "payment_or_activation_evidence");
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({
    profile: { ...eligibleStudent().profile, teacherMektebId: 4 },
  }), now), "school_linked");
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({
    profile: { exists: true, isArchived: true },
  }), now), "student_archived");
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({ relatedFamilyLinks: 1 }), now), "linked_family_requires_manual_review");
});

test("keeps ambiguous subscriptions and payment evidence", () => {
  const subscription = eligibleStudent().subscriptions[0];
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({
    subscriptions: [subscription, subscription],
  }), now), "subscription_count_ambiguous");
  assert.equal(standaloneTrialCleanupSkipReason(eligibleStudent({
    subscriptions: [{ ...subscription, stripeSessionId: "session" }],
  }), now), "payment_or_activation_evidence");
});

test("deletes an isolated unpaid family, but skips shared or school-linked children", () => {
  const family: StandaloneTrialCleanupFacts = {
    user: {
      id: 12,
      role: "roditelj",
      isActive: false,
      trialUntil,
      billingOverride: null,
      termsAcceptedAt: now,
      privacyAcknowledgedAt: now,
      parentAcknowledgedAt: now,
    },
    subscriptions: [{
      planType: "family",
      status: "pending",
      paidAt: null,
      activatedAt: null,
      stripeSessionId: null,
      stripeSubscriptionId: null,
    }],
    profile: { exists: true },
    relatedFamilyLinks: 0,
  };
  assert.equal(standaloneTrialCleanupSkipReason(family, now), null);
  const childFacts = {
    user: {
      id: 13,
      role: "ucenik",
      isActive: false,
      trialUntil,
      billingOverride: null,
      termsAcceptedAt: null,
      privacyAcknowledgedAt: null,
      parentAcknowledgedAt: null,
    },
    subscriptions: [],
    profile: {
      exists: true,
      isArchived: false,
      mektebId: null,
      muallimId: 21,
      teacherProfileExists: true,
      teacherMektebId: null,
      isOnlineMektebGroup: true,
    },
    linkStatus: "approved",
    approvedBy: 12,
    relatedFamilyLinks: 1,
  };
  const parentWithOwnedChild = {
    ...family,
    relatedFamilyLinks: 1,
    familyChildren: [childFacts],
  };
  assert.equal(standaloneTrialCleanupSkipReason(parentWithOwnedChild, now), null);
  assert.match(
    standaloneTrialCleanupSkipReason({
      ...parentWithOwnedChild,
      familyChildren: [{ ...childFacts, relatedFamilyLinks: 2 }],
    }, now) ?? "",
    /linked_child_shared_or_ambiguous/,
  );
  assert.match(
    standaloneTrialCleanupSkipReason({
      ...parentWithOwnedChild,
      familyChildren: [{
        ...childFacts,
        profile: { ...childFacts.profile, teacherMektebId: 4 },
      }],
    }, now) ?? "",
    /linked_child_school_or_group_ambiguous/,
  );
});