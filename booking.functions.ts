import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SLUG_RE = /^[a-z0-9-]{2,60}$/;

function validateText(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") throw new Error(`${label} non valido`);
  const v = value.trim();
  if (required && !v) throw new Error(`${label} obbligatorio`);
  if (v.length > max) throw new Error(`${label} troppo lungo`);
  return v;
}

// Convert JS getDay() (0=sun..6=sat) to our convention (0=mon..6=sun)
function jsDayToOurs(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export const getSalonePublic = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => {
    const slug = String(input.slug ?? "").toLowerCase();
    if (!SLUG_RE.test(slug)) throw new Error("Link non valido");
    return { slug };
  })
  .handler(async ({ data }) => {
    const { data: salone, error } = await supabaseAdmin
      .from("saloni")
      .select(
        "id, user_id, nome, prenotazioni_online_attive, pagamento_online_obbligatorio, modalita_pagamento_online, stripe_attivo, satispay_attivo",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!salone) return { found: false as const };
    if (!salone.prenotazioni_online_attive) {
      return { found: true as const, enabled: false as const, nome: salone.nome };
    }

    const [serviziRes, staffRes, staffServiziRes, orariSaloneRes, apertureRes, chiusureRes] = await Promise.all([
      supabaseAdmin
        .from("servizi")
        .select("id, nome, durata_minuti, prezzo")
        .eq("user_id", salone.user_id)
        .eq("attivo", true)
        .order("nome"),
      supabaseAdmin
        .from("staff")
        .select("id, nome, cognome, foto_url, colore")
        .eq("user_id", salone.user_id)
        .eq("attivo", true)
        .order("cognome"),
      supabaseAdmin
        .from("staff_servizi")
        .select("staff_id, servizio_id")
        .eq("user_id", salone.user_id),
      supabaseAdmin
        .from("salone_orari")
        .select("giorno_settimana, chiuso, ora_inizio, ora_fine, pausa_inizio, pausa_fine")
        .eq("user_id", salone.user_id),
      supabaseAdmin
        .from("salone_aperture_straordinarie")
        .select("data, ora_inizio, ora_fine")
        .eq("user_id", salone.user_id)
        .gte("data", new Date().toISOString().slice(0, 10)),
      supabaseAdmin
        .from("salone_chiusure_straordinarie")
        .select("data_inizio, data_fine, motivo")
        .eq("user_id", salone.user_id)
        .gte("data_fine", new Date().toISOString().slice(0, 10)),
    ]);

    const staffServizi = staffServiziRes.data ?? [];
    const orariSalone = (orariSaloneRes.data ?? []).map((o) => ({
      giorno_settimana: o.giorno_settimana as number,
      chiuso: o.chiuso as boolean,
      ora_inizio: String(o.ora_inizio).slice(0, 5),
      ora_fine: String(o.ora_fine).slice(0, 5),
      pausa_inizio: o.pausa_inizio ? String(o.pausa_inizio).slice(0, 5) : null,
      pausa_fine: o.pausa_fine ? String(o.pausa_fine).slice(0, 5) : null,
    }));
    const aperture = (apertureRes.data ?? []).map((a) => ({
      data: String(a.data),
      ora_inizio: String(a.ora_inizio).slice(0, 5),
      ora_fine: String(a.ora_fine).slice(0, 5),
    }));
    const chiusure = (chiusureRes.data ?? []).map((c) => ({
      data_inizio: String(c.data_inizio),
      data_fine: String(c.data_fine),
      motivo: c.motivo ?? null,
    }));

    const modalita_pagamento_online =
      (salone as { modalita_pagamento_online?: string }).modalita_pagamento_online ??
      (salone.pagamento_online_obbligatorio ? "obbligatorio" : "disattivato");

    return {
      found: true as const,
      enabled: true as const,
      nome: salone.nome,
      pagamento_online_obbligatorio: salone.pagamento_online_obbligatorio,
      modalita_pagamento_online,
      stripe_attivo: salone.stripe_attivo,
      satispay_attivo: salone.satispay_attivo,
      orari_salone: orariSalone,
      aperture_straordinarie: aperture,
      chiusure_straordinarie: chiusure,

      servizi: (serviziRes.data ?? []).map((s) => ({
        id: s.id,
        nome: s.nome,
        durata_minuti: s.durata_minuti,
        prezzo: s.prezzo == null ? null : Number(s.prezzo),
        staff_ids: staffServizi
          .filter((x) => x.servizio_id === s.id)
          .map((x) => x.staff_id),
      })),
      staff: (staffRes.data ?? []).map((m) => ({
        id: m.id,
        nome: m.nome,
        cognome: m.cognome,
        foto_url: m.foto_url,
        colore: m.colore,
      })),
    };
  });

type DayStaffInfo = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
  colore: string;
  orario: {
    ora_inizio: string;
    ora_fine: string;
    pausa_inizio: string | null;
    pausa_fine: string | null;
  } | null;
  assente: boolean;
  appuntamenti: { start_at: string; durata_minuti: number }[];
};

export const getDayBookings = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; giorno: string }) => {
    const slug = String(input.slug ?? "").toLowerCase();
    if (!SLUG_RE.test(slug)) throw new Error("Link non valido");
    const giorno = String(input.giorno ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) throw new Error("Data non valida");
    return { slug, giorno };
  })
  .handler(async ({ data }) => {
    const { data: salone } = await supabaseAdmin
      .from("saloni")
      .select("user_id, prenotazioni_online_attive")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!salone || !salone.prenotazioni_online_attive) {
      return { ok: false as const };
    }

    const dayStart = new Date(`${data.giorno}T00:00:00`);
    const dayEnd = new Date(`${data.giorno}T23:59:59`);
    const ourDay = jsDayToOurs(dayStart.getDay());

    const [apptsRes, staffRes, orariRes, assenzeRes, salOrarioRes, apOggi, chOggi] = await Promise.all([
      supabaseAdmin
        .from("appuntamenti")
        .select("start_at, durata_minuti, staff_id")
        .eq("user_id", salone.user_id)
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString()),
      supabaseAdmin
        .from("staff")
        .select("id, nome, cognome, foto_url, colore")
        .eq("user_id", salone.user_id)
        .eq("attivo", true),
      supabaseAdmin
        .from("staff_orari")
        .select("*")
        .eq("user_id", salone.user_id)
        .eq("giorno_settimana", ourDay),
      supabaseAdmin
        .from("staff_assenze")
        .select("staff_id, data_inizio, data_fine")
        .eq("user_id", salone.user_id)
        .lte("data_inizio", data.giorno)
        .gte("data_fine", data.giorno),
      supabaseAdmin
        .from("salone_orari")
        .select("chiuso, ora_inizio, ora_fine, pausa_inizio, pausa_fine")
        .eq("user_id", salone.user_id)
        .eq("giorno_settimana", ourDay)
        .maybeSingle(),
      supabaseAdmin
        .from("salone_aperture_straordinarie")
        .select("ora_inizio, ora_fine")
        .eq("user_id", salone.user_id)
        .eq("data", data.giorno),
      supabaseAdmin
        .from("salone_chiusure_straordinarie")
        .select("data_inizio, data_fine, motivo")
        .eq("user_id", salone.user_id)
        .lte("data_inizio", data.giorno)
        .gte("data_fine", data.giorno),
    ]);

    const allAppts = apptsRes.data ?? [];
    const allStaff = staffRes.data ?? [];
    const orari = orariRes.data ?? [];
    const assenze = assenzeRes.data ?? [];
    const so = salOrarioRes.data;
    const apertura = (apOggi.data ?? [])[0] ?? null;
    const chiusura = (chOggi.data ?? [])[0] ?? null;

    // If extraordinary closure covers the day: closed (overrides normal hours and openings)
    // If extraordinary opening exists: use those hours
    // Else: use normal weekly hours (with split-hours pause)
    let orarioSalone:
      | { chiuso: boolean; ora_inizio: string; ora_fine: string; pausa_inizio: string | null; pausa_fine: string | null }
      | null = null;
    if (chiusura) {
      orarioSalone = { chiuso: true, ora_inizio: "00:00", ora_fine: "00:00", pausa_inizio: null, pausa_fine: null };
    } else if (apertura) {
      orarioSalone = {
        chiuso: false,
        ora_inizio: String(apertura.ora_inizio).slice(0, 5),
        ora_fine: String(apertura.ora_fine).slice(0, 5),
        pausa_inizio: null,
        pausa_fine: null,
      };
    } else if (so) {
      orarioSalone = {
        chiuso: so.chiuso as boolean,
        ora_inizio: String(so.ora_inizio).slice(0, 5),
        ora_fine: String(so.ora_fine).slice(0, 5),
        pausa_inizio: so.pausa_inizio ? String(so.pausa_inizio).slice(0, 5) : null,
        pausa_fine: so.pausa_fine ? String(so.pausa_fine).slice(0, 5) : null,
      };
    }


    // Generic (no staff assigned) appointments — count for everyone
    const genericAppts = allAppts.filter((a) => !a.staff_id);

    const staff: DayStaffInfo[] = allStaff.map((m) => {
      const o = orari.find((x) => x.staff_id === m.id) ?? null;
      const ass = assenze.some((x) => x.staff_id === m.id);
      const myAppts = allAppts
        .filter((a) => a.staff_id === m.id)
        .concat(genericAppts)
        .map((a) => ({ start_at: a.start_at, durata_minuti: a.durata_minuti }));
      return {
        id: m.id,
        nome: m.nome,
        cognome: m.cognome,
        foto_url: m.foto_url,
        colore: m.colore,
        orario: o
          ? {
              ora_inizio: String(o.ora_inizio).slice(0, 5),
              ora_fine: String(o.ora_fine).slice(0, 5),
              pausa_inizio: o.pausa_inizio ? String(o.pausa_inizio).slice(0, 5) : null,
              pausa_fine: o.pausa_fine ? String(o.pausa_fine).slice(0, 5) : null,
            }
          : null,
        assente: ass,
        appuntamenti: myAppts,
      };
    });

    return {
      ok: true as const,
      staff,
      orario_salone: orarioSalone,
      // Back-compat: flat list of all appointments
      appuntamenti: allAppts.map((a) => ({
        start_at: a.start_at,
        durata_minuti: a.durata_minuti,
      })),
    };
  });

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      slug: string;
      servizio_id: string;
      start_at: string;
      nome: string;
      cognome: string;
      telefono: string;
      staff_id?: string | null;
    }) => {
      const slug = String(input.slug ?? "").toLowerCase();
      if (!SLUG_RE.test(slug)) throw new Error("Link non valido");
      const servizio_id = String(input.servizio_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(servizio_id))
        throw new Error("Servizio non valido");
      const start = new Date(String(input.start_at ?? ""));
      if (isNaN(start.getTime())) throw new Error("Orario non valido");
      if (start.getTime() < Date.now() - 60_000)
        throw new Error("Non puoi prenotare nel passato");

      const staff_id = input.staff_id ?? null;
      if (staff_id !== null && !/^[0-9a-f-]{36}$/i.test(staff_id))
        throw new Error("Operatore non valido");

      return {
        slug,
        servizio_id,
        start_at: start.toISOString(),
        nome: validateText(input.nome, "Nome", 80),
        cognome: validateText(input.cognome, "Cognome", 80),
        telefono: validateText(input.telefono, "Telefono", 30),
        staff_id,
      };
    },
  )
  .handler(async ({ data }) => {
    const { data: salone } = await supabaseAdmin
      .from("saloni")
      .select("user_id, prenotazioni_online_attive, nome, modalita_pagamento_online, pagamento_online_obbligatorio")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!salone || !salone.prenotazioni_online_attive) {
      throw new Error("Prenotazioni online non disponibili");
    }

    const modePay =
      (salone as { modalita_pagamento_online?: string }).modalita_pagamento_online ??
      (salone.pagamento_online_obbligatorio ? "obbligatorio" : "disattivato");
    if (modePay === "obbligatorio") {
      throw new Error("Pagamento online obbligatorio: usa il checkout");
    }

    const { data: servizio } = await supabaseAdmin
      .from("servizi")
      .select("nome, durata_minuti")
      .eq("id", data.servizio_id)
      .eq("user_id", salone.user_id)
      .eq("attivo", true)
      .maybeSingle();

    if (!servizio) throw new Error("Servizio non disponibile");

    const start = new Date(data.start_at);
    const end = new Date(start.getTime() + servizio.durata_minuti * 60000);
    const giorno = start.toISOString().slice(0, 10);
    const ourDay = jsDayToOurs(start.getDay());

    // Validate against salon opening hours (with extraordinary openings/closures and split-hours)
    const toMinStr = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const sMin = start.getHours() * 60 + start.getMinutes();
    const eMin = sMin + servizio.durata_minuti;

    const [{ data: chiusura }, { data: apertura }, { data: salOrario }] =
      await Promise.all([
        supabaseAdmin
          .from("salone_chiusure_straordinarie")
          .select("data_inizio, data_fine")
          .eq("user_id", salone.user_id)
          .lte("data_inizio", giorno)
          .gte("data_fine", giorno)
          .maybeSingle(),
        supabaseAdmin
          .from("salone_aperture_straordinarie")
          .select("ora_inizio, ora_fine")
          .eq("user_id", salone.user_id)
          .eq("data", giorno)
          .maybeSingle(),
        supabaseAdmin
          .from("salone_orari")
          .select("chiuso, ora_inizio, ora_fine, pausa_inizio, pausa_fine")
          .eq("user_id", salone.user_id)
          .eq("giorno_settimana", ourDay)
          .maybeSingle(),
      ]);

    if (chiusura) throw new Error("Salone chiuso in questa data");

    if (apertura) {
      const oS = toMinStr(String(apertura.ora_inizio).slice(0, 5));
      const oE = toMinStr(String(apertura.ora_fine).slice(0, 5));
      if (sMin < oS || eMin > oE) throw new Error("Orario fuori dall'apertura del salone");
    } else if (salOrario) {
      if (salOrario.chiuso) throw new Error("Salone chiuso in questo giorno");
      const oS = toMinStr(String(salOrario.ora_inizio).slice(0, 5));
      const oE = toMinStr(String(salOrario.ora_fine).slice(0, 5));
      if (sMin < oS || eMin > oE) throw new Error("Orario fuori dall'apertura del salone");
      if (salOrario.pausa_inizio && salOrario.pausa_fine) {
        const pS = toMinStr(String(salOrario.pausa_inizio).slice(0, 5));
        const pE = toMinStr(String(salOrario.pausa_fine).slice(0, 5));
        if (sMin < pE && eMin > pS) throw new Error("Orario nella pausa: non disponibile");
      }
    }



    // Determine candidate staff
    let candidateStaffIds: (string | null)[] = [data.staff_id];

    if (data.staff_id === null) {
      // "Qualsiasi disponibile" — find staff that can perform the service
      const { data: ss } = await supabaseAdmin
        .from("staff_servizi")
        .select("staff_id, staff!inner(id, attivo)")
        .eq("user_id", salone.user_id)
        .eq("servizio_id", data.servizio_id);
      const ids = (ss ?? [])
        .filter((x) => {
          const s = x.staff as unknown as { attivo: boolean } | null;
          return s?.attivo === true;
        })
        .map((x) => x.staff_id);
      candidateStaffIds = ids.length > 0 ? ids : [null];
    }

    // Fetch overlapping appointments + orari + assenze
    const windowStart = new Date(start.getTime() - 6 * 60 * 60 * 1000);
    const [apptsRes, orariRes, assenzeRes] = await Promise.all([
      supabaseAdmin
        .from("appuntamenti")
        .select("start_at, durata_minuti, staff_id")
        .eq("user_id", salone.user_id)
        .gte("start_at", windowStart.toISOString())
        .lt("start_at", end.toISOString()),
      candidateStaffIds[0] === null
        ? Promise.resolve({ data: [] })
        : supabaseAdmin
            .from("staff_orari")
            .select("*")
            .eq("user_id", salone.user_id)
            .eq("giorno_settimana", ourDay)
            .in("staff_id", candidateStaffIds as string[]),
      candidateStaffIds[0] === null
        ? Promise.resolve({ data: [] })
        : supabaseAdmin
            .from("staff_assenze")
            .select("staff_id, data_inizio, data_fine")
            .eq("user_id", salone.user_id)
            .lte("data_inizio", giorno)
            .gte("data_fine", giorno)
            .in("staff_id", candidateStaffIds as string[]),
    ]);

    const dayAppts = apptsRes.data ?? [];
    const orari = orariRes.data ?? [];
    const assenze = assenzeRes.data ?? [];

    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = startMin + servizio.durata_minuti;

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    // Try each candidate staff in order; pick first available
    let chosenStaffId: string | null = null;
    let found = false;
    for (const sid of candidateStaffIds) {
      if (sid !== null) {
        const o = orari.find((x) => x.staff_id === sid);
        if (!o) continue;
        const oStart = toMin(String(o.ora_inizio).slice(0, 5));
        const oEnd = toMin(String(o.ora_fine).slice(0, 5));
        if (startMin < oStart || endMin > oEnd) continue;
        if (o.pausa_inizio && o.pausa_fine) {
          const pStart = toMin(String(o.pausa_inizio).slice(0, 5));
          const pEnd = toMin(String(o.pausa_fine).slice(0, 5));
          if (startMin < pEnd && endMin > pStart) continue;
        }
        if (assenze.some((a) => a.staff_id === sid)) continue;
      }
      const conflict = dayAppts.some((a) => {
        // generic appts (staff_id null) block everyone; staff-specific block only that staff
        if (sid !== null && a.staff_id !== null && a.staff_id !== sid) return false;
        const s = new Date(a.start_at).getTime();
        const e = s + a.durata_minuti * 60000;
        return s < end.getTime() && e > start.getTime();
      });
      if (conflict) continue;
      chosenStaffId = sid;
      found = true;
      break;
    }

    if (!found) {
      throw new Error("Orario non più disponibile, scegline un altro");
    }

    // Dedup: find existing client by phone (normalized) for this salon
    const telNorm = data.telefono.replace(/\s+/g, "");
    let clienteId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("clienti")
      .select("id, telefono")
      .eq("user_id", salone.user_id);
    const match = (existing ?? []).find(
      (c) => (c.telefono ?? "").replace(/\s+/g, "") === telNorm && telNorm !== "",
    );
    if (match) {
      clienteId = match.id;
    } else {
      const { data: cliente } = await supabaseAdmin
        .from("clienti")
        .insert({
          user_id: salone.user_id,
          nome: data.nome,
          cognome: data.cognome,
          telefono: data.telefono,
        })
        .select("id")
        .single();
      clienteId = cliente?.id ?? null;
    }

    const { error: apptError } = await supabaseAdmin.from("appuntamenti").insert({
      user_id: salone.user_id,
      cliente_id: clienteId,
      staff_id: chosenStaffId,
      nome_cliente: `${data.nome} ${data.cognome}`,
      servizio: servizio.nome,
      start_at: start.toISOString(),
      durata_minuti: servizio.durata_minuti,
    });

    if (apptError) throw new Error(apptError.message);

    return { ok: true, nomeSalone: salone.nome };
  });
