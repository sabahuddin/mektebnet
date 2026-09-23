import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AcknowledgementFields, emptyAcknowledgements } from "@/components/acknowledgements";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";

export default function ObaveznePotvrdePage() {
  const { user, confirmAcknowledgements, logout } = useAuth();
  const [values, setValues] = useState(emptyAcknowledgements);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;
  const pending = user.pendingAcknowledgements ?? [];

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await confirmAcknowledgements(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Potvrde nije moguće sačuvati. Pokušajte ponovo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <ShieldCheck className="mb-4 h-9 w-9 text-primary" />
        <h1 className="text-2xl font-extrabold">Potvrde prije nastavka</h1>
        <p className="my-4 text-sm text-muted-foreground">
          {user.displayName}, pročitajte dokumente i potvrdite samo ono što za vaš račun još nije zabilježeno.
          Dok ne potvrdite, ostale funkcije naloga nisu dostupne.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <AcknowledgementFields role={user.role} values={values} onChange={setValues} pending={pending} />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Spremanje..." : "Potvrdi i nastavi"}</Button>
        </form>
        <button type="button" onClick={logout} className="mt-5 text-sm font-semibold text-muted-foreground underline">
          Odjavi se
        </button>
      </div>
    </main>
  );
}