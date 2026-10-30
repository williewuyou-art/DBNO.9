# 大本9號完整網站（前端＋管理後台＋後端 API）

本專案放在同一個 GitHub Repository，包含公開前端、拖曳上傳後台、報告檔案、報告清單，以及 Cloudflare Worker 後端原始碼。

## 檔案結構
- `index.html`：網站首頁
- `trim.html`：船舶配載／配平工具
- `cat3408-inspection.html`：CAT 3408 主機檢查頁面
- `reports.html`：公開報告下載中心（只顯示已上架項目）
- `admin.html`：管理後台（拖曳上傳、編輯、下架、重新上架、永久刪除）
- `reports.json`：報告清單
- `reports/`：已存在的報告檔案
- `backend/worker.js`：後端 API 原始碼

## 重要：前端與後端部署方式
GitHub Pages 只能提供靜態網站，無法直接安全地執行伺服器程式。因此可以把**所有程式碼放在同一個 GitHub 專案**，但後端 `backend/worker.js` 仍需部署到 Cloudflare Workers 執行。這不需要再開第二個 GitHub Repository。

### 1. 將網站放到 GitHub
1. 將 ZIP 解壓縮。
2. 把資料夾內的檔案與資料夾上傳至目前 GitHub Pages Repository 的根目錄（不是把 ZIP 本身上傳）。
3. 保留 `reports/`、`backend/` 兩個資料夾及 `reports.json`。
4. 在 GitHub Pages 設定使用 `main` 分支根目錄部署。

### 2. 部署後端 Worker
1. 登入 Cloudflare，建立一個 Worker。
2. 將 `backend/worker.js` 的內容貼入 Worker 編輯器並部署。
3. 在 Worker 的 Settings → Variables and Secrets 設定：
   - `GITHUB_OWNER`：GitHub 使用者名稱或組織名稱
   - `GITHUB_REPO`：目前網站 Repository 名稱
   - `GITHUB_TOKEN`：細粒度 Personal Access Token，只授權這個 Repository 的 Contents 讀寫權限；請設為 Secret
   - `ADMIN_PASSWORD`：自行設定高強度管理密碼；請設為 Secret
   - `ALLOWED_ORIGIN`：你的網站來源，例如 `https://YOURNAME.github.io`。若使用專案頁面，Origin 仍然是 `https://YOURNAME.github.io`，不包含 Repository 路徑。
4. Worker URL 會類似 `https://你的worker名稱.你的帳號.workers.dev`。
5. 在 `admin.html` 中將 `WORKER_URL` 的預設佔位網址替換成實際 Worker URL。
6. 提交更新後的 `admin.html` 到 GitHub。

## 管理功能
- **上架**：拖曳檔案、填寫名稱與分類後按「上傳並立即上架」。檔案寫入 `reports/`，報告資料寫入 `reports.json`。
- **下架**：只將 `published` 設為 `false`，前端不再顯示；檔案保留。
- **重新上架**：將 `published` 設回 `true`。
- **編輯**：修改名稱、分類、日期及說明。
- **永久刪除**：從 GitHub 刪除對應檔案，並從報告清單移除。後台會要求兩次確認。

## API 路徑
- `GET /health`：檢查 Worker 是否運作
- `GET /public-list`：取得已上架清單
- `POST /upload`：上傳新報告（multipart/form-data）
- `POST /manage`：管理清單（JSON action：`list`、`publish`、`unpublish`、`update`、`delete`）

## 安全注意事項
- **不要將 `GITHUB_TOKEN` 放進 HTML、JavaScript 或提交到公開 Repository。** 只能放在 Cloudflare Worker 的 Secret。
- 管理密碼由 Worker 驗證；不要沿用公開或容易猜到的密碼。
- GitHub Pages 上的報告檔案是公開檔案。下架只是從清單隱藏，知道原始網址的人仍可能直接存取；刪除後，GitHub Pages 部署更新仍可能需要一點時間。
- 檔案大小上限 20 MB，僅允許 PDF、Word、Excel、ZIP 及常見圖片格式。
- 若 GitHub Contents API 回傳衝突（例如同時多人修改清單），請稍候再試。

## 首次上線檢查
1. 打開 `https://你的網站網址/reports.html`，確認既有報告能顯示。
2. 打開 `https://你的網站網址/admin.html`，使用 Worker 設定的管理密碼登入。
3. 測試上架一份不敏感的測試檔案。
4. 測試下架後前端不再列出該報告，再重新上架。
5. 確認刪除測試檔案會從列表移除且 GitHub `reports/` 中對應檔案被刪除。
