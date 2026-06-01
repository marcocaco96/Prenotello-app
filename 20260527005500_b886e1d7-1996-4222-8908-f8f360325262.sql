ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS data_nascita date,
  ADD COLUMN IF NOT EXISTS sesso text,
  ADD COLUMN IF NOT EXISTS come_conosciuto text,
  ADD COLUMN IF NOT EXISTS tipo_cliente text NOT NULL DEFAULT 'privato',
  ADD COLUMN IF NOT EXISTS ragione_sociale text,
  ADD COLUMN IF NOT EXISTS partita_iva text,
  ADD COLUMN IF NOT EXISTS indirizzo_fatturazione text,
  ADD COLUMN IF NOT EXISTS codice_sdi text,
  ADD COLUMN IF NOT EXISTS pec text;