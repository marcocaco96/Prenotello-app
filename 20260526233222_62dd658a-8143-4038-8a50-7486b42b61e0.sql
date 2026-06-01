
CREATE TABLE public.salone_orari (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  giorno_settimana smallint NOT NULL CHECK (giorno_settimana BETWEEN 0 AND 6),
  chiuso boolean NOT NULL DEFAULT false,
  ora_inizio time NOT NULL DEFAULT '09:00',
  ora_fine time NOT NULL DEFAULT '19:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, giorno_settimana)
);

GRANT SELECT ON public.salone_orari TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salone_orari TO authenticated;
GRANT ALL ON public.salone_orari TO service_role;

ALTER TABLE public.salone_orari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view salone_orari" ON public.salone_orari FOR SELECT TO anon USING (true);
CREATE POLICY "Users view own salone_orari" ON public.salone_orari FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own salone_orari" ON public.salone_orari FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own salone_orari" ON public.salone_orari FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own salone_orari" ON public.salone_orari FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_salone_orari_updated_at
BEFORE UPDATE ON public.salone_orari
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
