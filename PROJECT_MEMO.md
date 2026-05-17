# HAMONDE CAFE 庫存系統 — 專案備忘

> **給 Claude Code 看的**：每次開新工作階段時，請先讀這份檔案了解專案狀況。

---

## 專案概況

- **店名**：HAMONDE CAFE
- **用途**：咖啡廳內部使用的咖啡豆庫存管理系統
- **狀態**：Phase 1、Phase 2、Phase 3 都已完成並正式上線運作中
- **使用者**：店內員工（不分權限）
- **主要裝置**：平板（觸控優先設計）

---

## 線上資源

- **正式網址**：https://hamonde.github.io/inventory/
- **程式碼倉庫**：https://github.com/hamonde/inventory（公開）
- **資料庫**：Supabase（專案名 `hamonde-cafe`）
- **GitHub 帳號**：hamonde

---

## 技術棧

| 項目 | 技術 |
|------|------|
| 前端框架 | Vite + React + TypeScript |
| 樣式 | Tailwind CSS + shadcn/ui |
| 路由 | React Router v6 |
| 資料庫 | Supabase (PostgreSQL) |
| 認證 | Supabase Auth（假網域 `@hamonde.local`）|
| 部署 | GitHub Pages（自動部署 via GitHub Actions）|
| 本機路徑 | `C:\Users\twins\hamonde-inventory` |

---

## 視覺規範（嚴格遵守）

### 主色系
- `#ACB6BF` 米灰：背景主色 / `cafe-bg`
- `#AC6342` 磚紅：主要按鈕、品牌色 / `cafe-primary`
- `#DFCC60` 芥末黃：點綴色、養豆中標示 / `cafe-accent`

### 輔助色
- `#FBF8F2` 奶白：卡片背景 / `cafe-cream`
- `#3D2817` 深棕：主要文字 / `cafe-dark`
- `#8B7355` 中棕：次要文字 / `cafe-muted`
- `#D6C9B8` 米色：輸入框邊框 / `cafe-border`

### 設計原則
- 平板優先（768px–1280px），向下相容手機，向上相容桌機
- 所有按鈕最小 44×44px（觸控標準）
- 圓角 8-12px
- 不使用陰影、漸層、毛玻璃效果
- 介面文字一律繁體中文

---

## 資料庫表格（重要）

### `beans`（豆子品項主檔）
重要欄位：
- `origins` (jsonb)：產地陣列 `[{country, region}]`，長度=1 是單品豆，長度≥2 是配方豆
- `process_category`：日曬 `sun_dried` / 水洗 `washed` / 蜜處理 `honey` / 特殊處理 `special`
- `process_detail`：細節（僅 honey/special 可填）
- `processing_plant`：處理廠（單品豆才有，配方豆為 null）
- `status`：販售中 `selling` / 售完 `sold_out`
- `deleted_at`：軟刪除標記

### `inventory_transactions`（交易紀錄）
**核心邏輯：庫存數量不存資料庫，由交易紀錄即時計算**

5 種交易類型 `transaction_type`：
- `in` 進庫（warehouse_to = 員工選）
- `out` 出庫（warehouse_from = 員工選）
- `sell` 售出（warehouse_from = 員工選，預設展示櫃）
- `shelf` 上架（warehouse_from = storage, warehouse_to = display，系統自動）
- `return` 回倉（warehouse_from = display, warehouse_to = storage，系統自動）

**庫存計算公式**：
```
某倉庫該批次庫存 = 
    Σ(warehouse_to = 該倉庫的交易數量)
  − Σ(warehouse_from = 該倉庫的交易數量)
```

### 其他表格
- `custom_flavors`：自訂風味
- `custom_process_details`：自訂處理法細節
- `countries`：國家清單（預載 26 國）
- `regions`：產區清單（預載 60+ 個產區）

---

## 重要業務規則

### 顏色標示
- 養豆中：烘豆日期距今 ≤ 10 天 → 芥末黃標示
- 過期警示：烘豆日期距今 > 120 天 → 磚紅加粗
- 庫存不足：豆子總數 < 2 包 → 磚紅加粗

### 處理法細節
- 日曬、水洗：**不顯示細節欄位**
- 蜜處理、特殊處理：可選填細節（細節會記錄供下次選用）
- 查詢顯示：有細節顯示細節，沒細節顯示大類別中文
- 篩選：只用大類別

### 配方豆
- 1 國家 = 單品豆 → 顯示處理廠欄位
- 2+ 國家 = 配方豆 → 隱藏處理廠欄位

### 出庫批次選擇
- 出庫/售出/上架/回倉時，烘豆日期改為下拉選單
- 預設選最舊批次（FIFO）

### 員工帳號
- 使用假網域 `@hamonde.local`（例如 `admin@hamonde.local`）
- 員工只輸入前綴，系統自動補後綴
- 邀請制（管理員在 Supabase 後台手動建立）

---

## 已完成的功能

### Phase 1（MVP）
- 登入系統
- 首頁（4 大功能卡片）
- 新增、查詢、修改、刪除豆子品項（軟刪除）
- 進出庫紀錄（5 種交易類型 + 暫存表格）
- 查詢豆子庫存（含批次明細彈窗、豆子卡片彈窗）

### Phase 2（優化）
- 完整風味選擇彈窗（階層展開列表，9 大類、150+ 風味、SCAA 中文版）
- 完整產地多選彈窗（洲別分頁、可新增產區）
- 歷史紀錄頁（多條件篩選 + CSV 匯出）
- 首頁新鮮度警示卡片（過期/養豆中）

### Phase 3（進階）
- 快速售出 / 快速上架捷徑（首頁彈窗）
- 每日消耗報表（含售出金額）
- 盤點功能（選倉庫 → 列批次 → 員工輸入 → 一次寫入調整紀錄）

---

## 環境變數

`.env` 檔內容（**絕對不能推到 GitHub**，已在 .gitignore 中排除）：
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

GitHub Actions Secrets 也設定相同兩個 key（用於自動部署）。

---

## 修改程式碼的標準流程

當使用者請你修改程式碼時，請依照以下流程：

### 步驟 1：確認本機與線上同步
```powershell
cd C:\Users\twins\hamonde-inventory
git pull
```

### 步驟 2：修改檔案
依照使用者需求修改。

### 步驟 3：本機驗證
建議跑一次 build 確認沒語法錯誤：
```powershell
npm run build
```

### 步驟 4：推送到 GitHub
```powershell
git add .
git commit -m "改動的簡短說明（用繁體中文）"
git push
```

### 步驟 5：告知使用者
告訴使用者：「已推送到 GitHub，2-3 分鐘後線上版本會自動更新。可以到 https://hamonde.github.io/inventory/ 重新整理（Ctrl+F5）測試。」

---

## 開發守則

- 程式碼風格簡潔，避免過度抽象
- 元件保持中等粒度
- 所有錯誤情況都要有 user-friendly 的提示
- 表單驗證在 client 端先做一輪
- 操作完成後給明確視覺回饋
- **嚴格遵守視覺規範**（顏色、圓角、留白、按鈕大小）
- 不加陰影、漸層、毛玻璃效果
- 介面文字一律繁體中文
- **絕對不要把 `.env` 推到 GitHub**

---

## 資料庫變動的注意事項

如果使用者要新增資料庫欄位或表格：

1. 在 `supabase/migrations/` 新增 `00X_xxx.sql`
2. **明確告訴使用者**：「請先到 Supabase 後台 → SQL Editor 執行新的 SQL，再推送程式碼」
3. SQL 與程式碼變動要同步，不然線上會壞掉
4. 大改動建議使用者先備份 Supabase 資料

---

## 遇到問題時

### Git 衝突（git pull/push 失敗）
1. 先執行 `git status` 看狀況
2. 如果有未推送的本機改動：`git stash` → `git pull` → `git stash pop`
3. 衝突嚴重的話，告訴使用者並截圖錯誤訊息

### 部署失敗（GitHub Actions 紅色 X）
1. 引導使用者打開 https://github.com/hamonde/inventory/actions
2. 點失敗的 workflow → 看哪一步紅色 X
3. 常見原因：
   - Secrets 沒設定 → 去 Settings → Secrets and variables → Actions 加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
   - GitHub Pages 沒啟用 → 去 Settings → Pages → Source 選「GitHub Actions」
   - 程式碼錯誤 → 看具體錯誤訊息修

### 網站打開但登入失敗
1. 檢查 Supabase URL Configuration 是否包含 `https://hamonde.github.io/inventory/**`
2. 檢查 Supabase Email Confirmation 是否關閉
3. 檢查員工帳號是否有「Auto Confirm」

---

## 重要：使用者不是工程師

使用者是咖啡廳老闆，沒有寫程式背景。請：
- 用淺白的繁體中文說明
- 不要丟一堆專有名詞
- 操作步驟要具體（不要說「打開 terminal」，要說「打開 PowerShell」）
- 任何指令都要明確說在哪裡執行
- 提供截圖描述讓使用者知道該找什麼
- 遇到錯誤要解釋原因，不是只說「失敗了」

---

最後更新：2026/05/17
