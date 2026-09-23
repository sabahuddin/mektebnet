import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { BMAC_SHOP_LINK, bmacRegistrationProductLink, mektebOfferLink, trialDaysLeft } from "@/lib/billing";
import { useLanguage } from "@/context/language";

export interface SubscriptionProfile {
  coverage: "self" | "family" | "mekteb" | "none";
  planType: "individual" | "family" | "mekteb-standard" | "mekteb-pro" | null;
  canRenew: boolean;
  isActive: boolean;
  trialUntil: string | null;
  billingRegion: "bih" | "dijaspora" | null;
  expectedAmount: number | null;
  currency: "BAM" | "EUR" | null;
  licenceCount: number | null;
  mektebMuallimCount: number | null;
  licenceStart: string | null;
  licenceEnd: string | null;
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

  const paid = data.subscription?.status === "active";
  const licenceActive = data.licenceEnd && new Date(data.licenceEnd).getTime() <= Date.now()
    ? false
    : paid || data.isActive;
  const canSeeBillingDetails = data.coverage === "self" || data.canRenew;
  const days = trialDaysLeft(data.trialUntil);
  const paymentLink = data.billingRegion
    ? data.planType === "mekteb-standard" || data.planType === "mekteb-pro"
      ? mektebOfferLink(
          data.planType === "mekteb-pro" ? "vise100" : "do100",
          data.billingRegion === "bih",
          data.mektebMuallimCount ?? (data.planType === "mekteb-pro" ? 5 : 1),
        )
      : bmacRegistrationProductLink(
          data.planType === "family" ? "roditelj" : "ucenik",
          data.billingRegion === "bih",
        )
    : BMAC_SHOP_LINK;
  const planLabel =
    data.planType === "family" ? t("Porodična licenca") :
    data.planType === "individual" ? t("Pojedinačna licenca") :
    data.planType === "mekteb-pro" ? t("Džematska licenca – Mekteb Pro") :
    t("Džematska licenca – Mekteb Standard");

  if (!canSeeBillingDetails) {
    return (
      <div className={`mb-6 rounded-2xl border p-5 ${licenceActive ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`} data-testid="subscription-profile-card">
        <h3 className={`flex items-center gap-2 font-extrabold ${licenceActive ? "text-emerald-950" : "text-amber-950"}`}>
          <ShieldCheck className="h-5 w-5" />
          {data.coverage === "family" ? t("Porodična licenca") : t("Džematska licenca")}
        </h3>
        {data.coverage === "family" && <p className="mt-1 text-xs text-muted-foreground">
          {t("Učenik je pokriven pretplatom roditelja. Nije potrebna posebna uplata.")}
        </p>}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-bold text-muted-foreground">{t("Licenca")}</dt>
            <dd className="font-extrabold text-foreground">{licenceActive ? t("Aktivna") : t("Nije aktivna")}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted-foreground">{t("Početak")}</dt>
            <dd className="font-extrabold text-foreground">{formatDate(data.licenceStart)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted-foreground">{t("Kraj licence")}</dt>
            <dd className="font-extrabold text-foreground">{formatDate(data.licenceEnd)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className={`mb-6 rounded-2xl border p-5 ${licenceActive ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`} data-testid="subscription-profile-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`flex items-center gap-2 font-extrabold ${licenceActive ? "text-emerald-950" : "text-amber-950"}`}>
            {data.coverage === "self" || data.canRenew
              ? <CreditCard className="h-5 w-5" />
              : <ShieldCheck className="h-5 w-5" />}
            {planLabel}
          </h3>
          <p className={`mt-1 text-sm ${licenceActive ? "text-emerald-800" : "text-amber-800"}`}>
            {paid
              ? `${t("Pretplata je plaćena. Vrijedi do")} ${formatDate(data.subscription?.expiresAt)}.`
              : data.coverage !== "self" && data.isActive
                ? t("Račun je aktivan i pokriven ovom licencom.")
              : data.coverage === "self" && days !== null && days > 0
                ? `${t("Preostalo besplatnog korištenja:")} ${days} ${days === 1 ? t("dan") : t("dana")}.`
                : t("Licenca nije aktivirana.")}
          </p>
          {data.coverage !== "self" && !data.canRenew && (
            <p className={`mt-1 text-xs ${licenceActive ? "text-emerald-700" : "text-amber-700"}`}>
              {data.coverage === "family"
                ? t("Ovaj račun je pokriven porodičnom licencom roditelja.")
                : t("Ovaj račun je pokriven licencom džemata. Nije potrebna posebna uplata.")}
            </p>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${licenceActive ? "bg-white text-emerald-700" : "bg-white text-amber-800"}`}>
          {data.canRenew ? (paid ? t("Plaćeno") : t("Nije plaćeno")) : (licenceActive ? t("Aktivna") : t("Nije aktivna"))}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold text-muted-foreground">{t("Status licence")}</dt>
          <dd className="font-extrabold text-foreground">{licenceActive ? t("Aktivna") : t("Nije aktivna")}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">{t("Vrsta licence")}</dt>
          <dd className="font-extrabold text-foreground">{planLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">{t("Početak licence")}</dt>
          <dd className="font-extrabold text-foreground">{formatDate(data.licenceStart)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted-foreground">{t("Kraj licence")}</dt>
          <dd className="font-extrabold text-foreground">{formatDate(data.licenceEnd)}</dd>
        </div>
        {data.licenceCount !== null && (
          <div>
            <dt className="text-xs font-bold text-muted-foreground">{t("Broj licenci")}</dt>
            <dd className="font-extrabold text-foreground">{data.licenceCount}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-bold text-muted-foreground">{data.planType?.startsWith("mekteb-") ? t("Cijena") : t("Cijena za 12 mjeseci")}</dt>
          <dd className="font-extrabold text-foreground">
            {data.expectedAmount !== null ? data.expectedAmount : "—"} {data.currency === "BAM" ? "KM" : data.currency ?? ""}
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
      {data.canRenew && !paymentLink && (
        <p className="mt-3 text-xs text-amber-800">
          {t("Za odabrani broj muallima nema jedinstvenog proizvoda za uplatu. Obratite se administratoru.")}
        </p>
      )}
      {data.canRenew && paymentLink && (
        <a
          href={paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-bold text-white ${paid ? "bg-emerald-700 hover:bg-emerald-800" : "bg-amber-600 hover:bg-amber-700"}`}
          data-testid="subscription-payment-link"
        >
          <ExternalLink className="h-4 w-4" />
          {data.coverage === "self" && data.planType === "family"
            ? t("Obnovi pretplatu")
            : paid ? t("Produži licencu") : t("Plati i aktiviraj licencu")}
        </a>
      )}
    </div>
  );
}