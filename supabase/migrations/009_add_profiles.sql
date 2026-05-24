-- 員工名稱對照表：讓歷史紀錄能顯示所有人的名稱（而非代號）
-- email 格式為 name@hamonde.local，display_name 取 @ 前面的部分

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 已登入員工皆可讀取（才能在歷史紀錄顯示彼此名稱）
DROP POLICY IF EXISTS "authenticated_read_profiles" ON profiles;
CREATE POLICY "authenticated_read_profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

-- 回填現有使用者
INSERT INTO profiles (id, email, display_name)
SELECT id, email, split_part(email, '@', 1)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 新增使用者時自動建立對應 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
