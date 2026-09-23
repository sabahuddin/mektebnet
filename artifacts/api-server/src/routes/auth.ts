import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  mektebiTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  grupeTable,
  pretplateTable,
  passwordResetTokensTable,
} from "@workspace/db/schema";
import { eq, and, isNull, gt, desc, inArray } from "drizzle-orm";
import { signToken, requireAuth, invalidateUserStatusCache } from "../middlewares/auth.js";
import { sendRegistrationNotification, sendPasswordResetEmail } from "../lib/email.js";

const router = Router();

type AcknowledgementKey =
  | "terms"
  | "privacy"
  | "administratorDeclaration"
  | "parent";

function pendingAcknowledgements(user: Pick<typeof usersTable.$inferSelect,
  "role" | "termsAcceptedAt" | "privacyAcknowledgedAt" | "administratorDeclarationAcceptedAt" | "parentAcknowledgedAt">): AcknowledgementKey[] {
  const pending: AcknowledgementKey[] = [];
  if (!user.termsAcceptedAt) pending.push("terms");
  if (!user.privacyAcknowledgedAt) pending.push("privacy");
  if (user.role === "muallim" && !user.administratorDeclarationAcceptedAt) pending.push("administratorDeclaration");
  if (user.role === "roditelj" && !user.parentAcknowledgedAt) pending.push("parent");
  return pending;
}

function publicAuthUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    isActive: user.isActive,
    trialUntil: user.trialUntil ? user.trialUntil.toISOString() : null,
    pendingAcknowledgements: pendingAcknowledgements(user),
  };
}

function hasRegistrationAcknowledgements(
  body: any,
  role: "ucenik" | "roditelj" | "muallim",
): boolean {
  if (body?.termsAccepted !== true || body?.privacyAcknowledged !== true) return false;
  if (role === "muallim" && body?.administratorDeclarationAccepted !== true) return false;
  if (role === "roditelj" && body?.parentAcknowledged !== true) return false;
  return true;
}

// Postavlja http-only cookie sa JWT-om za autentifikaciju zahtjeva ka
// statičkom H5P sadržaju (`/uploads/h5p/*`). H5P player u browseru čini
// fetcheve do html/css/js/json fajlova bez prilike da nosi Authorization
// header — cookie ovo rješava jer ga browser šalje automatski za same-origin.
//
// Sigurnost:
//  - HttpOnly: nedostupan iz JS-a (sprječava XSS krađu).
//  - SameSite=Lax: ne šalje se na cross-site POST-ove (CSRF mitigacija).
//  - Secure se postavlja samo u prod (NODE_ENV=production); lokalno je dev http.
//  - Max-Age 30 dana, isti kao JWT expiry.
function setH5pSessionCookie(res: Response, token: string) {
  const isProd = process.env["NODE_ENV"] === "production";
  const parts = [
    `mekteb_h5p_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000", // 30 dana
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// Briše H5P session cookie pri logout-u tako da JWT ostatak vremena valjanosti
// više ne može pristupiti H5P static sadržaju iz browser-a.
function clearH5pSessionCookie(res: Response) {
  const isProd = process.env["NODE_ENV"] === "production";
  const parts = [
    "mekteb_h5p_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Korisničko ime i lozinka su obavezni" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim().toLowerCase()));

    if (!user) {
      res.status(401).json({ error: "Pogrešno korisničko ime ili lozinka" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Pogrešno korisničko ime ili lozinka" });
      return;
    }

    // Pristup je dozvoljen ako je admin odobrio pretplatu (isActive=true) ILI
    // ako je probni period (trialUntil > now) još uvijek aktivan.
    const trialActive = user.trialUntil ? user.trialUntil.getTime() > Date.now() : false;
    if (!user.isActive && !trialActive) {
      res.status(403).json({
        error: user.trialUntil
          ? "Vaš 30-dnevni probni period je istekao. Kontaktirajte administratora kako bi odobrio pretplatu."
          : "Vaš račun još nije aktivan. Kontaktirajte administratora.",
      });
      return;
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    });

    if (pendingAcknowledgements(user).length === 0) setH5pSessionCookie(res, token);
    res.json({
      token,
      user: publicAuthUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/register-roditelj (self-registration for parents)
router.post("/register-roditelj", async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;
    if (!username || !password || !displayName) {
      res.status(400).json({ error: "Popunite sva obavezna polja" });
      return;
    }
    if (!hasRegistrationAcknowledgements(req.body, "roditelj")) {
      res.status(400).json({ error: "Morate pročitati i prihvatiti Uvjete, Pravila privatnosti i izjavu za roditelje" });
      return;
    }

    const exists = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase()));
    if (exists.length > 0) {
      res.status(409).json({ error: "Korisničko ime je zauzeto" });
      return;
    }

    if (email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailExists = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, normalizedEmail));
      if (emailExists.length > 0) {
        res.status(409).json({ error: "Ovaj email je već u upotrebi. Prijavite se ili koristite drugi email." });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const acknowledgedAt = new Date();

    const [newUser] = await db.insert(usersTable).values({
      username: username.trim().toLowerCase(),
      email: email?.trim().toLowerCase() || null,
      passwordHash,
      displayName: displayName.trim(),
      role: "roditelj",
      termsAcceptedAt: acknowledgedAt,
      privacyAcknowledgedAt: acknowledgedAt,
      parentAcknowledgedAt: acknowledgedAt,
    }).returning();

    await db.insert(roditeljProfiliTable).values({ userId: newUser.id });

    const token = signToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role,
      displayName: newUser.displayName,
    });

    setH5pSessionCookie(res, token);
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/forgot-password — pokreće reset šifre.
// Uvijek vraća 200 (ne otkriva da li email postoji u bazi — sigurnost).
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      res.status(400).json({ error: "Email je obavezan" });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const origin =
        process.env["FRONTEND_URL"] ||
        (req.headers.origin as string) ||
        "https://mekteb.net";
      const resetUrl = `${origin.replace(/\/$/, "")}/reset-sifra?token=${rawToken}`;

      if (user.email) {
        await sendPasswordResetEmail(user.email, user.displayName, resetUrl);
      }
    }

    res.json({ ok: true, message: "Ako račun s tim emailom postoji, link za reset je poslan." });
  } catch (err) {
    console.error("[forgot-password]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/reset-password — postavlja novu šifru putem tokena.
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token i nova šifra su obavezni" });
      return;
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      res.status(400).json({ error: "Šifra mora imati najmanje 6 karaktera" });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [record] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      );

    if (!record) {
      res.status(400).json({ error: "Link za reset šifre nije valjan ili je istekao. Zatražite novi." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, record.userId));
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, record.id));

    res.json({ ok: true, message: "Šifra je uspješno promijenjena. Možete se prijaviti." });
  } catch (err) {
    console.error("[reset-password]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/change-password — prijavljeni korisnik mijenja sopstvenu šifru.
// Body: { currentPassword, newPassword }. Zahtijeva trenutnu šifru radi sigurnosti.
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: "Niste prijavljeni" }); return; }
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      res.status(400).json({ error: "Trenutna i nova šifra su obavezne" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Nova šifra mora imati najmanje 6 karaktera" });
      return;
    }
    if (newPassword === currentPassword) {
      res.status(400).json({ error: "Nova šifra mora biti različita od trenutne" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }
    if (user.username.toLowerCase().startsWith("demo.") || user.username.toLowerCase() === "demo") {
      res.status(403).json({ error: "Demo nalozima nije dozvoljena promjena šifre." });
      return;
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) { res.status(401).json({ error: "Trenutna šifra nije ispravna" }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
    res.json({ ok: true, message: "Šifra je uspješno promijenjena." });
  } catch (err) {
    console.error("[change-password]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/logout — briše H5P session cookie. Nije strogo "logout" u JWT
// smislu (token je stateless i traje do isteka), ali sprječava da browser
// nakon klijentskog logout-a još uvijek može fetchati H5P static fajlove.
router.post("/logout", (_req, res) => {
  clearH5pSessionCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
//
// Pored vraćanja korisnikovih podataka, ova ruta osvježava `mekteb_h5p_session`
// HttpOnly cookie. Frontend zove /me pri svakom mount-u aplikacije (App.tsx),
// pa ovo garantuje da svaki ulogovani korisnik uvijek ima validan H5P cookie —
// čak i ako mu je cookie istekao, ako koristi novi browser ili je prijava
// izvršena prije nego je cookie mehanizam uveden. Bez toga, fetch ka
// /api/uploads/h5p/* vraća 401 i h5p-standalone player puca pri inicijalizaciji.
router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    if (!user) {
      res.status(404).json({ error: "Korisnik nije pronađen" });
      return;
    }
    // Re-issue H5P session cookie iz trenutnog Bearer tokena.
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    if (bearer && pendingAcknowledgements(user).length === 0) {
      setH5pSessionCookie(res, bearer);
    }
    res.json(publicAuthUser(user));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/acknowledgements — records the current policy acknowledgements.
// The server supplies timestamps; clients can only submit explicit true values.
router.post("/acknowledgements", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    if (!user) {
      res.status(404).json({ error: "Korisnik nije pronađen" });
      return;
    }
    const now = new Date();
    const patch: Partial<typeof usersTable.$inferInsert> = {};
    if (req.body?.termsAccepted === true && !user.termsAcceptedAt) patch.termsAcceptedAt = now;
    if (req.body?.privacyAcknowledged === true && !user.privacyAcknowledgedAt) patch.privacyAcknowledgedAt = now;
    if (user.role === "muallim" && req.body?.administratorDeclarationAccepted === true && !user.administratorDeclarationAcceptedAt) {
      patch.administratorDeclarationAcceptedAt = now;
    }
    if (user.role === "roditelj" && req.body?.parentAcknowledged === true && !user.parentAcknowledgedAt) {
      patch.parentAcknowledgedAt = now;
    }
    const [updated] = Object.keys(patch).length
      ? await db.update(usersTable).set(patch).where(eq(usersTable.id, user.id)).returning()
      : [user];
    // requireAuth caches acknowledgement state alongside account status. Clear
    // it before replying so the very next protected request sees the write.
    if (Object.keys(patch).length) invalidateUserStatusCache(user.id);
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    if (bearer && pendingAcknowledgements(updated).length === 0) {
      setH5pSessionCookie(res, bearer);
    }
    res.json({ user: publicAuthUser(updated), pendingAcknowledgements: pendingAcknowledgements(updated) });
  } catch (err) {
    console.error("[acknowledgements]", err);
    res.status(500).json({ error: "Nije moguće sačuvati potvrde" });
  }
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Popunite sva polja" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Trenutna lozinka nije tačna" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.user!.userId));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/auth/geo — cijene registracije bez slanja IP adrese trećoj strani.
// Ako je domena iza Cloudflarea, zemlja stiže kao provjeren proxy header.
router.get("/geo", (req, res) => {
  const countryHeader = req.headers["cf-ipcountry"];
  const country = Array.isArray(countryHeader) ? countryHeader[0] : countryHeader;
  res.json({ isBiH: country?.toUpperCase() === "BA" });
});

function generateUsername(firstName: string): string {
  const clean = firstName.toLowerCase().replace(/[^a-z0-9čćžšđ]/g, "").replace(/[čć]/g, "c").replace(/ž/g, "z").replace(/š/g, "s").replace(/đ/g, "d") || "user";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${clean}.${rand}`;
}

// Vraća/kreira jednu od četiri Online Mekteb grupe ovisno o godinama učenika.
// Sve grupe su pod istim "online.muallim" korisnikom (postojeći nalog).
//
// Mapping:
//   1-9   → "Online Mekteb 1"
//   10-12 → "Online Mekteb 2"
//   13-16 → "Online Mekteb 3"
//   17+   → "Online Mekteb"  (odrasli — zadržan postojeći naziv da se izbjegne migracija postojećih učenika)
function nazivGrupeZaGodine(godine: number): string {
  if (godine >= 1 && godine <= 9) return "Online Mekteb 1";
  if (godine >= 10 && godine <= 12) return "Online Mekteb 2";
  if (godine >= 13 && godine <= 16) return "Online Mekteb 3";
  return "Online Mekteb";
}

async function getOnlineMektebGroupForAge(godine: number) {
  const naziv = nazivGrupeZaGodine(godine);

  // Najprije osiguramo "online.muallim" korisnika — sve online grupe su pod njim.
  let [onlineMuallim] = await db.select().from(usersTable).where(eq(usersTable.username, "online.muallim"));
  if (!onlineMuallim) {
    const randomPw = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPw, 10);
    [onlineMuallim] = await db.insert(usersTable).values({
      username: "online.muallim",
      passwordHash,
      displayName: "Online Muallim",
      role: "muallim",
    }).returning();
    await db.insert(muallimProfiliTable).values({
      userId: onlineMuallim.id,
      licenceCount: 9999,
      licencesUsed: 0,
    });
  }

  // Lookup MORA biti scopeovan po muallimId — drugi muallim (npr. iz mekteba)
  // može imati grupu istog naziva, i ne smijemo dodijeliti učenika krivom muallimu.
  let [grupa] = await db
    .select()
    .from(grupeTable)
    .where(and(eq(grupeTable.naziv, naziv), eq(grupeTable.muallimId, onlineMuallim.id)));
  if (grupa) return grupa;

  [grupa] = await db.insert(grupeTable).values({
    muallimId: onlineMuallim.id,
    naziv,
    skolskaGodina: "Mektebska 2025/26",
    daniNastave: [],
    vrijemeNastave: "",
  }).returning();
  return grupa;
}

// POST /api/auth/register-ucenik — adult self-registration (pending admin approval)
router.post("/register-ucenik", async (req, res) => {
  try {
    const { displayName, email, godine, billingRegion } = req.body;
    if (!displayName?.trim() || !email?.trim()) {
      res.status(400).json({ error: "Ime i email su obavezni" });
      return;
    }
    const godineNum = Number(godine);
    if (!Number.isInteger(godineNum) || godineNum < 1 || godineNum > 120) {
      res.status(400).json({ error: "Unesite ispravan broj godina" });
      return;
    }
    if (!hasRegistrationAcknowledgements(req.body, "ucenik")) {
      res.status(400).json({ error: "Morate pročitati i prihvatiti Uvjete i Pravila privatnosti" });
      return;
    }

    const firstName = displayName.trim().split(/\s+/)[0];
    const password = crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(password, 10);
    const acknowledgedAt = new Date();
    const trialUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const region = billingRegion === "bih" ? "bih" : "dijaspora";

    // Online grupa se kreira/dohvaća van transakcije — koristi vlastite
    // mini-transakcije i, ako učenikov insert padne, grupa ne treba rollback
    // (može je koristiti idući učenik). Sigurno da se kreira unaprijed.
    const onlineGrupa = await getOnlineMektebGroupForAge(godineNum);

    // User + ucenik profil moraju biti atomarni — bez ovoga, ako profil insert
    // padne, ostaje "orphan" user sa kredencijalima ali bez profila.
    const newUser = await db.transaction(async (tx) => {
      let user;
      for (let attempt = 0; attempt < 5; attempt++) {
        const username = generateUsername(firstName);
        try {
          [user] = await tx.insert(usersTable).values({
            username,
            passwordHash,
            displayName: displayName.trim(),
            email: email.trim(),
            role: "ucenik",
            isActive: false,
            trialUntil,
            termsAcceptedAt: acknowledgedAt,
            privacyAcknowledgedAt: acknowledgedAt,
          }).returning();
          break;
        } catch (e: any) {
          if (attempt === 4 || !e?.message?.includes("unique")) throw e;
        }
      }
      if (!user) throw new Error("USERNAME_COLLISION");

      await tx.insert(ucenikProfiliTable).values({
        userId: user.id,
        muallimId: onlineGrupa.muallimId,
        grupaId: onlineGrupa.id,
      });
      await tx.insert(pretplateTable).values({
        userId: user.id,
        planType: "individual",
        iznos: 20,
        valuta: region === "bih" ? "BAM" : "EUR",
        status: "pending",
        licencesPurchased: 1,
      });
      return user;
    });

    sendRegistrationNotification("Učenik (samostalni)", {
      "Ime": newUser.displayName,
      "Email": email,
      "Korisničko ime": newUser.username,
      "Godine": godineNum,
      "Grupa": onlineGrupa.naziv,
      "Paket": "Pojedinačna pretplata",
      "Regija naplate": region === "bih" ? "BiH" : "Dijaspora",
      "Probni period do": trialUntil.toISOString().slice(0, 10),
    }).catch((e) => console.error("[Email] registracija učenik:", e));

    res.status(201).json({
      success: true,
      displayName: newUser.displayName,
      username: newUser.username,
      password,
      trialUntil: trialUntil.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/register-roditelj-v2 — parent registration with children count
router.post("/register-roditelj-v2", async (req, res) => {
  try {
    const { displayName, email, billingRegion } = req.body;
    if (!displayName?.trim() || !email?.trim()) {
      res.status(400).json({ error: "Ime i email su obavezni" });
      return;
    }
    if (!hasRegistrationAcknowledgements(req.body, "roditelj")) {
      res.status(400).json({ error: "Morate pročitati i prihvatiti Uvjete, Pravila privatnosti i izjavu za roditelje" });
      return;
    }
    // Provjera duplikata emaila prije insert-a — ljepša poruka nego "Greška servera"
    // koju bi vratio fallback na unique constraint violation.
    const normalizedEmail = email.trim().toLowerCase();
    const existingEmail = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));
    if (existingEmail.length > 0) {
      res.status(409).json({ error: "Ovaj email je već u upotrebi. Prijavite se ili koristite drugi email." });
      return;
    }
    // Porodična pretplata pokriva do 4 djece — roditelj ih dodaje sam u svom profilu.
    const count = 4;

    const firstName = displayName.trim().split(/\s+/)[0];
    const password = crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(password, 10);
    const acknowledgedAt = new Date();
    const trialUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const region = billingRegion === "bih" ? "bih" : "dijaspora";

    // Atomarno: user + roditelj_profili. Ako profil padne, rollback user-a.
    const parentUser = await db.transaction(async (tx) => {
      let user;
      for (let attempt = 0; attempt < 5; attempt++) {
        const username = generateUsername(firstName);
        try {
          [user] = await tx.insert(usersTable).values({
            username,
            passwordHash,
            displayName: displayName.trim(),
            email: normalizedEmail,
            role: "roditelj",
            isActive: false,
            trialUntil,
            termsAcceptedAt: acknowledgedAt,
            privacyAcknowledgedAt: acknowledgedAt,
            parentAcknowledgedAt: acknowledgedAt,
          }).returning();
          break;
        } catch (e: any) {
          if (attempt === 4 || !e?.message?.includes("unique")) throw e;
        }
      }
      if (!user) throw new Error("USERNAME_COLLISION");
      await tx.insert(roditeljProfiliTable).values({ userId: user.id });
      await tx.insert(pretplateTable).values({
        userId: user.id,
        planType: "family",
        iznos: 30,
        valuta: region === "bih" ? "BAM" : "EUR",
        status: "pending",
        licencesPurchased: 4,
      });
      return user;
    });

    sendRegistrationNotification("Roditelj", {
      "Ime": parentUser.displayName,
      "Email": email,
      "Korisničko ime": parentUser.username,
      "Broj djece (max)": count,
      "Paket": "Porodična pretplata",
      "Regija naplate": region === "bih" ? "BiH" : "Dijaspora",
      "Probni period do": trialUntil.toISOString().slice(0, 10),
    }).catch((e) => console.error("[Email] registracija roditelj:", e));

    res.status(201).json({
      success: true,
      displayName: parentUser.displayName,
      username: parentUser.username,
      password,
      trialUntil: trialUntil.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/auth/subscription — pretplata i način pokrića prijavljenog korisnika.
router.get("/subscription", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const [account] = await db.select({
      isActive: usersTable.isActive,
      trialUntil: usersTable.trialUntil,
      email: usersTable.email,
      billingOverride: usersTable.billingOverride,
    }).from(usersTable).where(eq(usersTable.id, userId));
    if (!account) {
      res.status(404).json({ error: "Korisnik nije pronađen" });
      return;
    }

    let coverage: "self" | "family" | "mekteb" | "none" = "none";
    let planType: "individual" | "family" | "mekteb-standard" | "mekteb-pro" | null = null;
    let subscriptionOwnerId: number | null = null;
    let canRenew = false;
    let storedBillingRegion: "bih" | "dijaspora" | null = null;
    let mektebMuallimCount: number | null = null;
    const [ownSubscription] = ["roditelj", "ucenik"].includes(role)
      ? await db.select().from(pretplateTable)
          .where(and(
            eq(pretplateTable.userId, userId),
            eq(pretplateTable.planType, role === "roditelj" ? "family" : "individual"),
          ))
          .orderBy(desc(pretplateTable.createdAt), desc(pretplateTable.id))
          .limit(1)
      : [];

    if (role === "roditelj") {
      if (ownSubscription?.planType === "family") {
        coverage = "self";
        planType = "family";
        subscriptionOwnerId = userId;
        canRenew = true;
      } else {
        const links = await db.select({ ucenikId: roditeljUcenikTable.ucenikId })
          .from(roditeljUcenikTable)
          .where(and(
            eq(roditeljUcenikTable.roditeljId, userId),
            eq(roditeljUcenikTable.status, "approved"),
          ));
        const childIds = links.map((link) => link.ucenikId);
        const childProfiles = childIds.length
          ? await db.select({
              mektebId: ucenikProfiliTable.mektebId,
              muallimId: ucenikProfiliTable.muallimId,
            }).from(ucenikProfiliTable)
              .where(inArray(ucenikProfiliTable.userId, childIds))
          : [];
        let mektebId = childProfiles.find((profile) => profile.mektebId)?.mektebId ?? null;
        if (!mektebId) {
          const teacherIds = childProfiles
            .map((profile) => profile.muallimId)
            .filter((id): id is number => id !== null);
          const [teacherProfile] = teacherIds.length
            ? await db.select({ mektebId: muallimProfiliTable.mektebId })
                .from(muallimProfiliTable)
                .where(inArray(muallimProfiliTable.userId, teacherIds))
                .limit(1)
            : [];
          mektebId = teacherProfile?.mektebId ?? null;
        }
        const [mekteb] = mektebId
          ? await db.select().from(mektebiTable).where(eq(mektebiTable.id, mektebId)).limit(1)
          : [];
        if (mekteb) {
          coverage = "mekteb";
          mektebMuallimCount = mekteb.dozvoljenoMuallima;
          planType = mekteb.billingPaket === "vise100" ? "mekteb-pro" : "mekteb-standard";
          subscriptionOwnerId = mekteb.glavniMuallimId;
          storedBillingRegion =
            mekteb.billingRegion === "bih" || mekteb.billingRegion === "dijaspora"
              ? mekteb.billingRegion
              : null;
        }
      }
    } else if (role === "muallim") {
      const [profile] = await db.select({
        mektebId: muallimProfiliTable.mektebId,
        isGlavni: muallimProfiliTable.isGlavni,
      }).from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));
      const [mekteb] = profile?.mektebId
        ? await db.select().from(mektebiTable)
            .where(eq(mektebiTable.id, profile.mektebId))
            .limit(1)
        : [];
      if (mekteb) {
        coverage = "mekteb";
        mektebMuallimCount = mekteb.dozvoljenoMuallima;
        planType = mekteb.billingPaket === "vise100" ? "mekteb-pro" : "mekteb-standard";
        subscriptionOwnerId = mekteb.glavniMuallimId ?? userId;
        canRenew = profile?.isGlavni === true && subscriptionOwnerId === userId;
        storedBillingRegion =
          mekteb.billingRegion === "bih" || mekteb.billingRegion === "dijaspora"
            ? mekteb.billingRegion
            : null;
      }
    } else if (role === "ucenik") {
      const [familyLink] = await db.select({
        roditeljId: roditeljUcenikTable.roditeljId,
      })
        .from(roditeljUcenikTable)
        .where(and(
          eq(roditeljUcenikTable.ucenikId, userId),
          eq(roditeljUcenikTable.status, "approved"),
        ))
        .limit(1);
      const [profile] = await db.select().from(ucenikProfiliTable)
        .where(eq(ucenikProfiliTable.userId, userId));
      const [muallimProfile] = profile?.muallimId
        ? await db.select({ mektebId: muallimProfiliTable.mektebId })
            .from(muallimProfiliTable)
            .where(eq(muallimProfiliTable.userId, profile.muallimId))
            .limit(1)
        : [];
      const mektebId = profile?.mektebId ?? muallimProfile?.mektebId ?? null;
      const [mekteb] = mektebId
        ? await db.select().from(mektebiTable).where(eq(mektebiTable.id, mektebId)).limit(1)
        : [];

      if (account.billingOverride === "self" && ownSubscription?.planType === "individual") {
        coverage = "self";
        planType = "individual";
        subscriptionOwnerId = userId;
        canRenew = true;
      } else if (mekteb) {
        coverage = "mekteb";
        mektebMuallimCount = mekteb.dozvoljenoMuallima;
        planType = mekteb.billingPaket === "vise100" ? "mekteb-pro" : "mekteb-standard";
        subscriptionOwnerId = mekteb.glavniMuallimId;
        storedBillingRegion =
          mekteb.billingRegion === "bih" || mekteb.billingRegion === "dijaspora"
            ? mekteb.billingRegion
            : null;
      } else if (familyLink) {
        coverage = "family";
        planType = "family";
        subscriptionOwnerId = familyLink.roditeljId;
      }
      else if (ownSubscription?.planType === "individual") {
        coverage = "self";
        planType = "individual";
        subscriptionOwnerId = userId;
        canRenew = true;
      }
    }

    const [subscription] = subscriptionOwnerId
      ? await db.select().from(pretplateTable)
          .where(eq(pretplateTable.userId, subscriptionOwnerId))
          .orderBy(desc(pretplateTable.createdAt), desc(pretplateTable.id))
          .limit(1)
      : [];
    const defaultAmount = planType === "family" ? 30 : planType === "individual" ? 20 : null;
    const expectedAmount = planType === "family"
      ? 30
      : subscription?.iznos ?? defaultAmount;
    const currency = subscription
      ? subscription.valuta === "BAM" ? "BAM" : "EUR"
      : null;
    const canSeeBillingDetails = coverage === "self" || canRenew;

    res.json({
      coverage,
      planType: canSeeBillingDetails ? planType : null,
      canRenew,
      isActive: account.isActive,
      trialUntil: account.trialUntil,
      billingRegion: canSeeBillingDetails
        ? storedBillingRegion
          ?? (currency === "BAM" ? "bih" : currency === "EUR" ? "dijaspora" : null)
        : null,
      expectedAmount: canSeeBillingDetails ? expectedAmount : null,
      currency: canSeeBillingDetails ? currency : null,
      licenceCount: canSeeBillingDetails ? subscription?.licencesPurchased ?? null : null,
      mektebMuallimCount: canSeeBillingDetails ? mektebMuallimCount : null,
      licenceStart: subscription?.activatedAt ?? null,
      licenceEnd: subscription?.expiresAt ?? null,
      subscription: canSeeBillingDetails ? subscription ?? null : null,
    });
  } catch (err) {
    console.error("Subscription profile error:", err);
    res.status(500).json({ error: "Nije moguće učitati pretplatu" });
  }
});

// POST /api/auth/register-mekteb — mekteb registration request
router.post("/register-mekteb", async (req, res) => {
  try {
    const { email, korisnickoIme, displayName, drzava, grad, nazivMekteba, paket, koliko_muallima } = req.body;
    if (!email?.trim() || !korisnickoIme?.trim() || !displayName?.trim() || !grad?.trim() || !nazivMekteba?.trim() || !paket) {
      res.status(400).json({ error: "Sva polja su obavezna" });
      return;
    }
    if (typeof drzava !== "string" || !drzava.trim()) {
      res.status(400).json({ error: "Država je obavezna" });
      return;
    }
    const drzavaTrimmed = drzava.trim();
    if (drzavaTrimmed.length > 100) {
      res.status(400).json({ error: "Država može imati najviše 100 karaktera" });
      return;
    }
    if (!hasRegistrationAcknowledgements(req.body, "muallim")) {
      res.status(400).json({ error: "Morate pročitati i prihvatiti Uvjete, Pravila privatnosti i administratorsku izjavu" });
      return;
    }

    if (paket !== "do100" && paket !== "vise100") {
      res.status(400).json({ error: "Odaberite ispravan Standard ili Pro paket" });
      return;
    }
    const billingPaket: "do100" | "vise100" = paket;
    const billingRegion =
      drzavaTrimmed === "Bosna i Hercegovina" ? "bih" : "dijaspora";
    const paketNaziv = billingPaket === "do100"
      ? "Mektebska pretplata (do 100 učenika)"
      : "Mektebska pretplata XL (više od 100 učenika)";
    const dozvoljenoMuallima = Number(koliko_muallima);
    const licenceCount = billingPaket === "vise100" ? 500 : 100 + (dozvoljenoMuallima - 1) * 30;
    if (!Number.isInteger(dozvoljenoMuallima) ||
        (billingPaket === "do100" && (dozvoljenoMuallima < 1 || dozvoljenoMuallima > 4)) ||
        (billingPaket === "vise100" && dozvoljenoMuallima !== 5)) {
      res.status(400).json({ error: "Odaberite dostupnu kombinaciju paketa i broja muallima" });
      return;
    }

    const usernameClean = String(korisnickoIme).trim().toLowerCase().replace(/\s+/g, ".");
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, usernameClean));
    if (existing.length > 0) {
      res.status(409).json({ error: "Korisničko ime je već zauzeto. Izaberite drugo." });
      return;
    }

    const password = crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(password, 10);
    const acknowledgedAt = new Date();
    const trialUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Iznos odgovara objavljenom jednom BMAC proizvodu za svaku kombinaciju.
    const subscriptionAmount = billingPaket === "vise100"
      ? 300
      : [200, 230, 260, 280][dozvoljenoMuallima - 1]!;
    const subscriptionCurrency = billingRegion === "bih" ? "BAM" : "EUR";

    // Atomarno: mekteb + glavni muallim user + muallim profil. Glavni muallim je
    // onaj ko registruje mekteb; jedino on kreira/briše ostale muallime i vidi
    // zbirnu statistiku mekteba. Bez ovoga, ako neki insert padne, ostaje
    // nedosljedno stanje (muallim bez profila ili mekteb bez glavnog).
    const muallimUser = await db.transaction(async (tx) => {
      const [u] = await tx.insert(usersTable).values({
        username: usernameClean,
        passwordHash,
        displayName: displayName.trim(),
        email: email.trim(),
        role: "muallim",
        isActive: false,
        trialUntil,
          termsAcceptedAt: acknowledgedAt,
          privacyAcknowledgedAt: acknowledgedAt,
          administratorDeclarationAcceptedAt: acknowledgedAt,
      }).returning();
      const [mekteb] = await tx.insert(mektebiTable).values({
        naziv: nazivMekteba.trim(),
        grad: grad.trim(),
        kontaktEmail: email.trim(),
        glavniMuallimId: u.id,
        dozvoljenoMuallima,
        billingPaket,
        billingRegion,
        drzava: drzavaTrimmed,
      }).returning();
      await tx.insert(muallimProfiliTable).values({
        userId: u.id,
        mektebId: mekteb.id,
        isGlavni: true,
        licenceCount,
        licencesUsed: 0,
      });
      await tx.insert(pretplateTable).values({
        userId: u.id,
        planType: billingPaket === "vise100" ? "mekteb-pro" : "mekteb-standard",
        iznos: subscriptionAmount,
        valuta: subscriptionCurrency,
        status: "pending",
        licencesPurchased: licenceCount,
      });
      return u;
    });

    const data: Record<string, any> = {
      "Email": email,
      "Ime i prezime muallima": displayName.trim(),
      "Korisničko ime": usernameClean,
      "Država": drzava,
      "Grad": grad,
      "Naziv mekteba": nazivMekteba,
      "Paket": paketNaziv,
      "Broj licenci": licenceCount,
      "Koliko muallimskih računa traženo": koliko_muallima || 1,
      "Probni period do": trialUntil.toISOString().slice(0, 10),
    };

    console.log("=== MEKTEB REGISTRATION REQUEST ===");
    Object.entries(data).forEach(([k, v]) => console.log(`${k}: ${v}`));
    console.log("====================================");

    sendRegistrationNotification("Mekteb", data)
      .catch((e) => console.error("[Email] registracija mekteb:", e));

    res.status(201).json({
      success: true,
      displayName: muallimUser.displayName,
      username: muallimUser.username,
      password,
      trialUntil: trialUntil.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
