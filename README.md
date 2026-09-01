<p align="right">
  <a href="./README.en.md">English</a> | <a href="./README.md"><b>中文</b></a>
</p>

# Agent Helm Extensions

> **让浏览器里的 ChatGPT 连接你的本地开发环境，并提供一个直接管理连接、项目、Agent 和当前工作的浏览器面板。**

**Agent Helm Extensions** 当前提供 **Agent Helm Chrome Extension**。

安装 Extension 后，你仍然使用原来的 ChatGPT。ChatGPT 通过 **Secure MCP** 与本地 Agent Helm 连接，在你授权的项目中完成实际工作；Extension 则提供浏览器里的安装、配置、状态和工作面板。

```text
                    浏览器里的 ChatGPT
                           │
                       Secure MCP
                           │
                           ▼
                       Agent Helm
                    /              \
                   /                \
             授权的本地项目      本地 Coding Agent
                   \                /
                    \              /
                       实际工作

                           ▲
                           │
                  Native Messaging
                           │
               Agent Helm Chrome Extension
                           │
                    浏览器操作面板
```

**项目和实际执行环境在你的电脑上。**

ChatGPT 工作时，Agent Helm 会通过 MCP 返回完成当前任务所需的信息，例如相关文件内容、错误信息、项目状态和命令输出。

本地操作基于你授权的项目和权限执行，并受到 Sandbox 保护。需要的安全保护不可用时，相关操作会被拒绝。

<img width="2166" height="1498" alt="workbench" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## 快速开始

### 推荐：先安装 Chrome Extension

先安装 **Agent Helm Chrome Extension**。

Extension 会检查当前电脑是否已经准备好连接 Agent Helm。

<img width="1988" height="1934" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

如果需要安装本地组件，Extension 会显示 **需要安装**，并提供 **下载安装器**。

按照页面引导完成安装和授权后，Extension 会继续检查连接状态。

完成后回到 ChatGPT，即可开始使用。

### 也可以从命令行开始

```bash
npm install -g agent-helm
agent-helm setup
agent-helm setup chrome
```

如果已经安装并配置过 Agent Helm：

```bash
agent-helm setup chrome
```

常用命令：

```bash
agent-helm start
agent-helm status
agent-helm doctor
agent-helm stop
```

## 浏览器操作面板

Agent Helm Chrome Extension 提供 Popup、Side Panel 和 Work Detail。

### Popup

点击 Chrome 工具栏中的 Agent Helm 图标，可以快速查看当前状态并进行常用控制。

如果当前环境还没有准备好，也会从这里提供安装和配置引导。

<img width="774" height="828" alt="chrome-plugin" src="https://github.com/user-attachments/assets/dec8f2ad-e632-444e-8290-4688e691cb23" />

### Side Panel

**Side Panel 是 Agent Helm 在浏览器里的主要操作面板。**

你可以在这里：

- 查看和调整本地连接状态
- 管理当前可用的能力
- 管理本地 Coding Agent
- 完成需要的连接配置
- 选择本地项目
- 添加新的本地项目
- 查看当前 ChatGPT Conversation 对应的工作
- 在不同工作之间切换
- 进入具体的工作详情

<img width="786" height="1634" alt="chrome-panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

### Work Detail

Work Detail 展示一项工作的具体内容。

你可以查看：

- ChatGPT 已经完成的工作
- 本地 Agent 的执行
- 活动记录
- 关联的 ChatGPT Conversation
- 使用的项目 / Worktree

<img width="2044" height="1516" alt="details" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

## ChatGPT Conversation 与本地工作

当当前标签页打开的是 `chatgpt.com` Conversation 时，Extension 可以识别当前 Conversation，并把它与对应的本地工作关联起来。

这样，在浏览器面板中可以直接看到当前 Conversation 正在对应哪一项工作，也可以进入相关工作查看后续执行情况。

## Work History

一项工作可能持续较长时间，也可能跨越 ChatGPT 直接处理和本地 Agent 执行。

Agent Helm 会把这些工作记录组织起来。

在 Side Panel 中可以按项目查看这些工作，并重新进入具体的 Work Detail。

你可以看到：

- 工作对应的 ChatGPT Conversation
- 使用的项目 / Worktree
- ChatGPT 已经完成的内容
- 是否使用了本地 Agent
- 对应的 Agent Session
- 最近的执行活动

这样，之前的工作可以重新找到并继续处理。

## 本地项目与 ChatGPT 之间会传递什么

项目文件、Git 状态、工具和命令都以你的本地环境为准。

ChatGPT 通过 Agent Helm 工作时，Agent Helm 会通过 MCP 返回完成当前任务所需要的信息，包括：

- 相关文件内容
- 错误和诊断信息
- 项目状态
- Git 信息
- 命令输出
- 完成当前任务需要的其他内容

Chrome Extension 主要负责浏览器里的安装、配置、状态展示和工作操作界面。

## 安全边界

本地文件访问、命令执行和 Coding Agent 使用都遵循 Agent Helm 当前授权项目的工作范围和权限限制。

在支持的环境中，本地命令运行在 Sandbox 中，对文件、命令、环境变量和网络等本地资源的访问进行限制。

需要的安全保护不可用时，相关操作会被拒绝。

Agent Helm 的完整说明见：

[**Agent Helm**](https://github.com/BeforeWave/agent-helm)

## 浏览器权限

Agent Helm Chrome Extension 只申请产品功能需要的浏览器权限。

正式版本当前使用：

- Native Messaging，用于连接本地 Agent Helm
- Side Panel，用于浏览器操作面板
- Storage，用于 Extension 本地状态
- Notifications，用于工作状态通知
- Alarms，用于必要的后台状态更新

下载权限只在需要下载 Agent Helm Installer 时按需申请。

对 `chatgpt.com` 的访问用于识别当前 ChatGPT Conversation，并将它与对应的本地工作关联。

## 相关项目

| 项目 | 用途 | 链接 |
| --- | --- | --- |
| **Agent Helm** | 让 ChatGPT 连接本地项目并完成工作 | [Agent Helm](https://github.com/BeforeWave/agent-helm) |
| **DSH with ChatGPT** | 让 ChatGPT 配合 DSH Session 持续执行较大的任务 | [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) |

## 项目状态

Agent Helm Extensions 正在持续开发中。

当前提供 Agent Helm Chrome Extension。
