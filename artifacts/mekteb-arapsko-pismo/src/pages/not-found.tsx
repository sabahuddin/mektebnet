import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { Maskota } from "@/components/maskota";
import { Home } from "lucide-react";
import { useLanguage } from "@/context/language";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-teal-50 px-4">
      <div className="text-center max-w-md">
        <Maskota varijanta="prazno" size={180} className="mx-auto" />
        <h1 className="mt-4 text-5xl font-black text-foreground">404</h1>
        <p className="mt-2 text-lg font-bold text-foreground">{t("Ova stranica ne postoji")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Mala pčela je tražila ali nije našla. Vrati se kući i nastavi učiti.")}
        </p>
        <Button asChild className="mt-6 rounded-xl flex items-center gap-2 mx-auto" data-testid="button-nazad-kuci">
          <BackLink fallback="/">
            <Home className="w-4 h-4" /> {t("Nazad na početnu")}
          </BackLink>
        </Button>
      </div>
    </div>
  );
}
