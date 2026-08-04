# 配置与使用

复制 `model-router.config.example.json` 为本机配置并自行填写模型目录。密钥只放在 `apiKeyEnv` 指向的环境变量中，绝不写入配置、Skill 或遥测。

## 模型目录

每个模型项需要 `id`、`provider`、`type`、`model`、`tiers`、`contextTokens`、输入/输出百万 token 价格、`baseUrl` 和 `apiKeyEnv`。支持 `openai-responses`、`anthropic-messages`、`google-generate-content` 和 `openai-compatible`。价格由用户维护；路由器不会猜测价格或可用模型。

DeepSeek 官方 API 使用 `type: "openai-compatible"`、`baseUrl: "https://api.deepseek.com"` 和 `DEEPSEEK_API_KEY`。示例将 `deepseek-v4-flash` 的非思考模式用于 `fast`，思考模式用于 `balanced`，将 `deepseek-v4-pro` 的思考模式用于 `deep`。`thinkingMode` 会传为 `thinking.type`，`reasoningEffort` 会传为 `reasoning_effort`；两者都必须在本项目的定向验证、预算和授权均通过后才可自动执行。不要再配置已退役的 `deepseek-chat` 或 `deepseek-reasoner` 名称。

## 刷新联网证据

`evidenceSources` 接受任意供应商的官方文档、价格页、模型目录、独立测评页或内部评测 API。运行 `node scripts/refresh-model-evidence.mjs model-router.config.json model-router.evidence.json` 可生成带获取时间、HTTP 状态、页面标题、内容类型与 SHA-256 的来源快照。这个通用刷新器只验证来源和新鲜度；需要稳定数值时，为特定来源添加解析器或将内部基准结果写入同一证据 schema，避免依赖脆弱的网页抓取。

## 路由策略与项目记忆

示例配置中的 `routingPolicy` 将成本控制原则变成项目级默认行为：优先确定性工具、生成后验证、仅在失败或证据不足时升级、增量上下文和按任务价值设置预算。网关会把增量上下文与升级规则回传到每个路由步骤；调用方据此提供变更文件摘要、依赖邻居、相关契约和必要源码，而不是默认发送整个仓库。

`projectMemory` 指向本项目的 `memory/architecture.md`、`memory/contracts.md` 和 `memory/decisions.md`。这些文档只保存简短、可复用的结构化结论；不保存密钥、个人数据、完整 prompt 或大段源码。

## HTTP 接口

运行：`node gateway/server.mjs --config path/to/config.json`。

- `POST /v1/route`：创建计划，不调用供应商。
- `POST /v1/route-and-run`：创建计划并执行第一条已授权、非 `tool` 步骤。

请求至少包含 `task`，也可给出 `steps`。步骤可指定 `title`、`tier`、`risk`、`contextTokens`、`input`、`validation` 和 `sideEffects`。

`authorization` 包含 `mode`、`expiresAt`、`providers`、`models`、`maxStepCost`、`maxProjectCost`、`approvedStepIds` 与 `blockedActions`。`per_step` 必须把待执行步骤 ID 放入 `approvedStepIds`；`budget_auto` 和 `full_auto` 必须同时满足全部预算与白名单限制。`publish`、`delete`、`permission`、`security` 永远要求对应步骤 ID 的显式批准。

## 平台边界

Codex 与 Cursor 的规则/Skill 可产生计划、授权请求和验证流程，但不能依靠它们改变正在运行会话的模型。Cursor Custom Modes、DeepSeek 网页/桌面聊天和其他宿主的模型选择器只能做人工快速切换；它们不是可由本 Skill 调用的 API。要自动跨供应商执行，应调用本网关；`per_step` 是半自动（人工批准每步），`budget_auto` 和 `full_auto` 仅在供应商/模型白名单、预算、有效期、能力检查和选择证据都满足时执行。发布、删除、权限和安全操作始终需要逐步显式批准。
