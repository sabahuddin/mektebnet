import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

type Tip = "lekcija" | "prilog" | "kviz";

interface PcelaRatingProps {
  tip: Tip;
  id: number;
  size?: number;
  showCount?: boolean;
  align?: "left" | "right" | "center";
  label?: string;
  className?: string;
}

const BEE = `${import.meta.env.BASE_URL}images/maskota/pcela.png`;

function Bee({ filled, size, onClick, onMouseEnter, onMouseLeave }: {
  filled: boolean;
  size: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={onClick ? "transition-transform hover:scale-125 active:scale-95 cursor-pointer" : "inline-block"}
      style={{ lineHeight: 0 }}
    >
      <img
        src={BEE}
        width={size}
        height={size}
        alt="pčelica"
        draggable={false}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: filled ? "none" : "grayscale(1)",
          opacity: filled ? 1 : 0.3,
        }}
      />
    </Tag>
  );
}

export function PcelaRating({ tip, id, size = 20, showCount = true, align = "left", label, className = "" }: PcelaRatingProps) {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [myOcjena, setMyOcjena] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    fetch(`/api/ocjene/${tip}/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!alive || !data) return;
        setAvg(Number(data.avg ?? 0));
        setCount(Number(data.count ?? 0));
        setMyOcjena(data.myOcjena ?? null);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, [tip, id, token]);

  const sendOcjena = async (val: number) => {
    if (!user || !token) {
      toast({ title: "Prijavi se", description: "Potrebno je biti prijavljen da bi ocijenio.", variant: "destructive" });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/ocjene", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tip, id, ocjena: val }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Greška");
      const data = await r.json();
      setAvg(Number(data.avg ?? 0));
      setCount(Number(data.count ?? 0));
      setMyOcjena(val);
      toast({ title: "Hvala na ocjeni!", description: `Tvoja ocjena: ${val} 🐝` });
    } catch (e: any) {
      toast({ title: "Greška", description: e.message ?? "Pokušaj ponovo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const display = hover ?? myOcjena ?? Math.round(avg);
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  const canRate = !!user && !!token;

  return (
    <div className={`inline-flex items-center gap-2 ${justify} ${className}`} data-testid={`rating-${tip}-${id}`}>
      {label && <span className="text-xs text-muted-foreground font-semibold">{label}</span>}
      <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map(i => (
          <Bee
            key={i}
            size={size}
            filled={i <= display}
            onClick={canRate ? () => sendOcjena(i) : undefined}
            onMouseEnter={canRate ? () => setHover(i) : undefined}
          />
        ))}
      </div>
      {showCount && loaded && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {count > 0 ? `${avg.toFixed(1)} (${count})` : "—"}
        </span>
      )}
    </div>
  );
}

export default PcelaRating;
