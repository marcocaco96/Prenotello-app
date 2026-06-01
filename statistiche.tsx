import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/hooks/use-realtime-tables";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  eachDayOfInterval,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Euro,
  CalendarCheck,
  CalendarX,
  UserX,
  CreditCard,
  Wallet,
  Hourglass,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/statistiche")({
  component: StatistichePage,
});

type Appt = {
  id: string;
  cliente_id: string | null;
  servizio: string;
  start_at: string;
  durata_minuti: number;
  stato: string;
  stato_pagamento: string | null;
  importo: number | null;
};
type Servizio = { id: string; nome: string; prezzo: number | null };

function eur(n: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

function StatistichePage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));

  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Appt[]>([]);
  const [previous, setPrevious] = useState<Appt[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [totaleClienti, setTotaleClienti] = useState(0);

  const loadStats = async () => {
    setLoading(true);
    const [c, p, sv, cl] = await Promise.all([
      supabase
        .from("appuntamenti")
        .select("id, cliente_id, servizio, start_at, durata_minuti, stato, stato_pagamento, importo")
        .gte("start_at", monthStart.toISOString())
        .lte("start_at", monthEnd.toISOString()),
      supabase
        .from("appuntamenti")
        .select("id, cliente_id, servizio, start_at, durata_minuti, stato, stato_pagamento, importo")
        .gte("start_at", prevStart.toISOString())
        .lte("start_at", prevEnd.toISOString()),
      supabase.from("servizi").select("id, nome, prezzo"),
      supabase.from("clienti").select("id", { count: "exact", head: true }),
    ]);
    setCurrent((c.data as Appt[]) ?? []);
    setPrevious((p.data as Appt[]) ?? []);
    setServizi((sv.data as Servizio[]) ?? []);
    setTotaleClienti(cl.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeTables(
    ["appuntamenti", "servizi", "clienti", "vendite_prodotti"],
    () => loadStats(),
  );

  const priceFor = (nome: string) =>
    servizi.find((s) => s.nome === nome)?.prezzo ?? 0;

  const calcFatturato = (items: Appt[]) =>
    items
      .filter((a) => a.stato === "eseguito")
      .reduce((sum, a) => sum + Number(priceFor(a.servizio) || 0), 0);

  const fatturatoMese = useMemo(() => calcFatturato(current), [current, servizi]);
  const fatturatoPrev = useMemo(() => calcFatturato(previous), [previous, servizi]);
  const variazione =
    fatturatoPrev > 0
      ? ((fatturatoMese - fatturatoPrev) / fatturatoPrev) * 100
      : fatturatoMese > 0
        ? 100
        : 0;

  const eseguiti = current.filter((a) => a.stato === "eseguito").length;
  const noShow = current.filter((a) => a.stato === "no_show").length;
  const cancellati = current.filter((a) => a.stato === "cancellato").length;
  const programmati = current.filter((a) => a.stato === "programmato").length;

  const clientiUnici = new Set(
    current.filter((a) => a.cliente_id).map((a) => a.cliente_id),
  ).size;
  const spesaMedia = clientiUnici > 0 ? fatturatoMese / clientiUnici : 0;

  // Pagamenti del mese corrente
  const importoOf = (a: Appt) =>
    a.importo != null ? Number(a.importo) : Number(priceFor(a.servizio) || 0);
  const incassoOnline = current
    .filter((a) => a.stato_pagamento === "pagato_online")
    .reduce((s, a) => s + importoOf(a), 0);
  const incassoNegozio = current
    .filter((a) => a.stato_pagamento === "pagato")
    .reduce((s, a) => s + importoOf(a), 0);
  const daIncassare = current
    .filter(
      (a) =>
        (a.stato_pagamento === "da_pagare" || a.stato_pagamento == null) &&
        a.stato !== "cancellato",
    )
    .reduce((s, a) => s + importoOf(a), 0);

  // Fatturato giornaliero per il mese corrente
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const byDay = new Map<string, number>();
    for (const a of current) {
      if (a.stato !== "eseguito") continue;
      const k = format(new Date(a.start_at), "yyyy-MM-dd");
      byDay.set(k, (byDay.get(k) ?? 0) + Number(priceFor(a.servizio) || 0));
    }
    return days.map((d) => ({
      day: format(d, "d"),
      fatturato: byDay.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, servizi]);

  const statiData = [
    { name: "Eseguiti", value: eseguiti, color: "hsl(142 71% 45%)" },
    { name: "Programmati", value: programmati, color: "hsl(217 91% 60%)" },
    { name: "No-show", value: noShow, color: "hsl(38 92% 50%)" },
    { name: "Cancellati", value: cancellati, color: "hsl(0 84% 60%)" },
  ];

  const confrontoData = [
    { name: "Mese scorso", fatturato: fatturatoPrev },
    { name: "Mese corrente", fatturato: fatturatoMese },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Report Azienda
        </h1>
        <p className="text-muted-foreground mt-1">
          {format(now, "MMMM yyyy", { locale: it })}
        </p>
      </div>

      <ProdottiReport monthStart={monthStart} monthEnd={monthEnd} prevStart={prevStart} prevEnd={prevEnd} />


      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          Caricamento...
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fatturato mese
                </CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{eur(fatturatoMese)}</div>
                <div
                  className={`flex items-center gap-1 text-xs mt-1 ${
                    variazione >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {variazione >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {variazione >= 0 ? "+" : ""}
                  {variazione.toFixed(1)}% vs {eur(fatturatoPrev)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Clienti totali
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{totaleClienti}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {clientiUnici} attivi questo mese
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Spesa media / cliente
                </CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{eur(spesaMedia)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Calcolata sul mese corrente
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Appuntamenti totali
                </CardTitle>
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{current.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  questo mese
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stato appuntamenti cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Eseguiti
                </CardTitle>
                <CalendarCheck className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-600">
                  {eseguiti}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  No-show
                </CardTitle>
                <UserX className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-amber-600">
                  {noShow}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cancellati
                </CardTitle>
                <CalendarX className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-red-600">
                  {cancellati}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pagamenti */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Incassato online
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{eur(incassoOnline)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tramite Stripe / Satispay
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Incassato in negozio
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{eur(incassoNegozio)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pagamenti contanti / POS
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Da incassare
                </CardTitle>
                <Hourglass className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{eur(daIncassare)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Appuntamenti da pagare
                </p>
              </CardContent>
            </Card>
          </div>


          {/* Charts */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fatturato giornaliero</CardTitle>
                <CardDescription>
                  Mese di {format(now, "MMMM", { locale: it })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(v: number) => eur(v)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="fatturato"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confronto fatturato</CardTitle>
                <CardDescription>
                  Mese precedente vs corrente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={confrontoData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(v: number) => eur(v)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Bar
                      dataKey="fatturato"
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Distribuzione appuntamenti</CardTitle>
                <CardDescription>Stato appuntamenti del mese</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statiData.filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(e: { name: string; value: number }) =>
                        `${e.name}: ${e.value}`
                      }
                    >
                      {statiData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {servizi.every((s) => !s.prezzo) && (
            <p className="text-xs text-muted-foreground text-center">
              Imposta il prezzo dei servizi nella sezione Impostazioni per
              vedere il fatturato.
            </p>
          )}
        </>
      )}
    </div>
  );
}

type Vendita = {
  id: string;
  prodotto_id: string | null;
  nome_prodotto: string;
  quantita: number;
  prezzo_unitario: number;
  created_at: string;
};
type ProdottoLite = {
  id: string;
  nome: string;
  quantita: number;
  quantita_minima: number;
};

function ProdottiReport({
  monthStart,
  monthEnd,
  prevStart,
  prevEnd,
}: {
  monthStart: Date;
  monthEnd: Date;
  prevStart: Date;
  prevEnd: Date;
}) {
  const [vendite, setVendite] = useState<Vendita[]>([]);
  const [venditePrev, setVenditePrev] = useState<Vendita[]>([]);
  const [prodotti, setProdotti] = useState<ProdottoLite[]>([]);

  const loadVendite = async () => {
    const [v, vp, p] = await Promise.all([
      supabase
        .from("vendite_prodotti")
        .select("id, prodotto_id, nome_prodotto, quantita, prezzo_unitario, created_at")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString()),
      supabase
        .from("vendite_prodotti")
        .select("id, prodotto_id, nome_prodotto, quantita, prezzo_unitario, created_at")
        .gte("created_at", prevStart.toISOString())
        .lte("created_at", prevEnd.toISOString()),
      supabase.from("prodotti").select("id, nome, quantita, quantita_minima"),
    ]);
    setVendite((v.data as Vendita[]) ?? []);
    setVenditePrev((vp.data as Vendita[]) ?? []);
    setProdotti((p.data as ProdottoLite[]) ?? []);
  };

  useEffect(() => {
    loadVendite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart.getTime(), monthEnd.getTime(), prevStart.getTime(), prevEnd.getTime()]);

  useRealtimeTables(["vendite_prodotti", "prodotti"], () => loadVendite());

  const totMese = vendite.reduce((s, v) => s + Number(v.prezzo_unitario) * v.quantita, 0);
  const totPrev = venditePrev.reduce((s, v) => s + Number(v.prezzo_unitario) * v.quantita, 0);
  const variazione =
    totPrev > 0 ? ((totMese - totPrev) / totPrev) * 100 : totMese > 0 ? 100 : 0;

  const perProdotto = useMemo(() => {
    const m = new Map<string, { nome: string; qta: number; importo: number }>();
    for (const v of vendite) {
      const key = v.nome_prodotto;
      const cur = m.get(key) ?? { nome: v.nome_prodotto, qta: 0, importo: 0 };
      cur.qta += v.quantita;
      cur.importo += Number(v.prezzo_unitario) * v.quantita;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.qta - a.qta);
  }, [vendite]);

  const piuVenduto = perProdotto[0];
  const inEsaurimento = prodotti.filter((p) => p.quantita <= p.quantita_minima);
  const confrontoProdotti = [
    { name: "Mese scorso", fatturato: totPrev },
    { name: "Mese corrente", fatturato: totMese },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Prodotti</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fatturato prodotti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{eur(totMese)}</div>
            <div
              className={`flex items-center gap-1 text-xs mt-1 ${
                variazione >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {variazione >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {variazione >= 0 ? "+" : ""}
              {variazione.toFixed(1)}% vs {eur(totPrev)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prodotto più venduto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold truncate">
              {piuVenduto ? piuVenduto.nome : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {piuVenduto ? `${piuVenduto.qta} unità` : "Nessuna vendita"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unità vendute
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {vendite.reduce((s, v) => s + v.quantita, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In esaurimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-amber-600">
              {inEsaurimento.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">prodotti sotto soglia</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Confronto vendite prodotti</CardTitle>
            <CardDescription>Mese precedente vs corrente</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={confrontoProdotti}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(v: number) => eur(v)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="fatturato" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prodotti venduti</CardTitle>
            <CardDescription>Dettaglio del mese</CardDescription>
          </CardHeader>
          <CardContent>
            {perProdotto.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nessuna vendita registrata questo mese.
              </p>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {perProdotto.map((p) => (
                  <div
                    key={p.nome}
                    className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
                  >
                    <span className="font-medium truncate">{p.nome}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {p.qta} × · {eur(p.importo)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

