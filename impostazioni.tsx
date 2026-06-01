import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/hooks/use-realtime-tables";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  Globe,
  Copy,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Scissors,
  Clock,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { ModuliConsensoCard } from "@/components/moduli-consenso-card";

const DAYS_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
type OrarioSalone = {
  giorno_settimana: number;
  chiuso: boolean;
  ora_inizio: string;
  ora_fine: string;
  pausa_inizio: string | null;
  pausa_fine: string | null;
};
function defaultOrari(): OrarioSalone[] {
  return DAYS_IT.map((_, i) => ({
    giorno_settimana: i,
    chiuso: i === 6,
    ora_inizio: "09:00",
    ora_fine: "19:00",
    pausa_inizio: null,
    pausa_fine: null,
  }));
}
type AperturaExtra = {
  id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  note: string | null;
};
type ChiusuraExtra = {
  id: string;
  data_inizio: string;
  data_fine: string;
  motivo: string | null;
};


export const Route = createFileRoute("/_authenticated/impostazioni")({
  component: ImpostazioniPage,
});

type Salone = {
  id: string;
  user_id: string;
  nome: string;
  slug: string;
  prenotazioni_online_attive: boolean;
  pagamento_online_obbligatorio: boolean;
  modalita_pagamento_online: "disattivato" | "opzionale" | "obbligatorio";
  stripe_attivo: boolean;
  stripe_secret_key: string | null;
  stripe_publishable_key: string | null;
  stripe_webhook_secret: string | null;
  satispay_attivo: boolean;
  satispay_key_id: string | null;
  satispay_private_key: string | null;
};

type Servizio = {
  id: string;
  user_id: string;
  nome: string;
  durata_minuti: number;
  prezzo: number | null;
  attivo: boolean;
};

const SLUG_RE = /^[a-z0-9-]{2,60}$/;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function ImpostazioniPage() {
  const [email, setEmail] = useState("");
  const [salone, setSalone] = useState<Salone | null>(null);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [servizi, setServizi] = useState<Servizio[]>([]);

  const [svcDialogOpen, setSvcDialogOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Servizio | null>(null);
  const [svcForm, setSvcForm] = useState({
    nome: "",
    durata_minuti: 30,
    prezzo: "",
    attivo: true,
  });
  const [svcDeleteId, setSvcDeleteId] = useState<string | null>(null);

  const [orari, setOrari] = useState<OrarioSalone[]>(defaultOrari());
  const [savingOrari, setSavingOrari] = useState(false);
  const [aperture, setAperture] = useState<AperturaExtra[]>([]);
  const [chiusure, setChiusure] = useState<ChiusuraExtra[]>([]);
  const [apForm, setApForm] = useState({ data: "", ora_inizio: "09:00", ora_fine: "13:00", note: "" });
  const [chForm, setChForm] = useState({ data_inizio: "", data_fine: "", motivo: "" });
  const [savingPay, setSavingPay] = useState(false);

  const [pay, setPay] = useState<{
    modalita_pagamento_online: "disattivato" | "opzionale" | "obbligatorio";
    stripe_attivo: boolean;
    stripe_secret_key: string;
    stripe_publishable_key: string;
    stripe_webhook_secret: string;
    satispay_attivo: boolean;
    satispay_key_id: string;
    satispay_private_key: string;
  }>({
    modalita_pagamento_online: "disattivato",
    stripe_attivo: false,
    stripe_secret_key: "",
    stripe_publishable_key: "",
    stripe_webhook_secret: "",
    satispay_attivo: false,
    satispay_key_id: "",
    satispay_private_key: "",
  });

  const bootstrap = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setEmail(u.user.email ?? "");

    let { data: row } = await supabase
      .from("saloni")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();

    if (!row) {
      const defaultSlug = `salone-${u.user.id.slice(0, 8)}`;
      const ins = await supabase
        .from("saloni")
        .insert({
          user_id: u.user.id,
          nome: "Il mio salone",
          slug: defaultSlug,
          prenotazioni_online_attive: false,
        })
        .select()
        .single();
      row = ins.data;
    }

    if (row) {
      setSalone(row as Salone);
      setNome(row.nome);
      setSlug(row.slug);
      const r = row as unknown as Salone;
      setPay({
        modalita_pagamento_online:
          r.modalita_pagamento_online ??
          (r.pagamento_online_obbligatorio ? "obbligatorio" : "disattivato"),
        stripe_attivo: !!r.stripe_attivo,
        stripe_secret_key: r.stripe_secret_key ?? "",
        stripe_publishable_key: r.stripe_publishable_key ?? "",
        stripe_webhook_secret: r.stripe_webhook_secret ?? "",
        satispay_attivo: !!r.satispay_attivo,
        satispay_key_id: r.satispay_key_id ?? "",
        satispay_private_key: r.satispay_private_key ?? "",
      });
    }

    const { data: svc } = await supabase
      .from("servizi")
      .select("*")
      .order("nome");
    setServizi(
      ((svc ?? []) as Servizio[]).map((s) => ({
        ...s,
        prezzo: s.prezzo == null ? null : Number(s.prezzo),
      })),
    );

    const { data: ors } = await supabase
      .from("salone_orari")
      .select("giorno_settimana, chiuso, ora_inizio, ora_fine, pausa_inizio, pausa_fine")
      .eq("user_id", u.user.id);
    const base = defaultOrari();
    (ors ?? []).forEach((o) => {
      const idx = base.findIndex((b) => b.giorno_settimana === o.giorno_settimana);
      if (idx >= 0)
        base[idx] = {
          giorno_settimana: o.giorno_settimana as number,
          chiuso: o.chiuso as boolean,
          ora_inizio: String(o.ora_inizio).slice(0, 5),
          ora_fine: String(o.ora_fine).slice(0, 5),
          pausa_inizio: o.pausa_inizio ? String(o.pausa_inizio).slice(0, 5) : null,
          pausa_fine: o.pausa_fine ? String(o.pausa_fine).slice(0, 5) : null,
        };
    });
    setOrari(base);

    const [ap, ch] = await Promise.all([
      supabase
        .from("salone_aperture_straordinarie")
        .select("*")
        .eq("user_id", u.user.id)
        .order("data"),
      supabase
        .from("salone_chiusure_straordinarie")
        .select("*")
        .eq("user_id", u.user.id)
        .order("data_inizio"),
    ]);
    setAperture(
      ((ap.data ?? []) as AperturaExtra[]).map((a) => ({
        ...a,
        ora_inizio: String(a.ora_inizio).slice(0, 5),
        ora_fine: String(a.ora_fine).slice(0, 5),
      })),
    );
    setChiusure((ch.data ?? []) as ChiusuraExtra[]);
  };

  const saveOrari = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    for (const o of orari) {
      if (!o.chiuso && o.ora_inizio >= o.ora_fine) {
        toast.error(`${DAYS_IT[o.giorno_settimana]}: orario non valido`);
        return;
      }
      if (!o.chiuso && o.pausa_inizio && o.pausa_fine) {
        if (
          o.pausa_inizio >= o.pausa_fine ||
          o.pausa_inizio < o.ora_inizio ||
          o.pausa_fine > o.ora_fine
        ) {
          toast.error(`${DAYS_IT[o.giorno_settimana]}: pausa non valida`);
          return;
        }
      }
    }
    setSavingOrari(true);
    const payload = orari.map((o) => ({
      user_id: u.user!.id,
      giorno_settimana: o.giorno_settimana,
      chiuso: o.chiuso,
      ora_inizio: o.ora_inizio,
      ora_fine: o.ora_fine,
      pausa_inizio: o.chiuso ? null : o.pausa_inizio,
      pausa_fine: o.chiuso ? null : o.pausa_fine,
    }));
    const { error } = await supabase
      .from("salone_orari")
      .upsert(payload, { onConflict: "user_id,giorno_settimana" });
    setSavingOrari(false);
    if (error) toast.error(error.message);
    else toast.success("Orari salvati");
  };


  const addApertura = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!apForm.data) return toast.error("Seleziona una data");
    if (apForm.ora_inizio >= apForm.ora_fine) return toast.error("Orario non valido");
    const { data, error } = await supabase
      .from("salone_aperture_straordinarie")
      .insert({
        user_id: u.user.id,
        data: apForm.data,
        ora_inizio: apForm.ora_inizio,
        ora_fine: apForm.ora_fine,
        note: apForm.note.trim() || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setAperture((p) =>
      [...p, data as AperturaExtra].sort((a, b) => a.data.localeCompare(b.data)),
    );
    setApForm({ data: "", ora_inizio: "09:00", ora_fine: "13:00", note: "" });
    toast.success("Apertura straordinaria aggiunta");
  };
  const removeApertura = async (id: string) => {
    const { error } = await supabase.from("salone_aperture_straordinarie").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAperture((p) => p.filter((x) => x.id !== id));
  };
  const addChiusura = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!chForm.data_inizio || !chForm.data_fine) return toast.error("Indica le date");
    if (chForm.data_inizio > chForm.data_fine) return toast.error("Intervallo non valido");
    const { data, error } = await supabase
      .from("salone_chiusure_straordinarie")
      .insert({
        user_id: u.user.id,
        data_inizio: chForm.data_inizio,
        data_fine: chForm.data_fine,
        motivo: chForm.motivo.trim() || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setChiusure((p) =>
      [...p, data as ChiusuraExtra].sort((a, b) => a.data_inizio.localeCompare(b.data_inizio)),
    );
    setChForm({ data_inizio: "", data_fine: "", motivo: "" });
    toast.success("Chiusura straordinaria aggiunta");
  };
  const removeChiusura = async (id: string) => {
    const { error } = await supabase.from("salone_chiusure_straordinarie").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setChiusure((p) => p.filter((x) => x.id !== id));
  };


  const savePay = async () => {
    if (!salone) return;
    setSavingPay(true);
    const { error } = await supabase
      .from("saloni")
      .update({
        modalita_pagamento_online: pay.modalita_pagamento_online,
        pagamento_online_obbligatorio: pay.modalita_pagamento_online === "obbligatorio",
        stripe_attivo: pay.stripe_attivo,
        stripe_secret_key: pay.stripe_secret_key.trim() || null,
        stripe_publishable_key: pay.stripe_publishable_key.trim() || null,
        stripe_webhook_secret: pay.stripe_webhook_secret.trim() || null,
        satispay_attivo: pay.satispay_attivo,
        satispay_key_id: pay.satispay_key_id.trim() || null,
        satispay_private_key: pay.satispay_private_key.trim() || null,
      } as never)
      .eq("id", salone.id);
    setSavingPay(false);
    if (error) toast.error(error.message);
    else toast.success("Impostazioni pagamento salvate");
  };

  useEffect(() => {
    bootstrap();
  }, []);

  useRealtimeTables(
    [
      "saloni",
      "servizi",
      "salone_orari",
      "salone_aperture_straordinarie",
      "salone_chiusure_straordinarie",
    ],
    () => bootstrap(),
  );

  const saveSalone = async () => {
    if (!salone) return;
    const cleanSlug = slugify(slug);
    if (!SLUG_RE.test(cleanSlug)) {
      toast.error("Il link deve contenere solo lettere, numeri o trattini (min 2 caratteri)");
      return;
    }
    if (!nome.trim()) {
      toast.error("Inserisci il nome del salone");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("saloni")
      .update({ nome: nome.trim(), slug: cleanSlug })
      .eq("id", salone.id);
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Questo link è già in uso, scegline un altro");
      } else {
        toast.error(error.message);
      }
      return;
    }
    setSalone({ ...salone, nome: nome.trim(), slug: cleanSlug });
    setSlug(cleanSlug);
    toast.success("Impostazioni salvate");
  };

  const toggleOnline = async (val: boolean) => {
    if (!salone) return;
    const { error } = await supabase
      .from("saloni")
      .update({ prenotazioni_online_attive: val })
      .eq("id", salone.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSalone({ ...salone, prenotazioni_online_attive: val });
    toast.success(
      val ? "Prenotazioni online attivate" : "Prenotazioni online disattivate",
    );
  };

  const openNewSvc = () => {
    setEditingSvc(null);
    setSvcForm({ nome: "", durata_minuti: 30, prezzo: "", attivo: true });
    setSvcDialogOpen(true);
  };

  const openEditSvc = (s: Servizio) => {
    setEditingSvc(s);
    setSvcForm({
      nome: s.nome,
      durata_minuti: s.durata_minuti,
      prezzo: s.prezzo == null ? "" : String(s.prezzo),
      attivo: s.attivo,
    });
    setSvcDialogOpen(true);
  };

  const saveSvc = async () => {
    if (!svcForm.nome.trim()) {
      toast.error("Inserisci il nome del servizio");
      return;
    }
    const payload = {
      nome: svcForm.nome.trim(),
      durata_minuti: Number(svcForm.durata_minuti) || 30,
      prezzo: svcForm.prezzo.trim() ? Number(svcForm.prezzo) : null,
      attivo: svcForm.attivo,
    };
    if (editingSvc) {
      const { error } = await supabase
        .from("servizi")
        .update(payload)
        .eq("id", editingSvc.id);
      if (error) return toast.error(error.message);
      toast.success("Servizio aggiornato");
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from("servizi")
        .insert({ ...payload, user_id: u.user.id });
      if (error) return toast.error(error.message);
      toast.success("Servizio creato");
    }
    setSvcDialogOpen(false);
    bootstrap();
  };

  const removeSvc = async () => {
    if (!svcDeleteId) return;
    const { error } = await supabase
      .from("servizi")
      .delete()
      .eq("id", svcDeleteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Servizio eliminato");
      bootstrap();
    }
    setSvcDeleteId(null);
  };

  const publicUrl =
    salone && typeof window !== "undefined"
      ? `${window.location.origin}/prenota/${salone.slug}`
      : "";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Impostazioni
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestisci il tuo account, il salone e le prenotazioni online
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="text-foreground font-medium">{email || "—"}</p>
        </CardContent>
      </Card>

      {salone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              Il tuo salone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome-salone">Nome del salone</Label>
              <Input
                id="nome-salone"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Link prenotazione</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  /prenota/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  maxLength={60}
                  placeholder="nome-salone"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Solo lettere minuscole, numeri e trattini.
              </p>
            </div>
            <Button onClick={saveSalone} disabled={saving}>
              {saving ? "Salvataggio..." : "Salva modifiche"}
            </Button>
          </CardContent>
        </Card>
      )}

      {salone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Prenotazioni online
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="font-medium text-foreground">
                  Pagina di prenotazione pubblica
                </p>
                <p className="text-sm text-muted-foreground">
                  I clienti possono prenotare senza account dal tuo link.
                </p>
              </div>
              <Switch
                checked={salone.prenotazioni_online_attive}
                onCheckedChange={toggleOnline}
              />
            </div>

            {salone.prenotazioni_online_attive && (
              <div className="space-y-2">
                <Label>Il tuo link pubblico</Label>
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("Link copiato");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                {servizi.filter((s) => s.attivo).length === 0 && (
                  <p className="text-sm text-destructive">
                    Aggiungi almeno un servizio attivo per ricevere prenotazioni.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Orari di apertura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Imposta i giorni di apertura e le fasce orarie. I clienti vedranno solo gli slot disponibili.
          </p>
          <div className="divide-y divide-border">
            {orari.map((o, idx) => {
              const hasPausa = o.pausa_inizio != null && o.pausa_fine != null;
              return (
                <div key={o.giorno_settimana} className="py-3 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-24 font-medium text-foreground text-sm">
                      {DAYS_IT[o.giorno_settimana]}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!o.chiuso}
                        onCheckedChange={(v) => {
                          const next = [...orari];
                          next[idx] = { ...o, chiuso: !v };
                          setOrari(next);
                        }}
                      />
                      <span className="text-xs text-muted-foreground w-14">
                        {o.chiuso ? "Chiuso" : "Aperto"}
                      </span>
                    </div>
                    {!o.chiuso && (
                      <div className="flex items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          value={o.ora_inizio}
                          onChange={(e) => {
                            const next = [...orari];
                            next[idx] = { ...o, ora_inizio: e.target.value };
                            setOrari(next);
                          }}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                          type="time"
                          value={hasPausa ? o.pausa_inizio! : o.ora_fine}
                          onChange={(e) => {
                            const next = [...orari];
                            if (hasPausa) next[idx] = { ...o, pausa_inizio: e.target.value };
                            else next[idx] = { ...o, ora_fine: e.target.value };
                            setOrari(next);
                          }}
                          className="w-28"
                        />
                      </div>
                    )}
                  </div>
                  {!o.chiuso && (
                    <div className="flex items-center gap-3 flex-wrap pl-24">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={hasPausa}
                          onCheckedChange={(v) => {
                            const next = [...orari];
                            if (v) {
                              next[idx] = {
                                ...o,
                                pausa_inizio: "13:00",
                                pausa_fine: "15:00",
                              };
                            } else {
                              next[idx] = { ...o, pausa_inizio: null, pausa_fine: null };
                            }
                            setOrari(next);
                          }}
                        />
                        Orario spezzato (pausa)
                      </label>
                      {hasPausa && (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs text-muted-foreground">Riapre</span>
                          <Input
                            type="time"
                            value={o.pausa_fine!}
                            onChange={(e) => {
                              const next = [...orari];
                              next[idx] = { ...o, pausa_fine: e.target.value };
                              setOrari(next);
                            }}
                            className="w-28"
                          />
                          <span className="text-muted-foreground">—</span>
                          <Input
                            type="time"
                            value={o.ora_fine}
                            onChange={(e) => {
                              const next = [...orari];
                              next[idx] = { ...o, ora_fine: e.target.value };
                              setOrari(next);
                            }}
                            className="w-28"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button onClick={saveOrari} disabled={savingOrari}>
            {savingOrari ? "Salvataggio..." : "Salva orari"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-600" />
            Aperture straordinarie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Apri il salone in una data specifica anche se normalmente è chiuso.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={apForm.data}
                onChange={(e) => setApForm({ ...apForm, data: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dalle</Label>
              <Input
                type="time"
                value={apForm.ora_inizio}
                onChange={(e) => setApForm({ ...apForm, ora_inizio: e.target.value })}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alle</Label>
              <Input
                type="time"
                value={apForm.ora_fine}
                onChange={(e) => setApForm({ ...apForm, ora_fine: e.target.value })}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note (opz.)</Label>
              <Input
                value={apForm.note}
                onChange={(e) => setApForm({ ...apForm, note: e.target.value })}
                placeholder="Festa, evento..."
              />
            </div>
            <Button onClick={addApertura}>Aggiungi</Button>
          </div>
          {aperture.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nessuna apertura straordinaria.</p>
          ) : (
            <div className="divide-y divide-border">
              {aperture.map((a) => (
                <div key={a.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {a.data} · {a.ora_inizio}–{a.ora_fine}
                    </p>
                    {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeApertura(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Chiusure straordinarie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Chiudi il salone in una data o periodo specifico (es. ferie estive).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Dal</Label>
              <Input
                type="date"
                value={chForm.data_inizio}
                onChange={(e) => setChForm({ ...chForm, data_inizio: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Al</Label>
              <Input
                type="date"
                value={chForm.data_fine}
                onChange={(e) => setChForm({ ...chForm, data_fine: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motivo (opz.)</Label>
              <Input
                value={chForm.motivo}
                onChange={(e) => setChForm({ ...chForm, motivo: e.target.value })}
                placeholder="Ferie, malattia..."
              />
            </div>
            <Button onClick={addChiusura}>Aggiungi</Button>
          </div>
          {chiusure.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nessuna chiusura straordinaria.</p>
          ) : (
            <div className="divide-y divide-border">
              {chiusure.map((c) => (
                <div key={c.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {c.data_inizio === c.data_fine
                        ? c.data_inizio
                        : `${c.data_inizio} → ${c.data_fine}`}
                    </p>
                    {c.motivo && <p className="text-xs text-muted-foreground">{c.motivo}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeChiusura(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {salone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pagamenti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <p className="font-medium text-foreground">Pagamento online</p>
              <p className="text-sm text-muted-foreground">
                Scegli come gestire il pagamento durante la prenotazione online.
              </p>
              <div className="grid gap-2 pt-1">
                {(
                  [
                    {
                      v: "disattivato",
                      t: "Disattivato",
                      d: "Nessun pagamento online. Il cliente paga sempre in negozio.",
                    },
                    {
                      v: "opzionale",
                      t: "Opzionale",
                      d: "Il cliente sceglie se pagare ora online o in negozio.",
                    },
                    {
                      v: "obbligatorio",
                      t: "Obbligatorio",
                      d: "La prenotazione è confermata solo dopo il pagamento online.",
                    },
                  ] as const
                ).map((opt) => {
                  const active = pay.modalita_pagamento_online === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() =>
                        setPay({ ...pay, modalita_pagamento_online: opt.v })
                      }
                      className={
                        "text-left p-3 rounded-md border transition-colors " +
                        (active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50")
                      }
                    >
                      <div className="font-medium text-sm text-foreground">{opt.t}</div>
                      <div className="text-xs text-muted-foreground">{opt.d}</div>
                    </button>
                  );
                })}
              </div>
              {pay.modalita_pagamento_online !== "disattivato" &&
                !pay.stripe_attivo &&
                !pay.satispay_attivo && (
                  <p className="text-xs text-destructive pt-1">
                    Attiva almeno un metodo di pagamento (Stripe o Satispay) qui sotto.
                  </p>
                )}
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">Stripe (carta)</p>
                <Switch
                  checked={pay.stripe_attivo}
                  onCheckedChange={(v) => setPay({ ...pay, stripe_attivo: v })}
                />
              </div>
              {pay.stripe_attivo && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="sk">Stripe Secret Key</Label>
                    <Input
                      id="sk"
                      type="password"
                      value={pay.stripe_secret_key}
                      onChange={(e) =>
                        setPay({ ...pay, stripe_secret_key: e.target.value })
                      }
                      placeholder="sk_live_..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pk">Stripe Publishable Key</Label>
                    <Input
                      id="pk"
                      value={pay.stripe_publishable_key}
                      onChange={(e) =>
                        setPay({ ...pay, stripe_publishable_key: e.target.value })
                      }
                      placeholder="pk_live_..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="whsec">Stripe Webhook Secret</Label>
                    <Input
                      id="whsec"
                      type="password"
                      value={pay.stripe_webhook_secret}
                      onChange={(e) =>
                        setPay({ ...pay, stripe_webhook_secret: e.target.value })
                      }
                      placeholder="whsec_..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">Satispay</p>
                <Switch
                  checked={pay.satispay_attivo}
                  onCheckedChange={(v) => setPay({ ...pay, satispay_attivo: v })}
                />
              </div>
              {pay.satispay_attivo && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="ssk">Satispay Key ID</Label>
                    <Input
                      id="ssk"
                      value={pay.satispay_key_id}
                      onChange={(e) =>
                        setPay({ ...pay, satispay_key_id: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="spk">Satispay Private Key</Label>
                    <Textarea
                      id="spk"
                      value={pay.satispay_private_key}
                      onChange={(e) =>
                        setPay({ ...pay, satispay_private_key: e.target.value })
                      }
                      rows={4}
                      placeholder="-----BEGIN PRIVATE KEY-----..."
                    />
                  </div>
                </div>
              )}
            </div>

            <Button onClick={savePay} disabled={savingPay}>
              {savingPay ? "Salvataggio..." : "Salva impostazioni pagamento"}
            </Button>
          </CardContent>
        </Card>
      )}




      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Servizi
          </CardTitle>
          <Button size="sm" onClick={openNewSvc}>
            <Plus className="h-4 w-4 mr-1" />
            Nuovo servizio
          </Button>
        </CardHeader>
        <CardContent>
          {servizi.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Nessun servizio. Aggiungi i servizi che offri ai clienti.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {servizi.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-3 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">
                        {s.nome}
                      </p>
                      {!s.attivo && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          disattivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.durata_minuti} min
                      {s.prezzo != null && ` · €${s.prezzo.toFixed(2)}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditSvc(s)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSvcDeleteId(s.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSvc ? "Modifica servizio" : "Nuovo servizio"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="svc-nome">Nome *</Label>
              <Input
                id="svc-nome"
                value={svcForm.nome}
                onChange={(e) => setSvcForm({ ...svcForm, nome: e.target.value })}
                maxLength={100}
                placeholder="Taglio e piega"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="svc-durata">Durata (min)</Label>
                <Input
                  id="svc-durata"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={svcForm.durata_minuti}
                  onChange={(e) =>
                    setSvcForm({
                      ...svcForm,
                      durata_minuti: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-prezzo">Prezzo (€)</Label>
                <Input
                  id="svc-prezzo"
                  type="number"
                  min={0}
                  step={0.5}
                  value={svcForm.prezzo}
                  onChange={(e) =>
                    setSvcForm({ ...svcForm, prezzo: e.target.value })
                  }
                  placeholder="opzionale"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-sm">Servizio attivo</p>
                <p className="text-xs text-muted-foreground">
                  Solo i servizi attivi appaiono nella pagina pubblica.
                </p>
              </div>
              <Switch
                checked={svcForm.attivo}
                onCheckedChange={(v) => setSvcForm({ ...svcForm, attivo: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSvcDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={saveSvc}>
              {editingSvc ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!svcDeleteId}
        onOpenChange={(o) => !o && setSvcDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il servizio?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={removeSvc}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ModuliConsensoCard />
    </div>
  );
}
