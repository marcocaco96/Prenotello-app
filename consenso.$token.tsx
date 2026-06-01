import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Eraser } from "lucide-react";
import { getConsensoByToken, firmaConsenso } from "@/lib/consensi.functions";

export const Route = createFileRoute("/consenso/$token")({
  component: ConsensoPage,
  head: () => ({ meta: [{ title: "Firma consenso informato" }] }),
});

type Data = Awaited<ReturnType<typeof getConsensoByToken>>;

function ConsensoPage() {
  const { token } = useParams({ from: "/consenso/$token" });
  const fetchFn = useServerFn(getConsensoByToken);
  const signFn = useServerFn(firmaConsenso);

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const isEmpty = useRef(true);

  const load = async () => {
    try {
      const d = await fetchFn({ data: { token } });
      setData(d);
      if (d.nome_firma) setNome(d.nome_firma);
      if (d.cognome_firma) setCognome(d.cognome_firma);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || data?.stato === "firmato") return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const start = (e: PointerEvent) => {
      drawing.current = true;
      isEmpty.current = false;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = () => {
      drawing.current = false;
    };
    c.addEventListener("pointerdown", start);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    return () => {
      c.removeEventListener("pointerdown", start);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", end);
      c.removeEventListener("pointercancel", end);
    };
  }, [data?.stato, loading]);

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    isEmpty.current = true;
  };

  const submit = async () => {
    if (!nome.trim() || !cognome.trim()) {
      toast.error("Inserisci nome e cognome");
      return;
    }
    if (isEmpty.current || !canvasRef.current) {
      toast.error("Firma il documento prima di confermare");
      return;
    }
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setSubmitting(true);
    try {
      await signFn({
        data: {
          token,
          nome: nome.trim(),
          cognome: cognome.trim(),
          firma_data_url: dataUrl,
        },
      });
      toast.success("Consenso firmato");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore firma");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Caricamento…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Consenso non trovato.
      </div>
    );
  }

  const signed = data.stato === "firmato";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{data.salone_nome}</h1>
          <p className="text-muted-foreground">Consenso informato</p>
        </div>

        {signed && (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <div className="font-medium">Consenso già firmato</div>
                <div className="text-sm text-muted-foreground">
                  Firmato da {data.nome_firma} {data.cognome_firma}
                  {data.firmato_at
                    ? ` il ${new Date(data.firmato_at).toLocaleString("it-IT")}`
                    : ""}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{data.nome_modulo}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.appuntamento && (
              <div className="text-sm text-muted-foreground mb-3 p-3 rounded-md bg-muted/40">
                Appuntamento: <strong>{data.appuntamento.servizio}</strong> —{" "}
                {new Date(data.appuntamento.start_at).toLocaleString("it-IT")}
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {data.testo_snapshot}
            </div>
          </CardContent>
        </Card>

        {!signed && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Firma il documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cognome">Cognome</Label>
                  <Input
                    id="cognome"
                    value={cognome}
                    onChange={(e) => setCognome(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Firma a mano libera</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={clearCanvas}
                  >
                    <Eraser className="h-4 w-4 mr-1" /> Cancella
                  </Button>
                </div>
                <canvas
                  ref={canvasRef}
                  className="w-full h-48 rounded-md border border-input bg-white touch-none"
                />
              </div>
              <Button
                onClick={submit}
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? "Invio…" : "Conferma e firma"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Confermando dichiari di aver letto e compreso il documento.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
