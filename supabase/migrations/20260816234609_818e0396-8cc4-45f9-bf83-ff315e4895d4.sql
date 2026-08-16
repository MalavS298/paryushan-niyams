-- Enums
CREATE TYPE public.age_category AS ENUM ('0-5','6-8','9-11','12+');
CREATE TYPE public.program_type AS ENUM ('paryushan','das_lakshan');
CREATE TYPE public.app_role AS ENUM ('admin','user');

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Activity catalog
CREATE TABLE public.activities (
  key text PRIMARY KEY,
  sort_order numeric NOT NULL,
  label text NOT NULL,
  kind text NOT NULL,
  points integer NOT NULL,
  alt_points integer,
  note text
);
GRANT SELECT ON public.activities TO authenticated, anon;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activities are readable by everyone" ON public.activities FOR SELECT USING (true);

INSERT INTO public.activities (key, sort_order, label, kind, points, alt_points, note) VALUES
('1', 1, 'Recite 8 navkar mantras on waking up', 'do', 20, NULL, NULL),
('2.1', 2.1, 'Navkarsi (Breakfast 48 minutes after sunrise)', 'do', 30, NULL, NULL),
('2.2', 2.2, 'Porasi (Breakfast 3 hours after sunrise)', 'do', 50, NULL, NULL),
('2.3', 2.3, 'Besanu (Sit & eat 2 meals; boiled water sunrise to sunset)', 'do', 70, NULL, NULL),
('2.4', 2.4, 'Ekasanu (Sit & eat 1 meal; boiled water sunrise to sunset)', 'do', 100, NULL, NULL),
('2.5', 2.5, 'Upvaas (Boiled water sunrise to sunset)', 'do', 200, NULL, NULL),
('3', 3, 'Bow to your parents/elders and get blessings', 'do', 20, NULL, NULL),
('4', 4, 'Daily Darshan at temple (70 pts if kesar/vakshep pooja)', 'do', 50, 70, 'variant'),
('5', 5, '1 navkar mala (Recite navkar mantra 108 times)', 'do', 70, NULL, NULL),
('6', 6, 'Eat only Jain food all day (no root vegetables)', 'do', 100, NULL, NULL),
('7', 7, '48 min meditation/samayika/pratikraman/Shrimad Alochna (200 pts for Samvatsari)', 'do', 100, 200, 'variant'),
('8', 8, 'Recite 8 navkar mantra before sleeping', 'do', 20, NULL, NULL),
('9', 9, 'Donate $1 from your piggybank to a good cause (can donate later)', 'do', 30, NULL, NULL),
('10', 10, 'Leave food on your plate (breakfast, lunch, dinner) — count if you did Upvaas', 'dont', 50, NULL, NULL),
('11', 11, 'Eat after sunset until sunrise (Chauvihaar/Tivihaar) — count if Besanu/Ekasanu/Upvaas', 'dont', 100, NULL, NULL),
('12', 12, 'Watch any screen for entertainment (video games/TV/smartphones)', 'dont', 80, NULL, NULL),
('13', 13, 'Talk for 15 minutes (vow of silence)', 'dont', 50, NULL, NULL);

-- Kids
CREATE TABLE public.kids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  age_category public.age_category NOT NULL,
  program public.program_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kids TO authenticated;
GRANT ALL ON public.kids TO service_role;
ALTER TABLE public.kids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage their own kids" ON public.kids FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all kids" ON public.kids FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_kids_updated_at BEFORE UPDATE ON public.kids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Entries
CREATE TABLE public.kid_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  activity_key text NOT NULL REFERENCES public.activities(key),
  variant text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kid_id, day_index, activity_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kid_entries TO authenticated;
GRANT ALL ON public.kid_entries TO service_role;
ALTER TABLE public.kid_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage entries for their kids" ON public.kid_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = kid_id AND k.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = kid_id AND k.user_id = auth.uid()));
CREATE POLICY "Admins can view all entries" ON public.kid_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Points computation
CREATE OR REPLACE FUNCTION public.kid_points(_kid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH prog AS (SELECT program FROM public.kids WHERE id = _kid),
  days AS (
    SELECT e.day_index,
      SUM(CASE WHEN a.alt_points IS NOT NULL AND e.variant = 'alt' THEN a.alt_points ELSE a.points END) AS pts
    FROM public.kid_entries e
    JOIN public.activities a ON a.key = e.activity_key
    WHERE e.kid_id = _kid
    GROUP BY e.day_index
  ),
  ranked AS (SELECT pts, row_number() OVER (ORDER BY pts DESC) AS rn FROM days)
  SELECT COALESCE(
    CASE WHEN (SELECT program FROM prog) = 'das_lakshan'
      THEN (SELECT SUM(pts) FROM ranked WHERE rn <= 8)
      ELSE (SELECT SUM(pts) FROM days)
    END, 0)::int
$$;

-- Leaderboard for an age category (names + points only)
CREATE OR REPLACE FUNCTION public.leaderboard(_age public.age_category)
RETURNS TABLE (kid_id uuid, name text, program public.program_type, points integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.name, k.program, public.kid_points(k.id)
  FROM public.kids k
  WHERE k.age_category = _age
  ORDER BY public.kid_points(k.id) DESC, k.name ASC
$$;

-- Admin overview of every kid
CREATE OR REPLACE FUNCTION public.admin_kids_overview()
RETURNS TABLE (kid_id uuid, name text, age_category public.age_category, program public.program_type, points integer, parent_name text, parent_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT k.id, k.name, k.age_category, k.program, public.kid_points(k.id),
           p.display_name, u.email::text
    FROM public.kids k
    LEFT JOIN public.profiles p ON p.id = k.user_id
    LEFT JOIN auth.users u ON u.id = k.user_id
    ORDER BY public.kid_points(k.id) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard(public.age_category) FROM anon;
REVOKE ALL ON FUNCTION public.admin_kids_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.leaderboard(public.age_category) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kids_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.kid_points(uuid) TO authenticated;