import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  getSalonePublic,
  getDayBookings,
  createPublicBooking,
} from "@/lib/booking.functions";
import {
  createStripeCheckoutForBooking,
  confirmStripeSession,
} from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  Clock,
  Scissors,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { addDays, format, isBefore, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/prenota/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Prenota online — ${params.slug}` },
      { name: "description", content: "Prenota il tuo appuntamento online." },
    ],
  }),
  component: PrenotaPage,
});

type Servizio = {
  id: string;
  nome: string;
  durata_minuti: number;
  prezzo: number | null;
  staff_ids: string[];
};
type StaffPub = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
  colore: string;
};
type OrarioSalone = {
  giorno_settimana: number;
  chiuso: boolean;
  ora_inizio: string;
  ora_fine: string;
  pausa_inizio: string | null;
  pausa_fine: string | null;
};
type AperturaExtra = { data: string; ora_inizio: string; ora_fine: string };
type ChiusuraExtra = { data_inizio: string; data_fine: string; motivo: string | null };


const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 19;
const SLOT_STEP = 30;
const ANY_STAFF = "__any__";

function jsDayToOurs(d: Date): number {
  return (d.getDay() + 6) % 7;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

function PrenotaPage() {
  const { slug } = Route.useParams();
  const loadSalone = useServerFn(getSalonePublic);
  const loadDay = useServerFn(getDayBookings);
  const createBooking = useServerFn(createPublicBooking);
  const createCheckout = useServerFn(createStripeCheckoutForBooking);
  const confirmSession = useServerFn(confirmStripeSession);

  const [loading, setLoading] = useState(true);
  const [salone, setSalone] = useState<{
    found: boolean;
    enabled: boolean;
    nome?: string;
    servizi?: Servizio[];
    staff?: StaffPub[];
    orari_salone?: OrarioSalone[];
    aperture_straordinarie?: AperturaExtra[];
    chiusure_straordinarie?: ChiusuraExtra[];
    modalita_pagamento_online?: "disattivato" | "opzionale" | "obbligatorio";
    stripe_attivo?: boolean;
    satispay_attivo?: boolean;
  }>({ found: false, enabled: false });

  const [step, setStep] = useState<Step>(1);
  const [servizio, setServizio] = useState<Servizio | null>(null);
  const [data, setData] = useState<string>(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [staffSel, setStaffSel] = useState<string>(ANY_STAFF);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [ora, setOra] = useState<string>("");
  const [form, setForm] = useState({ nome: "", cognome: "", telefono: "" });
  const [payChoice, setPayChoice] = useState<"online" | "negozio">("negozio");
  const [submitting, setSubmitting] = useState(false);
  const [paidConfirmed, setPaidConfirmed] = useState(false);

  useEffect(() => {
    loadSalone({ data: { slug } })
      .then((r) => {
        const mode = (r as { modalita_pagamento_online?: "disattivato" | "opzionale" | "obbligatorio" })
          .modalita_pagamento_online;
        setSalone({
          found: r.found,
          enabled: r.found && (r as { enabled?: boolean }).enabled === true,
          nome: (r as { nome?: string }).nome,
          servizi: (r as { servizi?: Servizio[] }).servizi,
          staff: (r as { staff?: StaffPub[] }).staff,
          orari_salone: (r as { orari_salone?: OrarioSalone[] }).orari_salone,
          aperture_straordinarie: (r as { aperture_straordinarie?: AperturaExtra[] }).aperture_straordinarie,
          chiusure_straordinarie: (r as { chiusure_straordinarie?: ChiusuraExtra[] }).chiusure_straordinarie,
          modalita_pagamento_online: mode ?? "disattivato",
          stripe_attivo: (r as { stripe_attivo?: boolean }).stripe_attivo,
          satispay_attivo: (r as { satispay_attivo?: boolean }).satispay_attivo,
        });

        if (mode === "obbligatorio") setPayChoice("online");
        else setPayChoice("negozio");
      })
      .catch(() => setSalone({ found: false, enabled: false }))
      .finally(() => setLoading(false));
  }, [slug, loadSalone]);

  // Handle return from Stripe Checkout
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    confirmSession({ data: { slug, session_id: sessionId } })
      .then((r) => {
        if (r.ok) {
          setPaidConfirmed(true);
          setStep(6);
        } else {
          toast.error("Pagamento non confermato");
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Errore"))
      .finally(() => {
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, [slug, confirmSession]);

  // Eligible staff for selected service
  const eligibleStaff = useMemo<StaffPub[]>(() => {
    if (!servizio || !salone.staff) return [];
    return salone.staff.filter((m) => servizio.staff_ids.includes(m.id));
  }, [servizio, salone.staff]);

  const hasStaffSystem = (salone.staff?.length ?? 0) > 0;

  useEffect(() => {
    if (step !== 4 || !servizio) return;
    setLoadingSlots(true);
    setOra("");
    loadDay({ data: { slug, giorno: data } })
      .then((r) => {
        if (!r.ok) {
          setSlots([]);
          return;
        }
        const now = Date.now();
        const dayDate = new Date(`${data}T00:00:00`);

        // Build per-staff data
        type StaffInfo = {
          id: string;
          orario: { ora_inizio: string; ora_fine: string; pausa_inizio: string | null; pausa_fine: string | null } | null;
          assente: boolean;
          busy: { start: number; end: number }[];
        };
        const allBusy = r.appuntamenti.map((a) => {
          const s = new Date(a.start_at).getTime();
          return { start: s, end: s + a.durata_minuti * 60000 };
        });
        const staffInfos: StaffInfo[] = r.staff.map((s) => ({
          id: s.id,
          orario: s.orario,
          assente: s.assente,
          busy: s.appuntamenti.map((a) => {
            const t = new Date(a.start_at).getTime();
            return { start: t, end: t + a.durata_minuti * 60000 };
          }),
        }));

        const toMin = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };

        const staffAvailable = (info: StaffInfo, slotStart: Date, slotEnd: number) => {
          if (info.assente) return false;
          if (!info.orario) return false;
          const sm = slotStart.getHours() * 60 + slotStart.getMinutes();
          const em = sm + servizio.durata_minuti;
          if (sm < toMin(info.orario.ora_inizio) || em > toMin(info.orario.ora_fine)) return false;
          if (info.orario.pausa_inizio && info.orario.pausa_fine) {
            const ps = toMin(info.orario.pausa_inizio);
            const pe = toMin(info.orario.pausa_fine);
            if (sm < pe && em > ps) return false;
          }
          const conflict = info.busy.some((b) => slotStart.getTime() < b.end && slotEnd > b.start);
          if (conflict) return false;
          return true;
        };

        const targetStaff =
          staffSel === ANY_STAFF
            ? staffInfos.filter((i) =>
                eligibleStaff.some((e) => e.id === i.id),
              )
            : staffInfos.filter((i) => i.id === staffSel);

        // Fallback when no staff configured at all: use generic working hours + global busy
        const useGeneric = !hasStaffSystem;

        // Determine working window from salone hours (fallback to defaults)
        const sal = r.orario_salone;
        if (sal && sal.chiuso) {
          setSlots([]);
          return;
        }
        const startMin = sal ? toMin(sal.ora_inizio) : DEFAULT_START_HOUR * 60;
        const endMin = sal ? toMin(sal.ora_fine) : DEFAULT_END_HOUR * 60;
        const pausaInizio = sal && (sal as { pausa_inizio?: string | null }).pausa_inizio
          ? toMin((sal as { pausa_inizio: string }).pausa_inizio)
          : null;
        const pausaFine = sal && (sal as { pausa_fine?: string | null }).pausa_fine
          ? toMin((sal as { pausa_fine: string }).pausa_fine)
          : null;

        const out: string[] = [];
        for (
          let m = startMin;
          m + servizio.durata_minuti <= endMin;
          m += SLOT_STEP
        ) {
          const hh = Math.floor(m / 60);
          const mm = m % 60;
          const slotStart = new Date(dayDate);
          slotStart.setHours(hh, mm, 0, 0);
          const slotEnd = slotStart.getTime() + servizio.durata_minuti * 60000;
          if (slotStart.getTime() <= now + 5 * 60000) continue;

          // Skip slots overlapping the salon pause (split-hours)
          if (pausaInizio != null && pausaFine != null) {
            const slotEndMin = m + servizio.durata_minuti;
            if (m < pausaFine && slotEndMin > pausaInizio) continue;
          }

          if (useGeneric) {
            const overlap = allBusy.some(
              (b) => slotStart.getTime() < b.end && slotEnd > b.start,
            );
            if (!overlap) out.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
          } else {
            // at least one targeted staff free
            const free = targetStaff.some((info) => staffAvailable(info, slotStart, slotEnd));
            if (free) out.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
          }
        }

        setSlots(out);
      })
      .finally(() => setLoadingSlots(false));
  }, [step, servizio, data, slug, loadDay, staffSel, eligibleStaff, hasStaffSystem]);

  const dayOptions = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)),
    [],
  );

  const payMode = salone.modalita_pagamento_online ?? "disattivato";
  const onlinePayAvailable =
    payMode !== "disattivato" && salone.stripe_attivo === true;
  const requiresPayment = payMode === "obbligatorio" && onlinePayAvailable;
  const offerPayChoice = payMode === "opzionale" && onlinePayAvailable;
  const willPayNow = requiresPayment || (offerPayChoice && payChoice === "online");

  const submit = async () => {
    if (!servizio || !ora) return;
    if (!form.nome.trim() || !form.cognome.trim() || !form.telefono.trim()) {
      toast.error("Compila tutti i campi");
      return;
    }
    const start = new Date(`${data}T${ora}:00`);
    setSubmitting(true);
    try {
      if (willPayNow) {
        if (servizio.prezzo == null || servizio.prezzo <= 0) {
          toast.error("Questo servizio non ha un prezzo: contatta il salone");
          return;
        }
        const origin = window.location.origin;
        const path = `/prenota/${slug}`;
        const r = await createCheckout({
          data: {
            slug,
            servizio_id: servizio.id,
            start_at: start.toISOString(),
            nome: form.nome,
            cognome: form.cognome,
            telefono: form.telefono,
            staff_id: hasStaffSystem && staffSel !== ANY_STAFF ? staffSel : null,
            success_url: `${origin}${path}`,
            cancel_url: `${origin}${path}`,
          },
        });
        if (r.checkout_url) {
          window.location.href = r.checkout_url;
          return;
        }
        toast.error("Impossibile avviare il pagamento");
      } else {
        await createBooking({
          data: {
            slug,
            servizio_id: servizio.id,
            start_at: start.toISOString(),
            nome: form.nome,
            cognome: form.cognome,
            telefono: form.telefono,
            staff_id: hasStaffSystem && staffSel !== ANY_STAFF ? staffSel : null,
          },
        });
        setStep(6);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!salone.found) {
    return (
      <CenteredCard
        icon={<Scissors className="h-10 w-10 text-muted-foreground" />}
        title="Salone non trovato"
        text="Il link che hai aperto non corrisponde a nessun salone."
      />
    );
  }

  if (!salone.enabled) {
    return (
      <CenteredCard
        icon={<Scissors className="h-10 w-10 text-muted-foreground" />}
        title={salone.nome ?? "Prenotazioni non disponibili"}
        text="Le prenotazioni online sono al momento disattivate. Contatta direttamente il salone."
      />
    );
  }

  const servizi = salone.servizi ?? [];
  const selectedStaff = eligibleStaff.find((s) => s.id === staffSel);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{salone.nome}</h1>
            <p className="text-xs text-muted-foreground">Prenotazione online</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {step < 6 && <Stepper current={step} hasStaff={hasStaffSystem} />}

        {step === 1 && (
          <Section title="Scegli il servizio" icon={<Sparkles className="h-5 w-5 text-primary" />}>
            {servizi.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nessun servizio disponibile al momento.
              </p>
            ) : (
              <div className="space-y-2">
                {servizi.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setServizio(s);
                      setStaffSel(ANY_STAFF);
                      setStep(2);
                    }}
                    className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent/30 transition-all"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-medium text-foreground">{s.nome}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {s.durata_minuti} minuti
                        </p>
                      </div>
                      {s.prezzo != null && (
                        <p className="font-semibold text-primary">€{s.prezzo.toFixed(2)}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {step === 2 && servizio && (
          <Section
            title="Scegli la data"
            icon={<CalendarIcon className="h-5 w-5 text-primary" />}
            onBack={() => setStep(1)}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {dayOptions.map((d) => {
                const ds = format(d, "yyyy-MM-dd");
                const past = isBefore(d, startOfDay(new Date()));
                const ourDay = jsDayToOurs(d);
                const dayOrario = salone.orari_salone?.find(
                  (o) => o.giorno_settimana === ourDay,
                );
                const inChiusura = (salone.chiusure_straordinarie ?? []).some(
                  (c) => ds >= c.data_inizio && ds <= c.data_fine,
                );
                const hasApertura = (salone.aperture_straordinarie ?? []).some(
                  (a) => a.data === ds,
                );
                // Chiusura straordinaria wins. Apertura straordinaria sblocca giorni chiusi.
                const normallyClosed = dayOrario ? dayOrario.chiuso : false;
                const isClosed = inChiusura || (normallyClosed && !hasApertura);
                const disabled = isClosed || past;
                const selected = ds === data;
                return (
                  <button
                    key={ds}
                    disabled={disabled}
                    onClick={() => {
                      setData(ds);
                      setStep(hasStaffSystem && eligibleStaff.length > 0 ? 3 : 4);
                    }}
                    className={cn(
                      "relative p-3 rounded-lg border text-center transition-all",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50",
                      disabled && "opacity-40 cursor-not-allowed",
                    )}
                    title={
                      inChiusura
                        ? "Chiusura straordinaria"
                        : hasApertura
                          ? "Apertura straordinaria"
                          : undefined
                    }
                  >
                    {hasApertura && !inChiusura && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                    <div className="text-xs uppercase">{format(d, "EEE", { locale: it })}</div>
                    <div className="text-lg font-semibold mt-1">{format(d, "d")}</div>
                    <div className="text-xs">{format(d, "MMM", { locale: it })}</div>
                  </button>
                );
              })}

            </div>
          </Section>
        )}

        {step === 3 && servizio && hasStaffSystem && (
          <Section
            title="Scegli l'operatore"
            icon={<Users className="h-5 w-5 text-primary" />}
            onBack={() => setStep(2)}
          >
            <div className="space-y-2">
              <button
                onClick={() => {
                  setStaffSel(ANY_STAFF);
                  setStep(4);
                }}
                className="w-full text-left p-3 rounded-lg border border-border bg-card hover:border-primary transition-all flex items-center gap-3"
              >
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Qualsiasi disponibile</p>
                  <p className="text-xs text-muted-foreground">Ti assegniamo il primo operatore libero</p>
                </div>
              </button>
              {eligibleStaff.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nessun operatore configurato per questo servizio.
                </p>
              )}
              {eligibleStaff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStaffSel(s.id);
                    setStep(4);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border bg-card hover:border-primary transition-all flex items-center gap-3"
                >
                  <StaffAvatar staff={s} size={44} />
                  <div className="flex-1">
                    <p className="font-medium">{s.nome} {s.cognome}</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {step === 4 && servizio && (
          <Section
            title="Scegli l'orario"
            icon={<Clock className="h-5 w-5 text-primary" />}
            onBack={() => setStep(hasStaffSystem && eligibleStaff.length > 0 ? 3 : 2)}
            subtitle={format(new Date(`${data}T00:00:00`), "EEEE d MMMM", { locale: it })}
          >
            {loadingSlots ? (
              <p className="text-center text-muted-foreground py-8">Caricamento orari...</p>
            ) : slots.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nessun orario disponibile per questa data.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setOra(s);
                      setStep(5);
                    }}
                    className="p-3 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {step === 5 && servizio && (
          <Section
            title="I tuoi dati"
            icon={<Check className="h-5 w-5 text-primary" />}
            onBack={() => setStep(4)}
          >
            <div className="rounded-lg bg-accent/30 border border-border p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Servizio</span>
                <span className="font-medium">{servizio.nome}</span>
              </div>
              {hasStaffSystem && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operatore</span>
                  <span className="font-medium">
                    {selectedStaff ? `${selectedStaff.nome} ${selectedStaff.cognome}` : "Qualsiasi disponibile"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quando</span>
                <span className="font-medium">
                  {format(new Date(`${data}T${ora}:00`), "EEE d MMM 'alle' HH:mm", { locale: it })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Durata</span>
                <span className="font-medium">{servizio.durata_minuti} min</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cognome">Cognome *</Label>
                  <Input
                    id="cognome"
                    value={form.cognome}
                    onChange={(e) => setForm({ ...form, cognome: e.target.value })}
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Telefono *</Label>
                <Input
                  id="telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  maxLength={30}
                  placeholder="+39 333 1234567"
                />
              </div>
              {requiresPayment && (
                <div className="rounded-md bg-primary/10 border border-primary/30 p-3 text-sm">
                  <p className="font-medium text-foreground">
                    Pagamento richiesto{servizio.prezzo != null && `: €${servizio.prezzo.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verrai reindirizzato a Stripe per completare il pagamento.
                  </p>
                </div>
              )}
              {offerPayChoice && (
                <div className="space-y-2">
                  <Label>Come vuoi pagare?</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPayChoice("online")}
                      disabled={servizio.prezzo == null || servizio.prezzo <= 0}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all",
                        payChoice === "online"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50",
                        (servizio.prezzo == null || servizio.prezzo <= 0) &&
                          "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <div className="font-medium text-sm">Paga ora online</div>
                      <div className="text-xs text-muted-foreground">
                        {servizio.prezzo != null && servizio.prezzo > 0
                          ? `€${servizio.prezzo.toFixed(2)} con carta`
                          : "Prezzo non disponibile"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayChoice("negozio")}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all",
                        payChoice === "negozio"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50",
                      )}
                    >
                      <div className="font-medium text-sm">Paga in negozio</div>
                      <div className="text-xs text-muted-foreground">
                        Pagherai al momento dell'appuntamento
                      </div>
                    </button>
                  </div>
                </div>
              )}
              <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
                {submitting
                  ? "Caricamento..."
                  : willPayNow
                    ? "Procedi al pagamento"
                    : "Conferma prenotazione"}
              </Button>
            </div>
          </Section>
        )}

        {step === 6 && (
          <Card className="border-primary/30">
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                {paidConfirmed ? "Pagamento ricevuto!" : "Prenotazione confermata!"}
              </h2>
              {servizio && (
                <p className="text-muted-foreground">
                  Ti aspettiamo {format(new Date(`${data}T${ora}:00`), "EEEE d MMMM 'alle' HH:mm", { locale: it })}
                  <br />
                  per {servizio.nome}.
                </p>
              )}
              <p className="text-sm text-muted-foreground pt-2">
                {paidConfirmed
                  ? "Il tuo appuntamento è stato pagato e confermato."
                  : "Riceverai una conferma dal salone."}
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-6">
          Powered by{" "}
          <Link to="/" className="text-primary hover:underline">
            Prenotello
          </Link>
        </p>
      </main>
    </div>
  );
}

function StaffAvatar({ staff, size = 36 }: { staff: StaffPub; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: staff.colore, fontSize: size * 0.38 }}
    >
      {staff.foto_url ? (
        <img src={staff.foto_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>
          {staff.nome.charAt(0)}
          {staff.cognome.charAt(0)}
        </span>
      )}
    </div>
  );
}

function Stepper({ current, hasStaff }: { current: number; hasStaff: boolean }) {
  const total = hasStaff ? 5 : 4;
  // Map step to bar index when no staff system: steps 1,2,4,5 -> bars 1..4
  const barCurrent = !hasStaff && current >= 4 ? current - 1 : current;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const active = n === barCurrent;
        const done = n < barCurrent;
        return (
          <div key={i} className="flex-1 flex items-center gap-1">
            <div
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                done || active ? "bg-primary" : "bg-border",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {icon}
          <div>
            <h2 className="font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function CenteredCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            {icon}
          </div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{text}</p>
        </CardContent>
      </Card>
    </div>
  );
}
