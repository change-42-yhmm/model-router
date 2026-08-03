# 配置与使用

复制 `model-router.config.example.json` 为本机配置并自行填写模型目录。密钥只放在 `apiKeyEnv` 指向的环境变量中，绝不写入配置、Skill 或遥测。

## 模型目录

每个模型项需要 `id`、`provider`、`type`、`model`、`tiers`、`contextTokens`、输入/输出百万 token 价格、`baseUrl` 和 `apiKeyEnv`。支持 `openai-responses`、`anthropic-messages`、`google-generate-content` 和 `openai-compatible`。价格由用户维护；路由器不会猜测价格或可用模型。

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

Codex 与 Cursor 的规则/Skill 可产生计划、授权请求和验证流程，但不能依靠它们改变正在运行会话的模型。Cursor Custom Modes 可做人工快速切换。要自动跨供应商执行，应调用本网关。
