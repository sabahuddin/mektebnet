import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { Library, ChevronRight, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Knjiga {
  id: number;
  slug: string;
  naslov: string;
  kategorija: string;
  coverImage?: string;
}

export default function CitaonicaPage() {
  const [knjige, setKnjige] = useState<Knjiga[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest<Knjiga[]>("GET", "/content/knjige")
      .then(setKnjige)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const price = knjige.filter(k => k.kategorija === "prica");
  const ostale = knjige.filter(k => k.kategorija !== "prica");

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <Library className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Čitaonica</h1>
            <p className="text-muted-foreground text-sm">Priče o poslanicima i islamske teme — {knjige.length} knjiga</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-3xl" />)}
          </div>
        ) : (
          <>
            {price.length > 0 && (
              <>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-600 mb-4">
                  Priče o poslanicima ({price.length})
                </h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  {price.map((k, i) => (
                    <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={`/citaonica/${k.slug}`}>
                        <div className="bg-violet-50 border-2 border-violet-200 rounded-3xl overflow-hidden cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
                          <div className="h-36 bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center overflow-hidden">
                            {k.coverImage ? (
                              <img src={k.coverImage} alt={k.naslov} className="w-full h-full object-cover" />
                            ) : (
                              <BookOpen className="w-14 h-14 text-white opacity-80" />
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-extrabold text-violet-800 leading-snug group-hover:text-violet-600 transition-colors">{k.naslov}</h3>
                            <div className="flex items-center gap-1 text-violet-600 font-bold text-sm mt-3">
                              Čitaj <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {ostale.length > 0 && (
              <>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-violet-600 mb-4">
                  Ostale knjige ({ostale.length})
                </h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {ostale.map((k, i) => (
                    <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={`/citaonica/${k.slug}`}>
                        <div className="bg-violet-50 border-2 border-violet-200 rounded-3xl p-5 cursor-pointer hover:shadow-md transition-all group">
                          <BookOpen className="w-8 h-8 text-violet-500 mb-3" />
                          <h3 className="font-bold text-violet-800 mb-1">{k.naslov}</h3>
                          <div className="flex items-center gap-1 text-violet-600 font-bold text-sm mt-2">
                            Čitaj <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {knjige.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Library className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nema knjiga u čitaonici</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
