# Model Router Dashboard

本地、只读的 Skill 使用成效仪表盘。它让用户在任务完成后查看：模型路由相对单一模型策略的阶段耗时、API token 等效成本，以及每个项目的可验证收益。当前示例对应 Model Router v0.2.0；实际自动路由前会先执行官方证据刷新与新鲜度检查。

## 打开方式

从 Skill 根目录启动仪表盘服务，然后打开浏览器：

```powershell
node scripts/serve-dashboard.mjs
```

默认地址为 `http://127.0.0.1:8765`；传入端口号可覆盖默认值，例如 `node scripts/serve-dashboard.mjs 9000`。页面默认读取本地 `sample-data.json`；图表库从 jsDelivr 加载 ECharts 5.5.1，项目数据不会上传。

直接双击 `index.html` 使用 `file://` 协议时，浏览器会阻止页面读取 `sample-data.json`；请始终通过本地服务地址打开仪表盘。

## 页面说明

- `总览`：展示使用 Skill 路由相对单一 Fast、Balanced、Deep 模式的阶段耗时；阶段包含模型执行、工具验证、模型切换和授权等待。
- `项目列表`：展示项目名称、范围、使用前后耗时和 API token 等效成本、节省比例、每一步的最小上下文、模型/工具层级和验证状态。
- `EN / 中文`：切换显示语言；也支持 `?lang=en`。
- `选择依据 / 路由偏好`：在第一性原则之后比较 `auto`（默认）、`speed` 和 `quality` 三种受约束偏好；安全/授权、任务能力与验收始终优先于用户偏好。

## 接入真实数据

`sample-data.json` 是模拟数据。真实接入时必须生成同样的顶层结构：

- `strategies`：至少包含四种策略的总耗时、成本和阶段耗时。
- `projects`：每个项目包含 `before`、`after`、`steps`、范围和说明。

页面不会把数据发送到网络。真实指标应来自匿名遥测和项目验收记录，并注明统计窗口、价格快照日期和数据性质。
