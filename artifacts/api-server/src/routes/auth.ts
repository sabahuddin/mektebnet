import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  grupeTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../middlewares/auth.js";
import { sendRegistrationNotification } from "../lib/email.js";

const router = Router();

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

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Pogrešno korisničko ime ili lozinka" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Pogrešno korisničko ime ili lozinka" });
      return;
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
      },
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

    const exists = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase()));
    if (exists.length > 0) {
      res.status(409).json({ error: "Korisničko ime je zauzeto" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(usersTable).values({
      username: username.trim().toLowerCase(),
      email: email?.trim() || null,
      passwordHash,
      displayName: displayName.trim(),
      role: "roditelj",
    }).returning();

    await db.insert(roditeljProfiliTable).values({ userId: newUser.id });

    const token = signToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role,
      displayName: newUser.displayName,
    });

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

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    if (!user) {
      res.status(404).json({ error: "Korisnik nije pronađen" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
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

// GET /api/auth/geo — detect if user is from Bosnia (BA)
router.get("/geo", async (req, res) => {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || "";

    let isBiH = false;
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
      const data = await response.json() as { countryCode?: string };
      isBiH = data.countryCode === "BA";
    } catch {
      isBiH = false;
    }

    res.json({ isBiH });
  } catch {
    res.json({ isBiH: false });
  }
});

function generateUsername(firstName: string): string {
  const clean = firstName.toLowerCase().replace(/[^a-z0-9čćžšđ]/g, "").replace(/[čć]/g, "c").replace(/ž/g, "z").replace(/š/g, "s").replace(/đ/g, "d") || "user";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${clean}.${rand}`;
}

async function getOnlineMektebGroup() {
  let [grupa] = await db.select().from(grupeTable).where(eq(grupeTable.naziv, "Online Mekteb"));
  if (grupa) return grupa;

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

  [grupa] = await db.insert(grupeTable).values({
    muallimId: onlineMuallim.id,
    naziv: "Online Mekteb",
    skolskaGodina: "2024/2025",
    daniNastave: [],
    vrijemeNastave: "",
  }).returning();
  return grupa;
}

// POST /api/auth/register-ucenik — adult self-registration (pending admin approval)
router.post("/register-ucenik", async (req, res) => {
  try {
    const { displayName, email, paymentLink } = req.body;
    if (!displayName?.trim() || !email?.trim()) {
      res.status(400).json({ error: "Ime i email su obavezni" });
      return;
    }

    const firstName = displayName.trim().split(/\s+/)[0];
    const password = crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(password, 10);

    let newUser;
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = generateUsername(firstName);
      try {
        [newUser] = await db.insert(usersTable).values({
          username,
          passwordHash,
          displayName: displayName.trim(),
          email: email.trim(),
          role: "ucenik",
          isActive: false,
        }).returning();
        break;
      } catch (e: any) {
        if (attempt === 4 || !e?.message?.includes("unique")) throw e;
      }
    }
    if (!newUser) throw new Error("USERNAME_COLLISION");

    const onlineGrupa = await getOnlineMektebGroup();
    await db.insert(ucenikProfiliTable).values({
      userId: newUser.id,
      muallimId: onlineGrupa.muallimId,
      grupaId: onlineGrupa.id,
    });

    await sendRegistrationNotification("Učenik (samostalni)", {
      "Ime": newUser.displayName,
      "Email": email,
      "Korisničko ime": newUser.username,
    });

    res.status(201).json({ success: true, displayName: newUser.displayName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/register-roditelj-v2 — parent registration with children count
router.post("/register-roditelj-v2", async (req, res) => {
  try {
    const { displayName, email, brojDjece, paymentLink } = req.body;
    if (!displayName?.trim() || !email?.trim() || !brojDjece) {
      res.status(400).json({ error: "Ime, email i broj djece su obavezni" });
      return;
    }

    const count = parseInt(brojDjece);
    if (count < 1 || count > 4) {
      res.status(400).json({ error: "Broj djece mora biti 1-4" });
      return;
    }

    const firstName = displayName.trim().split(/\s+/)[0];
    const password = crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(password, 10);

    let parentUser;
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = generateUsername(firstName);
      try {
        [parentUser] = await db.insert(usersTable).values({
          username,
          passwordHash,
          displayName: displayName.trim(),
          email: email.trim(),
          role: "roditelj",
          isActive: false,
        }).returning();
        break;
      } catch (e: any) {
        if (attempt === 4 || !e?.message?.includes("unique")) throw e;
      }
    }
    if (!parentUser) throw new Error("USERNAME_COLLISION");

    await db.insert(roditeljProfiliTable).values({ userId: parentUser.id });

    await sendRegistrationNotification("Roditelj", {
      "Ime": parentUser.displayName,
      "Email": email,
      "Korisničko ime": parentUser.username,
      "Broj djece": count,
    });

    res.status(201).json({ success: true, displayName: parentUser.displayName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/auth/register-mekteb — mekteb registration request
router.post("/register-mekteb", async (req, res) => {
  try {
    const { email, korisnickoIme, drzava, grad, nazivMekteba, paket, koliko_muallima, koliko_ucenika } = req.body;
    if (!email?.trim() || !korisnickoIme?.trim() || !grad?.trim() || !nazivMekteba?.trim() || !paket) {
      res.status(400).json({ error: "Sva polja su obavezna" });
      return;
    }
    if (!drzava?.trim()) {
      res.status(400).json({ error: "Država je obavezna" });
      return;
    }

    const paketNaziv = paket === 4 ? "Posebni zahtjevi" : `Paket ${paket}`;
    const data: Record<string, any> = {
      "Email": email,
      "Korisničko ime": korisnickoIme,
      "Država": drzava,
      "Grad": grad,
      "Naziv mekteba": nazivMekteba,
      "Paket": paketNaziv,
    };

    if (paket === 4) {
      data["Koliko muallima"] = koliko_muallima || 1;
      data["Koliko učenika"] = koliko_ucenika || "50";
    }

    console.log("=== MEKTEB REGISTRATION REQUEST ===");
    Object.entries(data).forEach(([k, v]) => console.log(`${k}: ${v}`));
    console.log("====================================");

    await sendRegistrationNotification("Mekteb", data);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
