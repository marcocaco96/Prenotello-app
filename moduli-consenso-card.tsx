import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/hooks/use-realtime-tables";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileSignature, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Modulo = {
  id: string;
  nome: string;
  testo: string;
  attivo: boolean;
};

export function ModuliConsensoCard() {
  const [items, setItems] = useState<Modulo[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Modulo | null>(null);
  const [form, setForm] = useState({ nome: "", testo: "", attivo: true });

  const load = async () => {
    const { data, error } = await supabase
      .from("moduli_consenso")
      .select("*")
      .order("nome");
    if (error) toast.error(error.message);
    else setItems((data as Modulo[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  useRealtimeTables(["moduli_consenso"], () => load());

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", testo: "", attivo: true });
    setOpen(true);
  };
  const openEdit = (m: Modulo) => {
    setEditing(m);
    setForm({ nome: m.nome, testo: m.testo, attivo: m.attivo });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) {
      toast.error("Inserisci un nome");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (editing) {
      const { error } = await supabase
        .from("moduli_consenso")
        .update({
          nome: form.nome.trim(),
          testo: form.testo,
          attivo: form.attivo,
        })
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("moduli_consenso").insert({
        user_id: u.user.id,
        nome: form.nome.trim(),
        testo: form.testo,
        attivo: form.attivo,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Modulo salvato");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Eliminare il modulo?")) return;
    const { error } = await supabase.from("moduli_consenso").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Moduli di consenso informato
        </CardTitle>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo modulo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun modulo. Crea modelli di consenso da associare agli appuntamenti.
            Il cliente riceverà un link per firmare digitalmente prima della seduta.
          </p>
        ) : (
          items.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {m.nome}
                  {!m.attivo && (
                    <span className="ml-2 text-xs text-muted-foreground">(disattivo)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.testo.slice(0, 120) || "—"}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove(m.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica modulo" : "Nuovo modulo di consenso"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mc-nome">Nome modulo</Label>
              <Input
                id="mc-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Es. Consenso trattamento colore"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mc-testo">Testo del consenso</Label>
              <Textarea
                id="mc-testo"
                value={form.testo}
                onChange={(e) => setForm({ ...form, testo: e.target.value })}
                rows={14}
                placeholder="Scrivi qui il testo informativo che il cliente leggerà e firmerà..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="mc-attivo">Modulo attivo</Label>
              <Switch
                id="mc-attivo"
                checked={form.attivo}
                onCheckedChange={(v) => setForm({ ...form, attivo: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={save}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
