-- 修正 009 建的 profiles 自動建立 trigger
-- 問題：SECURITY DEFINER 函式沒設 search_path，導致無法找到 public.profiles
--      新增 auth.users 時 trigger 失敗，整個 user creation 被 rollback
-- 解法：明確設定 search_path，並用完整路徑 public.profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
