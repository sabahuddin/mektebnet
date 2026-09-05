import { useEffect, useState } from "react";
import { Loader2, Plus, UserPlus, Users } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  grupaId?: number | null;
  profil?: { grupaId?: number | null };
}

interface CreatedUcenik {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
  roditelj?: {
    id: number;
    displayName: string;
    username: string;
    generatedPassword: string;
  } | null;
}

interface GroupStudentSetupProps {
  grupaId: number;
}

function parseBulkEntries(text: string) {
  return text.split("\n").map(line => {
    const [u, r] = line.split("|");
    return { ucenik: (u || "").trim(), roditelj: r ? r.trim() : null };
  }).filter(entry => entry.ucenik.length > 0);
}

export function GroupStudentSetup({ grupaId }: GroupStudentSetupProps) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [mode, setMode] = useState<"bulk" | "existing">("bulk");
  const [bulkNames, setBulkNames] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [createdStudents, setCreatedStudents] = useState<CreatedUcenik[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Ucenik[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [addingStudentId, setAddingStudentId] = useState<number | null>(null);

  async function loadAvailableStudents() {
    if (!token) return;
    setStudentsLoading(true);
    try {
      const students = await apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token);
      setAvailableStudents(students.filter(student => !(student.grupaId ?? student.profil?.grupaId)));
    } catch {
      setAvailableStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }

  useEffect(() => {
    void loadAvailableStudents();
  }, [token, grupaId]);

  async function handleBulkAdd() {
    if (!token || !bulkNames.trim()) return;
    const entries = parseBulkEntries(bulkNames);
    if (entries.length === 0) {
      toast({ title: t("Unesite barem jedno ime") });
      return;
    }
    setBulkLoading(true);
    try {
      const results = await apiRequest<CreatedUcenik[]>("POST", "/muallim/ucenici/bulk", {
        entries,
        grupaId,
      }, token);
      setCreatedStudents(results);
      const withParent = results.filter(result => result.roditelj).length;
      toast({
        title: t("{n} učenika dodano!", { n: String(results.length) }),
        description: withParent > 0 ? t("{n} sa nalogom za roditelja", { n: String(withParent) }) : undefined,
      });
      await loadAvailableStudents();
    } catch (error: any) {
      toast({
        title: t("Greška"),
        description: error?.message || t("Neuspješno dodavanje"),
        variant: "destructive",
      });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleAddExisting(studentId: number) {
    if (!token) return;
    setAddingStudentId(studentId);
    try {
      await apiRequest("PUT", `/muallim/ucenici/${studentId}/grupa`, { grupaId }, token);
      setAvailableStudents(current => current.filter(student => student.id !== studentId));
      toast({ title: t("Učenik dodan u grupu!") });
    } catch (error: any) {
      toast({
        title: t("Greška"),
        description: error?.message || t("Nije moguće dodati učenika"),
        variant: "destructive",
      });
    } finally {
      setAddingStudentId(null);
    }
  }

  const entries = parseBulkEntries(bulkNames);
  const withParent = entries.filter(entry => entry.roditelj).length;

  return (
    <section className="bg-white border border-border/50 rounded-2xl p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="font-extrabold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t("Učenici grupe")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Dodavanje učenika koristi se uglavnom pri formiranju grupe i nalazi se u podešavanjima.")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "bulk" ? "default" : "outline"}
          onClick={() => setMode("bulk")}
          className="rounded-xl font-bold"
        >
          <UserPlus className="w-4 h-4 mr-2" /> {t("Dodaj nove učenike")}
        </Button>
        <Button
          type="button"
          variant={mode === "existing" ? "default" : "outline"}
          onClick={() => setMode("existing")}
          className="rounded-xl font-bold"
        >
          <Plus className="w-4 h-4 mr-2" /> {t("Dodaj postojećeg")}
        </Button>
      </div>

      {mode === "bulk" && (
        createdStudents.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="font-bold text-emerald-800 mb-3">
                {t("{n} učenika uspješno kreirano!", { n: String(createdStudents.length) })}
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {createdStudents.map(student => (
                  <div key={student.id} className="space-y-1">
                    <div className="bg-white rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-sm border border-emerald-100">
                      <div>
                        <span className="font-bold text-foreground">{t("Učenik: {ime}", { ime: student.displayName })}</span>
                        <span className="text-muted-foreground ml-2 font-mono text-xs">{student.username}</span>
                      </div>
                      <span className="font-mono font-bold text-primary">{student.generatedPassword}</span>
                    </div>
                    {student.roditelj && (
                      <div className="bg-blue-50 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-sm border border-blue-200 sm:ml-4">
                        <div>
                          <span className="font-bold text-blue-900">{t("Roditelj: {ime}", { ime: student.roditelj.displayName })}</span>
                          <span className="text-blue-700/70 ml-2 font-mono text-xs">{student.roditelj.username}</span>
                        </div>
                        <span className="font-mono font-bold text-blue-700">{student.roditelj.generatedPassword}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                setCreatedStudents([]);
                setBulkNames("");
              }}
              className="w-full rounded-xl font-bold"
            >
              {t("Dodaj još")}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {t("Unesite imena učenika, svako u novi red. Ako želite kreirati i nalog za roditelja, upišite ga iza znaka")}{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">|</code>:
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-900">
              <div className="font-bold mb-1">{t("Primjer:")}</div>
              <code className="block whitespace-pre-wrap font-mono leading-relaxed">
                Amina Hasić | Senad Hasić{"\n"}Ahmed Begović{"\n"}Merjem Hadžić | Edina Hadžić
              </code>
              <p className="mt-2 text-blue-800">{t("Roditelj ne ulazi u kvotu licenci.")}</p>
            </div>
            <textarea
              value={bulkNames}
              onChange={event => setBulkNames(event.target.value)}
              rows={8}
              placeholder={"Amina Hasić | Senad Hasić\nAhmed Begović\nMerjem Hadžić | Edina Hadžić"}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 resize-none font-medium font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {t("{n} učenika", { n: String(entries.length) })}
              {withParent > 0 ? t(" · {r} sa roditeljem", { r: String(withParent) }) : ""}
            </p>
            <Button
              type="button"
              onClick={handleBulkAdd}
              disabled={bulkLoading || entries.length === 0}
              className="w-full rounded-xl font-bold py-3"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {bulkLoading ? t("Kreiranje...") : t("Kreiraj {n} učenika", { n: String(entries.length) })}
            </Button>
          </div>
        )
      )}

      {mode === "existing" && (
        <div>
          {studentsLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : availableStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("Nema dostupnih učenika za dodavanje")}</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {availableStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between gap-3 bg-muted/20 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <span className="block font-bold text-foreground truncate">{student.displayName}</span>
                    <span className="block text-muted-foreground text-xs truncate">{student.username}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddExisting(student.id)}
                    disabled={addingStudentId !== null}
                    className="rounded-lg text-xs font-bold shrink-0"
                  >
                    {addingStudentId === student.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                    {t("Dodaj")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}