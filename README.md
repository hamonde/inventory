# HAMONDE CAFE 咖啡豆庫存管理系統

咖啡廳內部使用的咖啡豆庫存管理系統，支援多倉庫管理、批次追蹤、新鮮度警示與消耗報表。

## 上線網址

🌐 https://hamonde.github.io/inventory/

## 主要功能

- 員工帳密登入系統
- 6 種交易類型：進庫、出庫、售出、上架、回倉、盤點
- 雙倉庫管理：二樓倉庫、展示櫃
- 批次管理：依烘豆日期追蹤
- 新鮮度警示：養豆中、過期提醒
- 完整 SCAA 風味分類選擇
- 多國產地（含配方豆）
- 歷史紀錄與 CSV 匯出
- 每日消耗報表
- 倉庫盤點功能
- 快速售出 / 上架捷徑

## 技術棧

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase（PostgreSQL + Auth）
- GitHub Pages（部署）

## 本機開發

```bash
npm install
cp .env.example .env  # 填入 Supabase URL 與 Key
npm run dev
```

開啟 http://localhost:5173

## Supabase 後台設定

1. 到 Supabase 後台 → **Project Settings → API Keys** 複製 Publishable key 與 Project URL，填入 `.env`
2. 依序執行 `supabase/migrations/` 內的 SQL：
   - `001_initial.sql`
   - `002_add_check_transaction_type.sql`
   - `003_nullable_bean_for_check.sql`
3. Authentication → Providers → Email 關閉「Confirm email」
4. Authentication → Users → Add user 建立員工帳號（email 格式：`員工名@hamonde.local`）

## 部署

推送到 main 分支後，GitHub Actions 會自動 build 並部署到 GitHub Pages。

詳細部署設定請參考 `.github/workflows/deploy.yml`。
