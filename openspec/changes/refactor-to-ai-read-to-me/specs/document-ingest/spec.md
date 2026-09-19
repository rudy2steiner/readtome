## Purpose

定义文本进入朗读器的方式——在编辑器中粘贴，或在浏览器本地解析常见文档后载入——文件不上传到服务器。

## ADDED Requirements

### Requirement: 可粘贴的纯文本编辑器
系统 SHALL 提供文本编辑器，用户粘贴或键入的内容成为 TTS 播放器的活动文档。

#### Scenario: 粘贴文本成为活动文档
- **WHEN** 用户在编辑器中粘贴或键入文本
- **THEN** 该文本 SHALL 成为可供播放的活动文档

### Requirement: 客户端多格式上传
系统 SHALL 在浏览器内接受并解析常见文档，将其可读文本载入编辑器作为活动文档。支持的类型包括 `.txt`、`.md`、`.html`、`.htm`、`.rtf`、`.csv`、`.tsv`、`.docx`、`.odt`、`.pdf`、`.epub`。解析 MUST 在客户端完成，MUST NOT 把文件发到服务器。

#### Scenario: 成功上传文本文档
- **WHEN** 用户上传有效的 UTF-8（或浏览器可解码）`.txt`、`.md`、`.html`、`.rtf`、`.csv` 或 `.tsv` 文件
- **THEN** 系统 SHALL 用提取的文本替换编辑器内容，并将其设为活动文档

#### Scenario: 成功上传富文档
- **WHEN** 用户上传可提取文本的 `.docx`、`.odt`、`.pdf` 或 `.epub`
- **THEN** 系统 SHALL 在浏览器内解析并载入可读文本，且 MUST NOT 将文件上传到服务器

#### Scenario: 扫描版 PDF 在浏览器内识别
- **WHEN** 用户上传没有文字层、仅含页面图像的 PDF
- **THEN** 系统 SHALL 在浏览器内对页面做文字识别，逐步载入已识别文本，且 MUST NOT 把文件发到服务器

#### Scenario: 拒绝旧版 .doc
- **WHEN** 用户上传 `.doc`（非 `.docx`）
- **THEN** 系统 SHALL 拒绝上传、提示另存为 `.docx`，且 MUST NOT 更改当前文档

#### Scenario: 拒绝不支持的文件类型
- **WHEN** 用户上传不在支持列表中的文件类型
- **THEN** 系统 SHALL 拒绝上传并显示错误，且 MUST NOT 更改当前文档

#### Scenario: 拒绝空文件或过大文件
- **WHEN** 用户上传超过 15 MB 的文件，或解析后没有可读文本
- **THEN** 系统 SHALL 拒绝载入并显示错误，且 MUST NOT 更改当前文档

### Requirement: 清空文档
系统 SHALL 允许用户清空编辑器中的活动文档文本。

#### Scenario: 清空后编辑器为空
- **WHEN** 用户在非空文档上触发清空
- **THEN** 编辑器 SHALL 变为空；若当时正在播放，播放 SHALL 停止
