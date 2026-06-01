import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsPDF } from "jspdf";

/** Crea una richiesta di consenso per un appuntamento */
export const creaConsensoPerAppuntamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        appuntamento_id: z.string().uuid(),
        modulo_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: modulo, error: mErr } = await supabase
      .from("moduli_consenso")
      .select("id, nome, testo")
      .eq("id", data.modulo_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (mErr || !modulo) throw new Error("Modulo di consenso non trovato");

    const { data: app, error: aErr } = await supabase
      .from("appuntamenti")
      .select("id, cliente_id, nome_cliente")
      .eq("id", data.appuntamento_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (aErr || !app) throw new Error("Appuntamento non trovato");

    const { data: inserted, error: iErr } = await supabase
      .from("consensi_firmati")
      .insert({
        user_id: userId,
        modulo_id: modulo.id,
        appuntamento_id: app.id,
        cliente_id: app.cliente_id,
        nome_modulo: modulo.nome,
        testo_snapshot: modulo.testo,
        stato: "in_attesa",
      })
      .select("id, token")
      .single();
    if (iErr || !inserted) throw new Error(iErr?.message ?? "Errore creazione consenso");

    return { id: inserted.id, token: inserted.token as string };
  });

/** Pubblico: ottieni il consenso da firmare tramite token */
export const getConsensoByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: c, error } = await supabaseAdmin
      .from("consensi_firmati")
      .select(
        "id, token, stato, nome_modulo, testo_snapshot, nome_firma, cognome_firma, firmato_at, user_id, appuntamento_id",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (error || !c) throw new Error("Consenso non trovato");

    // recupera info salone + appuntamento per contesto
    const [{ data: salone }, { data: app }] = await Promise.all([
      supabaseAdmin.from("saloni").select("nome").eq("user_id", c.user_id).maybeSingle(),
      c.appuntamento_id
        ? supabaseAdmin
            .from("appuntamenti")
            .select("nome_cliente, servizio, start_at")
            .eq("id", c.appuntamento_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      id: c.id,
      stato: c.stato,
      nome_modulo: c.nome_modulo,
      testo_snapshot: c.testo_snapshot,
      nome_firma: c.nome_firma,
      cognome_firma: c.cognome_firma,
      firmato_at: c.firmato_at,
      salone_nome: salone?.nome ?? "Salone",
      appuntamento: app
        ? {
            nome_cliente: app.nome_cliente,
            servizio: app.servizio,
            start_at: app.start_at,
          }
        : null,
    };
  });

/** Pubblico: firma il consenso e genera il PDF */
export const firmaConsenso = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().uuid(),
        nome: z.string().min(1).max(120),
        cognome: z.string().min(1).max(120),
        firma_data_url: z
          .string()
          .min(100)
          .max(2_000_000)
          .regex(/^data:image\/png;base64,/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: c, error } = await supabaseAdmin
      .from("consensi_firmati")
      .select("id, user_id, stato, nome_modulo, testo_snapshot, appuntamento_id, cliente_id")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !c) throw new Error("Consenso non trovato");
    if (c.stato === "firmato") throw new Error("Consenso già firmato");

    const [{ data: salone }, { data: app }] = await Promise.all([
      supabaseAdmin.from("saloni").select("nome").eq("user_id", c.user_id).maybeSingle(),
      c.appuntamento_id
        ? supabaseAdmin
            .from("appuntamenti")
            .select("nome_cliente, servizio, start_at")
            .eq("id", c.appuntamento_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const now = new Date();

    // Genera PDF
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(salone?.nome ?? "Salone", margin, y);
    y += 24;
    doc.setFontSize(14);
    doc.text("Consenso informato", margin, y);
    y += 8;
    doc.setDrawColor(180);
    doc.line(margin, y, W - margin, y);
    y += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(c.nome_modulo, margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(c.testo_snapshot || "", W - margin * 2);
    for (const line of lines as string[]) {
      if (y > 780) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 14;
    }
    y += 10;

    if (app) {
      if (y > 720) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.text("Appuntamento", margin, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.text(`Servizio: ${app.servizio}`, margin, y);
      y += 14;
      doc.text(`Data: ${new Date(app.start_at).toLocaleString("it-IT")}`, margin, y);
      y += 20;
    }

    if (y > 640) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Sottoscrittore", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${data.nome}`, margin, y);
    y += 14;
    doc.text(`Cognome: ${data.cognome}`, margin, y);
    y += 14;
    doc.text(`Data firma: ${now.toLocaleString("it-IT")}`, margin, y);
    y += 20;

    doc.setFont("helvetica", "bold");
    doc.text("Firma", margin, y);
    y += 8;
    try {
      doc.addImage(data.firma_data_url, "PNG", margin, y, 200, 80);
    } catch {
      // ignora se l'immagine non è valida
    }
    y += 90;
    doc.setDrawColor(120);
    doc.line(margin, y, margin + 220, y);
    y += 14;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "Documento firmato digitalmente. Token: " + data.token,
      margin,
      y,
    );

    const pdfArrayBuffer = doc.output("arraybuffer");
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    const path = `${c.user_id}/${c.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("consensi-pdf")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error("Errore salvataggio PDF: " + upErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("consensi_firmati")
      .update({
        stato: "firmato",
        nome_firma: data.nome,
        cognome_firma: data.cognome,
        firma_data_url: data.firma_data_url,
        pdf_path: path,
        firmato_at: now.toISOString(),
      })
      .eq("id", c.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

/** Ottieni una signed URL per scaricare il PDF (solo proprietario) */
export const getConsensoPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ consenso_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: c, error } = await supabaseAdmin
      .from("consensi_firmati")
      .select("pdf_path, user_id")
      .eq("id", data.consenso_id)
      .maybeSingle();
    if (error || !c) throw new Error("Consenso non trovato");
    if (c.user_id !== userId) throw new Error("Non autorizzato");
    if (!c.pdf_path) throw new Error("PDF non ancora generato");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("consensi-pdf")
      .createSignedUrl(c.pdf_path, 60 * 10);
    if (sErr || !signed) throw new Error("Errore generazione link");
    return { url: signed.signedUrl };
  });
