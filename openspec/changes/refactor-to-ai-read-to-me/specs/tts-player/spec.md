## Purpose

提供核心在线文字转语音朗读体验：选择音色、控制播放，并在朗读时跟随高亮当前文本。

## ADDED Requirements

### Requirement: 朗读已粘贴或已载入的文本
系统 SHALL 使用可用的系统/浏览器音色，对当前文档文本进行语音合成，且 MUST NOT 要求用户注册账号。

#### Scenario: 从当前位置开始播放
- **WHEN** 朗读器中有非空文本且用户触发播放
- **THEN** 系统 SHALL 从当前播放位置开始朗读（若无位置则从文档开头）

#### Scenario: 空文本禁止播放
- **WHEN** 朗读器文本为空且用户触发播放
- **THEN** 系统 SHALL NOT 开始朗读，并 SHALL 提示需要先输入文本

### Requirement: 播放控制
系统 SHALL 提供播放、暂停、停止控件，并作用于当前朗读过程。

#### Scenario: 暂停与继续
- **WHEN** 正在朗读且用户触发暂停
- **THEN** 系统 SHALL 暂停语音并保留播放位置，以便稍后播放可从该位置继续

#### Scenario: 停止后重置进度
- **WHEN** 正在朗读或已暂停且用户触发停止
- **THEN** 系统 SHALL 结束语音，并将活动进度重置为当前文档开头（或约定的起始位置）

### Requirement: 音色与语速选择
系统 SHALL 允许用户在可用音色中选择，并在支持范围内调节语速。浏览器音色对匿名与 Free 用户可用；云端 Premium 音色受登录与套餐权益约束（见 `plan-billing`）。

#### Scenario: 播放前更换浏览器音色
- **WHEN** 用户选择一可用浏览器音色并触发播放
- **THEN** 系统 SHALL 使用所选音色朗读

#### Scenario: 调节语速
- **WHEN** 用户将语速设为非默认值并触发播放
- **THEN** 系统 SHALL 以所选语速朗读

#### Scenario: 未授权云端音色引导升级
- **WHEN** 未登录或 Free 用户选择 Premium/云端音色并尝试播放
- **THEN** 系统 SHALL NOT 消耗云端配额成功朗读，并 SHALL 引导登录或查看定价

#### Scenario: Premium 音色来自 MiniMax 预设
- **WHEN** 已授权用户打开 Premium 音色列表
- **THEN** 系统 SHALL 展示基于 Atlas MiniMax Speech 2.6 Turbo 的可选预设音色（如 `English_expressive_narrator` 等可读名称映射）

### Requirement: 跟读高亮
朗读过程中，系统 SHALL 高亮当前正在朗读的句子（或等价片段），并在需要时将其保持在可视区域内。

#### Scenario: 高亮随朗读前进
- **WHEN** 朗读进入新的句子片段
- **THEN** 系统 SHALL 高亮该片段；若片段在编辑器可视区域外，SHALL 滚动使其进入视口

#### Scenario: 停止后清除高亮
- **WHEN** 用户停止播放
- **THEN** 系统 SHALL 清除当前朗读高亮

### Requirement: 朗读工作区布局
朗读器 SHALL 呈现以文档为中心的工作区，包含：(1) 主可编辑文本卡片；(2) 与该卡片关联的浮动播放/暂停控件；(3) 用于语言/语速/音色选择的 Playback 侧栏。构图对标 TTSReader 播放器参考，但 MUST NOT 要求完整多分区应用壳。

#### Scenario: 编辑器与播放控件同时可见
- **WHEN** 用户在首页打开朗读器
- **THEN** 用户 SHALL 看到文本编辑器、文档播放/暂停控件，以及独立播放区域中的音色与语速控制

#### Scenario: 从播放面板选择音色
- **WHEN** 用户打开 Playback 音色列表
- **THEN** 系统 SHALL 列出可用的浏览器/系统音色，并允许将其中之一设为当前音色
