import type { ReactNode } from "react";
import { useLanguage } from "@/context/language";

export type AcknowledgementKey = "terms" | "privacy" | "administratorDeclaration" | "parent";

export type AcknowledgementValues = {
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
  administratorDeclarationAccepted: boolean;
  parentAcknowledged: boolean;
};

export const emptyAcknowledgements: AcknowledgementValues = {
  termsAccepted: false,
  privacyAcknowledged: false,
  administratorDeclarationAccepted: false,
  parentAcknowledged: false,
};

const fields: { key: AcknowledgementKey; value: keyof AcknowledgementValues; label: (t: (key: string) => string) => ReactNode }[] = [
  {
    key: "terms", value: "termsAccepted",
    label: t => <>{t("Prihvatam")} <a href="/uvjeti" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">{t("Uvjete korištenja")}</a>.</>,
  },
  {
    key: "privacy", value: "privacyAcknowledged",
    label: t => <>{t("Potvrđujem da sam pročitao/la")} <a href="/privatnost" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">{t("Pravila privatnosti")}</a>.</>,
  },
  {
    key: "administratorDeclaration", value: "administratorDeclarationAccepted",
    label: t => <>{t("Pročitao/la sam i potvrđujem")} <a href="/uvjeti#izjava-muallima" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">{t("izjavu muallima")}</a>: {t("ovlašten/a sam unositi učenike i roditelje u svoju grupu, unosit ću samo potrebne podatke i čuvati izvezene ili ispisane podatke.")}</>,
  },
  {
    key: "parent", value: "parentAcknowledged",
    label: t => <>{t("Upoznat/a sam s")} <a href="/uvjeti#izjava-roditelja" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">{t("izjavom roditelja")}</a> {t("i potvrđujem da sam ovlašten/a otvoriti i koristiti roditeljski račun te upravljati profilima djece koju dodam.")}</>,
  },
];

export function AcknowledgementFields({ role, values, onChange, pending }: {
  role: "ucenik" | "roditelj" | "muallim" | "admin";
  values: AcknowledgementValues;
  onChange: (next: AcknowledgementValues) => void;
  pending?: AcknowledgementKey[];
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
      <p className="font-bold">{t("Prije nastavka pročitajte i potvrdite:")}</p>
      {fields.filter(field =>
        (field.key !== "administratorDeclaration" || role === "muallim")
        && (field.key !== "parent" || role === "roditelj")
        && (!pending || pending.includes(field.key))
      ).map(field => (
        <label key={field.key} className="flex items-start gap-3">
          <input type="checkbox" required checked={values[field.value]}
            onChange={e => onChange({ ...values, [field.value]: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-primary" />
          <span>{field.label(t)}</span>
        </label>
      ))}
    </div>
  );
}