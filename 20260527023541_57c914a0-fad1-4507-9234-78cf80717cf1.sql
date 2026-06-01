
-- Add split-hours (lunch break) columns to salone_orari
ALTER TABLE public.salone_orari
  ADD COLUMN IF NOT EXISTS pausa_inizio time without time zone NULL,
  ADD COLUMN IF NOT EXISTS pausa_fine time without time zone NULL;

-- Extraordinary openings (open on a day normally closed, or different hours)
CREATE TABLE IF NOT EXISTS public.salone_aperture_straordinarie (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  data date NOT NULL,
  ora_inizio time without time zone NOT NULL,
  ora_fine time without time zone NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.salone_aperture_straordinarie TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salone_aperture_straordinarie TO authenticated;
GRANT ALL ON public.salone_aperture_straordinarie TO service_role;

ALTER TABLE public.salone_aperture_straordinarie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view aperture" ON public.salone_aperture_straordinarie FOR SELECT TO anon USING (true);
CREATE POLICY "Users view own aperture" ON public.salone_aperture_straordinarie FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own aperture" ON public.salone_aperture_straordinarie FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own aperture" ON public.salone_aperture_straordinarie FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own aperture" ON public.salone_aperture_straordinarie FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_aperture_user_data ON public.salone_aperture_straordinarie(user_id, data);

-- Extraordinary closures (closed even if normally open, single date or range)
CREATE TABLE IF NOT EXISTS public.salone_chiusure_straordinarie (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  motivo text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.salone_chiusure_straordinarie TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salone_chiusure_straordinarie TO authenticated;
GRANT ALL ON public.salone_chiusure_straordinarie TO service_role;

ALTER TABLE public.salone_chiusure_straordinarie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view chiusure" ON public.salone_chiusure_straordinarie FOR SELECT TO anon USING (true);
CREATE POLICY "Users view own chiusure" ON public.salone_chiusure_straordinarie FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chiusure" ON public.salone_chiusure_straordinarie FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chiusure" ON public.salone_chiusure_straordinarie FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own chiusure" ON public.salone_chiusure_straordinarie FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chiusure_user_data ON public.salone_chiusure_straordinarie(user_id, data_inizio, data_fine);
