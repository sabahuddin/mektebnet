import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "info@mekteb.net";

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Ograničeni timeouti: ako je SMTP nedostupan/spor (npr. Coolify blokira port),
    // send brzo padne u catch → false, umjesto da request visi do default 2 min.
    // Bitno za awaitane pozive (kontakt forma vraća 502 na neuspjeh).
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  console.log(`[Email] SMTP configured: ${SMTP_HOST}:${SMTP_PORT}`);
} else {
  console.log("[Email] SMTP not configured — emails will be logged to console only");
}

export async function sendEmail(to: string, subject: string, html: string) {
  console.log(`[Email] To: ${to} | Subject: ${subject}`);

  if (transporter) {
    try {
      await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
      console.log(`[Email] Sent successfully to ${to}`);
      return true;
    } catch (err) {
      console.error(`[Email] Failed to send to ${to}:`, err);
      return false;
    }
  }

  console.log(`[Email] (No SMTP) HTML:\n${html}`);
  return false;
}

export async function sendPasswordResetEmail(to: string, displayName: string, resetUrl: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0d9488;padding:20px;border-radius:12px 12px 0 0">
        <h2 style="color:white;margin:0">Reset šifre — Mekteb.net</h2>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;background:white">
        <p style="font-size:16px;color:#111827;margin:0 0 16px">Esselamu alejkum, ${displayName},</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px">
          Primili smo zahtjev za promjenu šifre na vašem Mekteb.net računu. Kliknite na dugme ispod kako biste postavili novu šifru:
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${resetUrl}" style="display:inline-block;background:#0d9488;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:16px">Postavi novu šifru</a>
        </div>
        <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 8px">
          Link važi <strong>1 sat</strong>. Ako dugme ne radi, kopirajte link u browser:
        </p>
        <p style="font-size:12px;color:#0d9488;word-break:break-all;margin:0 0 16px">${resetUrl}</p>
        <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0;border-top:1px solid #e5e7eb;padding-top:16px">
          Ako niste vi tražili reset šifre, slobodno ignorišite ovu poruku — vaša šifra ostaje nepromijenjena.
        </p>
      </div>
    </div>
  `;
  return sendEmail(to, "Reset šifre — Mekteb.net", html);
}

export async function sendRegistrationNotification(type: string, data: Record<string, any>) {
  const lines = Object.entries(data)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:bold;border:1px solid #e5e7eb">${k}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${v}</td></tr>`)
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0d9488;padding:20px;border-radius:12px 12px 0 0">
        <h2 style="color:white;margin:0">Nova registracija — ${type}</h2>
      </div>
      <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse">${lines}</table>
        <p style="margin-top:16px;color:#6b7280;font-size:14px">Ova poruka je automatski generisana sa mekteb.net</p>
      </div>
    </div>
  `;

  await sendEmail("info@mekteb.net", `[Mekteb.net] Nova registracija: ${type}`, html);
}
