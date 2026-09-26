import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { PORUKE_READ_EVENT } from "@/hooks/use-unread-poruke";
import { Button } from "@/components/ui/button";

interface AdminContact {
  id: number;
  displayName: string;
  role: string;
}

interface Poruka {
  id: number;
  posiljateljId: number;
  primateljId: number;
  naslov: string;
  sadrzaj: string;
  createdAt: string;
}

const categories = ["Pitanje", "Prijedlog", "Problem"] as const;

export default function PitanjaPrijedloziTab() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminContact[]>([]);
  const [adminId, setAdminId] = useState<number | null>(null);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState("");
  const [messages, setMessages] = useState<Poruka[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Pitanje");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setContactLoading(true);
    setContactError("");
    setAdmins([]);
    setAdminId(null);
    setMessages([]);
    apiRequest<AdminContact[]>("GET", "/poruke/kontakti", undefined, token)
      .then(contacts => {
        if (!active) return;
        const available = contacts.filter(c => c.role === "admin");
        setAdmins(available);
        setAdminId(available[0]?.id ?? null);
      })
      .catch(() => { if (active) setContactError(t("Nije moguće učitati administratore.")); })
      .finally(() => { if (active) setContactLoading(false); });
    return () => { active = false; };
  }, [token, t]);

  useEffect(() => {
    if (!token || !adminId) return;
    let active = true;
    setMessages([]);
    setMessagesLoading(true);
    const load = async () => {
      try {
        const result = await apiRequest<{ poruke: Poruka[] }>(
          "GET", `/poruke/razgovor/${adminId}`, undefined, token,
        );
        if (!active) return;
        setMessages(result.poruke);
        setMessagesError("");
        window.dispatchEvent(new CustomEvent(PORUKE_READ_EVENT));
      } catch {
        if (active) setMessagesError(t("Nije moguće učitati razgovor"));
      } finally {
        if (active) setMessagesLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [adminId, token, t]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !adminId || !text.trim() || sending) return;
    setSending(true);
    try {
      const sent = await apiRequest<Poruka>("POST", "/poruke", {
        primateljId: adminId,
        naslov: category,
        sadrzaj: text.trim(),
      }, token);
      setMessages(current => [...current, sent]);
      setMessagesError("");
      setText("");
      toast({ title: t("Poruka poslana!") });
    } catch (error) {
      toast({
        title: t("Nije moguće poslati poruku"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-5" data-testid="muallim-pitanja-prijedlozi">
      <div className="rounded-2xl border border-border/60 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-foreground">
          <MessageSquare className="h-5 w-5 text-primary" /> {t("Pitanja i prijedlozi")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Vaše poruke vidi samo administrator. Odgovor ćete vidjeti ovdje.")}
        </p>
        {contactLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("Učitavanje...")}</div>
        ) : contactError || admins.length === 0 ? (
          <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {contactError || t("Administrator nije dostupan.")}
          </p>
        ) : (
          <form onSubmit={sendMessage} className="mt-5 space-y-4">
            {admins.length > 1 && (
              <label className="block text-sm font-semibold">
                {t("Odaberite administratora")}
                <select
                  value={adminId ?? ""}
                  onChange={event => setAdminId(Number(event.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5"
                >
                  {admins.map(admin => <option key={admin.id} value={admin.id}>{admin.displayName}</option>)}
                </select>
              </label>
            )}
            <label className="block text-sm font-semibold">
              {t("Vrsta poruke")}
              <select
                value={category}
                onChange={event => setCategory(event.target.value as (typeof categories)[number])}
                className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5"
                data-testid="pitanja-kategorija"
              >
                {categories.map(value => <option key={value} value={value}>{t(value)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {t("Poruka")}
              <textarea
                value={text}
                onChange={event => setText(event.target.value)}
                maxLength={3000}
                rows={5}
                required
                placeholder={t("Napišite pitanje ili prijedlog...")}
                className="mt-1.5 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 font-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="pitanja-poruka"
              />
            </label>
            <Button type="submit" disabled={sending || !text.trim() || !adminId} className="rounded-xl" data-testid="pitanja-posalji">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t("Pošalji poruku")}
            </Button>
          </form>
        )}
      </div>

      {adminId && (
        <div className="rounded-2xl border border-border/60 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-extrabold text-foreground">{t("Razgovor s administratorom")}</h3>
            <span className="text-xs text-muted-foreground"><RefreshCw className="mr-1 inline h-3 w-3" />{t("Automatsko osvježavanje")}</span>
          </div>
          {messagesLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("Učitavanje...")}</p>
          ) : messagesError ? (
            <p role="alert" className="mt-4 text-sm text-red-700">{messagesError}</p>
          ) : messages.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("Nema poruka. Pošaljite prvo pitanje ili prijedlog.")}</p>
          ) : (
            <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto" aria-live="polite">
              {messages.map(message => {
                const own = message.posiljateljId === user?.id;
                return (
                  <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] ${own ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <p className="mb-1 text-xs font-bold opacity-80">
                        {own ? t(message.naslov) : t("Odgovor administratora")}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.sadrzaj}</p>
                      <time className="mt-2 block text-[11px] opacity-70" dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}