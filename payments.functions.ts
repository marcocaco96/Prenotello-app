import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SLUG_RE = /^[a-z0-9-]{2,60}$/;

function jsDayToOurs(d: number): number {
  return (d + 6) % 7;
}

function validateText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${label} non valido`);
  const v = value.trim();
  if (!v) throw new Error(`${label} obbligatorio`);
  if (v.length > max) throw new Error(`${label} troppo lungo`);
  return v;
}

// Create a Stripe Checkout session for a public booking.
// Creates the appointment immediately with stato_pagamento='da_pagare' + stripe_session_id;
// the webhook updates to 'pagato_online' on success.
export const createStripeCheckoutForBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      slug: string;
      servizio_id: string;
      start_at: string;
      nome: string;
      cognome: string;
      telefono: string;
      staff_id?: string | null;
      success_url: string;
      cancel_url: string;
    }) => {
      const slug = String(input.slug ?? "").toLowerCase();
      if (!SLUG_RE.test(slug)) throw new Error("Link non valido");
      const servizio_id = String(input.servizio_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(servizio_id))
        throw new Error("Servizio non valido");
      const start = new Date(String(input.start_at ?? ""));
      if (isNaN(start.getTime())) throw new Error("Orario non valido");
      const staff_id = input.staff_id ?? null;
      if (staff_id !== null && !/^[0-9a-f-]{36}$/i.test(staff_id))
        throw new Error("Operatore non valido");
      const success_url = String(input.success_url ?? "");
      const cancel_url = String(input.cancel_url ?? "");
      if (!/^https?:\/\//.test(success_url) || !/^https?:\/\//.test(cancel_url))
        throw new Error("URL non valido");
      return {
        slug,
        servizio_id,
        start_at: start.toISOString(),
        nome: validateText(input.nome, "Nome", 80),
        cognome: validateText(input.cognome, "Cognome", 80),
        telefono: validateText(input.telefono, "Telefono", 30),
        staff_id,
        success_url,
        cancel_url,
      };
    },
  )
  .handler(async ({ data }) => {
    const { data: salone } = await supabaseAdmin
      .from("saloni")
      .select(
        "id, user_id, nome, prenotazioni_online_attive, stripe_attivo, stripe_secret_key, pagamento_online_obbligatorio",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (!salone || !salone.prenotazioni_online_attive) {
      throw new Error("Prenotazioni online non disponibili");
    }
    if (!salone.stripe_attivo || !salone.stripe_secret_key) {
      throw new Error("Pagamento Stripe non configurato dal salone");
    }

    const { data: servizio } = await supabaseAdmin
      .from("servizi")
      .select("nome, durata_minuti, prezzo")
      .eq("id", data.servizio_id)
      .eq("user_id", salone.user_id)
      .eq("attivo", true)
      .maybeSingle();
    if (!servizio) throw new Error("Servizio non disponibile");
    const prezzo = Number(servizio.prezzo ?? 0);
    if (!prezzo || prezzo <= 0)
      throw new Error("Questo servizio non ha un prezzo: contatta il salone");

    const start = new Date(data.start_at);
    const end = new Date(start.getTime() + servizio.durata_minuti * 60000);
    const ourDay = jsDayToOurs(start.getDay());
    const giorno = start.toISOString().slice(0, 10);

    // Salon hours check
    const { data: salOrario } = await supabaseAdmin
      .from("salone_orari")
      .select("chiuso, ora_inizio, ora_fine")
      .eq("user_id", salone.user_id)
      .eq("giorno_settimana", ourDay)
      .maybeSingle();
    if (salOrario) {
      if (salOrario.chiuso) throw new Error("Salone chiuso");
      const toMin = (t: string) => {
        const [h, m] = String(t).slice(0, 5).split(":").map(Number);
        return h * 60 + m;
      };
      const sMin = start.getHours() * 60 + start.getMinutes();
      const eMin = sMin + servizio.durata_minuti;
      if (sMin < toMin(salOrario.ora_inizio) || eMin > toMin(salOrario.ora_fine))
        throw new Error("Orario fuori apertura");
    }

    // Conflict check (simple: existing non-cancelled appts)
    const { data: existing } = await supabaseAdmin
      .from("appuntamenti")
      .select("start_at, durata_minuti, staff_id, stato")
      .eq("user_id", salone.user_id)
      .gte("start_at", new Date(start.getTime() - 6 * 60 * 60 * 1000).toISOString())
      .lt("start_at", end.toISOString());
    const conflict = (existing ?? []).some((a) => {
      if (a.stato === "cancellato") return false;
      if (data.staff_id && a.staff_id && a.staff_id !== data.staff_id) return false;
      const s = new Date(a.start_at).getTime();
      const e = s + a.durata_minuti * 60000;
      return s < end.getTime() && e > start.getTime();
    });
    if (conflict) throw new Error("Orario non più disponibile");

    // Dedup client by phone
    const telNorm = data.telefono.replace(/\s+/g, "");
    let clienteId: string | null = null;
    const { data: clientiAll } = await supabaseAdmin
      .from("clienti")
      .select("id, telefono")
      .eq("user_id", salone.user_id);
    const match = (clientiAll ?? []).find(
      (c) => (c.telefono ?? "").replace(/\s+/g, "") === telNorm && telNorm !== "",
    );
    if (match) clienteId = match.id;
    else {
      const { data: nuovo } = await supabaseAdmin
        .from("clienti")
        .insert({
          user_id: salone.user_id,
          nome: data.nome,
          cognome: data.cognome,
          telefono: data.telefono,
        })
        .select("id")
        .single();
      clienteId = nuovo?.id ?? null;
    }

    // Create pending appointment
    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appuntamenti")
      .insert({
        user_id: salone.user_id,
        cliente_id: clienteId,
        staff_id: data.staff_id,
        nome_cliente: `${data.nome} ${data.cognome}`,
        servizio: servizio.nome,
        start_at: start.toISOString(),
        durata_minuti: servizio.durata_minuti,
        stato: "programmato",
        stato_pagamento: "da_pagare",
        metodo_pagamento: "stripe",
        importo: prezzo,
      })
      .select("id")
      .single();
    if (apptError || !appt) throw new Error(apptError?.message ?? "Errore");

    // Create Stripe Checkout session using salon's secret key
    const stripe = new Stripe(salone.stripe_secret_key, {
      apiVersion: "2024-12-18.acacia" as any,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${data.success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancel_url,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `${servizio.nome} — ${salone.nome}` },
            unit_amount: Math.round(prezzo * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        appuntamento_id: appt.id,
        salone_id: salone.id,
      },
    });

    // Save the session ID on the appointment
    await supabaseAdmin
      .from("appuntamenti")
      .update({ stripe_session_id: session.id })
      .eq("id", appt.id);

    return { ok: true as const, checkout_url: session.url };
  });

// Verify a checkout session client-side after redirect (no webhook reliance for confirmation page)
export const confirmStripeSession = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; session_id: string }) => {
    const slug = String(input.slug ?? "").toLowerCase();
    if (!SLUG_RE.test(slug)) throw new Error("Link non valido");
    const session_id = String(input.session_id ?? "");
    if (!session_id) throw new Error("Sessione non valida");
    return { slug, session_id };
  })
  .handler(async ({ data }) => {
    const { data: salone } = await supabaseAdmin
      .from("saloni")
      .select("user_id, stripe_secret_key")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!salone?.stripe_secret_key) return { ok: false as const };

    const stripe = new Stripe(salone.stripe_secret_key, {
      apiVersion: "2024-12-18.acacia" as any,
    });
    const session = await stripe.checkout.sessions.retrieve(data.session_id);
    if (session.payment_status === "paid") {
      await supabaseAdmin
        .from("appuntamenti")
        .update({ stato_pagamento: "pagato_online", metodo_pagamento: "stripe" })
        .eq("stripe_session_id", data.session_id)
        .eq("user_id", salone.user_id);
      return { ok: true as const };
    }
    return { ok: false as const };
  });
