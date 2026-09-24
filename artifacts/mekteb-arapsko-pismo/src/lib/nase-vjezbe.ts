/**
 * Naše vježbe (osmosmjerka, popuni prazninu, poredak, razvrstaj, spoji,
 * upiši) žive kao statički HTML na našoj domeni i učitavaju se u iframe.
 * Iframe ne može poslati `X-Lang` zaglavlje, pa jezik putuje kroz upit:
 * `?lang=de` čita i sama vježba (za svoje sučelje) i API koji joj vraća
 * sadržaj. Prefiksi prate foldere u `public/vjezbe/`.
 */
export const NASE_VJEZBE_PREFIKSI = [
  "/vjezbe/osmosmjerka/",
  "/vjezbe/popuni/",
  "/vjezbe/poredak/",
  "/vjezbe/razvrstaj/",
  "/vjezbe/spoji/",
  "/vjezbe/upisi/",
  "/vjezbe/napamet/",
];

export function jeNasaVjezbaUrl(url: string | null | undefined): boolean {
  const u = String(url || "");
  return NASE_VJEZBE_PREFIKSI.some((prefix) => u.startsWith(prefix));
}

/**
 * Dopiši jezik na URL naše vježbe. Vanjski embedi (LearningApps, Wordwall…)
 * i bosanski ostaju netaknuti — ne diramo tuđe adrese.
 */
export function vjezbaSaJezikom(url: string | null | undefined, jezik: string): string {
  const u = String(url || "");
  if (!u || jezik === "bs" || !jeNasaVjezbaUrl(u)) return u;
  if (/[?&]lang=/.test(u)) return u;
  return `${u}${u.includes("?") ? "&" : "?"}lang=${encodeURIComponent(jezik)}`;
}
