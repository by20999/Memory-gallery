# `docs/` 文档目录

本目录保存项目专题文档，是理解和维护项目的主要入口。

## 文档索引

| 文件 | 内容 |
| --- | --- |
| `project-overview.md` | 项目定位、用户场景、功能边界。 |
| `architecture.md` | 前后端架构、数据流、持久化策略。 |
| `module-map.md` | 根目录、前端、后端模块职责。 |
| `api.md` | HTTP API 文档。 |
| `data-model.md` | JSON 数据结构和一致性规则。 |
| `development-constraints.md` | 开发约束、安全约束、文档约束。 |
| `project-plan.md` | 项目计划。 |
| `progress.md` | 项目进度。 |
| `project-log.md` | 项目建设日志，按日期记录完成内容、决策、验证和后续事项。 |
| `roadmap.md` | 后续方向。 |
| `improvements.md` | 改进清单和技术债。 |
| `deployment-operations.md` | 部署、备份、恢复和运维。 |
| `testing-strategy.md` | 测试建设路线。 |
| `maintenance.md` | 常见维护任务和故障排查。 |

## 维护规则

- API 变化更新 `api.md`。
- 数据字段变化更新 `data-model.md`。
- 目录和模块变化更新 `module-map.md`。
- 部署方式变化更新 `deployment-operations.md`。
- 计划或优先级变化更新 `project-plan.md`、`roadmap.md` 或 `improvements.md`。
- 每轮项目建设、功能新增、UI/交互调整或重要修复都要追加 `project-log.md`。
- 影响架构边界、存储策略、产品定位或长期维护习惯的决策，要同步写入 `../memory/decision-log.md`。
