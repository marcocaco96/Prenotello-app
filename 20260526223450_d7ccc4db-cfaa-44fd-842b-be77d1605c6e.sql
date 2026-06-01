CREATE TABLE public.saloni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT 'Il mio salone',
  slug TEXT NOT NULL UNIQUE,
  prenotazioni_online_attive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.saloni TO authenticated;
GRANT ALL ON public.saloni TO service_role;

ALTER TABLE public.saloni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own salone" ON public.saloni FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own salone" ON public.saloni FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own salone" ON public.saloni FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_saloni_slug ON public.saloni(slug);

CREATE TRIGGER update_saloni_updated_at BEFORE UPDATE ON public.saloni
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.servizi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  durata_minuti INT NOT NULL DEFAULT 30,
  prezzo NUMERIC(10,2),
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.servizi TO authenticated;
GRANT ALL ON public.servizi TO service_role;

ALTER TABLE public.servizi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own servizi" ON public.servizi FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own servizi" ON public.servizi FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own servizi" ON public.servizi FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own servizi" ON public.servizi FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_servizi_user ON public.servizi(user_id);

CREATE TRIGGER update_servizi_updated_at BEFORE UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();