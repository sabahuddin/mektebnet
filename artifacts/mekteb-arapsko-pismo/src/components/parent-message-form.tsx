import { useId, useState } from "react";
import { Link } from "wouter";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ParentMessageForm({ parentId, parentName }: { parentId: number; parentName: string }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!token || !body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiRequest("POST", "/poruke", {
        primateljId: parentId, naslov: subject.trim() || undefined, sadrzaj: body.trim(),
      }, token);
      setSubject(""); setBody(""); setOpen(false); setSent(true);
      toast({ title: t("Poruka poslana!") });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Nije moguće sačuvati"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 min-w-0 space-y-3 border-t border-border/50 pt-3" data-testid={`parent-message-${parentId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl font-bold"
          onClick={() => { setOpen(v => !v); setError(null); setSent(false); }} disabled={sending} aria-expanded={open} aria-controls={`${fieldId}-form`}>
          <MessageSquare className="h-4 w-4" />{open ? t("Odustani") : t("Pošalji poruku")}
        </Button>
        <Link href={`/poruke?primateljId=${parentId}`} className="text-xs font-bold text-primary hover:underline">{t("Otvori razgovor")}</Link>
      </div>
      {sent && <p role="status" className="text-sm font-bold text-emerald-700">{t("Poruka poslana!")}</p>}
      {open && <form id={`${fieldId}-form`} className="space-y-3 rounded-xl bg-primary/5 p-3" onSubmit={e => { e.preventDefault(); void send(); }}>
        <p className="break-words text-sm font-bold">{t("Primatelj")}: {parentName}</p>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-subject`}>{t("Naslov poruke")} ({t("opcionalno")})</Label>
          <Input id={`${fieldId}-subject`} value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} disabled={sending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-body`}>{t("Poruka")}</Label>
          <textarea id={`${fieldId}-body`} rows={4} value={body} onChange={e => setBody(e.target.value)} required disabled={sending}
            className="w-full min-w-0 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        {error && <p role="alert" className="break-words text-sm font-medium text-red-700">{error}</p>}
        <Button type="submit" className="w-full gap-2 rounded-xl font-bold sm:w-auto" disabled={sending || !token || !body.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? t("Slanje...") : t("Pošalji poruku")}
        </Button>
      </form>}
    </div>
  );
}