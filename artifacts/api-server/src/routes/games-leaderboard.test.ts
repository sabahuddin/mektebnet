import { test } from "node:test";
import assert from "node:assert/strict";
import { leaderboardPublicName, projectLeaderboardEntry } from "./games.js";

test("global leaderboard projects username instead of real display name", () => {
  assert.equal(
    leaderboardPublicName("global", "Amira Hadžić", "amira.h"),
    "amira.h",
  );
});

test("scoped leaderboard keeps display name for group members", () => {
  assert.equal(
    leaderboardPublicName("group", "Amira Hadžić", "amira.h"),
    "Amira Hadžić",
  );
  assert.equal(
    leaderboardPublicName("mekteb", "Amira Hadžić", "amira.h"),
    "Amira Hadžić",
  );
});

test("global response projection contains no real name or mekteb affiliation", () => {
  const entry = projectLeaderboardEntry("global", {
    user_id: 7,
    display_name: "Amira Hadžić",
    username: "amira.h",
    mekteb_name: "Mekteb Sarajevo",
    best_score: 42,
    total_games: 3,
  }, 1);

  assert.deepEqual(entry, {
    rank: 1,
    userId: 7,
    displayName: "amira.h",
    username: "amira.h",
    mektebName: null,
    bestScore: 42,
    totalGames: 3,
  });
});

test("scoped response projection retains display name and mekteb", () => {
  const entry = projectLeaderboardEntry("mekteb", {
    user_id: 7,
    display_name: "Amira Hadžić",
    username: "amira.h",
    mekteb_name: "Mekteb Sarajevo",
    best_score: 42,
    total_games: 3,
  }, 1);

  assert.equal(entry.displayName, "Amira Hadžić");
  assert.equal(entry.mektebName, "Mekteb Sarajevo");
});