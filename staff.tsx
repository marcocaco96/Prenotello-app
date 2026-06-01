import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/hooks/use-realtime-tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Pencil, Plus, Trash2, Upload, UserCog } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
});

export type Staff = {
  id: string;
  user_id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
  colore: string;
  attivo: boolean;
};

export type StaffServizio = { id: string; staff_id: string; servizio_id: string };
export type StaffOrario = {
  id: string;
  staff_id: string;
  giorno_settimana: number;
  ora_inizio: string;
  ora_fine: string;
  pausa_inizio: string | null;
  pausa_fine: string | null;
};
export type StaffAssenza = {
  id: string;
  staff_id: string;
  data_inizio: string;
  data_fine: string;
  motivo: string | null;
};

type Servizio = { id: string; nome: string };

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
// JS getDay(): 0=domenica..6=sabato. We'll store: 0=lunedì..6=domenica.
const DEFAULT_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [s, sv] = await Promise.all([
      supabase.from("staff").select("*").order("cognome"),
      supabase.from("servizi").select("id, nome").order("nome"),
    ]);
    if (s.error) toast.error(s.error.message);
    setStaff((s.data as Staff[]) ?? []);
    setServizi((sv.data as Servizio[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useRealtimeTables(
    ["staff", "servizi", "staff_orari", "staff_assenze", "staff_servizi"],
    () => load(),
  );

  const handleCreate = async (payload: { nome: string; cognome: string; colore: string }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("staff")
      .insert({
        user_id: u.user.id,
        nome: payload.nome.trim(),
        cognome: payload.cognome.trim(),
        colore: payload.colore,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success("Membro aggiunto");
    setCreating(false);
    await load();
    setEditing(data as Staff);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("staff").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else toast.success("Eliminato");
    setDeleteId(null);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Staff
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci i membri del tuo team, i loro orari e le ferie
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuovo membro
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : staff.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <UserCog className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nessun membro dello staff</p>
            <p className="text-sm text-muted-foreground">
              Aggiungi il primo membro per iniziare a gestire l'agenda per più operatori.
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi membro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="h-2" style={{ background: m.colore }} />
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar foto={m.foto_url} colore={m.colore} nome={m.nome} cognome={m.cognome} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {m.nome} {m.cognome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.attivo ? "Attivo" : "Non attivo"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditing(m)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Apri
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(m.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={handleCreate}
      />

      {editing && (
        <EditDialog
          key={editing.id}
          staff={editing}
          servizi={servizi}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutti i suoi orari e assenze verranno eliminati. Gli appuntamenti già assegnati resteranno ma senza operatore.
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

function Avatar({
  foto,
  colore,
  nome,
  cognome,
  size = 44,
}: {
  foto: string | null;
  colore: string;
  nome: string;
  cognome: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: colore, fontSize: size * 0.4 }}
    >
      {foto ? (
        <img src={foto} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>
          {nome.charAt(0)}
          {cognome.charAt(0)}
        </span>
      )}
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (p: { nome: string; cognome: string; colore: string }) => void;
}) {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [colore, setColore] = useState(DEFAULT_COLORS[0]);

  useEffect(() => {
    if (open) {
      setNome("");
      setCognome("");
      setColore(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo membro dello staff</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label>Cognome</Label>
              <Input value={cognome} onChange={(e) => setCognome(e.target.value)} maxLength={80} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Colore identificativo</Label>
            <ColorPicker value={colore} onChange={setColore} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => {
              if (!nome.trim() || !cognome.trim()) {
                toast.error("Nome e cognome obbligatori");
                return;
              }
              onCreate({ nome, cognome, colore });
            }}
          >
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DEFAULT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-8 w-8 rounded-full border-2 transition"
          style={{
            background: c,
            borderColor: value === c ? "var(--foreground)" : "transparent",
          }}
          aria-label={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 rounded border border-border bg-transparent cursor-pointer"
      />
    </div>
  );
}

function EditDialog({
  staff,
  servizi,
  onClose,
}: {
  staff: Staff;
  servizi: Servizio[];
  onClose: () => void;
}) {
  const [m, setM] = useState<Staff>(staff);
  const [staffServizi, setStaffServizi] = useState<StaffServizio[]>([]);
  const [orari, setOrari] = useState<StaffOrario[]>([]);
  const [assenze, setAssenze] = useState<StaffAssenza[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [ss, so, sa] = await Promise.all([
        supabase.from("staff_servizi").select("*").eq("staff_id", staff.id),
        supabase.from("staff_orari").select("*").eq("staff_id", staff.id),
        supabase.from("staff_assenze").select("*").eq("staff_id", staff.id).order("data_inizio"),
      ]);
      setStaffServizi((ss.data as StaffServizio[]) ?? []);
      setOrari((so.data as StaffOrario[]) ?? []);
      setAssenze((sa.data as StaffAssenza[]) ?? []);
    })();
  }, [staff.id]);

  const onUpload = async (file: File) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/${staff.id}.${ext}?v=${Date.now()}`;
    const cleanPath = path.split("?")[0];
    const { error: upErr } = await supabase.storage
      .from("staff-photos")
      .upload(cleanPath, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("staff-photos").getPublicUrl(cleanPath);
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    setM((s) => ({ ...s, foto_url: url }));
    setUploading(false);
  };

  const toggleServizio = (servizioId: string, checked: boolean) => {
    if (checked) {
      setStaffServizi((arr) => [
        ...arr,
        { id: `tmp-${servizioId}`, staff_id: staff.id, servizio_id: servizioId },
      ]);
    } else {
      setStaffServizi((arr) => arr.filter((x) => x.servizio_id !== servizioId));
    }
  };

  const setOrario = (giorno: number, patch: Partial<StaffOrario>) => {
    setOrari((arr) => {
      const idx = arr.findIndex((x) => x.giorno_settimana === giorno);
      if (idx === -1) {
        return [
          ...arr,
          {
            id: `tmp-${giorno}`,
            staff_id: staff.id,
            giorno_settimana: giorno,
            ora_inizio: "09:00",
            ora_fine: "18:00",
            pausa_inizio: null,
            pausa_fine: null,
            ...patch,
          },
        ];
      }
      const copy = [...arr];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const removeOrario = (giorno: number) => {
    setOrari((arr) => arr.filter((x) => x.giorno_settimana !== giorno));
  };

  const addAssenza = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setAssenze((arr) => [
      ...arr,
      {
        id: `tmp-${Date.now()}`,
        staff_id: staff.id,
        data_inizio: today,
        data_fine: today,
        motivo: "",
      },
    ]);
  };

  const removeAssenza = (id: string) => {
    setAssenze((arr) => arr.filter((x) => x.id !== id));
  };

  const updateAssenza = (id: string, patch: Partial<StaffAssenza>) => {
    setAssenze((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
    const uid = u.user.id;

    // 1. Update staff
    const { error: e1 } = await supabase
      .from("staff")
      .update({
        nome: m.nome.trim(),
        cognome: m.cognome.trim(),
        foto_url: m.foto_url,
        colore: m.colore,
        attivo: m.attivo,
      })
      .eq("id", staff.id);
    if (e1) {
      toast.error(e1.message);
      setSaving(false);
      return;
    }

    // 2. Sync staff_servizi
    await supabase.from("staff_servizi").delete().eq("staff_id", staff.id);
    if (staffServizi.length > 0) {
      await supabase.from("staff_servizi").insert(
        staffServizi.map((x) => ({
          user_id: uid,
          staff_id: staff.id,
          servizio_id: x.servizio_id,
        })),
      );
    }

    // 3. Sync orari
    await supabase.from("staff_orari").delete().eq("staff_id", staff.id);
    if (orari.length > 0) {
      await supabase.from("staff_orari").insert(
        orari.map((o) => ({
          user_id: uid,
          staff_id: staff.id,
          giorno_settimana: o.giorno_settimana,
          ora_inizio: o.ora_inizio,
          ora_fine: o.ora_fine,
          pausa_inizio: o.pausa_inizio,
          pausa_fine: o.pausa_fine,
        })),
      );
    }

    // 4. Sync assenze
    await supabase.from("staff_assenze").delete().eq("staff_id", staff.id);
    if (assenze.length > 0) {
      await supabase.from("staff_assenze").insert(
        assenze.map((a) => ({
          user_id: uid,
          staff_id: staff.id,
          data_inizio: a.data_inizio,
          data_fine: a.data_fine,
          motivo: a.motivo || null,
        })),
      );
    }

    toast.success("Modifiche salvate");
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {m.nome} {m.cognome}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="generale">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="generale">Generale</TabsTrigger>
            <TabsTrigger value="orari">Orari</TabsTrigger>
            <TabsTrigger value="assenze">Assenze</TabsTrigger>
          </TabsList>

          <TabsContent value="generale" className="space-y-4 pt-4">
            <div className="flex items-center gap-4">
              <Avatar foto={m.foto_url} colore={m.colore} nome={m.nome} cognome={m.cognome} size={64} />
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {uploading ? "Caricamento..." : "Carica foto"}
                </Button>
                {m.foto_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setM((s) => ({ ...s, foto_url: null }))}
                  >
                    Rimuovi
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label>Cognome</Label>
                <Input value={m.cognome} onChange={(e) => setM({ ...m, cognome: e.target.value })} maxLength={80} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Colore identificativo</Label>
              <ColorPicker value={m.colore} onChange={(c) => setM({ ...m, colore: c })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-sm">Attivo</p>
                <p className="text-xs text-muted-foreground">
                  Se disattivato non appare nell'agenda né nella prenotazione online
                </p>
              </div>
              <Switch checked={m.attivo} onCheckedChange={(c) => setM({ ...m, attivo: c })} />
            </div>
            <div className="space-y-2">
              <Label>Servizi che può eseguire</Label>
              {servizi.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nessun servizio configurato. Aggiungili dalle Impostazioni.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {servizi.map((s) => {
                    const checked = staffServizi.some((x) => x.servizio_id === s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-accent/30"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => toggleServizio(s.id, c === true)}
                        />
                        <span className="text-sm">{s.nome}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="orari" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Imposta orari di lavoro e pausa per ogni giorno. Spegni il giorno per indicare riposo.
            </p>
            {GIORNI.map((label, giorno) => {
              const o = orari.find((x) => x.giorno_settimana === giorno);
              const enabled = !!o;
              return (
                <div key={giorno} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{label}</p>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(c) =>
                        c ? setOrario(giorno, {}) : removeOrario(giorno)
                      }
                    />
                  </div>
                  {enabled && o && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Inizio</Label>
                        <Input
                          type="time"
                          value={o.ora_inizio}
                          onChange={(e) => setOrario(giorno, { ora_inizio: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Fine</Label>
                        <Input
                          type="time"
                          value={o.ora_fine}
                          onChange={(e) => setOrario(giorno, { ora_fine: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Pausa da</Label>
                        <Input
                          type="time"
                          value={o.pausa_inizio ?? ""}
                          onChange={(e) =>
                            setOrario(giorno, {
                              pausa_inizio: e.target.value || null,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Pausa a</Label>
                        <Input
                          type="time"
                          value={o.pausa_fine ?? ""}
                          onChange={(e) =>
                            setOrario(giorno, {
                              pausa_fine: e.target.value || null,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="assenze" className="space-y-3 pt-4">
            {assenze.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessuna assenza programmata.</p>
            )}
            {assenze.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Dal</Label>
                    <Input
                      type="date"
                      value={a.data_inizio}
                      onChange={(e) => updateAssenza(a.id, { data_inizio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Al</Label>
                    <Input
                      type="date"
                      value={a.data_fine}
                      onChange={(e) => updateAssenza(a.id, { data_fine: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Motivo (facoltativo)"
                    value={a.motivo ?? ""}
                    onChange={(e) => updateAssenza(a.id, { motivo: e.target.value })}
                    maxLength={120}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAssenza(a.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(a.data_inizio), "d MMM yyyy", { locale: it })} —{" "}
                  {format(new Date(a.data_fine), "d MMM yyyy", { locale: it })}
                </p>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addAssenza}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi assenza
            </Button>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
