## Context

动机见 `proposal.md`。实现栈与 **deepsearch** 对齐：Next.js 14 App Router、next-intl、OpenNext → Cloudflare Workers、NextAuth（Google）、Stripe 订阅、Drizzle + Cloudflare D1。

参考仓库：`/Users/xuandu/mywsp/deepsearch`  
参考体验：[TTSReader](https://ttsreader.com/) 播放器构图（`references/ttsreader-player-ui.png`）。

## Goals / Non-Goals

**目标：**
- Hero 内嵌 TTS 朗读器（对标 deepsearch `Hero` + `LandingChat`，首屏即用产品）。
- 免费 Web Speech + 付费云端 AI 音色（登录 + Stripe）。
- 购买页讲权益、用量/账单页讲数字与订单（对标 deepsearch `pay-usage` 原则，不向用户暴露 credits）。
- 移除 PhotoMaker；保留 Workers 与 `en`/`zh`。

**非目标：**
- 像素级复刻 TTSReader / deepsearch 视觉。
- ChatGPT 级多模型聊天用量双池；本产品计量为 **TTS 字符（或分钟）**，非聊天 token。
- 首期不做扩展、离线 App、完整 audiobook 工作室。

## Decisions

### 1. 落地页：deepsearch Landing 模式
- **选择：** `Hero` 含标题区 + **内嵌 `LandingReader`**；下方营销段（Benefits、Features、HowItWorks、FAQ、CTA）保留并改写为 TTS。
- **理由：** 与 deepsearch 已验证转化路径一致——首屏即用产品。
- **不收起营销头：** deepsearch 收起标题是因为对话会不断变长，需要腾出纵向空间；朗读器高度固定，收起换不来工作区，只会在播放瞬间让整页跳一次。标题保持原位。
- **备选：** 仅营销 + 独立 `/player`（多一次跳转）。

### 2. 播放器构图：TTSReader
- 见既有决策：文档卡 + 浮动播放条 + 右侧 Playback；不做左侧全应用导航栏。

### 3. 语音引擎分层：浏览器 + 双云端引擎
竞品在同价位包含的高级字符量是我们的十几倍（TTSReader $10.99 含 1M 字符/月，我们单靠 MiniMax 在 $9 只能给 ~75k），差距来自单价而非定价策略。因此云端不用单一引擎，按「走量」与「表现力」拆两档。

- **Basic（免费、可匿名）：** `speechSynthesis` 浏览器音色，无限、零成本、零服务端往返。
- **Natural（付费主力）：** Atlas Cloud [xAI TTS v1](https://www.atlascloud.ai/zh/models/xai/tts-v1)，`xai/tts-v1`，**$0.015 / 1K 字符（无折扣，即标价）**，承担长文与整本书的日常朗读。
  - 80+ 音色 / 20 语言，其中 `ara`/`eve`/`leo`/`rex`/`sal` 为多语言音色，中文可直接用；`language: auto` 自动识别。
  - 单请求 ≤ **15,000** 字符；`speed` 仅 0.7–1.5（比 MiniMax 窄），所以倍速一律走客户端 `playbackRate`，正好与 3.2 的缓存 key 设计一致。
  - 附带能力：14 个 inline 速度/停顿/笑声标签 + 13 个包裹式风格标签；约 1 分钟参考音频即可免费克隆音色（后续功能储备）。
- **Expressive（付费差异化）：** Atlas Cloud [MiniMax Speech 2.6 Turbo](https://www.atlascloud.ai/zh/models/minimax/speech-2.6-turbo)，**$0.048 / 1K 字符**，保留 `emotion`/`pitch`/`language_boost` 等表现力参数；与 Natural 共用一份额度，按 3 倍扣，不承担走量。
  - Model `minimax/speech-2.6-turbo`；`ATLASCLOUD_API_KEY` 仅 Worker 服务端持有。
  - 单请求 ≤ 10,000 字符；音色参数名是 `voice`（xAI 是 `voice_id`），适配层需归一化。
- **两个引擎同厂同 key 同端点：** 均为 `POST /api/v1/model/generateAudio` 提交 + 轮询 `GET .../prediction/{id}`，所以一套 adapter 覆盖两者，只有 payload 字段不同；不引入第二个供应商与第二把密钥。
- **已排除：** `google/gemini-2.5-flash-tts`（$0.04/1K）返回 **WAV**，31 秒音频 1.5MB，且实测最慢（17–18s），不适合边听边取；Murf Falcon 名义 $0.01/1K 更便宜，但需第二个厂商与密钥，省下的钱在 Plus 档只有约 $1.5/月，留作后续成本优化。
- **定价风险：** MiniMax 的 $0.048 是 **-20% 折扣价（原价 $0.06）**，折扣到期 COGS 涨 25%；xAI 的 $0.015 无折扣，更适合承担走量。

- **理由：** 单一 MiniMax 迫使我们在「额度寒酸」与「毛利极薄」之间二选一；拆开后 $9 档包含量进入买家预期区间，MiniMax 也从成本天花板变回差异点。
- **备选：** 只用 MiniMax（同价位额度比 TTSReader 少一个数量级，不采用）；学 Speechify 完全不公开额度、纯按能力分层（与已定的月度时长额度口径冲突，不采用）。

#### 3.1 抽象边界：音色目录驱动，客户端不选引擎
- `lib/tts/voices.ts` 是唯一目录（`{ id, engine, providerVoice, lang, name, minPlan }`）。UI 分组、权益校验、扣哪个池、路由到哪个 adapter **全部由 voiceId 推导**；请求体里没有 engine 字段，客户端无法绕过权益。
- 客户端两种播放实现共用一个接口（`play/pause/resume/stop/onSegmentEnd`）：`BrowserEngine` 包 `SpeechSynthesisUtterance`；`CloudEngine` 包 `<audio>` + `/api/tts/speak`。播放器状态机只认接口，不认引擎。
- 服务端两个 adapter 共用 `CloudTtsAdapter`（`pricePer1kChars`、`maxCharsPerRequest`、`synthesize()`）；换供应商只新增一个文件加一批目录项。

#### 3.2 成本控制（双引擎成立的前提）
- **R2 内容寻址缓存：** key = `sha256(归一化文本 + voiceId + format)`，**刻意不含 speed/volume**——倍速由 `<audio>.playbackRate` 在客户端实现，于是同一句在任何倍速下共用一份音频。按句段缓存而非整篇，改一句只失效一句。
- **缓存命中不计量：** 命中不产生供应商成本就不扣池。重听、回放、多人读同一篇公开文章都免费，这同时是可写进定价页的用户利益。
- **预取窗口 2–3 句：** 播放时绝不整篇合成。听 30 秒就放弃的用户只该花掉 30 秒的钱。
- **先占后扣：** 调供应商前用单条原子语句占额度（`UPDATE ... SET used = used + $1 WHERE used + $1 <= quota RETURNING used`），成功后按实际字符结算，失败则释放。并发预取击不穿上限，也避开读-改-写竞态。
- **降级阶梯而非报错：** Expressive 超限就地提示切 Natural，Natural 超限切浏览器音色继续播。任何时候都不让朗读断掉。

#### 3.3 字符与时长的实测换算（关键，此前的假设是错的）
同一段文本实测（`scripts/tts-bakeoff.mjs`，2026-09-18）：

| 语言 | 字符数 | 音频时长 | 字符/分钟 | Natural 成本/小时 | Expressive 成本/小时 |
|------|-------|---------|----------|-----------------|-------------------|
| 英文 | 527 | 31.0s | **1020** | $0.92 | $2.94 |
| 中文 | 153 | 30.1s | **305** | $0.27 | $0.88 |

- 中文每个字符承载的信息量是英文的 3.3 倍，所以**按字符计费时中文每小时只要英文的三分之一成本**。
- 交叉验证：ElevenLabs 把 121k credits（1 字符 = 1 credit）标为「≈121 分钟」，即 1000 字符/分钟，与我们实测的英文 1020 几乎一致。这个换算率是行业共识，可以放心用。

**单位决策：三层分开，不要混用同一个数字。**

| 层 | 单位 | 理由 |
|----|------|------|
| 成本记账 | 字符 | 供应商只按字符收费，对账必须同口径 |
| 权益扣减 | 分钟（= 字符 ÷ 该语言实测速率） | 「4 小时」在任何语言下都是 4 小时，口径不随语言漂移 |
| 页面展示 | 小时 | 阅读器用户想的是时间，不是字符 |

- 卖分钟而不是卖字符，是因为我们实测中文 305 / 英文 1020：若卖字符，中文用户同价能多听 3.3 倍，口径任意且没法解释；卖分钟则把**英文当成最坏情况来定价**，中文用户反而让我们的实际 COGS 降到三分之一。
- 竞品也没有一家对外只讲字符：ElevenLabs 对比表首行是 "Minutes included" 并给出 "Extra minute" 单价（$0.36 → $0.17 随档位递减）；NaturalReader 免费档讲「5 分钟/天」、付费档才讲「50 万字符/天」；只有 TTSReader 全程字符口径，而它也是四家里最偏工具/API 的。

#### 3.3.1 套餐定稿
按英文最坏情况折算的每分钟成本：**Natural $0.0153/分钟（$0.918/小时）**、**Expressive $0.0490/分钟（$2.94/小时）**。对外只卖一份 **AI 时长**（Natural 等价分钟）；Expressive 按 **3×** 扣同一池。试听仍按实际收听 1:1，不乘 3。

| 档位 | 月付 | 年付（折算/月） | AI 时长 | 其他权益 |
|------|------|---------------|---------|---------|
| Free | $0 | — | 一次性 10 分钟试听（任意音色，1:1） | 浏览器音色无限 |
| Plus | $9 | $84（$7） | 8 小时/月 | 浏览器音色无限；可买加油包 |
| Pro | $19 | $180（$15） | 16 小时/月 | 优先队列、可买加油包 |

满额烧尽按「全花 Natural」与「全花 Expressive」取高：Plus 8h → $7.34 / $7.84；Pro 16h → $14.69 / $15.68。

| 档位 | 计费周期 | 满额 COGS（上限） | Stripe | 满额毛利 | 预估用量（21.5%）下毛利 |
|------|---------|----------------|--------|---------|---------------------|
| Plus | 月付 $9 | $7.84 | $0.56 | **+$0.60** | $6.75 / 75% |
| Plus | 年付 $84 | $7.84 | $0.23/月 | **−$1.07** | $5.08 / 73% |
| Pro | 月付 $19 | $15.68 | $0.85 | **+$2.47** | $14.78 / 78% |
| Pro | 年付 $180 | $15.68 | $0.46/月 | **−$1.14** | $11.17 / 74% |

- **年付用户满额时为小幅亏损，这是有意接受的。** 把整池烧干的人在实际分布里很少；换来的是年付能压低 Stripe 固定费、提高留存并预收现金。若实际用量分布明显偏重，先加日上限而不是砍月额度。
- **一次性 10 分钟试听的成本上限 $0.49/账号**，取决于用户把额度花在哪个引擎与哪种语言：

| | Natural | Expressive |
|---|---------|-----------|
| 英文（1020 字符/分钟） | $0.15 | **$0.49（上限）** |
| 中文（305 字符/分钟） | $0.05 | $0.15 |

  - 每账号一次且需 Google 登录，伪造账号的成本远高于 $0.49，滥用在经济上不成立。
  - 实际远低于上限：多数人只试一段（约 30 秒）就停，不会用满 10 分钟。
  - **落地页示例文本对所有人是同一份，而 R2 缓存是内容寻址、不分用户**——第一个试听的人付费，后来者全是缓存命中。若多数试听发生在示例文本上，这部分成本趋近于「每个音色全局付一次」。
  - 按最坏的 $0.49 计，若试听转付费率 3%，摊到每个付费用户是 $16.3，不到两个月的 Plus 月费即可回收；按更现实的 $0.20 均值则是 $6.7。
  - 参照：TTSReader 只给 5k 字符（约 5 分钟英文）且同样是一次性，我们给的是它的两倍；NaturalReader 给约 5 分钟/天且循环发放，比我们大方得多，但他们跑的是更便宜的音色。
- 价格带定位：年付折算 $7 低于 TTSReader $8.25 与 NaturalReader Plus $9.92，月付 $9 低于 TTSReader $10.99；年付折扣 22%（Plus）/ 21%（Pro），落在竞品 17%–52% 区间内。
- 额度诚实说明：TTSReader $10.99 含 1M 字符/月 ≈ 16 小时英文。Plus 8 小时约合每天 16 分钟，对得上「日常习惯」；Pro 16 小时对齐那条竞品数字。差异点是一份 AI 时长 + Expressive 3× + 重听免费，而不是两套时钟。

#### 3.3.2 加油包（extra）
| 加油包 | 价格 | 全 Natural 成本 | 全 Expressive 成本 | Stripe | 毛利 |
|-------|------|----------------|-------------------|--------|------|
| AI 时长 +10 小时 | $15 | $9.18 | $9.80 | $0.74 | $4.46–$5.08 / 30–34% |

- **规则（抄 TTSReader 的顺序）：** Plus 与 Pro 均可买；**套餐额度用尽后才消耗**加油包；多个加油包按购买时间先旧后新消耗；自购买起 **12 个月**有效，订阅失效期间不可用。
- **一种货币。** 加油包写入同一 `cloud` 池（Natural 等价秒）。Expressive 仍按 3× 扣；剩余额度不够 3× 时就地降到 Natural，再不够降到浏览器音色。
- **定价与 Plus 同费率（$1.50/小时 Natural 等价），不做惩罚性溢价。** 加油包是溢出阀门而不是利润中心：ElevenLabs 的超额分钟要 $0.18–0.36/分钟（$10.8–21.6/小时），那是面向创作者的口径；TTSReader 的积分折算约 $1.84–3.06/小时，更接近阅读器场景。升级 Pro 的理由留在更多小时与优先队列，而不是靠罚超额的用户。

#### 3.4 延迟实测与分块策略
Atlas 两个模型都是异步提交 + 轮询，实测（xAI，`optimize_streaming_latency: 2`）呈「固定开销 + 线性吞吐」：

| 文本 | 字符 | 提交到完成 |
|------|-----|-----------|
| 单句 | 31 | 2.86s |
| 单句 | 86 | 2.73s |
| 单句 | 53 | 3.28s |
| 三句合并 | 172 | 5.63s |
| 整段 | 527 | 10.8s |

约 **2.5s 固定开销 + 每字符 16ms**。由此三条硬结论：

- **必须按音频时长分块，不能按句。** 31 字符的句子要 2.8s 合成却只产出约 1.9s 音频，合成追不上播放；而 300 字符的块产出约 18s 音频只需约 7s，是 2.5 倍实时速度。所以把句子聚合成 **200–400 字符**的块，块内保留句边界用于高亮。
- **重复提交同一段文本耗时不变（2.82s vs 2.86s），供应商侧没有去重缓存。** 所以 3.2 的 R2 缓存不只是省钱，它是唯一能把重听做成「瞬时播放」的手段。
- **首块无法瞬时。** 用户按下播放到出声约 2.7–3.3s，需要明确的「准备中」状态；并在用户**选中云端音色的那一刻**就预取第 1 块，把这段延迟藏进他浏览页面的时间里，代价仅一块。
- Worker 不阻塞等供应商：`/api/tts/speak` 要么返回 `{audioUrl}`（缓存命中或同步引擎），要么返回 `{taskId}` 交客户端轮询 `/api/tts/task/{id}`，避免长轮询吃满请求时长。
- 跟读高亮：浏览器有 `onboundary`，词级免费；云端首期句级，之后按音频时长对句内字符做比例插值（零额外成本），不依赖供应商时间戳。

### 4. 登录：对标 deepsearch NextAuth
- **选择：** 复用/移植 `lib/auth` 模式——`next-auth@5`、GoogleProvider、`pages.signIn = '/auth/signin'`、`handleSignInUser` 写 `users`、`AuthSessionProvider`、`isAuthEnabled()`。
- **环境变量：** `AUTH_SECRET`、`AUTH_GOOGLE_ID/SECRET`、`AUTH_TRUST_HOST` 等（同 deepsearch `.env.example` 口径）。
- **备选：** Clerk（偏离参考栈，不采用）。

### 5. 付费：对标 deepsearch Stripe + 简化套餐
- **选择：** 移植架构：`/api/checkout`、`/api/stripe/webhook`（`checkout.session.completed`、`invoice.paid`、`customer.subscription.*`）、`/api/billing/portal`、`orders` 表、Customer Portal 管理订阅。
- **套餐与加油包定稿见 3.3.1 / 3.3.2；Stripe product_id 口径：**

| 商品 | product_id |
|------|-----------|
| Plus 月付 / 年付 | `readtome-plus-monthly` / `readtome-plus-yearly` |
| Pro 月付 / 年付 | `readtome-pro-monthly` / `readtome-pro-yearly` |
| AI 时长 +10 小时 | `readtome-pack-10h`（旧 id `readtome-pack-natural-10h` / `readtome-pack-expressive-1h` 仍入同一池） |

- 订阅走 Stripe Subscription，加油包走一次性 Payment（非订阅），两者都落 `orders` 表并由 webhook 同步。

#### 5.1 计费模型：订阅先行，按量只作溢出
消费级朗读器没有一家做纯按量——纯按量只出现在开发者/API 场景（TTSReader 的 PAYG 档自己写着 "perfect for API users"，Murf 的按量是 API 定价）。原因很直接：按量会让用户为了省钱而停止收听，而这个产品的全部价值就建立在「养成收听习惯」上。

- **选择：** 只卖订阅，加油包作为溢出阀门（规则与定价见 3.3.2）。首发不做面向未订阅用户的纯按量入口。
- **套餐额度不结转，加油包 12 个月有效：** ElevenLabs 允许结转 2 个月、余额上限 3× 月额度，降级或取消即作废；TTSReader 积分 1 年到期。都在刻意限制结转负债。我们的月额度直接周期重置（NaturalReader 的每日重置说明用户完全接受重置），只有花钱买的加油包才带 12 个月有效期。
- **年付折算价做卡片主视觉，月付价放小字：** NaturalReader 标 $9.92 而月付实收 $20.90（差 52%），TTSReader $8.25 对 $10.99，ElevenLabs 年付等于付 10 个月。四家的卡片主数字都是年付折算。
- **展示原则（照搬 deepsearch）：** `/pricing` 只 bullets + 价格 + CTA；设置·用量显示比例与明细；设置·账单显示方案与订单。不暴露 credits——我们对外的单位是小时，credits 这层抽象只有多产品共用一个池时才有必要（ElevenLabs 那样 TTS/STT/音乐/配音共用），我们没有这个问题。
- **开关：** `NEXT_PUBLIC_BILLING_ENABLED`；未配置时可整站 Free Web Speech。
- **备选：** Lemon Squeezy / Polar（偏离参考，不采用）。

### 6. 数据层
- **选择：** Drizzle + Cloudflare D1（SQLite）。表是 `users` / `orders` / `usage` / `packs`；列名与 deepsearch 对齐，类型改成 SQLite（`text` UUID、`integer` 毫秒时间戳）。额度仍用单条 `UPDATE … WHERE used + n <= quota` 占位。新用户登录写入一行 `usage`（`period_start = 0`，10 分钟试听，不换期）。
- **理由：** 应用已经在 Workers + R2 上，D1 是同平台 binding，登录/订单/额度都是按用户的小行，不必再外挂 Postgres。独立于 deepsearch 的库。
- **不采用：** 与 deepsearch 共用 Postgres（跨产品耦合，且 Worker 上要 Hyperdrive/Neon）。

### 7. 移除 PhotoMaker
- 同前：直接删除，不做 flag。

## Risks / Trade-offs

- [Atlas 异步合成延迟 vs 即时 Web Speech] → 实测约 2.5s 固定开销 + 每字符 16ms，首块出声 2.7–3.3s；按 200–400 字符成块使合成跑到 2.5 倍实时，配「准备中」状态与选中音色即预取第 1 块（详见 3.4）。
- [云端 TTS 成本与滥用] → 登录门控 + 单池 AI 时长（Expressive 3×）+ R2 缓存命中不计量 + 预取窗口 2–3 块 + 先占后扣；超限降级而非报错。
- [xAI Natural 音质不达标] → 盲评页 `prototypes/bakeoff/index.html` 已生成（xAI / Gemini / MiniMax / ElevenLabs 四路中英文对照），**听后定稿**；若 xAI 不可用则退到 MiniMax Turbo 单引擎，Plus 的 Natural 池须从 4 小时压到约 1.2 小时。
- [MiniMax 在 Atlas 上没有中文预置音色] → 仅 15 个 `English_*` 音色，中文靠 `language_boost: Chinese` 驱动英文音色，效果待盲评确认；若中文表现差，zh locale 的 Expressive 档需改用 xAI 多语言音色或暂不开放。
- [单一供应商依赖 Atlas] → 两引擎同厂降低了集成成本但集中了风险；adapter 层统一超时/重试，任一云端不可用时降级到浏览器音色，核心朗读不依赖任何云端。
- [Worker 上 Stripe webhook / DB / 长轮询] → 密钥 `wrangler secret put ATLASCLOUD_API_KEY`；轮询设超时与退避；照 deepsearch 路径部署。
- [三类音色的 UX 不一致] → 音色列表按 Basic（浏览器）/ Natural / Expressive 三区呈现；定价与用量只展示一份 AI 时长，Expressive 用 3× 说明，不再标两套时钟。
- [从「匿名无限」到「登录付费」转化摩擦] → Free 永远可用浏览器音色；Premium 点击才引导登录。
- [移植 deepsearch 代码过重] → 先抽 auth + checkout/webhook + 精简套餐，不做聊天双池与图片张数逻辑。

## Migration Plan

1. 落地朗读器 + 移除 PhotoMaker（可先无登录）。
2. 接入 NextAuth + users；导航登录态。
3. 接入 Stripe + pricing + webhook；实现双引擎代理路由、R2 缓存与单池（Natural 等价分钟，Expressive 3×）用量 enforcement。
4. `BILLING_ENABLED=false` 可回滚到仅 Free Web Speech。

## Open Questions

- ~~套餐档位数与额度~~ → 已定稿为 Free / Plus / Pro 三档 + 一份 AI 时长加油包，见 3.3.1 与 3.3.2。
- ~~计量单位~~ → 已定稿：成本记账用字符、权益扣减用分钟、展示用小时，见 3.3。
- **xAI 与 MiniMax 的中英文音质排序**：`prototypes/bakeoff/index.html` 已生成，待人工试听后确认 Natural 用 xAI、以及中文是否开放 Expressive。这是唯一还挡着 `/pricing` 落地的问题。
- ~~是否与 deepsearch 共用同一 Postgres~~ → 否：Read to Me 用独立 D1；Stripe 仍独立 product_id 前缀。
- 是否与 deepsearch **共用同一 Stripe 账号**，或 Read to Me 独立 product_id 前缀（默认：**独立 product_id**，架构代码同源）。
- Premium 播放跟读：首期块级高亮是否足够，是否需按句与音频时间轴精细对齐。