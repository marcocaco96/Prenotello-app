
-- STAFF
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  foto_url TEXT,
  colore TEXT NOT NULL DEFAULT '#3b82f6',
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
GRANT SELECT ON public.staff TO anon;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own staff" ON public.staff FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public can view staff" ON public.staff FOR SELECT TO anon USING (true);
CREATE POLICY "Users insert own staff" ON public.staff FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own staff" ON public.staff FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own staff" ON public.staff FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STAFF_SERVIZI
CREATE TABLE public.staff_servizi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  servizio_id UUID NOT NULL REFERENCES public.servizi(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, servizio_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_servizi TO authenticated;
GRANT ALL ON public.staff_servizi TO service_role;
GRANT SELECT ON public.staff_servizi TO anon;
ALTER TABLE public.staff_servizi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own staff_servizi" ON public.staff_servizi FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public view staff_servizi" ON public.staff_servizi FOR SELECT TO anon USING (true);
CREATE POLICY "Users insert own staff_servizi" ON public.staff_servizi FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own staff_servizi" ON public.staff_servizi FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- STAFF_ORARI (uno per giorno-settimana per staff)
CREATE TABLE public.staff_orari (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  giorno_settimana SMALLINT NOT NULL CHECK (giorno_settimana BETWEEN 0 AND 6),
  ora_inizio TIME NOT NULL,
  ora_fine TIME NOT NULL,
  pausa_inizio TIME,
  pausa_fine TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, giorno_settimana)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_orari TO authenticated;
GRANT ALL ON public.staff_orari TO service_role;
GRANT SELECT ON public.staff_orari TO anon;
ALTER TABLE public.staff_orari ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own staff_orari" ON public.staff_orari FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public view staff_orari" ON public.staff_orari FOR SELECT TO anon USING (true);
CREATE POLICY "Users insert own staff_orari" ON public.staff_orari FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own staff_orari" ON public.staff_orari FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own staff_orari" ON public.staff_orari FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_staff_orari_updated_at BEFORE UPDATE ON public.staff_orari FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STAFF_ASSENZE
CREATE TABLE public.staff_assenze (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  data_inizio DATE NOT NULL,
  data_fine DATE NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_assenze TO authenticated;
GRANT ALL ON public.staff_assenze TO service_role;
GRANT SELECT ON public.staff_assenze TO anon;
ALTER TABLE public.staff_assenze ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own staff_assenze" ON public.staff_assenze FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public view staff_assenze" ON public.staff_assenze FOR SELECT TO anon USING (true);
CREATE POLICY "Users insert own staff_assenze" ON public.staff_assenze FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own staff_assenze" ON public.staff_assenze FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own staff_assenze" ON public.staff_assenze FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- APPUNTAMENTI: aggiungi staff_id
ALTER TABLE public.appuntamenti
  ADD COLUMN staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- Storage bucket per foto staff
INSERT INTO storage.buckets (id, name, public) VALUES ('staff-photos', 'staff-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'staff-photos');
CREATE POLICY "Users upload own staff photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own staff photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'staff-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own staff photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'staff-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
