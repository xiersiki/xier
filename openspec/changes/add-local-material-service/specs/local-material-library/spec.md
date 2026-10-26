# Spec Delta

## Purpose

让桌面用户在明确授权后保存文本资料的本机副本，并离线搜索、阅读及移除。规范内容完整性、容量、重复关系和本地身份分区，确保失败可见、原文件不被更改，且不依赖模型或云服务。

## ADDED Requirements

### Requirement: Import authorized text copies
The system SHALL 仅从用户通过系统选择器选择的普通文件导入 UTF-8 .txt/.md/.markdown 副本，允许 BOM，拒绝空文件、非法 UTF-8 与含 NUL 的文本。导入不得写入、移动或删除原文件。

#### Scenario: Valid text copy
- **WHEN** 用户选择包含中文和 emoji 的合规文件并提交导入
- **THEN** 系统保存原始字节与可搜索正文，确认成功后重开仍可读取，原文件字节保持不变

#### Scenario: Invalid or unreadable source
- **WHEN** 文件编码非法、为空、含 NUL、不是普通文件或读取失败
- **THEN** 对应文件显示明确失败原因，其他合规文件可继续，失败项不产生可见资料

#### Scenario: Source visibly changes during read
- **WHEN** 同一源文件读取前后的文件大小、修改时间或文件身份比较检测到变化
- **THEN** 该项显示源文件变化并要求重新选择，不提交该次读取内容

### Requirement: Enforce import and library limits
The system SHALL 限制单文件为 2 MiB、每批 100 个且源文件合计 20 MiB；每个身份最多 500 份资料，已保存原始字节最多 100 MiB。重复资料不再次计额；索引占用另计。

#### Scenario: Batch limit exceeded
- **WHEN** 选择数量或预检源文件合计超过批次上限
- **THEN** 提交前解释超限并拒绝创建任务，不静默截断所选文件；选择后检测到文件大小变化时逐项拒绝，实际读取亦不能绕过批次总量

#### Scenario: Library reaches its limit
- **WHEN** 提交某个新资料将超过库容量或文件数量上限
- **THEN** 该项失败且不改变已完成资料，后续重复或仍可容纳的项按各自结果处理

### Requirement: Deduplicate exact source bytes per identity
The system SHALL 在同一身份内对字节完全相同的内容只保存一份资料，返回已有资料标识并保留首次导入的名称；同名而字节不同的资料可并存。

#### Scenario: Repeat identical content
- **WHEN** 用户再次导入同一内容，包括以不同名称选择它
- **THEN** 结果为重复且指向已有资料，数量和容量不增加

#### Scenario: Similar names or separate identities
- **WHEN** 同一身份导入同名但不同内容，或另一个身份导入相同内容
- **THEN** 前者生成独立资料，后者只在自己的分区处理，不显示跨身份重复关系

### Requirement: Search exact normalized substrings
The system SHALL 分别搜索标题及完整正文，查询 trim 后为 1–128 个 Unicode code points，使用 NFC、locale-independent lowercase、再次 NFC 的规范化顺序；查询为连续字面子串，不解释运算符。空查询列出最近资料。

#### Scenario: Chinese short words and literal punctuation
- **WHEN** 用户输入中文一字、二字、三字，英文大小写或含标点的合法查询
- **THEN** 返回规范化后标题或正文包含该完整子串的资料，不因索引分词漏检，也不跨标题与正文拼接制造命中

#### Scenario: Query boundaries
- **WHEN** trim 后查询超过 128 code points
- **THEN** 页面解释上限且不发送该查询；空查询按最近资料处理

#### Scenario: Stable result pages
- **WHEN** 结果超过一页
- **THEN** 每页最多 50 项，按导入时间倒序并以标识稳定排序，继续加载不得重复同一结果

### Requirement: Read bounded inert previews
The system SHALL 提供只读正文预览，每段最多 20,000 code points，支持继续加载、复制选区及复制全文；正文及文件名作为惰性文本显示，不执行原始 HTML 或脚本。

#### Scenario: Long text with embedded markup
- **WHEN** 用户预览包含 HTML/script 文本的长文
- **THEN** 页面以文本显示，按段加载且无脚本执行，复制全文与保存的解码正文一致

### Requirement: Remove only the imported copy
The system SHALL 在用户确认后移除所选本地资料副本及其检索结果，不更改原文件；取消确认不修改数据，历史任务保留当时的逐项结果。

#### Scenario: Confirm or cancel removal
- **WHEN** 用户确认或取消「仅移除此副本」
- **THEN** 确认时后续搜索/预览不再展示该资料，取消时保持原状，两种情况都不删除源文件

### Requirement: Preserve visible storage failures
The system SHALL 只在资料和索引已完成持久提交后确认导入成功；磁盘满、提交失败或数据损坏不得显示为成功或空资料库，且必须保留可核对的错误状态。

#### Scenario: Failure at commit
- **WHEN** 写入或提交因容量、权限或 I/O 失败
- **THEN** 该项不确认成功，无法可靠保存结果时任务显示待核实，重启后通过持久状态核对，不以缓存进度替代提交事实

### Requirement: Keyboard accessible local-only library
The system SHALL 让选择、导入、取消、搜索、预览、复制与移除可通过键盘完成；重要状态有非颜色提示，进度不抢焦点。本期资料不进入云同步或自动发送给模型。

#### Scenario: Keyboard operation and privacy
- **WHEN** 用户离线通过键盘完成一次导入、查询与移除
- **THEN** 操作可完成、焦点顺序可理解，并且没有资料上传或模型请求
