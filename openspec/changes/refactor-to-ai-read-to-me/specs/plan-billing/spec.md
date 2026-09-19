## Purpose

对标 deepsearch 的 Stripe 套餐与订单架构，为云端 AI 朗读提供订阅、Webhook 同步与周期用量强制。

## ADDED Requirements

### Requirement: 套餐分层与能力权益
系统 SHALL 定义下列三档，并按此配置价格、周期额度与能力权益：

| 档位 | 月付 | 年付 | AI 时长（Natural 等价） | 能力 |
|------|------|------|------------------------|------|
| Free | $0 | — | 一次性 10 分钟（任意云端音色，1:1） | 浏览器音色无限 |
| Plus | $9 | $84 | 480 分钟/周期 | 浏览器音色无限 + 云端音色 + 可购加油包 |
| Pro | $19 | $180 | 960 分钟/周期 | 同 Plus + 优先队列 |

#### Scenario: Free 仅浏览器音色
- **WHEN** 用户处于 Free（或未登录）且已用完一次性试听额度
- **THEN** 系统 SHALL 允许使用浏览器音色，且 MUST NOT 成功消耗付费云端 TTS 额度

#### Scenario: 付费档可用云端音色
- **WHEN** 用户拥有有效付费订阅且选择已授权的云端音色
- **THEN** 系统 SHALL 允许发起云端朗读（在用量未超限前提下）

### Requirement: 一次性云端试听
已登录的 Free 用户 SHALL 获得**每账号一次**、共 10 分钟的云端试听额度，可用于任意云端音色（含 Expressive）；该额度 MUST NOT 按周期续发。

#### Scenario: 首次试听
- **WHEN** 已登录 Free 用户首次选择云端音色朗读
- **THEN** 系统 SHALL 允许合成并从其一次性额度中扣减实际分钟数

#### Scenario: 试听额度用尽
- **WHEN** Free 用户的一次性额度已用尽且再次请求云端音色
- **THEN** 系统 SHALL 拒绝云端合成、引导订阅，并 SHALL 允许其改用浏览器音色继续朗读

#### Scenario: 未登录不得使用云端音色
- **WHEN** 未登录访客请求云端音色
- **THEN** 系统 SHALL 引导登录，且 MUST NOT 发起云端合成

### Requirement: 用量权益（单池，按 Natural 等价分钟计权益）
付费档 SHALL 维护**一份**按计费周期累计的云端额度，单位为 Natural 等价音频分钟。Natural SHALL 按 1× 扣减；已订阅用户的 Expressive SHALL 按 3× 扣减同一池。Free 试听 MUST 按实际收听 1:1 扣减，MUST NOT 乘 3。成本记账 SHALL 同时记录**字符数**以便与供应商对账，面向用户展示 SHALL 使用小时/分钟而非字符或 credits。

#### Scenario: 未超限可合成
- **WHEN** 已订阅用户请求云端朗读且已用 Natural 等价分钟 + 本次估算 ≤ 周期上限
- **THEN** 系统 SHALL 允许合成并记录同时包含引擎标识、字符数与扣减分钟数的用量事件

#### Scenario: Expressive 按三倍扣
- **WHEN** 已订阅用户请求 1 分钟 Expressive 音频
- **THEN** 系统 SHALL 从共享池扣减 3 分钟

#### Scenario: 同额度在不同语言下时长一致
- **WHEN** 同一档位用户分别朗读中文与英文文档
- **THEN** 两者消耗的分钟数 SHALL 与实际音频时长一致（Expressive 再乘 3），即同一份额度在任何语言下 SHALL 提供相同的可收听时长

#### Scenario: 扣减倍率由音色推导
- **WHEN** 客户端提交合成请求
- **THEN** 系统 SHALL 仅依据 voiceId 在音色目录中的 engine 字段决定 1× 或 3×，且 MUST NOT 接受客户端直接指定引擎或倍率

#### Scenario: 并发请求不得击穿上限
- **WHEN** 同一用户的多个预取请求并发抵达且合计估算超过剩余额度
- **THEN** 系统 SHALL 以原子方式先占额度，使实际消耗 MUST NOT 超过该池上限

#### Scenario: 缓存命中不计量
- **WHEN** 请求的文本与音色命中已有音频缓存
- **THEN** 系统 SHALL 直接返回音频且 MUST NOT 扣减任何额度

#### Scenario: 剩余不够 3× 时降级
- **WHEN** 共享池剩余大于 0 但不足以覆盖本次 Expressive 的 3× 扣减
- **THEN** 系统 SHALL 拒绝该次 Expressive 合成，并 SHALL 提示可改用 Natural 继续朗读

#### Scenario: 云端额度耗尽仍可朗读
- **WHEN** 共享池已达上限且无可用加油包
- **THEN** 产品 SHALL 仍允许用浏览器音色完成朗读

#### Scenario: 周期重置不结转
- **WHEN** 计费周期结束进入新周期
- **THEN** 共享池 SHALL 重置为该档位的完整额度，且上一周期未用完的额度 MUST NOT 结转

### Requirement: 加油包（一次性额度补充）
系统 SHALL 提供一种一次性加油包：AI 时长 +600 分钟（$15）。加油包 MUST 仅对持有有效付费订阅（Plus 或 Pro）的用户出售，SHALL 在套餐池耗尽后才被消耗，且 SHALL 自购买起 12 个月有效。加油包 MUST NOT 作为无订阅用户的独立购买入口。旧 Stripe id `readtome-pack-natural-10h` 与 `readtome-pack-expressive-1h` SHALL 仍写入同一共享池。

#### Scenario: 仅订阅用户可购买
- **WHEN** 无有效付费订阅的用户请求购买加油包
- **THEN** 系统 SHALL 拒绝并引导其先订阅

#### Scenario: Plus 与 Pro 均可购买
- **WHEN** Plus 或 Pro 用户请求购买 `readtome-pack-10h`
- **THEN** 系统 SHALL 允许创建一次性结账会话

#### Scenario: 套餐额度优先消耗
- **WHEN** 用户同时持有未耗尽的套餐额度与加油包余额
- **THEN** 系统 SHALL 先扣减套餐额度，且 MUST NOT 消耗加油包

#### Scenario: 套餐耗尽后启用加油包
- **WHEN** 套餐额度已耗尽且存在未过期的加油包余额
- **THEN** 系统 SHALL 从加油包余额继续放行合成，并按购买时间先旧后新消耗

#### Scenario: 加油包与套餐同一货币
- **WHEN** 用户仅持有加油包余额而请求 Expressive 音色
- **THEN** 系统 SHALL 按 3× 从该余额扣减；余额不够 3× 时 SHALL 降到 Natural

#### Scenario: 加油包过期或订阅失效
- **WHEN** 加油包超过 12 个月有效期，或用户订阅已失效
- **THEN** 该余额 SHALL NOT 可用于云端合成

### Requirement: 双云端引擎经统一服务端适配层
系统 SHALL 支持两个云端引擎——Natural（走量，目标 ≤ $0.01/1K 字符）与 Expressive（Atlas Cloud `minimax/speech-2.6-turbo`，$0.048/1K 字符，见 [模型页](https://www.atlascloud.ai/zh/models/minimax/speech-2.6-turbo)）——并 SHALL 通过同一适配接口暴露给合成路由。任何供应商 API 密钥 MUST 仅存在于服务端；单次请求文本 MUST NOT 超过该引擎上限（MiniMax 为 10,000 字符），更长文档 SHALL 分块合成。

#### Scenario: 授权用户云端合成成功
- **WHEN** 已订阅且未超限用户对不超过上限的文本块请求某云端音色
- **THEN** 系统 SHALL 路由到该音色对应引擎的适配器取得音频，并允许客户端播放

#### Scenario: 异步引擎不阻塞请求
- **WHEN** 所选引擎为异步合成（如 Atlas 提交后需轮询）
- **THEN** 合成路由 SHALL 返回任务标识供客户端轮询，且 MUST NOT 在单个请求内阻塞等待供应商完成

#### Scenario: 引擎故障时降级
- **WHEN** 某云端引擎返回错误或超时
- **THEN** 系统 SHALL 返回可理解错误并 SHALL 允许客户端降级到浏览器音色继续朗读

#### Scenario: 密钥未配置
- **WHEN** 服务端未配置所需引擎的 API 密钥且用户请求该引擎的音色
- **THEN** 系统 SHALL 失败并返回可理解错误，且 MUST NOT 在客户端暴露密钥

### Requirement: Stripe Checkout 与门户
在计费配置完整且用户已登录时，系统 SHALL 支持创建 Stripe Checkout，并支持打开 Customer Portal 管理订阅（对标 deepsearch checkout/portal）。

#### Scenario: 创建结账会话
- **WHEN** 已登录用户对有效 `product_id` 请求结账
- **THEN** 系统 SHALL 返回可跳转的 Stripe Checkout URL

#### Scenario: 订阅与加油包使用不同结账模式
- **WHEN** 请求的 `product_id` 为套餐（`readtome-plus-*` / `readtome-pro-*`）或加油包（`readtome-pack-*`）
- **THEN** 系统 SHALL 分别以订阅模式与一次性支付模式创建 Checkout，且两者 SHALL 均写入 `orders`

#### Scenario: 计费未配置
- **WHEN** 计费或 Stripe 未配置
- **THEN** 结账 API SHALL 失败且不创建订单

### Requirement: Webhook 同步订单
系统 SHALL 处理 Stripe webhook 事件以同步订阅/订单状态（至少覆盖 checkout 完成与订阅变更类事件，对标 deepsearch）。

#### Scenario: 支付成功后权益生效
- **WHEN** 有效 webhook 确认订阅已支付/激活
- **THEN** 该用户后续权益查询 SHALL 反映对应付费档

### Requirement: 功能开关
系统 SHALL 支持通过配置关闭计费；关闭时产品行为退回 Free（浏览器音色）路径。

#### Scenario: 关闭计费开关
- **WHEN** `NEXT_PUBLIC_BILLING_ENABLED`（或等价开关）为 false
- **THEN** 产品 SHALL NOT 依赖付费云端路径即可完成核心浏览器朗读
