# dsh-turn-chime

DSH（DeepSeek Harness）的**回合结束提示音**插件：每轮任务结束时，在宿主端扬声器播放提示音。

插件本体在 [`bundle/`](./bundle/README.md)，npm 包名 `@local/dsh-turn-chime`，通过 `cordis.patch.yml`
以 bundle 形式装入 DSH profile。

## 仓库结构

```text
bundle/          # 可安装的插件包
  index.js       # 监听 agent/turn-stopping / agent/status 并触发播放
  play.ps1       # 分离进程播放脚本（System.Media.SoundPlayer）
  notify.wav     # 16-bit PCM WAV 提示音
  cordis.patch.yml
tools/           # 本机把 MP3 转成 WAV 用的辅助页面与本地服务器
notify.wav       # 原始提示音副本
```

## 行为要点

- 触发点：`agent/turn-stopping`；`agent/status` → `idle` 作为兜底（覆盖出错/中断关停）。
- 去重：`cooldownMs`（默认 2500）保证正常回合只响一次。
- 子代理回合默认不响（`includeSubagents: false`）。
- 以分离进程播放，立即返回，不阻塞回合关停。

## 配置

见 [`bundle/README.md`](./bundle/README.md) 的「配置」小节：`enabled`、`soundPath`、`scriptPath`、
`cooldownMs`、`includeSubagents`、`logPath`。

## 为什么必须是 WAV

本机可用的播放通道只有 `System.Media.SoundPlayer`：Windows 11 25H2 已弃用旧版 WMP/WPF 媒体栈，
WinRT 播放器在无消息泵的进程里不推进。因此插件只接受 WAV，MP3 需先用 `tools/` 里的链路转换。
