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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/magazzino")({
  component: MagazzinoPage,
});

export type Prodotto = {
  id: string;
  user_id: string;
  nome: string;
  categoria: string | null;
  marca: string | null;
  prezzo_acquisto: number | null;
  prezzo_vendita: number | null;
  quantita: number;
  quantita_minima: number;
};

type VenditaRow = { prodotto_id: string | null; quantita: number };

const emptyForm = {
  nome: "",
  categoria: "",
  marca: "",
  prezzo_acquisto: "",
  prezzo_vendita: "",
  quantita: "0",
  quantita_minima: "0",
};

function MagazzinoPage() {
  const [items, setItems] = useState<Prodotto[]>([]);
  const [vendite, setVendite] = useState<VenditaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Prodotto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [p, v] = await Promise.all([
      supabase.from("prodotti").select("*").order("nome"),
      supabase.from("vendite_prodotti").select("prodotto_id, quantita"),
    ]);
    setItems((p.data as Prodotto[]) ?? []);
    setVendite((v.data as VenditaRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useRealtimeTables(["prodotti", "vendite_prodotti"], () => load());

  const venduteMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vendite) {
      if (!v.prodotto_id) continue;
      m.set(v.prodotto_id, (m.get(v.prodotto_id) ?? 0) + Number(v.quantita || 0));
    }
    return m;
  }, [vendite]);

  const inEsaurimento = items.filter((p) => p.quantita <= p.quantita_minima);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Prodotto) => {
    setEditing(p);
    setForm({
      nome: p.nome,
      categoria: p.categoria ?? "",
      marca: p.marca ?? "",
      prezzo_acquisto: p.prezzo_acquisto == null ? "" : String(p.prezzo_acquisto),
      prezzo_vendita: p.prezzo_vendita == null ? "" : String(p.prezzo_vendita),
      quantita: String(p.quantita),
      quantita_minima: String(p.quantita_minima),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return toast.error("Il nome è obbligatorio");
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim() || null,
      marca: form.marca.trim() || null,
      prezzo_acquisto: form.prezzo_acquisto ? Number(form.prezzo_acquisto) : null,
      prezzo_vendita: form.prezzo_vendita ? Number(form.prezzo_vendita) : null,
      quantita: Number(form.quantita || 0),
      quantita_minima: Number(form.quantita_minima || 0),
    };
    if (editing) {
      const { error } = await supabase.from("prodotti").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Prodotto aggiornato");
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return toast.error("Non autenticato");
      const { error } = await supabase.from("prodotti").insert({ ...payload, user_id: u.user.id });
      if (error) return toast.error(error.message);
      toast.success("Prodotto creato");
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("prodotti").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else {
      toast.success("Prodotto eliminato");
      load();
    }
    setDeleteId(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Magazzino</h1>
          <p className="text-muted-foreground mt-1">Gestione prodotti del salone</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo prodotto
        </Button>
      </div>

      {inEsaurimento.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">
              {inEsaurimento.length} prodotto/i sotto la soglia minima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {inEsaurimento.map((p) => (
                <Badge
                  key={p.id}
                  variant={p.quantita === 0 ? "destructive" : "secondary"}
                >
                  {p.nome} · {p.quantita}/{p.quantita_minima}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prodotto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="text-right">Acquisto</TableHead>
              <TableHead className="text-right">Vendita</TableHead>
              <TableHead className="text-right">Giacenza</TableHead>
              <TableHead className="text-right">Min.</TableHead>
              <TableHead className="text-right">Vendute</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nessun prodotto. Aggiungi il primo!
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => {
                const low = p.quantita <= p.quantita_minima;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{p.categoria ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.marca ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {p.prezzo_acquisto != null ? `€ ${Number(p.prezzo_acquisto).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.prezzo_vendita != null ? `€ ${Number(p.prezzo_vendita).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {low ? (
                        <Badge variant={p.quantita === 0 ? "destructive" : "secondary"}>
                          {p.quantita}
                        </Badge>
                      ) : (
                        p.quantita
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.quantita_minima}
                    </TableCell>
                    <TableCell className="text-right">{venduteMap.get(p.id) ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica prodotto" : "Nuovo prodotto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  maxLength={80}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prezzo acquisto (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.prezzo_acquisto}
                  onChange={(e) => setForm({ ...form, prezzo_acquisto: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prezzo vendita (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.prezzo_vendita}
                  onChange={(e) => setForm({ ...form, prezzo_vendita: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantità in magazzino</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantita}
                  onChange={(e) => setForm({ ...form, quantita: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Soglia minima</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantita_minima}
                  onChange={(e) => setForm({ ...form, quantita_minima: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>{editing ? "Salva" : "Crea"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il prodotto?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
