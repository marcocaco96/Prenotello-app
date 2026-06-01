import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/hooks/use-realtime-tables";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  CheckCircle2,
  FileSignature,
  Copy,
  Download,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  creaConsensoPerAppuntamento,
  getConsensoPdfUrl,
} from "@/lib/consensi.functions";

type Modulo = { id: string; nome: string; attivo: boolean };

export type ConsensoRow = {
  id: string;
  token: string;
  stato: string;
  nome_modulo: string;
  nome_firma: string | null;
  cognome_firma: string | null;
  firmato_at: string | null;
  pdf_path: string | null;
  appuntamento_id: string | null;
};

function publicConsensoUrl(token: string) {
  if (typeof window === "undefined") return `/consenso/${token}`;
  return `${window.location.origin}/consenso/${token}`;
}

export function ConsensiSection({
  appuntamentoId,
  clienteId,
  compact = false,
}: {
  appuntamentoId?: string | null;
  clienteId?: string | null;
  compact?: boolean;
}) {
  const [moduli, setModuli] = useState<Modulo[]>([]);
  const [consensi, setConsensi] = useState<ConsensoRow[]>([]);
  const [selModulo, setSelModulo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const creaFn = useServerFn(creaConsensoPerAppuntamento);
  const pdfFn = useServerFn(getConsensoPdfUrl);

  const load = async () => {
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase
        .from("moduli_consenso")
        .select("id, nome, attivo")
        .eq("attivo", true)
        .order("nome"),
      (async () => {
        let q = supabase
          .from("consensi_firmati")
          .select(
            "id, token, stato, nome_modulo, nome_firma, cognome_firma, firmato_at, pdf_path, appuntamento_id",
          )
          .order("created_at", { ascending: false });
        if (appuntamentoId) q = q.eq("appuntamento_id", appuntamentoId);
        else if (clienteId) q = q.eq("cliente_id", clienteId);
        else return { data: [] };
        return await q;
      })(),
    ]);
    setModuli((m as Modulo[]) ?? []);
    setConsensi((c as ConsensoRow[]) ?? []);
  };

  useEffect(() => {
    if (!appuntamentoId && !clienteId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appuntamentoId, clienteId]);

  useRealtimeTables(["consensi_firmati", "moduli_consenso"], () => load());

  const invia = async () => {
    if (!appuntamentoId) {
      toast.error("Salva prima l'appuntamento");
      return;
    }
    if (!selModulo) {
      toast.error("Seleziona un modulo");
      return;
    }
    setBusy(true);
    try {
      const res = await creaFn({
        data: { appuntamento_id: appuntamentoId, modulo_id: selModulo },
      });
      const url = publicConsensoUrl(res.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Richiesta creata — link copiato negli appunti");
      } catch {
        toast.success("Richiesta creata");
      }
      setSelModulo("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
    setBusy(false);
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicConsensoUrl(token));
      toast.success("Link copiato");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  const openLink = (token: string) => {
    window.open(publicConsensoUrl(token), "_blank");
  };

  const download = async (id: string) => {
    try {
      const { url } = await pdfFn({ data: { consenso_id: id } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  };

  const remove = async (id: string) => {
    const ok = window.confirm("Eliminare questa richiesta di consenso?");
    if (!ok) return;
    const { error } = await supabase.from("consensi_firmati").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Eliminato");
      load();
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {appuntamentoId && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Modulo di consenso</Label>
            <Select value={selModulo} onValueChange={setSelModulo}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleziona modulo…" />
              </SelectTrigger>
              <SelectContent>
                {moduli.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">
                    Nessun modulo. Creane uno in Impostazioni.
                  </div>
                ) : (
                  moduli.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            type="button"
            onClick={invia}
            disabled={busy || !selModulo}
          >
            <FileSignature className="h-4 w-4 mr-1" /> Invia richiesta
          </Button>
        </div>
      )}

      {consensi.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nessun consenso{appuntamentoId ? " per questo appuntamento" : ""}.
        </p>
      ) : (
        <div className="space-y-2">
          {consensi.map((c) => {
            const firmato = c.stato === "firmato";
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    {firmato ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Firmato
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Clock className="h-4 w-4" /> In attesa
                      </span>
                    )}
                    <span className="truncate">{c.nome_modulo}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {firmato
                      ? `Da ${c.nome_firma ?? ""} ${c.cognome_firma ?? ""} · ${
                          c.firmato_at
                            ? new Date(c.firmato_at).toLocaleString("it-IT")
                            : ""
                        }`
                      : "In attesa di firma del cliente"}
                  </div>
                </div>
                {!firmato && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Copia link"
                      onClick={() => copyLink(c.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Apri pagina firma"
                      onClick={() => openLink(c.token)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {firmato && c.pdf_path && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Scarica PDF"
                    onClick={() => download(c.id)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  title="Elimina"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Badge compatto per la lista appuntamenti (mostra stato consenso più recente) */
export function ConsensoBadge({ appuntamentoId }: { appuntamentoId: string }) {
  const [stato, setStato] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("consensi_firmati")
      .select("stato")
      .eq("appuntamento_id", appuntamentoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setStato(data?.stato ?? null);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appuntamentoId]);

  useRealtimeTables(["consensi_firmati"], () => load());

  if (!stato) return null;
  if (stato === "firmato")
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700"
        title="Consenso firmato"
      >
        <CheckCircle2 className="h-3 w-3" /> Consenso
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700"
      title="Consenso in attesa di firma"
    >
      <Clock className="h-3 w-3" /> Consenso
    </span>
  );
}
