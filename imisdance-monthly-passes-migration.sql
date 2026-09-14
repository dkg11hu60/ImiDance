-- 1. Create monthly_passes table
CREATE TABLE IF NOT EXISTS public.monthly_passes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_profile_year_month UNIQUE (profile_id, year, month)
);

-- Enable RLS
ALTER TABLE public.monthly_passes ENABLE ROW LEVEL SECURITY;

-- Allow public read and write access for development/simplicity (matching existing profiles pattern)
CREATE POLICY "Allow public read access" ON public.monthly_passes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.monthly_passes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.monthly_passes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.monthly_passes FOR DELETE USING (true);

-- 2. Trigger function for insert/delete on monthly_passes
CREATE OR REPLACE FUNCTION public.sync_monthly_pass_attendances()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.attendances a
    SET paid = true
    FROM public.events e
    WHERE a.event_id = e.id
      AND a.profile_id = NEW.profile_id
      AND EXTRACT(YEAR FROM e.event_date) = NEW.year
      AND EXTRACT(MONTH FROM e.event_date) = NEW.month;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.attendances a
    SET paid = false
    FROM public.events e
    WHERE a.event_id = e.id
      AND a.profile_id = OLD.profile_id
      AND EXTRACT(YEAR FROM e.event_date) = OLD.year
      AND EXTRACT(MONTH FROM e.event_date) = OLD.month;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_monthly_pass_attendances
AFTER INSERT OR DELETE ON public.monthly_passes
FOR EACH ROW
EXECUTE FUNCTION public.sync_monthly_pass_attendances();

-- 3. Trigger function on attendances to automatically set paid = true if monthly_pass exists
CREATE OR REPLACE FUNCTION public.check_attendance_monthly_pass()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.monthly_passes mp
    JOIN public.events e ON e.id = NEW.event_id
    WHERE mp.profile_id = NEW.profile_id
      AND mp.year = EXTRACT(YEAR FROM e.event_date)
      AND mp.month = EXTRACT(MONTH FROM e.event_date)
  ) THEN
    NEW.paid := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_attendance_monthly_pass
BEFORE INSERT OR UPDATE OF event_id, profile_id ON public.attendances
FOR EACH ROW
EXECUTE FUNCTION public.check_attendance_monthly_pass();
