import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/hooks/use-realtime-tables";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import type { Cliente } from "./clienti";
import type { Prodotto } from "./magazzino";
import { ConsensiSection } from "@/components/consensi-section";

type VenditaForm = {
  id?: string;
  prodotto_id: string;
  nome_prodotto: string;
  quantita: number;
  prezzo_unitario: number;
};


export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

type Appuntamento = {
  id: string;
  user_id: string;
  cliente_id: string | null;
  staff_id: string | null;
  nome_cliente: string;
  servizio: string;
  start_at: string;
  durata_minuti: number;
  note: string | null;
  allergie: string | null;
  stato: string;
  stato_pagamento: string | null;
  importo: number | null;
};

type Staff = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
  colore: string;
  attivo: boolean;
};
type StaffOrario = {
  staff_id: string;
  giorno_settimana: number;
  ora_inizio: string;
  ora_fine: string;
  pausa_inizio: string | null;
  pausa_fine: string | null;
};
type StaffAssenza = {
  staff_id: string;
  data_inizio: string;
  data_fine: string;
};
type Servizio = { id: string; nome: string; durata_minuti: number };
type StaffServizio = { staff_id: string; servizio_id: string };

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 8:00 - 19:00
const SLOT_HEIGHT = 80; // px per hour (4 x 20px quarter-hour slots)
const QUARTER_PX = SLOT_HEIGHT / 4;
const DEFAULT_COLOR = "hsl(var(--primary))";

function jsDayToOurs(jsDay: number): number {
  return (jsDay + 6) % 7;
}
function timeToMin(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function AgendaPage() {
  const [view, setView] = useState<"week" | "day">("day");
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [items, setItems] = useState<Appuntamento[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [orari, setOrari] = useState<StaffOrario[]>([]);
  const [assenze, setAssenze] = useState<StaffAssenza[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [staffServizi, setStaffServizi] = useState<StaffServizio[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [vendite, setVendite] = useState<VenditaForm[]>([]);
  const [venditeOriginali, setVenditeOriginali] = useState<VenditaForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appuntamento | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
  const [newClienteOpen, setNewClienteOpen] = useState(false);
  const [newCliente, setNewCliente] = useState({
    nome: "",
    cognome: "",
    telefono: "",
    email: "",
  });

  const [form, setForm] = useState({
    cliente_id: null as string | null,
    nome_cliente: "",
    servizio: "",
    servizio_id: null as string | null,
    staff_id: null as string | null,
    data: format(new Date(), "yyyy-MM-dd"),
    ora: "09:00",
    durata_minuti: 30,
    note: "",
    allergie: "",
    stato: "programmato",
    stato_pagamento: "da_pagare",
    importo: "",
  });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loadAppts = async () => {
    setLoading(true);
    let from: Date, to: Date;
    if (view === "week") {
      from = weekStart;
      to = addDays(weekStart, 7);
    } else {
      from = new Date(selectedDay);
      from.setHours(0, 0, 0, 0);
      to = addDays(from, 1);
    }
    const { data, error } = await supabase
      .from("appuntamenti")
      .select("*")
      .gte("start_at", from.toISOString())
      .lt("start_at", to.toISOString())
      .order("start_at");
    if (error) toast.error("Errore nel caricamento");
    else setItems((data as Appuntamento[]) ?? []);
    setLoading(false);
  };

  const loadStatic = async () => {
    const [c, s, o, a, sv, ss, pr] = await Promise.all([
      supabase.from("clienti").select("*").order("cognome"),
      supabase.from("staff").select("*").eq("attivo", true).order("cognome"),
      supabase.from("staff_orari").select("*"),
      supabase.from("staff_assenze").select("staff_id, data_inizio, data_fine"),
      supabase.from("servizi").select("id, nome, durata_minuti").eq("attivo", true).order("nome"),
      supabase.from("staff_servizi").select("staff_id, servizio_id"),
      supabase.from("prodotti").select("*").order("nome"),
    ]);
    setClienti((c.data as Cliente[]) ?? []);
    setStaff((s.data as Staff[]) ?? []);
    setOrari((o.data as StaffOrario[]) ?? []);
    setAssenze((a.data as StaffAssenza[]) ?? []);
    setServizi((sv.data as Servizio[]) ?? []);
    setStaffServizi((ss.data as StaffServizio[]) ?? []);
    setProdotti((pr.data as Prodotto[]) ?? []);
  };

  useEffect(() => {
    loadAppts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekStart, selectedDay]);

  useEffect(() => {
    loadStatic();
  }, []);

  useRealtimeTables(
    ["appuntamenti", "vendite_prodotti"],
    () => loadAppts(),
  );
  useRealtimeTables(
    ["clienti", "staff", "staff_orari", "staff_assenze", "servizi", "staff_servizi", "prodotti"],
    () => loadStatic(),
  );

  const openNewAt = (day: Date, hour: number, minute = 0, staffId: string | null = null) => {
    setEditing(null);
    setVendite([]);
    setVenditeOriginali([]);
    setForm({
      cliente_id: null,
      nome_cliente: "",
      servizio: "",
      servizio_id: null,
      staff_id: staffId,
      data: format(day, "yyyy-MM-dd"),
      ora: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      durata_minuti: 30,
      note: "",
      allergie: "",
      stato: "programmato",
      stato_pagamento: "da_pagare",
      importo: "",
    });
    setDialogOpen(true);
  };

  const openEdit = async (a: Appuntamento) => {
    const d = new Date(a.start_at);
    setEditing(a);
    setForm({
      cliente_id: a.cliente_id,
      nome_cliente: a.nome_cliente,
      servizio: a.servizio,
      servizio_id: servizi.find((s) => s.nome === a.servizio)?.id ?? null,
      staff_id: a.staff_id,
      data: format(d, "yyyy-MM-dd"),
      ora: format(d, "HH:mm"),
      durata_minuti: a.durata_minuti,
      note: a.note ?? "",
      allergie: a.allergie ?? "",
      stato: a.stato ?? "programmato",
      stato_pagamento: a.stato_pagamento ?? "da_pagare",
      importo: a.importo == null ? "" : String(a.importo),
    });
    const { data: vd } = await supabase
      .from("vendite_prodotti")
      .select("id, prodotto_id, nome_prodotto, quantita, prezzo_unitario")
      .eq("appuntamento_id", a.id);
    const list: VenditaForm[] = (vd ?? []).map((v) => ({
      id: v.id,
      prodotto_id: v.prodotto_id ?? "",
      nome_prodotto: v.nome_prodotto,
      quantita: v.quantita,
      prezzo_unitario: Number(v.prezzo_unitario),
    }));
    setVendite(list);
    setVenditeOriginali(list);
    setDialogOpen(true);
  };


  const createInlineCliente = async (): Promise<Cliente | null> => {
    if (!newCliente.nome.trim() || !newCliente.cognome.trim()) {
      toast.error("Nome e cognome del cliente sono obbligatori");
      return null;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Non autenticato"), null;
    const { data, error } = await supabase
      .from("clienti")
      .insert({
        user_id: u.user.id,
        nome: newCliente.nome.trim(),
        cognome: newCliente.cognome.trim(),
        telefono: newCliente.telefono.trim() || null,
        email: newCliente.email.trim() || null,
      })
      .select()
      .single();
    if (error || !data) return toast.error(error?.message ?? "Errore"), null;
    const cliente = data as Cliente;
    setClienti((prev) =>
      [...prev, cliente].sort((a, b) => a.cognome.localeCompare(b.cognome)),
    );
    setForm((f) => ({
      ...f,
      cliente_id: cliente.id,
      nome_cliente: `${cliente.nome} ${cliente.cognome}`,
    }));
    setNewCliente({ nome: "", cognome: "", telefono: "", email: "" });
    setNewClienteOpen(false);
    toast.success("Cliente creato");
    return cliente;
  };

  const handleSave = async () => {
    if (!form.nome_cliente.trim() || !form.servizio.trim()) {
      toast.error("Seleziona un cliente e indica il servizio");
      return;
    }
    const start_at = new Date(`${form.data}T${form.ora}:00`).toISOString();
    const payload = {
      cliente_id: form.cliente_id,
      staff_id: form.staff_id,
      nome_cliente: form.nome_cliente.trim(),
      servizio: form.servizio.trim(),
      start_at,
      durata_minuti: form.durata_minuti,
      note: form.note.trim() || null,
      allergie: form.allergie.trim() || null,
      stato: form.stato,
      stato_pagamento: form.stato_pagamento,
      importo: form.importo.trim() ? Number(form.importo) : null,
    };

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Non autenticato");
    const userId = u.user.id;

    let appuntamentoId: string;
    if (editing) {
      const { error } = await supabase
        .from("appuntamenti")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      appuntamentoId = editing.id;
      toast.success("Appuntamento aggiornato");
    } else {
      const { data: created, error } = await supabase
        .from("appuntamenti")
        .insert({ ...payload, user_id: userId })
        .select("id")
        .single();
      if (error || !created) return toast.error(error?.message ?? "Errore");
      appuntamentoId = created.id;
      toast.success("Appuntamento creato");
    }

    // Sync vendite_prodotti: rimuovi vecchie, reinserisci nuove, e aggiorna stock
    if (venditeOriginali.length > 0 || vendite.length > 0) {
      // restore stock for originali
      for (const v of venditeOriginali) {
        if (v.prodotto_id) {
          const p = prodotti.find((x) => x.id === v.prodotto_id);
          if (p) {
            await supabase
              .from("prodotti")
              .update({ quantita: p.quantita + v.quantita })
              .eq("id", v.prodotto_id);
            p.quantita += v.quantita;
          }
        }
      }
      await supabase
        .from("vendite_prodotti")
        .delete()
        .eq("appuntamento_id", appuntamentoId);

      // insert new and decrement stock
      const validVendite = vendite.filter((v) => v.prodotto_id && v.quantita > 0);
      if (validVendite.length > 0) {
        await supabase.from("vendite_prodotti").insert(
          validVendite.map((v) => ({
            user_id: userId,
            appuntamento_id: appuntamentoId,
            prodotto_id: v.prodotto_id,
            nome_prodotto: v.nome_prodotto,
            quantita: v.quantita,
            prezzo_unitario: v.prezzo_unitario,
          })),
        );
        for (const v of validVendite) {
          const p = prodotti.find((x) => x.id === v.prodotto_id);
          if (p) {
            await supabase
              .from("prodotti")
              .update({ quantita: Math.max(0, p.quantita - v.quantita) })
              .eq("id", v.prodotto_id);
            p.quantita = Math.max(0, p.quantita - v.quantita);
          }
        }
      }
      // refresh prodotti
      const { data: prFresh } = await supabase.from("prodotti").select("*").order("nome");
      setProdotti((prFresh as Prodotto[]) ?? []);
    }

    setDialogOpen(false);
    loadAppts();
  };


  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("appuntamenti")
      .delete()
      .eq("id", deleteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Appuntamento eliminato");
      setDialogOpen(false);
      loadAppts();
    }
    setDeleteId(null);
  };

  // Staff actively working on selectedDay
  const dayStaff = useMemo(() => {
    const dayStr = format(selectedDay, "yyyy-MM-dd");
    const ourDay = jsDayToOurs(selectedDay.getDay());
    return staff
      .filter((m) => {
        const has = orari.some(
          (o) => o.staff_id === m.id && o.giorno_settimana === ourDay,
        );
        const absent = assenze.some(
          (a) => a.staff_id === m.id && a.data_inizio <= dayStr && a.data_fine >= dayStr,
        );
        return has && !absent;
      })
      .map((m) => {
        const o = orari.find(
          (x) => x.staff_id === m.id && x.giorno_settimana === ourDay,
        )!;
        return { staff: m, orario: o };
      });
  }, [staff, orari, assenze, selectedDay]);

  const eligibleStaffForServizio = useMemo(() => {
    if (!form.servizio_id) return staff;
    const ids = staffServizi
      .filter((x) => x.servizio_id === form.servizio_id)
      .map((x) => x.staff_id);
    return staff.filter((m) => ids.includes(m.id));
  }, [staff, staffServizi, form.servizio_id]);

  const staffColor = (id: string | null): string => {
    if (!id) return DEFAULT_COLOR;
    return staff.find((s) => s.id === id)?.colore ?? DEFAULT_COLOR;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {(() => {
        const low = prodotti.filter((p) => p.quantita <= p.quantita_minima);
        if (low.length === 0) return null;
        return (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">
                {low.length} prodotto/i sotto la soglia minima
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {low.slice(0, 8).map((p) => (
                  <Badge key={p.id} variant={p.quantita === 0 ? "destructive" : "secondary"}>
                    {p.nome} · {p.quantita}/{p.quantita_minima}
                  </Badge>
                ))}
                {low.length > 8 && (
                  <Badge variant="outline">+{low.length - 8} altri</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Agenda
          </h1>
          <p className="text-muted-foreground mt-1">
            {view === "week"
              ? `${format(weekStart, "d MMM", { locale: it })} - ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: it })}`
              : format(selectedDay, "EEEE d MMMM yyyy", { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "week" | "day")}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="day">Giorno</ToggleGroupItem>
            <ToggleGroupItem value="week">Settimana</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                view === "week"
                  ? setWeekStart(addWeeks(weekStart, -1))
                  : setSelectedDay(addDays(selectedDay, -1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (view === "week") setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                else setSelectedDay(new Date());
              }}
            >
              Oggi
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                view === "week"
                  ? setWeekStart(addWeeks(weekStart, 1))
                  : setSelectedDay(addDays(selectedDay, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => openNewAt(view === "day" ? selectedDay : new Date(), 9)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuovo
          </Button>
        </div>
      </div>

      {view === "week" ? (
        <WeekView
          days={days}
          items={items}
          openNewAt={openNewAt}
          openEdit={openEdit}
          staffColor={staffColor}
        />
      ) : (
        <DayView
          day={selectedDay}
          dayStaff={dayStaff}
          items={items}
          openNewAt={openNewAt}
          openEdit={openEdit}
        />
      )}

      {loading && (
        <div className="text-center text-sm text-muted-foreground">
          Caricamento...
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica appuntamento" : "Nuovo appuntamento"}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const cli = form.cliente_id
              ? clienti.find((c) => c.id === form.cliente_id)
              : null;
            if (!cli?.allergie) return null;
            return (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <div className="font-medium text-destructive">⚠️ Allergie cliente</div>
                <div className="text-foreground/90 whitespace-pre-wrap mt-0.5">
                  {cli.allergie}
                </div>
              </div>
            );
          })()}
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cliente</Label>
              {newClienteOpen ? (
                <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nome *"
                      value={newCliente.nome}
                      onChange={(e) =>
                        setNewCliente({ ...newCliente, nome: e.target.value })
                      }
                      maxLength={80}
                    />
                    <Input
                      placeholder="Cognome *"
                      value={newCliente.cognome}
                      onChange={(e) =>
                        setNewCliente({ ...newCliente, cognome: e.target.value })
                      }
                      maxLength={80}
                    />
                  </div>
                  <Input
                    placeholder="Telefono"
                    type="tel"
                    value={newCliente.telefono}
                    onChange={(e) =>
                      setNewCliente({ ...newCliente, telefono: e.target.value })
                    }
                    maxLength={30}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newCliente.email}
                    onChange={(e) =>
                      setNewCliente({ ...newCliente, email: e.target.value })
                    }
                    maxLength={255}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewClienteOpen(false);
                        setNewCliente({ nome: "", cognome: "", telefono: "", email: "" });
                      }}
                    >
                      Annulla
                    </Button>
                    <Button size="sm" onClick={createInlineCliente}>
                      Salva cliente
                    </Button>
                  </div>
                </div>
              ) : (
                <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal",
                        !form.nome_cliente && "text-muted-foreground",
                      )}
                    >
                      {form.nome_cliente || "Seleziona cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                    <Command>
                      <CommandInput placeholder="Cerca cliente..." />
                      <CommandList>
                        <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
                        <CommandGroup>
                          {clienti.map((c) => {
                            const label = `${c.nome} ${c.cognome}`;
                            return (
                              <CommandItem
                                key={c.id}
                                value={label}
                                onSelect={() => {
                                  setForm((f) => ({
                                    ...f,
                                    cliente_id: c.id,
                                    nome_cliente: label,
                                  }));
                                  setClientePopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.cliente_id === c.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{label}</span>
                                  {c.telefono && (
                                    <span className="text-xs text-muted-foreground">
                                      {c.telefono}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setClientePopoverOpen(false);
                              setNewClienteOpen(true);
                            }}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Nuovo cliente
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="space-y-2">
              <Label>Servizio</Label>
              {servizi.length > 0 ? (
                <Select
                  value={form.servizio_id ?? "custom"}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      setForm({ ...form, servizio_id: null });
                    } else {
                      const s = servizi.find((x) => x.id === v);
                      if (s) {
                        setForm({
                          ...form,
                          servizio_id: s.id,
                          servizio: s.nome,
                          durata_minuti: s.durata_minuti,
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona servizio" />
                  </SelectTrigger>
                  <SelectContent>
                    {servizi.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} ({s.durata_minuti} min)
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Altro...</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {(!form.servizio_id || servizi.length === 0) && (
                <Input
                  value={form.servizio}
                  onChange={(e) => setForm({ ...form, servizio: e.target.value })}
                  placeholder="Taglio e piega"
                  maxLength={100}
                />
              )}
            </div>
            {staff.length > 0 && (
              <div className="space-y-2">
                <Label>Operatore</Label>
                <Select
                  value={form.staff_id ?? "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, staff_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {eligibleStaffForServizio.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: s.colore }}
                          />
                          {s.nome} {s.cognome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ora">Ora</Label>
                <Input
                  id="ora"
                  type="time"
                  value={form.ora}
                  onChange={(e) => setForm({ ...form, ora: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durata</Label>
              <Select
                value={String(form.durata_minuti)}
                onValueChange={(v) =>
                  setForm({ ...form, durata_minuti: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} minuti
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select
                value={form.stato}
                onValueChange={(v) => setForm({ ...form, stato: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="programmato">Programmato</SelectItem>
                  <SelectItem value="eseguito">Eseguito</SelectItem>
                  <SelectItem value="no_show">No-show (non presentato)</SelectItem>
                  <SelectItem value="cancellato">Cancellato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stato pagamento</Label>
                <Select
                  value={form.stato_pagamento}
                  onValueChange={(v) => setForm({ ...form, stato_pagamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="da_pagare">Da pagare</SelectItem>
                    <SelectItem value="pagato">Pagato (in negozio)</SelectItem>
                    <SelectItem value="pagato_online">Pagato online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="importo">Importo (€)</Label>
                <Input
                  id="importo"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.importo}
                  onChange={(e) => setForm({ ...form, importo: e.target.value })}
                  placeholder="opzionale"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Appunti sul cliente..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergie">Allergie / Controindicazioni</Label>
              <Textarea
                id="allergie"
                value={form.allergie}
                onChange={(e) => setForm({ ...form, allergie: e.target.value })}
                placeholder="Allergie o controindicazioni..."
                rows={2}
              />
            </div>

            <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label>Prodotti venduti</Label>
                <Select
                  value=""
                  onValueChange={(pid) => {
                    const p = prodotti.find((x) => x.id === pid);
                    if (!p) return;
                    if (vendite.some((v) => v.prodotto_id === pid)) {
                      toast.error("Prodotto già aggiunto");
                      return;
                    }
                    setVendite([
                      ...vendite,
                      {
                        prodotto_id: p.id,
                        nome_prodotto: p.nome,
                        quantita: 1,
                        prezzo_unitario: Number(p.prezzo_vendita ?? 0),
                      },
                    ]);
                  }}
                >
                  <SelectTrigger className="w-44 h-8">
                    <SelectValue placeholder="+ Aggiungi prodotto" />
                  </SelectTrigger>
                  <SelectContent>
                    {prodotti.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">
                        Nessun prodotto in magazzino
                      </div>
                    ) : (
                      prodotti.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={p.quantita === 0}>
                          {p.nome} {p.quantita === 0 ? "(esaurito)" : `· ${p.quantita} disp.`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {vendite.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nessun prodotto venduto in questo appuntamento.
                </p>
              ) : (
                <div className="space-y-2">
                  {vendite.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 text-sm font-medium truncate">{v.nome_prodotto}</div>
                      <Input
                        type="number"
                        min={1}
                        value={v.quantita}
                        onChange={(e) =>
                          setVendite(
                            vendite.map((x, j) =>
                              j === i ? { ...x, quantita: Math.max(1, Number(e.target.value) || 1) } : x,
                            ),
                          )
                        }
                        className="w-16 h-8"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={v.prezzo_unitario}
                        onChange={(e) =>
                          setVendite(
                            vendite.map((x, j) =>
                              j === i ? { ...x, prezzo_unitario: Number(e.target.value) || 0 } : x,
                            ),
                          )
                        }
                        className="w-20 h-8"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setVendite(vendite.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="text-right text-sm font-medium pt-1 border-t border-border">
                    Totale prodotti: €{" "}
                    {vendite
                      .reduce((s, v) => s + v.prezzo_unitario * v.quantita, 0)
                      .toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {editing && (
              <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
                <Label className="flex items-center gap-2">
                  <span>Consenso informato</span>
                </Label>
                <ConsensiSection appuntamentoId={editing.id} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {editing && (
              <Button
                variant="destructive"
                onClick={() => setDeleteId(editing.id)}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Elimina
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>{editing ? "Salva" : "Crea"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l'appuntamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WeekView({
  days,
  items,
  openNewAt,
  openEdit,
  staffColor,
}: {
  days: Date[];
  items: Appuntamento[];
  openNewAt: (day: Date, hour: number, minute?: number) => void;
  openEdit: (a: Appuntamento) => void;
  staffColor: (id: string | null) => string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/30">
          <div />
          {days.map((d) => {
            const today = isSameDay(d, new Date());
            return (
              <div
                key={d.toISOString()}
                className={`p-2 text-center border-l border-border ${today ? "bg-primary/10" : ""}`}
              >
                <div className="text-xs uppercase text-muted-foreground">
                  {format(d, "EEE", { locale: it })}
                </div>
                <div className={`text-lg font-semibold ${today ? "text-primary" : "text-foreground"}`}>
                  {format(d, "d")}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="border-b border-border text-xs text-muted-foreground pr-2 text-right pt-1"
                style={{ height: SLOT_HEIGHT }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day.toISOString()} className="border-l border-border relative">
              {HOURS.map((h) => (
                <div key={h} style={{ height: SLOT_HEIGHT }} className="border-b border-border">
                  {[0, 1, 2, 3].map((q) => (
                    <button
                      key={q}
                      onClick={() => openNewAt(day, h, q * 15)}
                      className={cn(
                        "block w-full hover:bg-accent/40 transition-colors",
                        q < 3 && "border-b border-dashed border-border/40",
                      )}
                      style={{ height: QUARTER_PX }}
                    />
                  ))}
                </div>
              ))}
              {items
                .filter((a) => isSameDay(new Date(a.start_at), day))
                .map((a) => {
                  const d = new Date(a.start_at);
                  const top =
                    (d.getHours() - HOURS[0]) * SLOT_HEIGHT +
                    (d.getMinutes() / 60) * SLOT_HEIGHT;
                  const height = Math.max(QUARTER_PX, (a.durata_minuti / 60) * SLOT_HEIGHT - 2);
                  if (top < 0) return null;
                  return (
                    <button
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(a);
                      }}
                      className="absolute left-1 right-1 rounded-md text-left px-2 py-1 text-xs shadow-sm hover:opacity-90 overflow-hidden text-white"
                      style={{ top, height, background: staffColor(a.staff_id) }}
                    >
                      <div className="font-semibold truncate">{a.nome_cliente}</div>
                      <div className="truncate opacity-90">
                        {a.servizio} · {format(d, "HH:mm")}
                      </div>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayView({
  day,
  dayStaff,
  items,
  openNewAt,
  openEdit,
}: {
  day: Date;
  dayStaff: { staff: Staff; orario: StaffOrario }[];
  items: Appuntamento[];
  openNewAt: (day: Date, hour: number, minute: number, staffId: string | null) => void;
  openEdit: (a: Appuntamento) => void;
}) {
  const SLOT_MIN = 15;
  const startMin = HOURS[0] * 60;
  const endMin = (HOURS[HOURS.length - 1] + 1) * 60;
  const slots = Math.floor((endMin - startMin) / SLOT_MIN);
  const slotPx = SLOT_HEIGHT / (60 / SLOT_MIN);

  const columns =
    dayStaff.length > 0
      ? dayStaff
      : [{ staff: null as unknown as Staff, orario: null as unknown as StaffOrario }];

  const isFallback = dayStaff.length === 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <div style={{ minWidth: 200 + columns.length * 180 }}>
        {/* Header */}
        <div
          className="grid border-b border-border bg-muted/30"
          style={{ gridTemplateColumns: `60px repeat(${columns.length}, 1fr)` }}
        >
          <div />
          {columns.map((c, i) =>
            isFallback ? (
              <div key="all" className="p-3 text-center border-l border-border">
                <p className="font-semibold text-sm">Tutti</p>
                <p className="text-xs text-muted-foreground">Nessun operatore configurato</p>
              </div>
            ) : (
              <div
                key={c.staff.id}
                className="p-3 text-center border-l border-border flex flex-col items-center gap-1.5"
              >
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden"
                  style={{ background: c.staff.colore }}
                >
                  {c.staff.foto_url ? (
                    <img src={c.staff.foto_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>
                      {c.staff.nome.charAt(0)}
                      {c.staff.cognome.charAt(0)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-tight">
                  {c.staff.nome} {c.staff.cognome}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {c.orario.ora_inizio.slice(0, 5)}-{c.orario.ora_fine.slice(0, 5)}
                </p>
              </div>
            ),
          )}
        </div>
        {/* Body */}
        <div
          className="grid relative"
          style={{ gridTemplateColumns: `60px repeat(${columns.length}, 1fr)` }}
        >
          {/* Hour labels */}
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="border-b border-border text-xs text-muted-foreground pr-2 text-right pt-1"
                style={{ height: SLOT_HEIGHT }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {columns.map((c) => {
            const staffId = isFallback ? null : c.staff.id;
            const orario = isFallback ? null : c.orario;
            const oStart = orario ? timeToMin(orario.ora_inizio) : startMin;
            const oEnd = orario ? timeToMin(orario.ora_fine) : endMin;
            const pStart = orario?.pausa_inizio ? timeToMin(orario.pausa_inizio) : null;
            const pEnd = orario?.pausa_fine ? timeToMin(orario.pausa_fine) : null;
            return (
              <div
                key={staffId ?? "all"}
                className="border-l border-border relative"
                style={{ height: HOURS.length * SLOT_HEIGHT }}
              >
                {/* slot click buttons */}
                {Array.from({ length: slots }).map((_, i) => {
                  const m = startMin + i * SLOT_MIN;
                  const inWork = m >= oStart && m < oEnd;
                  const inPause = pStart != null && pEnd != null && m >= pStart && m < pEnd;
                  const offwork = !inWork || inPause;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const hh = Math.floor(m / 60);
                        const mm = m % 60;
                        openNewAt(day, hh, mm, staffId);
                      }}
                      className={cn(
                        "block w-full transition-colors",
                        offwork
                          ? "bg-muted/40 hover:bg-muted/60 cursor-pointer"
                          : "hover:bg-accent/40",
                        i % 4 === 3
                          ? "border-b border-border"
                          : "border-b border-dashed border-border/30",
                      )}
                      style={{ height: slotPx }}
                      title={offwork ? "Fuori orario" : "Slot libero"}
                    />
                  );
                })}
                {/* Appointments for this staff column */}
                {items
                  .filter((a) => {
                    if (isFallback) return true;
                    return a.staff_id === staffId;
                  })
                  .map((a) => {
                    const d = new Date(a.start_at);
                    const top =
                      (d.getHours() - HOURS[0]) * SLOT_HEIGHT +
                      (d.getMinutes() / 60) * SLOT_HEIGHT;
                    const height = Math.max(QUARTER_PX, (a.durata_minuti / 60) * SLOT_HEIGHT - 2);
                    if (top < 0) return null;
                    const bg = isFallback
                      ? DEFAULT_COLOR
                      : c.staff.colore;
                    return (
                      <button
                        key={a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(a);
                        }}
                        className="absolute left-1 right-1 rounded-md text-left px-2 py-1 text-xs shadow-sm hover:opacity-90 overflow-hidden text-white z-10"
                        style={{ top, height, background: bg }}
                      >
                        <div className="font-semibold truncate">{a.nome_cliente}</div>
                        <div className="truncate opacity-90">
                          {a.servizio} · {format(d, "HH:mm")}
                        </div>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
