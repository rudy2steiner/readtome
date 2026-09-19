## Purpose

将营销与应用壳重塑为 Read to Me TTS：对标 deepsearch 将主产品嵌在 Hero，并移除 PhotoMaker。

## ADDED Requirements

### Requirement: Hero 内嵌朗读器（Landing 模式）
首页 Hero SHALL 在主视觉区嵌入可交互的 TTS 朗读器。Hero 标题区 SHALL 在朗读期间保持可见且位置稳定——朗读器高度本就固定，收起标题换不来工作区，只会让页面在播放瞬间跳动一次。

#### Scenario: 首屏可见朗读器
- **WHEN** 访客打开本地化首页
- **THEN** Hero 区域 SHALL 包含可编辑文本与播放控件，无需先进入其他路由即可开始粘贴与试听

#### Scenario: 播放不改变页面布局
- **WHEN** 用户在 Hero 内的朗读器中开始输入或播放
- **THEN** Hero 标题/tagline SHALL 保持原位，页面 SHALL NOT 因此发生跳动或重排

### Requirement: 首页不以 PhotoMaker 为主工具
首页 MUST NOT 将 PhotoMaker 图片生成作为主要交互工具。

#### Scenario: 不出现 PhotoMaker 控件
- **WHEN** 访客打开首页
- **THEN** 页面 SHALL NOT 展示 PhotoMaker 上传/生成图片控件

### Requirement: 营销文案匹配 TTS
Hero、功能、使用步骤、FAQ、CTA 等 SHALL 描述文字转语音，而非 AI 图片生成。

#### Scenario: Hero 文案为 TTS
- **WHEN** 访客查看 Hero 文案
- **THEN** 标题与描述 SHALL 表达听文本 / 文字转语音

### Requirement: Hero 云端音色试听条
计费开启时，Hero SHALL 提供可点播的云端音色样片，并给出通往定价的入口。样片 MUST 是真实合成的音频，不得以静音或占位文件充数——付费音色是买声音，听不到就没有购买理由。

#### Scenario: 试听云端音色
- **WHEN** 访客点击某个音色样片
- **THEN** 系统 SHALL 播放该音色的真实样片，并 SHALL 停止其他正在播放的样片与朗读器

#### Scenario: 样片语言跟随界面
- **WHEN** 访客将界面语言切换为 `zh`
- **THEN** 样片 SHALL 播放中文句子，展示的引文 SHALL 同为中文

#### Scenario: 样片缺失时不留残骸
- **WHEN** 样片清单加载失败
- **THEN** 整条试听区 SHALL 隐藏，页面 SHALL NOT 出现无法播放的按钮

### Requirement: SEO 元数据匹配 Read to Me
默认标题与描述 SHALL 标识为文字转语音产品，不得以 PhotoMaker 为品牌。

#### Scenario: 默认标题
- **WHEN** 渲染首页或 locale 默认 metadata
- **THEN** 标题/描述 SHALL NOT 以 PhotoMaker 作为产品名

### Requirement: 导航含登录与定价入口
站点导航 SHALL 提供登录/账户入口（鉴权开启时）以及定价页入口（计费开启时），交互模式对标 deepsearch 导航。

#### Scenario: 未登录显示登录
- **WHEN** 鉴权已启用且用户未登录
- **THEN** 导航 SHALL 提供可进入登录页的入口

#### Scenario: 计费开启显示定价
- **WHEN** 计费功能开关为开启
- **THEN** 导航 SHALL 提供通往 `/pricing`（或等价本地化路径）的入口

### Requirement: 保留 en/zh
产品壳 SHALL 继续支持 `en` 与 `zh`。

#### Scenario: 双语首页
- **WHEN** 用户打开 `en` 或 `zh` 首页
- **THEN** 壳层与朗读器 SHALL 使用对应语言文案渲染
