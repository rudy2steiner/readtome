## Why

站点已以 “Read To Me”（文字转语音）品牌与域名 `read-to-me.org` 对外呈现，但产品主界面仍嵌入 PhotoMaker 图片生成。品牌与能力错位，阻碍真正产品落地：对标 [TTSReader](https://ttsreader.com/) 的在线 AI 朗读器——粘贴或上传文本，用自然语音收听，暂停后可从离开处继续。

落地页、登录与付费架构 **以同栈项目 [`/Users/xuandu/mywsp/deepsearch`](file:///Users/xuandu/mywsp/deepsearch) 为参考**：Hero 内嵌主产品、NextAuth（Google）登录、Stripe 订阅 + 用量权益（购买页讲权益、用量页讲数字），并在 Cloudflare Workers 上部署。

## What Changes

- **BREAKING**：移除 PhotoMaker 作为主产品（UI、`/api/generate`、Gradio/HF 调用链、与图片生成相关的示例/画廊流程）。
- 主体验改为 **TTS 播放器**，布局对标 TTSReader 播放器：文档卡片 + 浮动播放条 + 右侧 Playback 面板（音色/语速），支持播放/暂停/停止与跟读高亮。
- **落地页**：对标 deepsearch `Hero` + `LandingChat`——**朗读器嵌在 Hero 主区**，营销标题在朗读期间保持原位；Hero 内另有云端音色试听条作为付费入口；下方保留 Benefits / Features / FAQ / CTA 等营销段。
- **文档导入**：纯文本粘贴，以及浏览器本地解析 TXT/MD/HTML/RTF/CSV/DOCX/ODT/PDF/EPUB；旧版 `.doc` 需另存为 `.docx`。文件不上传到服务器。
- **阅读会话** 本地持久化（文本、句段位置、音色与语速）；登录后可扩展账号级同步（非首期硬性）。
- **免费档**：浏览器 Web Speech 无限收听；**付费档**：经 [Atlas Cloud MiniMax Speech 2.6 Turbo](https://www.atlascloud.ai/zh/models/minimax/speech-2.6-turbo) 的云端 AI 音色 + 周期字符用量池（标价 $0.048/1K characters；对标 deepsearch「能力 + 用量」权益模型）。
- **登录**：对标 deepsearch——`next-auth` v5 + Google、`/auth/signin`、SessionProvider、用户写入 `users` 表。
- **付费**：对标 deepsearch——Stripe Checkout / Customer Portal / Webhook、`orders`、套餐 Free/Go/Plus/Pro（或精简档）、`/pricing` 权益 bullets、设置内账单/用量 Tab、`NEXT_PUBLIC_BILLING_ENABLED` 开关。
- 营销文案与 SEO 从 PhotoMaker 重塑为 Read to Me TTS；保留 `en`/`zh` 与 Workers 部署路径。

## Capabilities

### New Capabilities

- `tts-player`：核心在线朗读器（音色、语速、播放控制、跟读高亮、TTSReader 式工作区构图）。
- `document-ingest`：粘贴编辑器与客户端多格式上传。
- `reading-persistence`：本地（及后续可扩展账号）阅读状态持久化。
- `product-shell`：落地页壳与重塑营销；Hero 内嵌朗读器（对标 deepsearch Landing 模式）；移除 PhotoMaker。
- `user-auth`：Google 登录、会话、受保护计费 API（对标 deepsearch `lib/auth`）。
- `plan-billing`：Stripe 套餐/订单/Webhook/周期；TTS 能力与用量权益 enforcement（对标 deepsearch `pay-usage`，计量适配朗读）。
- `billing-ui`：`/pricing` 套餐卡 + 设置内用量/账单（对标 deepsearch billing UI 原则）。

### Modified Capabilities

- （无——`openspec/specs/` 下尚无既有主规格）

## Impact

- **删除/重写**：PhotoMaker 相关 UI/API/Gradio 依赖。
- **依赖**：新增 `next-auth`、`stripe`、`drizzle-orm` + Cloudflare D1；云端 TTS 仅需 `ATLASCLOUD_API_KEY`（HTTP 调用 Atlas，无额外 SDK 硬性要求）。移除 `@gradio/client`。
- **可复用参考路径**：`deepsearch/lib/auth/**`、`deepsearch/lib/billing/**`、`deepsearch/app/api/checkout`、`stripe/webhook`、`deepsearch/components/sections/Hero.tsx`、`LandingChat` 交互模式（改为 `LandingReader`）。
- **UI**：Hero 内朗读器；定价页；登录页；导航登录/账户入口。
- **托管**：Cloudflare Workers + OpenNext；Webhook 与 DB 需在 Worker 上可用（与 deepsearch 相同约束）。
- **明确延后**：Chrome 扩展、完整 MP3 工作室、多音色对白编辑器、移动 App、账号级跨设备文档库（首期可只做登录门控付费音色）。
