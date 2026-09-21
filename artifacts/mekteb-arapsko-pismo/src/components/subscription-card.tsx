import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { BMAC_SHOP_LINK, bmacRegistrationProductLink, trialDaysLeft } from "@/lib/billing";
import { useLanguage } from "@/context/language";

export interface SubscriptionProfile {
  coverage: "self" | "family" | "mekteb" | "none";
  planType: "individual" | "family" | null;
  isActive: boolean;
  trialUntil: string | null;
  billingRegion: "bih" | "dijaspora" | null;
  expectedAmount: number | null;
  currency: "BAM" | "EUR" | null;
  subscription: {
    status: string;
    iznos: number | null;
    valuta: string | null;
    paidAt: string | null;
    activatedAt: string | null;
    expiresAt: string | null;
  } | null;
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("bs-BA") : "—";
}

export function SubscriptionCard({ data }: { data: SubscriptionProfile }) {
  const { t } = useLanguage();
  if (data.coverage === "none") return null;

  if (data.coverage !== "self") {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" data-testid="subscription-covered-card">
        <h3 className="flex items-center gap-2 font-extrabold text-emerald-900">
          <ShieldCheck className="h-5 w-5" /> {t("Pristup je pokriven")}
        </h3>
        <p className="mt-1 text-sm text-emerald-800">
          {data.coverage === "family"
            ? t("Ovaj račun je uključen u porodičnu pretplatu roditelja.")
            : t("Ovaj račun je uključen u pretplatu mekteba. Nije potrebna posebna uplata.")}
        </p>
      </div>
    );
  }

  const paid = data.subscription?.status === "active";
  const days = trialDaysLeft(data.trialUntil);
  const paymentLink = data.billingRegion
    ? bmacRegistrationProductLink(
        data.planType === "family" ? "roditelj" : "ucenik",
        data.billingRegion === "bih",
      )
    : BMAC_SHOP_LINK;
  const planLabel = data.planType === "family" ? t("Porodična pretplata") : t("Pojedinačna pretplata");

  return (
    <div className={`mb-6 rounded-2xl border p-5 ${paid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`} data-testid="subscription-profile-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`flex items-center gap-2 font-extrabold ${paid ? "text-emerald-950" : "text-amber-950"}`}>
            <CreditCard className="h-5 w-5" /> {planLabel}
          </h3>
          <p className={`mt-1 text-sm ${paid ? "text-emerald-800" : "text-amber-800"}`}>
            {paid
              ? `${t("Pretplata je plaćena. Vrijedi do")} ${formatDate(data.subscription?.expiresAt)}.`
              : days !== null && days > 0
                ? `${t("Preostalo besplatnog korištenja:")} ${days} ${days === 1 ? t("dan") : t("dana")}.`
                : t("Probni period je istekao.")}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${paid ? "bg-white text-emerald-700" : "bg-white text-amber-800"}`}>
          {paid ? t("Plaćeno") : t("Nije plaćeno")}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold text-muted-foreground">{t("Cijena za 12 mjeseci")}</dt>
          <dd className="font-extrabold text-foreground">
            {data.expectedAmount !== null ? data.expectedAmount : "—"} {data.currency ?? ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">{t("Regija naplate")}</dt>
          <dd className="font-extrabold text-foreground">
            {data.billingRegion === "bih" ? "BiH" : data.billingRegion === "dijaspora" ? t("Dijaspora") : t("Nije sačuvana")}
          </dd>
        </div>
        {paid && (
          <>
            <div>
              <dt className="text-xs font-bold text-muted-foreground">{t("Datum uplate")}</dt>
              <dd className="font-extrabold text-foreground">{formatDate(data.subscription?.paidAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted-foreground">{t("Aktivirana")}</dt>
              <dd className="font-extrabold text-foreground">{formatDate(data.subscription?.activatedAt)}</dd>
            </div>
          </>
        )}
      </dl>

      {!data.billingRegion && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("Za ovaj stariji račun regija naplate nije sačuvana. Odaberite odgovarajući BiH ili dijaspora proizvod u Shopu.")}
        </p>
      )}
      <a
        href={paymentLink}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-bold text-white ${paid ? "bg-emerald-700 hover:bg-emerald-800" : "bg-amber-600 hover:bg-amber-700"}`}
        data-testid="subscription-payment-link"
      >
        <ExternalLink className="h-4 w-4" />
        {paid ? t("Obnovi pretplatu") : t("Plati pretplatu")}
      </a>
    </div>
  );
}