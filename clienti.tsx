import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/hooks/use-realtime-tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eye, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { ConsensiSection } from "@/components/consensi-section";

export const Route = createFileRoute("/_authenticated/clienti")({
  component: ClientiPage,
});

export type Cliente = {
  id: string;
  user_id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  note: string | null;
  allergie: string | null;
  data_nascita: string | null;
  sesso: string | null;
  come_conosciuto: string | null;
  tipo_cliente: string;
  ragione_sociale: string | null;
  partita_iva: string | null;
  indirizzo_fatturazione: string | null;
  codice_sdi: string | null;
  pec: string | null;
  created_at?: string;
};

type Appt = {
  id: string;
  start_at: string;
  servizio: string;
  durata_minuti: number;
  stato: string;
  stato_pagamento: string | null;
  importo: number | null;
  staff_id: string | null;
  note: string | null;
  allergie: string | null;
};

type StaffRow = { id: string; nome: string; cognome: string };

const emptyForm = {
  nome: "",
  cognome: "",
  telefono: "",
  email: "",
  note: "",
  allergie: "",
  data_nascita: "",
  sesso: "non_specificato",
  come_conosciuto: "",
  tipo_cliente: "privato",
  ragione_sociale: "",
  partita_iva: "",
  indirizzo_fatturazione: "",
  codice_sdi: "",
  pec: "",
};

const sessoLabels: Record<string, string> = {
  maschio: "Maschio",
  femmina: "Femmina",
  non_specificato: "Non specificato",
};

const canaleLabels: Record<string, string> = {
  passaparola: "Passaparola",
  instagram: "Instagram",
  google: "Google",
  facebook: "Facebook",
  altro: "Altro",
};

const pagamentoLabels: Record<string, string> = {
  da_pagare: "Da pagare",
  pagato: "Pagato",
  pagato_online: "Pagato online",
};

function ClientiPage() {
  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Cliente | null>(null);
  const [viewAppts, setViewAppts] = useState<Appt[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const openView = async (c: Cliente) => {
    setViewing(c);
    setViewAppts([]);
    setViewLoading(true);
    const { data, error } = await supabase
      .from("appuntamenti")
      .select(
        "id, start_at, servizio, durata_minuti, stato, stato_pagamento, importo, staff_id, note, allergie"
      )
      .eq("cliente_id", c.id)
      .order("start_at", { ascending: false });
    if (error) toast.error(error.message);
    else setViewAppts((data as Appt[]) ?? []);
    setViewLoading(false);
  };

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: s }] = await Promise.all([
      supabase.from("clienti").select("*").order("cognome"),
      supabase.from("staff").select("id, nome, cognome"),
    ]);
    if (error) toast.error(error.message);
    else setItems((data as Cliente[]) ?? []);
    setStaff((s as StaffRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Refresh client list + open client detail when relevant data changes
  useRealtimeTables(["clienti", "staff"], () => load());
  useRealtimeTables(["appuntamenti", "vendite_prodotti"], () => {
    if (viewing) openView(viewing);
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      cognome: c.cognome,
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      note: c.note ?? "",
      allergie: c.allergie ?? "",
      data_nascita: c.data_nascita ?? "",
      sesso: c.sesso ?? "non_specificato",
      come_conosciuto: c.come_conosciuto ?? "",
      tipo_cliente: c.tipo_cliente ?? "privato",
      ragione_sociale: c.ragione_sociale ?? "",
      partita_iva: c.partita_iva ?? "",
      indirizzo_fatturazione: c.indirizzo_fatturazione ?? "",
      codice_sdi: c.codice_sdi ?? "",
      pec: c.pec ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) {
      toast.error("Nome e cognome sono obbligatori");
      return;
    }
    const isAzienda = form.tipo_cliente === "azienda";
    const payload = {
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      note: form.note.trim() || null,
      allergie: form.allergie.trim() || null,
      data_nascita: form.data_nascita || null,
      sesso: form.sesso || null,
      come_conosciuto: form.come_conosciuto || null,
      tipo_cliente: form.tipo_cliente,
      ragione_sociale: isAzienda ? form.ragione_sociale.trim() || null : null,
      partita_iva: isAzienda ? form.partita_iva.trim() || null : null,
      indirizzo_fatturazione: isAzienda
        ? form.indirizzo_fatturazione.trim() || null
        : null,
      codice_sdi: isAzienda ? form.codice_sdi.trim() || null : null,
      pec: isAzienda ? form.pec.trim() || null : null,
    };
    if (editing) {
      const { error } = await supabase
        .from("clienti")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Cliente aggiornato");
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return toast.error("Non autenticato");
      const { error } = await supabase
        .from("clienti")
        .insert({ ...payload, user_id: u.user.id });
      if (error) return toast.error(error.message);
      toast.success("Cliente creato");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("clienti")
      .delete()
      .eq("id", deleteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente eliminato");
      load();
    }
    setDeleteId(null);
  };

  const filtered = items.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.nome.toLowerCase().includes(q) ||
      c.cognome.toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.ragione_sociale ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Clienti
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci la tua rubrica clienti
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          Nuovo cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca cliente..."
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cognome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                  {items.length === 0
                    ? "Nessun cliente ancora. Aggiungi il primo!"
                    : "Nessun cliente trovato"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openView(c)}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.cognome}</TableCell>
                  <TableCell>
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded-full " +
                        (c.tipo_cliente === "azienda"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {c.tipo_cliente === "azienda" ? "Azienda" : "Privato"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.telefono || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email || "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openView(c)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit / New dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica cliente" : "Nuovo cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Dati anagrafici</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cognome">Cognome *</Label>
                  <Input
                    id="cognome"
                    value={form.cognome}
                    onChange={(e) => setForm({ ...form, cognome: e.target.value })}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Telefono</Label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    maxLength={30}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_nascita">Data di nascita</Label>
                  <Input
                    id="data_nascita"
                    type="date"
                    value={form.data_nascita}
                    onChange={(e) => setForm({ ...form, data_nascita: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sesso</Label>
                  <Select
                    value={form.sesso}
                    onValueChange={(v) => setForm({ ...form, sesso: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maschio">Maschio</SelectItem>
                      <SelectItem value="femmina">Femmina</SelectItem>
                      <SelectItem value="non_specificato">Non specificato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Come ci ha conosciuto</Label>
                  <Select
                    value={form.come_conosciuto || "none"}
                    onValueChange={(v) =>
                      setForm({ ...form, come_conosciuto: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="passaparola">Passaparola</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo cliente</Label>
                  <Select
                    value={form.tipo_cliente}
                    onValueChange={(v) => setForm({ ...form, tipo_cliente: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="privato">Privato</SelectItem>
                      <SelectItem value="azienda">Azienda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {form.tipo_cliente === "azienda" && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Dati azienda</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="rs">Ragione sociale</Label>
                    <Input
                      id="rs"
                      value={form.ragione_sociale}
                      onChange={(e) =>
                        setForm({ ...form, ragione_sociale: e.target.value })
                      }
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="piva">Partita IVA</Label>
                    <Input
                      id="piva"
                      value={form.partita_iva}
                      onChange={(e) =>
                        setForm({ ...form, partita_iva: e.target.value })
                      }
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sdi">Codice SDI</Label>
                    <Input
                      id="sdi"
                      value={form.codice_sdi}
                      onChange={(e) =>
                        setForm({ ...form, codice_sdi: e.target.value })
                      }
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="indfat">Indirizzo di fatturazione</Label>
                    <Input
                      id="indfat"
                      value={form.indirizzo_fatturazione}
                      onChange={(e) =>
                        setForm({ ...form, indirizzo_fatturazione: e.target.value })
                      }
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="pec">PEC</Label>
                    <Input
                      id="pec"
                      type="email"
                      value={form.pec}
                      onChange={(e) => setForm({ ...form, pec: e.target.value })}
                      maxLength={255}
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Note e allergie</h3>
              <div className="space-y-2">
                <Label htmlFor="note-cli">Note</Label>
                <textarea
                  id="note-cli"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  maxLength={2000}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Preferenze, abitudini, appunti generali..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergie-cli">Allergie</Label>
                <textarea
                  id="allergie-cli"
                  value={form.allergie}
                  onChange={(e) => setForm({ ...form, allergie: e.target.value })}
                  maxLength={2000}
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Prodotti o sostanze a cui è allergico..."
                />
              </div>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={save}>{editing ? "Salva" : "Crea"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Gli appuntamenti collegati resteranno ma senza riferimento al cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClienteDetailDialog
        cliente={viewing}
        appts={viewAppts}
        staff={staff}
        loading={viewLoading}
        onClose={() => setViewing(null)}
        onEdit={(c) => {
          setViewing(null);
          openEdit(c);
        }}
      />
    </div>
  );
}

function ClienteDetailDialog({
  cliente,
  appts,
  staff,
  loading,
  onClose,
  onEdit,
}: {
  cliente: Cliente | null;
  appts: Appt[];
  staff: StaffRow[];
  loading: boolean;
  onClose: () => void;
  onEdit: (c: Cliente) => void;
}) {
  const staffMap = useMemo(() => {
    const m: Record<string, string> = {};
    staff.forEach((s) => (m[s.id] = `${s.nome} ${s.cognome}`));
    return m;
  }, [staff]);

  const stats = useMemo(() => {
    if (!cliente) return null;
    const completati = appts.filter((a) => a.stato === "completato");
    const cancellati = appts.filter((a) => a.stato === "cancellato");
    const noShow = appts.filter((a) => a.stato === "no_show");
    const importi = completati
      .map((a) => Number(a.importo ?? 0))
      .filter((n) => !isNaN(n));
    const totaleSpeso = importi.reduce((s, n) => s + n, 0);
    const mediaSpesa = importi.length ? totaleSpeso / importi.length : 0;
    const sortedAsc = [...completati].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    const ultima = sortedAsc[sortedAsc.length - 1]?.start_at ?? null;
    let frequenzaGiorni: number | null = null;
    if (sortedAsc.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < sortedAsc.length; i++) {
        diffs.push(
          (new Date(sortedAsc[i].start_at).getTime() -
            new Date(sortedAsc[i - 1].start_at).getTime()) /
            (1000 * 60 * 60 * 24)
        );
      }
      frequenzaGiorni = Math.round(diffs.reduce((s, n) => s + n, 0) / diffs.length);
    }
    const anno = new Date().getFullYear();
    const speseAnno = completati
      .filter((a) => new Date(a.start_at).getFullYear() === anno)
      .reduce((s, a) => s + Number(a.importo ?? 0), 0);
    const primaPren = [...appts].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    )[0];
    const acquisizione = primaPren?.start_at ?? cliente.created_at ?? null;
    const servizioCount: Record<string, number> = {};
    completati.forEach((a) => {
      servizioCount[a.servizio] = (servizioCount[a.servizio] ?? 0) + 1;
    });
    const servizioTop =
      Object.entries(servizioCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const staffCount: Record<string, number> = {};
    completati.forEach((a) => {
      if (a.staff_id)
        staffCount[a.staff_id] = (staffCount[a.staff_id] ?? 0) + 1;
    });
    const staffTopId =
      Object.entries(staffCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      mediaSpesa,
      ultima,
      frequenzaGiorni,
      totali: appts.length,
      completati: completati.length,
      cancellati: cancellati.length,
      noShow: noShow.length,
      speseAnno,
      acquisizione,
      servizioTop,
      staffTop: staffTopId ? staffMap[staffTopId] ?? "—" : null,
    };
  }, [appts, cliente, staffMap]);

  if (!cliente) return null;

  const fmtDate = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const fmtFreq = (g: number | null) => {
    if (g == null) return "—";
    if (g < 14) return `ogni ${g} giorni`;
    if (g < 60) return `ogni ${Math.round(g / 7)} settimane`;
    return `ogni ${Math.round(g / 30)} mesi`;
  };

  const fmtMoney = (n: number) =>
    n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const completati = appts.filter((a) => a.stato === "completato");
  const cancellati = appts.filter((a) => a.stato === "cancellato");
  const noShow = appts.filter((a) => a.stato === "no_show");

  const renderApptList = (list: Appt[]) =>
    list.length === 0 ? (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Nessun appuntamento
      </div>
    ) : (
      <div className="divide-y divide-border">
        {list.map((a) => {
          const d = new Date(a.start_at);
          return (
            <div key={a.id} className="p-3 text-sm flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{a.servizio}</div>
                <div className="text-muted-foreground text-xs">
                  {d.toLocaleDateString("it-IT", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  ·{" "}
                  {d.toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {a.staff_id && staffMap[a.staff_id]
                    ? ` · ${staffMap[a.staff_id]}`
                    : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium">
                  {a.importo != null ? fmtMoney(Number(a.importo)) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {pagamentoLabels[a.stato_pagamento ?? "da_pagare"] ?? "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <Dialog open={!!cliente} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cliente.nome} {cliente.cognome}
            {cliente.tipo_cliente === "azienda" && cliente.ragione_sociale && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {cliente.ragione_sociale}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Allergie banner */}
          {cliente.allergie && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-destructive mb-0.5">⚠️ Allergie</div>
              <div className="text-foreground/90 whitespace-pre-wrap">
                {cliente.allergie}
              </div>
            </div>
          )}

          {/* Dati anagrafici */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Dati anagrafici</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-md border border-border bg-card p-3">
              <Info label="Email" value={cliente.email} />
              <Info label="Telefono" value={cliente.telefono} />
              <Info label="Data di nascita" value={fmtDate(cliente.data_nascita)} />
              <Info
                label="Sesso"
                value={cliente.sesso ? sessoLabels[cliente.sesso] ?? cliente.sesso : null}
              />
              <Info
                label="Come ci ha conosciuto"
                value={
                  cliente.come_conosciuto
                    ? canaleLabels[cliente.come_conosciuto] ?? cliente.come_conosciuto
                    : null
                }
              />
              <Info
                label="Tipo cliente"
                value={cliente.tipo_cliente === "azienda" ? "Azienda" : "Privato"}
              />
            </div>
          </section>

          {cliente.tipo_cliente === "azienda" && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Dati azienda</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-md border border-border bg-card p-3">
                <Info label="Ragione sociale" value={cliente.ragione_sociale} />
                <Info label="Partita IVA" value={cliente.partita_iva} />
                <Info
                  label="Indirizzo fatturazione"
                  value={cliente.indirizzo_fatturazione}
                />
                <Info label="Codice SDI" value={cliente.codice_sdi} />
                <Info label="PEC" value={cliente.pec} />
              </div>
            </section>
          )}

          {cliente.note && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Note</h3>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {cliente.note}
              </div>
            </section>
          )}

          {/* Statistiche */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Statistiche cliente</h3>
            {loading || !stats ? (
              <div className="text-sm text-muted-foreground">Caricamento...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Spesa media" value={fmtMoney(stats.mediaSpesa)} />
                <Stat label="Ultimo appuntamento" value={fmtDate(stats.ultima)} />
                <Stat label="Frequenza media" value={fmtFreq(stats.frequenzaGiorni)} />
                <Stat label="Prenotazioni totali" value={String(stats.totali)} />
                <Stat label="Completate" value={String(stats.completati)} />
                <Stat label="Cancellazioni" value={String(stats.cancellati)} />
                <Stat label="No-show" value={String(stats.noShow)} />
                <Stat
                  label={`Spesa ${new Date().getFullYear()}`}
                  value={fmtMoney(stats.speseAnno)}
                />
                <Stat label="Acquisizione" value={fmtDate(stats.acquisizione)} />
                <Stat label="Servizio top" value={stats.servizioTop ?? "—"} />
                <Stat label="Staff preferito" value={stats.staffTop ?? "—"} />
              </div>
            )}
          </section>

          {/* Storico appuntamenti */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Storico appuntamenti</h3>
            <Tabs defaultValue="completati">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="completati">
                  Completati ({completati.length})
                </TabsTrigger>
                <TabsTrigger value="cancellati">
                  Cancellati ({cancellati.length})
                </TabsTrigger>
                <TabsTrigger value="noshow">
                  No-show ({noShow.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="completati">
                <div className="rounded-md border border-border max-h-72 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Caricamento...
                    </div>
                  ) : (
                    renderApptList(completati)
                  )}
                </div>
              </TabsContent>
              <TabsContent value="cancellati">
                <div className="rounded-md border border-border max-h-72 overflow-y-auto">
                  {renderApptList(cancellati)}
                </div>
              </TabsContent>
              <TabsContent value="noshow">
                <div className="rounded-md border border-border max-h-72 overflow-y-auto">
                  {renderApptList(noShow)}
                </div>
              </TabsContent>
            </Tabs>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Consensi informati</h3>
            <ConsensiSection clienteId={cliente.id} compact />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
          <Button onClick={() => onEdit(cliente)}>Modifica</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium text-foreground mt-0.5 break-words">
        {value}
      </div>
    </div>
  );
}
