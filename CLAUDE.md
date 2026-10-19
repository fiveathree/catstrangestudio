# 交接筆記（畀之後接手嘅對話）

> **狀態：2026-10-19 恢復。** 用戶要求繼續做，第一個改動係加入會行嘅狸花貓同「貓咪視角」。

呢個 repo 有兩樣嘢：一個宇宙玻璃 Studio 嘅 3D 模型頁，同一個裝修 3D 規劃工具。全部係靜態檔案，冇後端、冇 build 步驟。

## 用戶嘅溝通習慣

- 用廣東話（繁體）溝通，回覆都用廣東話。介面文字用繁體中文。
- 訊息好短，一句講一個要求。照字面做，唔好自己加大範圍。
- 鍾意睇到實物多過睇解釋：做完直接講結果、點用、有咩未試過。
- 一步一步改：通常睇完成品先講下一個改動。唔使一次過做到盡。
- 會打錯術語（例如將 SVG 打成 SGV），照上文理解就得。
- 一句說話有兩個合理解法、而且做錯要大改嘅時候，先問一條選擇題；細改動就直接做，再講明係點理解。
- 要「3D」嘅時候係指可以轉動嘅立體模型。呢度做唔到相片級效果圖，要一早講明。
- 字體偏好免費嘅 Google Noto 字體。

## 架構

```
index.html            Studio 3D 模型頁（單一檔案，CSS 同 JS 都喺入面）
assets/plan.png       原本平面圖嘅裁切圖（只有房間部分）
assets/favicon.svg    狸花貓頭 favicon（兩個頁面共用）
planner/index.html    裝修規劃工具
planner/style.css
planner/app.js
planner/vendor/       three.js r128、OrbitControls、pdf.js（第三方，唔好改）
```

### Studio 3D 模型頁（`index.html`）

- three.js r128 由 cdnjs 載入，OrbitControls 由 jsDelivr 載入。
- 單位係米。`L=11.9`（長）、`W=3.85`（闊）、`H=2.8`（樓底，假設值）、`BAL=1.8`（陽台深）。平面 x 沿長邊，z 沿闊邊；入口喺左下角。
- `THEMES`：四種風格（A 暗宇宙、B 實驗室、C 侘寂茶室、D 工業工坊）嘅顏色同燈光。
- `PLANS`：每種風格嘅傢俬清單，`x,z` 係左上角、`w,d` 係長闊。3D 同下面嘅設計平面圖都係由呢份清單畫出嚟，所以改擺位只改 `PLANS` 一處。
- `BUILD`：每類傢俬點樣砌成 3D。`ZONES`：每種風格嘅分區（x 範圍）。
- 下面嘅平面圖區：左邊 `#orig` 係原圖，右邊 `#plan` 係由 `drawPlan()` 畫嘅 SVG。兩個 SVG 用同一個 `viewBox`（單位都係米），所以位置對得上。
- 同步邏輯喺 `syncPlan()`（3D 鏡頭 → 平面圖標記同分區）同 `planClick()`／`flyZone()`（平面圖 → 3D 鏡頭）。
- `#plantog` 收埋／展開平面圖區，狀態存喺 `localStorage`。
- 原圖比例：110 dpi 下 1 px = 8.6 mm，室內左上角喺 (152, 442) px。`assets/plan.png` 係用呢個比例擺位，換圖要重新計。
- 狸花貓：`catG` 擺喺 `scene`（唔喺 `world`），所以換風格唔會重砌，`build()` 最尾只會叫 `buildNav()` 重算可以行嘅格。地面每 0.1 m 一格，傢俬、柱同牆邊向外加 `CR=0.18` 當行唔到；凳只計支柱，所以貓可以喺凳底行過。`newTrip()` 用 BFS 隨機揀一個最少 1.5 m 遠嘅點，再拉直成幾段直線；`updateCat(dt)` 負責行、轉身、停低，同埋四肢、尾巴同頭嘅動畫。虎紋係用 canvas 即場畫嘅貼圖。
- 貓咪視角：`#v-cat` 掣（冇 `data-v`，唔喺 `VIEWS` 入面）。`setCatView(on)` 會停用 OrbitControls、收埋隻貓、FOV 轉 70；`frame()` 入面改用 `catCam()` 將鏡頭放喺貓眼。`go()` 同 `fly()` 一開始就會退出貓咪視角，再㩒一次個掣就飛返入嚟之前嘅位置。

### 裝修規劃工具（`planner/`）

- 左欄設定、中間 SVG 平面編輯、右邊 three.js 3D。程式庫用 `vendor/` 入面嘅本地檔案。
- 狀態係一個物件 `S`：`room`（長、闊、高、是否用矩形外牆）、`mats`、`walls`、`items`、`bg`（底圖）。每次改動都 `changed()`，會重畫平面、重建 3D、存入 `localStorage`。
- `CAT` 係物件目錄（水電位、門窗、電器傢俬）；`MAT` 係質感，用 canvas 即場畫貼圖。
- 貼牆嘅物件用 `snapWall()` 吸附，會記低牆嘅法線 `n` 同角度 `rot`。
- 底圖支援圖片同 PDF（PDF 用 `vendor/pdf.min.mjs` 動態載入第一頁）。

## 部署

- GitHub Pages，由 `main` 分支嘅根目錄發佈。冇 build，push 上 `main` 就係上線。
- 網址：根目錄係 Studio 模型，`/planner/` 係規劃工具。
- Pages 設定要用戶自己喺 GitHub 嘅 Settings → Pages 做，呢邊嘅工具改唔到。
- Commit 訊息用英文，直接 push 上 `main`（用戶冇用 PR 流程）。

## 改完要行嘅測試

冇自動測試，每次改完都要用無頭瀏覽器開一次頁面睇真。

1. 語法檢查：`node --check planner/app.js`；`index.html` 入面最後一個 `<script>` 抽出嚟再 `node --check`。
2. 喺 repo 根目錄開本地伺服器：`python3 -m http.server 8766`。
3. 用 Playwright（Chromium，加 `--use-gl=swiftshader --enable-unsafe-swiftshader`）開頁面，截圖，並且收集 `pageerror` 同 console error，要係零。
   - 測 `index.html` 嗰陣，沙盒連唔到 CDN，要用 `page.route` 將 `three.min.js` 同 `OrbitControls.js` 指去 `planner/vendor/` 嘅本地檔案，Google Fonts 就回一個空嘅 CSS。
4. 最少試呢啲：
   - Studio 頁：四種風格逐個切換；㩒分區條同平面圖；收埋再展開平面圖區；400 px 闊度冇橫向捲動。
   - 規劃工具：加一件物件、拖動、畫一段牆、換地板同牆身、上傳一個 PDF 做底圖；400 px 闊度冇橫向捲動。
5. 親眼睇截圖，唔好淨係睇有冇報錯。
6. 回覆用戶嗰陣，講清楚邊樣試過、邊樣冇試。

> 2026-10 用戶部 Windows 機冇 Node、Python 同 Playwright，上面第 1 至 3 步行唔到。替代做法：用 Claude desktop app 內置嘅瀏覽器直接開 `index.html`（會變成 `data:` 快照，CDN 載入正常，但係 `assets/plan.png` 呢類相對路徑載入唔到）。用 `javascript_tool` 撳掣同讀狀態，用 `read_console_messages` 睇錯誤，用 `resize_window` 試 400 px 闊度。如果要讀閉包入面嘅變數，可以臨時加一行 `window.__dbg=…`，測完一定要刪。

## 私隱同安全規則

- 呢個 repo 係公開嘅，push 上去嘅嘢任何人都睇到。
- 唔好放任何密碼、API key、token，亦唔好放地址、電話、電郵、真實姓名。
- 平面圖：只可以放裁切過、淨係得房間嗰部分嘅圖。原本嘅 PDF、圖框、裝修公司名同版權字句都唔好放上嚟。
- 用戶喺規劃工具上傳嘅底圖只留喺佢自己嘅瀏覽器，唔會上傳去任何地方。唔好加任何會將用戶資料送出去嘅功能，除非用戶明確要求。
- 規劃工具「開啟檔案」會讀外來嘅 JSON：物件類型要喺 `CAT` 入面先接受，底圖只接受 `data:image/` 開頭。寫入 SVG 嘅文字要經 `esc()`。改呢部分要保持呢啲檢查。
- 如果之後要加 AI 識別平面圖，金鑰一定要放喺後端（例如 Cloudflare Worker），唔可以寫入前端檔案。

## 未做完嘅嘢

- 規劃工具嘅「量比例」套用、「開啟檔案」、「儲存檔案」、「存 3D 圖片」未實測過。
- Studio 頁：㩒平面圖空白位移鏡頭、滑鼠指住傢俬令 3D 標籤著色，呢兩樣未實測過。手機上下疊嘅排版只確認咗冇爆版，冇睇截圖。
- 用戶揀咗先做「底圖自己描牆」；AI 自動識別牆身係之後可能做嘅第二階段。
- 用戶未揀定用邊種風格，亦未俾現場相。揀定之後要深化嗰一個方案。
- Claude 入面有一個舊版 3D 頁同一個只做咗 A 方案嘅平面設計稿，冇跟 GitHub 版本更新。
- 狸花貓同貓咪視角只喺內置瀏覽器（Chromium）試過，冇喺真手機試過；外形同步態係第一版，用戶睇完可能會要求調整。

## 已知問題同假設

- 右邊盡頭當係陽台（排氣同氣瓶都放嗰邊），未同用戶確認。如果嗰邊其實係臨街，成個佈局要掉轉。
- 樓底高 2.8 m 係假設，原圖冇寫。
- 原圖只見到 110V 插座；高溫爐可能要 220V 專線，未確認。
- 3D 係方塊級模型：展櫃玻璃睇落有啲霧，傢俬冇細節。
- 狸花貓喺轉角原地轉身嗰陣，個頭（約 0.3 m 長）有機會輕輕伸入傢俬邊；停低轉身之前會先檢查個頭嗰邊有冇空位，但係行緊路轉彎嗰陣冇檢查。開咗「減少動態效果」隻貓都照行。
- 規劃工具嘅門窗只係貼喺牆面嘅板，冇喺牆度開窿。
- 規劃工具取消「矩形外牆」之後，地板係用所有牆嘅外框矩形，唔係跟牆嘅實際形狀。
- 規劃工具嘅設計只存喺瀏覽器，帶大底圖嗰陣有機會超出儲存上限，到時會自動唔存底圖。
- 兩個頁面都只喺無頭 Chromium 試過，未喺 Safari、Firefox 或者真手機試過。PDF 底圖靠 `planner/vendor/pdf.min.mjs`（pdf.js 嘅 legacy 版），喺其他瀏覽器未驗證。
