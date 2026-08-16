REVOKE ALL ON FUNCTION public.kid_points(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.leaderboard(public.age_category) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_kids_overview() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.kid_points(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leaderboard(public.age_category) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_kids_overview() TO authenticated, service_role;