# @local/dsh-turn-chime

宿主端「回合结束提示音」插件：每当 DSH 结束一轮任务（Agent 的 turn 关停）时，在这台机器的
扬声器上播放提示音。

## 为什么做成宿主插件

- Harness 客户端没有「回合结束」事件，宿主端有：`agent/turn-stopping`（回合即将关闭）与
  `agent/status`（`running` ⇄ `idle`）。
- 在宿主端播放，浏览器页面关闭、切到后台、或者你走开时都听得见。

## 音频格式

提示音必须是 **WAV**。本机可用且实测出声的播放通道只有 `System.Media.SoundPlayer`：

- Windows 11 25H2（build 26200）已弃用旧版 WMP/WPF 媒体栈 → `System.Windows.Media.MediaPlayer`
  解码 MP3 失败（`0xC00D11D2`），`WMPlayer.OCX` 停在 Ready 不播放；
- WinRT `Windows.Media.Playback.MediaPlayer` 在无消息泵的进程里不推进；
- 系统未安装 ffmpeg / vlc / mpv，DSH 依赖树里也没有音频解码器。

`notify.wav` 是把配置里指定的 MP3（`universfield-new-notification-032-480570.mp3`，MPEG-1 Layer III，
CBR 256 kbps / 44.1 kHz / 2.351 s）一次性解码后得到的 16-bit PCM WAV（414,764 字节），
因此听到的就是同一个声音。

重新生成 `notify.wav`：把 MP3 交给任意 Chromium 浏览器解码即可
（`tools/make-convert-page.mjs` + `tools/inline-server.mjs` 是本机实际使用的转换链路）。

## 配置（`cordis.patch.yml` 的 `config`）

| 字段 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | `false` 时插件不注册任何监听 |
| `soundPath` | 包内 `notify.wav` | 播放的 WAV 绝对路径 |
| `scriptPath` | 包内 `play.ps1` | 播放脚本 |
| `cooldownMs` | `2500` | 两次提示音之间的最短间隔；一次回合关停会同时发出 `agent/turn-stopping` 与 `agent/status`，用它去重 |
| `includeSubagents` | `false` | `true` 时子代理回合结束也响 |
| `logPath` | `''`（关闭） | 诊断日志路径，每次触发写一行；超过 64 KiB 自动清空 |

## 行为

- 触发：`agent/turn-stopping`；另有 `agent/status` → `idle` 作为兜底（覆盖出错/中断关停），
  由 `cooldownMs` 去重，正常回合只会响一次。
- 子代理（`subagent/start` 公布的子会话）默认不响，避免后台委派任务连续打断。
- 播放：以分离进程启动
  `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File play.ps1 <wav>`，
  立即返回，绝不阻塞回合关停。
