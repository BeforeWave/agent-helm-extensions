<p align="right">
  <a href="./README.en.md">English</a> | <a href="./README.md"><b>中文</b></a>
</p>

# Agent Helm Extensions

> **让浏览器里的 ChatGPT 直接进入你的本地开发环境：理解真实代码、操作本地工作区、执行工程任务，而不需要不断复制粘贴文件和日志。**

[**Agent Helm**](https://github.com/BeforeWave/agent-helm) **Extensions** 让浏览器里的 ChatGPT 真正能够在你的本地项目上工作。

安装 **Agent Helm Chrome Extension** 后，你仍然使用原来的 ChatGPT，但它不再只能看到聊天窗口里的内容。

它可以连接到你授权的本地项目，理解项目当前的真实状态，按照你的要求修改项目、完成任务，并继续检查实际结果。

这些本地操作在明确的权限范围和 **Sandbox** 中执行，让 ChatGPT 能真正动手，同时不会获得对整台电脑的无限制访问。

你可以像平时一样描述问题、提出修改要求、讨论方案和 Review 结果；需要更长时间执行的任务，也可以继续交给本地 Agent。

```text
                    浏览器里的 ChatGPT
                           │
                    理解 · 推理 · 工作
                           │
                           ▼
                  Agent Helm Extension
                           │
                    Sandbox Boundary
                           │
                           ▼
                      本地项目
```

<img width="2166" height="1498" alt="workbench" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## 让 ChatGPT 操作真实的本地项目

一个任务可以从 ChatGPT Conversation 开始，但真正的项目始终在你的电脑上。

Agent Helm Extension 把这两边连接起来。

你不需要不断把代码、日志、错误信息和项目背景复制进聊天窗口。ChatGPT 可以直接基于你授权的本地项目理解问题、完成修改，并继续检查实际结果。

对于用户来说，体验很简单：

* 在 ChatGPT 里描述你想做什么
* 让 ChatGPT 理解当前项目
* 让它直接处理修改
* 需要时把更大的任务交给本地 Agent
* 回到同一个 Conversation 继续讨论和 Review

同时，Extension 会把这个 Conversation 和它对应的本地工作关联起来，让你随时知道当前对话背后正在处理的是哪一个项目、哪一项工作。

## 引导式配置

### 推荐：从 Chrome Extension 开始

**Chrome Extension 本身就是安装入口，而不只是所有环境准备完成后的最后一步。**

你可以先安装 Agent Helm Chrome Extension。

Extension 会自动检查当前电脑是否已经具备需要的本地运行环境。

<img width="1988" height="1934" alt="20260831234846" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

如果还没有准备好，Extension 会继续引导你完成 Agent Helm、本地连接和 ChatGPT 连接所需要的安装、配置与授权。

能够自动完成的步骤会直接完成；必须由用户授权或前往外部页面完成的步骤，则会给出明确的下一步操作。

**你不需要先离开浏览器，自己研究整套本地环境应该怎么安装和连接。**

### 也可以从命令行开始

如果你更喜欢 Terminal，也可以直接安装并配置 Agent Helm：

```bash
npm install -g agent-helm
agent-helm setup
agent-helm setup chrome
```

如果已经安装并配置过 Agent Helm，直接进入 Chrome 配置即可：

```bash
agent-helm setup chrome
```

无论从 Extension 还是命令行开始，最终都会进入同一套 Setup 流程。

配置完成后：

```bash
agent-helm start
agent-helm status
```

Agent Helm：

https://github.com/BeforeWave/agent-helm

## 浏览器体验

Agent Helm Chrome Extension 当前提供三个主要界面。

### Popup

点击 Chrome 工具栏中的 Agent Helm 图标，可以快速确认本地连接状态，以及 ChatGPT 当前是否已经可以在本地工作。

<img width="774" height="828" alt="chrome-plugin" src="https://github.com/user-attachments/assets/dec8f2ad-e632-444e-8290-4688e691cb23" />

### Side Panel

Side Panel 是浏览器里的主要工作视图。

你可以查看当前 Workspace 和 Work History，在不同工作之间切换，并看到 ChatGPT 直接完成的工作以及已经交给本地 Agent 的任务。

<img width="786" height="1634" alt="chrome-pannle" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

### Work Detail

Work Detail 用来查看一项工作的完整上下文。

你可以看到 ChatGPT 做过的工作、本地 Agent 的执行、活动记录、关联的 Conversation，以及这项工作对应的 Workspace。

当当前标签页打开的是一个 `chatgpt.com` Conversation 时，Extension 可以识别当前 Conversation，并将它与对应的本地 Work 关联起来。

<img width="2044" height="1516" alt="details" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

## Work History

一次真实的工作，往往不只发生在一条 ChatGPT Conversation 里。

ChatGPT 可能直接完成一部分，也可能把更大的任务交给本地 Agent；你也可能在过程中切换 Workspace、离开 Conversation，之后再回来继续。

Work History 把这些工作重新组织到一起。

你可以随时重新找到：

* 这个 Conversation 对应的是哪一项本地工作
* 使用的是哪个 Workspace / Worktree
* ChatGPT 已经完成了什么
* 是否把任务交给了本地 Agent
* 对应的是哪个 Agent Session
* 离开 Conversation 后又发生了什么
* 一个 Work 关联了哪些 ChatGPT Conversations

Work History 不是另一份聊天记录。

它连接的是：

**Conversation → Workspace → Direct Work → Agent Sessions → 实际工作历史**

这样，一项工作即使持续很久，也不会因为关闭一个标签页或者切换一次 Conversation 就失去上下文。

## 安全地让 ChatGPT 真正动手

让 ChatGPT 操作本地项目，不应该等于把整台电脑交给它。

Agent Helm Extension 只连接你授权的本地工作环境。ChatGPT 能够访问什么、能够在哪里工作，以及本地操作可以做到什么，都受到明确的权限范围限制。

本地执行进一步受到 **Sandbox** 约束。

```text
ChatGPT
   │
   ▼
Chrome Extension
   │
   ▼
Agent Helm
   │
   ├── Authorized Workspace
   ├── Permission Boundary
   └── Sandbox
            │
            ▼
        本地项目
```

这不是简单依赖 Prompt 告诉 ChatGPT“不要访问其他地方”。

真正的限制发生在本地执行层。

> **ChatGPT 可以真正进入项目工作，但它能够访问什么、执行什么，仍然由明确的本地权限和 Sandbox 边界决定。**

完整的本地能力和安全模型由 Agent Helm 提供：

https://github.com/BeforeWave/agent-helm

## 相关项目

这几个项目都可以独立使用，不要求你提前了解整个产品体系。

| 项目                   | 说明                                          | 链接                                             |
| -------------------- | ------------------------------------------- | ---------------------------------------------- |
| **Agent Helm**       | 让 ChatGPT 获得受控的本地工作能力。                      | https://github.com/BeforeWave/agent-helm       |
| **DSH with ChatGPT** | 让 ChatGPT 与 DSH Coding Agent 一起完成更完整的开发工作流。 | https://github.com/BeforeWave/dsh-with-chatgpt |

## 它是如何连接的

Extension 与本地环境之间通过 Chrome Native Messaging 连接：

```
Chrome
  │
  ▼
Agent Helm Extension
  │
  ▼
Chrome Native Messaging
  │
  ▼
Agent Helm
```

ChatGPT 与本地 Agent Helm 之间通过 Secure MCP Tunnel 连接：

```
ChatGPT
  │
  ▼
Secure MCP Tunnel
  │
  ▼
Agent Helm
```

两条连接承担不同职责：

* Extension 负责浏览器里的交互和展示
* Native Messaging 连接浏览器与本地 Agent Helm
* Secure MCP Tunnel 连接 ChatGPT 与本地 Agent Helm
* Agent Helm 负责实际的本地工作与安全边界

对用户来说，这些连接完成以后，仍然是在原来的 ChatGPT 中工作。

## Project Status

Agent Helm Extensions 目前处于积极开发阶段。

当前提供 Agent Helm Chrome Extension。

> **让浏览器里的 ChatGPT 直接进入你的本地开发环境，在真实项目上理解问题、完成工作，同时保持清晰的本地权限和 Sandbox 边界。**
