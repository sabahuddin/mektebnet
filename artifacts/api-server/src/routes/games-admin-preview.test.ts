import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { db, usersTable } from "@workspace/db";
import { inArray, sql } from "drizzle-orm";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

let server: Server;
let base: string;
const ids: number[] = [];
const tokens: Record<string, string> = {};
before(async () => {
  for (const role of ["admin", "muallim", "roditelj", "ucenik"] as const) {
    const [user] = await db.insert(usersTable).values({
      username: `game-preview-${role}-${Date.now()}`, displayName: "Game preview fixture",
      passwordHash: "test-only", role, isActive: true,
      termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
      administratorDeclarationAcceptedAt: new Date(),
    }).returning();
    ids.push(user.id);
    tokens[role] = signToken({ userId: user.id, username: user.username, displayName: user.displayName, role });
  }
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      const address = server.address();
      base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/games`;
      resolve();
    });
  });
});
after(async () => {
  await new Promise<void>(resolve => server?.close(() => resolve()));
  for (const id of ids) {
    await db.execute(sql`DELETE FROM medena_vidjena_pitanja WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM game_sessions WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM student_progress WHERE student_id = ${String(id)}`);
  }
  if (ids.length) await db.delete(usersTable).where(inArray(usersTable.id, ids));
});
function request(role: string, path: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${tokens[role]}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("admin can preview every game repeatedly without earning student rewards", async () => {
  const credits = await request("admin", "/credits");
  assert.equal(credits.status, 200);
  assert.equal((await credits.json() as { secondsRemaining: number }).secondsRemaining, 1800);
  for (const gameId of ["memory", "quiz", "gradovi", "zastave", "sace", "medena", "pcelin"]) {
    const start = await request("admin", "/start", { gameId });
    assert.equal(start.status, 200, await start.clone().text());
    const { sessionId } = await start.json() as { sessionId: number };
    assert.ok(sessionId);
    await db.execute(sql`UPDATE game_sessions SET started_at = NOW() - INTERVAL '10 seconds' WHERE id = ${sessionId}`);
    const end = await request("admin", "/end", { sessionId, score: 20, answers: [] });
    assert.equal(end.status, 200, await end.clone().text());
    assert.equal((await end.json() as { medEarned: number }).medEarned, 0);
  }
  const progress = await db.execute(sql`SELECT student_id FROM student_progress WHERE student_id = ${String(ids[0])}`);
  assert.equal(progress.rows.length, 0);
  assert.equal((await request("admin", "/medena/pitanja")).status, 200);
  const leaderboard = await request("admin", "/leaderboard");
  assert.equal(leaderboard.status, 200);
  assert.ok(!JSON.stringify(await leaderboard.json()).includes(`"userId":${ids[0]}`));
  assert.equal((await (await request("admin", "/credits")).json() as { secondsRemaining: number }).secondsRemaining, 1800);
});
test("other adult roles remain blocked and pupils still need earned game time", async () => {
  for (const role of ["muallim", "roditelj"]) {
    assert.equal((await request(role, "/credits")).status, 403);
    assert.equal((await request(role, "/start", { gameId: "memory" })).status, 403);
    assert.equal((await request(role, "/end", { sessionId: 1 })).status, 403);
    assert.equal((await request(role, "/medena/pitanja")).status, 403);
  }
  assert.equal((await request("ucenik", "/start", { gameId: "memory", isPreview: true })).status, 403);
});
