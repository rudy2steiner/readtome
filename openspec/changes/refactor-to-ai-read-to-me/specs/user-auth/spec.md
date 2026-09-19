## Purpose

提供对标 deepsearch 的用户登录与会话能力，以便门控付费音色与账单相关 API。

## ADDED Requirements

### Requirement: Google 登录
在鉴权启用时，系统 SHALL 支持通过 Google OAuth 登录，并使用 NextAuth 风格的会话机制（对标 deepsearch `lib/auth`）。

#### Scenario: 成功登录
- **WHEN** 用户在登录页完成 Google 授权且服务端配置有效
- **THEN** 系统 SHALL 建立已登录会话，并 SHALL 持久化用户基本资料（至少 uuid、email）

#### Scenario: 鉴权关闭
- **WHEN** 鉴权功能开关为关闭
- **THEN** 系统 SHALL NOT 强制登录即可使用免费浏览器朗读

### Requirement: 登录页
系统 SHALL 提供本地化登录页（路径对标 `/auth/signin`），包含 Google 登录入口。

#### Scenario: 访问登录页
- **WHEN** 未登录用户打开登录页
- **THEN** 页面 SHALL 展示可用的 Google 登录操作

### Requirement: 受保护的计费接口
需要用户身份的计费/结账 API SHALL 在无有效会话时拒绝请求。

#### Scenario: 未登录结账
- **WHEN** 未登录客户端请求创建 Checkout
- **THEN** 系统 SHALL 返回未授权错误且 MUST NOT 创建支付会话

### Requirement: 登出
已登录用户 SHALL 能够登出并清除会话。

#### Scenario: 登出后状态
- **WHEN** 用户执行登出
- **THEN** 后续需要鉴权的请求 SHALL 视为未登录
