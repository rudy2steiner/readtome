## Purpose

对标 deepsearch 计费 UI 原则：购买页讲权益，用量页讲数字，账单页讲方案与订单。

## ADDED Requirements

### Requirement: 定价页套餐卡
在计费开启时，系统 SHALL 提供定价页，以卡片展示 Free / Plus / Pro 三档价格与简短权益 bullets（每档建议 ≤7 条），并提供升级/订阅 CTA。额度 SHALL 以**小时或分钟**表述，MUST NOT 以字符数或 credits 表述。卡片主价 SHALL 为年付折算的月等价（Plus $7、Pro $15），月付价（$9 / $19）SHALL 以次要字号同时可见。

#### Scenario: 查看定价页
- **WHEN** 访客打开定价页
- **THEN** 页面 SHALL 展示三档的价格与权益要点，且 MUST NOT 向用户展示 credits/积分或字符数术语

#### Scenario: 付费档只呈现一份 AI 时长
- **WHEN** 访客查看付费档卡片
- **THEN** 卡片 SHALL 各标注一个 AI 时长数字（Plus 8 小时、Pro 16 小时），并 SHALL 说明 Expressive 按 3 倍扣；MUST NOT 再分列两套时钟

#### Scenario: 年付与月付切换
- **WHEN** 访客在定价页切换计费周期
- **THEN** 卡片价格 SHALL 随之更新，且年付 SHALL 明示折扣幅度与实际年度收费金额

#### Scenario: 未登录点击付费 CTA
- **WHEN** 未登录用户点击付费档 CTA
- **THEN** 系统 SHALL 引导其登录（或进入登录页），而非静默失败

### Requirement: 用量展示
已登录用户 SHALL 能在设置或等价入口查看本周期云端朗读用量（已用/额度或比例）。用量 SHALL 以**一条** AI 时长进度展示，单位 SHALL 为小时/分钟。

#### Scenario: 查看用量
- **WHEN** 已登录付费（或有额度）用户打开用量视图
- **THEN** 系统 SHALL 显示本周期一份 AI 时长的已用与剩余，以及周期重置日期

#### Scenario: 展示加油包余额
- **WHEN** 用户持有未过期的加油包余额
- **THEN** 用量视图 SHALL 在套餐额度之外单独列出加油包剩余时长与到期时间

### Requirement: 加油包购买入口
加油包入口 SHALL 仅对持有有效付费订阅的用户可见或可用；对其他用户 SHALL 改为引导订阅。

#### Scenario: 订阅用户额度不足
- **WHEN** 已订阅（Plus 或 Pro）用户的本周期额度即将或已经耗尽
- **THEN** 系统 SHALL 提供 +10 小时 AI 时长加油包的购买入口，并明示其为一次性额度、12 个月内有效

#### Scenario: 非订阅用户
- **WHEN** Free 用户尝试进入加油包购买入口
- **THEN** 系统 SHALL 引导其先订阅，且 MUST NOT 创建加油包结账会话

### Requirement: 账单与订单
已登录用户 SHALL 能查看当前方案与订单/订阅概要，并在配置允许时打开 Stripe 门户。

#### Scenario: 查看账单
- **WHEN** 已登录用户打开账单视图
- **THEN** 系统 SHALL 显示当前方案信息；若有订单则展示订单概要

#### Scenario: 未登录看账单
- **WHEN** 未登录用户打开账单视图
- **THEN** 系统 SHALL 提示登录，而非展示他人数据
