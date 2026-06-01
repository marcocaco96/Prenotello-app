
-- Ensure full row data on updates/deletes so realtime payloads carry the previous values
ALTER TABLE public.appuntamenti REPLICA IDENTITY FULL;
ALTER TABLE public.clienti REPLICA IDENTITY FULL;
ALTER TABLE public.prodotti REPLICA IDENTITY FULL;
ALTER TABLE public.vendite_prodotti REPLICA IDENTITY FULL;
ALTER TABLE public.staff REPLICA IDENTITY FULL;
ALTER TABLE public.staff_orari REPLICA IDENTITY FULL;
ALTER TABLE public.staff_assenze REPLICA IDENTITY FULL;
ALTER TABLE public.staff_servizi REPLICA IDENTITY FULL;
ALTER TABLE public.servizi REPLICA IDENTITY FULL;
ALTER TABLE public.salone_orari REPLICA IDENTITY FULL;
ALTER TABLE public.salone_aperture_straordinarie REPLICA IDENTITY FULL;
ALTER TABLE public.salone_chiusure_straordinarie REPLICA IDENTITY FULL;
ALTER TABLE public.saloni REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (idempotent via DO block)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'appuntamenti','clienti','prodotti','vendite_prodotti',
    'staff','staff_orari','staff_assenze','staff_servizi','servizi',
    'salone_orari','salone_aperture_straordinarie','salone_chiusure_straordinarie','saloni'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
