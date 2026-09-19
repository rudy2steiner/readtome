## 1. 基础能力（TTS 内核）

- [x] 1.1 新增 `lib/tts/engine.ts` 契约：`SegmentPlayer`（客户端播放，browser 与 cloud 两实现共用）、`CloudTtsAdapter`（服务端供应商）、单价与字符/分钟常量；验证类型可编译且播放器状态机不分支于引擎
- [x] 1.2 句段切分 + **按时长聚合成块**（200–400 字符，块内保留句边界；尊重各引擎单请求上限 xAI 15k / MiniMax 10k）；验证短句被合并、超长块被切分
- [x] 1.3 `lib/tts/voices.ts` 音色目录（`{ id, engine, providerVoice, lang, name, minPlan }`）；验证 voiceId 可推导引擎/池/权益，且请求体不接受客户端指定引擎
- [x] 1.4 Atlas 适配器：一套 `generateAudio` 提交 + prediction 轮询覆盖 `xai/tts-v1` 与 `minimax/speech-2.6-turbo`（归一化 `voice_id`/`voice` 差异），密钥读 `ATLASCLOUD_API_KEY`；验证两个模型均能取回 mp3
- [x] 1.5 R2 内容寻址缓存：key = `sha256(归一化文本 + voiceId + format)` 且**不含 speed/volume**；验证命中时不调供应商、不扣额度，且同一句在不同倍速下共用一份音频
- [x] 1.6 browser 引擎实现（Web Speech + `onboundary` 词级高亮）；验证暂停/续播/停止
- [x] 1.7 新增 `lib/tts/persistence.ts`（localStorage 往返）；验证保存→清空→加载
- [x] 1.8 朗读 store（text、chunkIndex、voiceId、rate、status）+ **预取窗口 2–3 块**与「准备中」状态；验证首块约 3s 出声、播放期间后续块并行预取、放弃播放不会继续合成

## 2. 落地页朗读器（对标 deepsearch Hero + LandingChat）

- [x] 2.1 实现 `LandingReader`：文档卡 + 工具栏 + 浮动播放条 + 右侧 Playback；对照 `references/ttsreader-player-ui.png` 验证桌面构图与移动堆叠
- [x] 2.2 改造 `Hero`：内嵌 `LandingReader`，标题/tagline 在播放期间保持原位；验证首屏可粘贴试听且播放不引起重排
- [x] 2.3 接入客户端多格式上传（TXT/MD/HTML/RTF/CSV/DOCX/ODT/PDF/EPUB）与清空；旧版 `.doc` 拒绝并提示另存为 `.docx`
- [x] 2.4 句段队列、高亮跟读、本地持久化；验证暂停续听与刷新恢复
- [x] 2.5 Hero 云端音色试听条：预生成样片（`scripts/tts-samples.mjs`，en/zh 各一句）+ 进度环播放 + "Get cloud voices with Plus" CTA；验证点播互斥、locale 跟随、样片缺失时整条隐藏

## 3. 产品壳与移除 PhotoMaker

- [x] 3.1 营销段改写为 TTS；更新 en/zh；验证双语文案
- [x] 3.2 修正 metadata，去掉 PhotoMaker 品牌；验证 title/description
- [x] 3.3 删除 PhotoMaker UI/API/Gradio 依赖；`npm run build` 通过且无残留产品代码

## 4. 用户登录（对标 deepsearch `lib/auth`）

- [x] 4.1 移植/接入 NextAuth v5 + Google、`/auth/signin`、`AuthSessionProvider`、`isAuthEnabled`；验证 Google 登录建立会话
- [x] 4.2 Drizzle `users` 表与 `handleSignInUser`；验证登录后写入 uuid/email
- [x] 4.3 导航登录/头像/登出；验证登出后会话失效

## 5. 付费架构（对标 deepsearch Stripe / pay-usage）

- [x] 5.1 接入 Stripe：`checkout`（订阅模式 + 加油包一次性模式）、`webhook`、`portal`、`orders`；product_id 用 `readtome-plus-*` / `readtome-pro-*` / `readtome-pack-*`；验证 Test Mode 两种结账与 webhook 200
- [x] 5.2 单池用量强制（额度见 design 3.3.1）：**按 Natural 等价分钟扣权益（Expressive 3×）、按字符记成本**，调供应商前用单条原子语句先占后扣；验证并发预取不击穿上限、失败释放额度、中英文同额度得到相同可听时长
- [x] 5.3 `/api/tts/speak` 代理：voiceId → 权益校验 → 缓存查询 → 适配器路由 → 记账；异步引擎返回 `taskId` 由 `/api/tts/task/{id}` 轮询；验证 Worker 不长阻塞、Free 用完试听即拦截、密钥缺失报可读错误
- [x] 5.4 降级阶梯：Expressive 超限提示切 Natural、Natural 超限切浏览器音色、云端故障同样降级；验证任何超限或故障下朗读均不中断
- [x] 5.5 一次性 10 分钟试听：每账号一次、可用于任意云端音色、不按周期续发；验证用尽后引导订阅且未登录不可用
- [x] 5.6 加油包：Plus/Pro 可买一种 +10h、套餐额度耗尽后才消耗、先旧后新、12 个月有效、与套餐同一货币；验证上述规则
- [x] 5.7 `/pricing` 套餐卡：三档、每档一个 AI 时长数字、注明 Expressive 3×、主价用年付折算（$7/$15）月付价放小字、无 credits 与字符文案；验证未登录点付费进入登录、周期切换价格更新
- [x] 5.8 设置内用量/账单 Tab（或等价页）：一条 AI 时长已用与剩余、周期重置日、加油包余额与到期时间；验证已登录可见用量与订单，未登录提示登录
- [x] 5.9 `NEXT_PUBLIC_BILLING_ENABLED` 开关；关闭时仅浏览器朗读可用；验证开关行为

## 6. 验收与部署

- [x] 6.1 Chrome 冒烟：落地页粘贴→浏览器播放→登录→（若已配）付费音色/超限提示
- [x] 6.2 `npm run build` + `npm run preview`；确认 Workers 上首页/登录/定价可访问
- [x] 6.3 README 补充 Auth/Stripe/Webhook 配置说明（可精简抄写 deepsearch README 口径）；验证文档可跟做
