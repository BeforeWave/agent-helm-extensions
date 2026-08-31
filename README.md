# Agent Helm Extensions

[English](./README.en.md)

> **让你继续在 ChatGPT 里工作，同时看见并管理 Agent Helm 正在本地完成的真实工作。**

**Agent Helm Extensions** 是 [Agent Helm](https://github.com/BeforeWave/agent-helm) 的浏览器与用户界面集成项目。

第一个集成是 **Agent Helm Chrome Extension**。它把你正在使用的 ChatGPT 浏览器体验，与本机运行的 Agent Helm 连接起来。

```text
                    Chrome 中的 ChatGPT
                           │
                           ▼
                  Agent Helm Extension
                           │
                    Native Messaging
                           │
                           ▼
                       Agent Helm
                    /      |      \
              Workspaces   Work   Local Agents
                         History
```

## 让浏览器里的 ChatGPT 看见真实的本地工作

一个任务可以从 ChatGPT 对话开始，但真正的工程工作发生在本地 Workspace 中。

Agent Helm Extension 把这两个上下文连接起来。

你可以在浏览器里看到：

- Agent Helm 连接状态
- 本地 Workspaces
- 当前可用的能力
- 本地 Coding Agents
- Work History
- 关联的 ChatGPT Conversations
- 已委派的 Subagent Sessions

这样，浏览器中的对话不再与实际发生在本地的工作割裂。


## 引导式配置


### 推荐：从 Chrome Extension 开始

**Chrome Extension 本身就是 Agent Helm 的一个安装入口，而不只是安装完成后的最后一步。**

你可以先安装 Agent Helm Chrome Extension。Extension 会检查本机是否已经具备 Agent Helm 运行环境。

如果本机还没有 Agent Helm，Extension 会继续引导你完成需要的安装和配置，包括：

- Agent Helm Core
- 必要的 Node.js runtime
- Chrome Native Messaging 注册
- Serena / Semantic Code Intelligence
- OpenAI tunnel-client
- Secure MCP Tunnel 配置
- ChatGPT Developer Mode / Connector 配置

在支持自动安装的步骤上，Agent Helm 会直接完成安装；需要用户授权或前往外部页面的步骤，则会给出官方入口和明确的下一步操作。

<img width="1988" height="1934" alt="20260831234846" src="https://github.com/user-attachments/assets/e135e681-fc2a-410d-8a05-a77e02be54ba" />
<img width="2132" height="1910" alt="20260831234923" src="https://github.com/user-attachments/assets/609da667-b89f-4b6d-99c8-35bcbcea1dff" />

**你不需要先离开浏览器，自己研究如何把整套本地环境准备好。**

```text
Install Chrome Extension
        │
        ▼
检测本地 Agent Helm
        │
        ├── 已安装 ───────────────┐
        │                         │
        └── 未安装                │
              │                   │
              ▼                   │
       引导安装 Agent Helm         │
              │                   │
              ▼                   │
     引导依赖 / Tunnel / ChatGPT   │
              │                   │
              └───────────────────┘
                        │
                        ▼
                       Ready
```

### 也可以完全从命令行开始

如果你更喜欢 Terminal，可以独立安装并配置 Agent Helm：

```bash
npm install -g agent-helm
agent-helm setup
agent-helm setup chrome
```

### 已经安装并配置过 Agent Helm？

直接进入 Chrome 集成配置即可：

```bash
agent-helm setup chrome
```

两条入口最终进入同一套 Agent Helm Setup 流程。

如果某一步必须跳转到外部页面完成，Agent Helm 会直接提供官方入口和下一步操作，而不是让你自己搜索第三方文档。

当前连接栈中：

- Agent Helm 使用 **OpenAI tunnel-client** 作为默认 Secure MCP Tunnel backend
- 浏览器 Extension 与本地 Agent Helm Core 之间通过 **Chrome Native Messaging** 通信
- 语义代码理解和 sandboxed execution 由 Agent Helm Core 提供

关于当前使用的 Serena、Anthropic Sandbox Runtime、OpenAI tunnel-client 以及完整安全模型，请参阅 [Agent Helm](https://github.com/BeforeWave/agent-helm)。

配置完成后，日常生命周期保持简单：

```bash
agent-helm start
agent-helm status
```

## 浏览器体验

Agent Helm Chrome Extension 当前提供三个主要浏览器界面。

### Popup

点击 Chrome 工具栏中的 Agent Helm 图标，可以快速查看和控制：

- Agent Helm Service 状态
- Understand / Code / Command 能力
- 可用的 Coding Agents
- Local Agent LSP
- Tunnel 状态

<img width="1414" height="1330" alt="image" src="https://github.com/user-attachments/assets/72332c3f-0150-4524-97f8-b6ef855e3a45" />




### Side Panel

Side Panel 是浏览器里的主要工作视图。

你可以：

- 查看 Work History
- 按 Workspace 筛选本地工作
- 添加或切换 Workspace
- 查看 ChatGPT 直接完成的工作
- 查看 Subagent Sessions
- 在不同 Work 之间切换

<img width="830" height="1802" alt="image" src="https://github.com/user-attachments/assets/9e502dfc-b226-4c56-b784-192721fd2b1c" />

### Work Detail

Work Detail 用来查看一项工作的完整上下文，包括：

- ChatGPT Direct Work
- Subagent Work
- 活动时间线
- 执行动作
- 关联的 ChatGPT Conversations
- Workspace 信息
- 初始 requirement 与后续工作上下文

当当前标签页打开的是一个 `chatgpt.com` Conversation 时，Extension 可以识别当前 Conversation，并将它与对应的 Agent Helm Work History 关联。

<img width="3828" height="1942" alt="20260901001705" src="https://github.com/user-attachments/assets/dddee8c5-207a-43c2-a94e-0fd4cf09e10b" />


## Work History

Agent Helm Extension 让你更容易在一个 ChatGPT Conversation 和它背后的本地工作之间来回切换。

```text
ChatGPT Conversation
        │
        ▼
       Work
     /      \
Direct Work  Subagent Sessions
```

你可以直接回答这些实际问题：

- 这个 Conversation 对应的是哪一项本地工作？
- 使用了哪个 Workspace / Worktree？
- 这个任务是 ChatGPT 直接完成的，还是委派给了 Subagent？
- 应该重新打开哪个 Agent Session？
- 我离开这个 Conversation 之后，本地又发生了什么？
- 一个 Work 目前关联了哪些 ChatGPT Conversations？

Work History 的目标不是简单保存一份聊天记录。

它连接的是：

**Conversation → Workspace → Direct Work → Subagent Sessions → 实际执行历史**
<img width="3834" height="1936" alt="20260901001736" src="https://github.com/user-attachments/assets/efab56f2-5f70-4057-87e2-97241ce18b05" />
## 浏览器不是执行边界

Chrome Extension 是交互和展示层，不是拥有本地高权限的执行 runtime。

```text
ChatGPT
   │
   ▼
Chrome Extension
   │
   ▼
Native Messaging
   │
   ▼
Agent Helm
   │
   ├── Execution Context
   ├── Capability Policy
   └── Sandbox
            │
            ▼
     Authorized Local Workspace
```

文件系统访问、命令执行、环境变量、网络访问、Semantic Capabilities 和 Agent Delegation 仍然全部由 Agent Helm 控制。

因此，安装 Chrome Extension 并不等于把本机的无限制访问权限交给浏览器。

完整的本地 capability boundary、安全模型与 sandbox enforcement 机制，请参阅 [Agent Helm](https://github.com/BeforeWave/agent-helm)。

## 它是如何连接的

浏览器与 Agent Helm Core 之间的连接路径是：

```text
Chrome
  │
  ▼
Agent Helm Extension
  │
  ▼
Chrome Native Messaging
  │
  ▼
Agent Helm Core
```

而 ChatGPT 与本地 Agent Helm MCP 服务之间的默认连接路径是：

```text
ChatGPT
  │
  ▼
Secure MCP Tunnel
  │
  ▼
OpenAI tunnel-client
  │
  ▼
Agent Helm Core
```

这两个通路承担不同职责。

- Extension 负责浏览器交互与展示
- Native Messaging 负责浏览器与本地 Agent Helm Core 通信
- Secure MCP Tunnel 负责 ChatGPT 与 Agent Helm MCP endpoint 的连接
- Agent Helm Core 负责本地 capability、policy、runtime lifecycle 与 execution authority

这样的分层让浏览器体验可以独立演进，同时不会复制或绕过 Agent Helm 的安全边界。

## Repository

公开仓库中的 Chrome Extension 位于：

```text
agent-helm-extensions/
└── chrome-extension/
```

Extension 使用：

- React
- TypeScript
- WXT

浏览器私有 identity 与私有 release material 不进入公开源码树。

## Development

Chrome Extension 的开发环境要求：

- Node.js 22+
- npm
- Google Chrome

获取源码并安装依赖：

```bash
git clone https://github.com/BeforeWave/agent-helm-extensions.git
cd agent-helm-extensions/chrome-extension
npm install
```

启动 WXT Extension 开发模式：

```bash
npm run dev:extension
```

如果需要生成 production-style unpacked build：

```bash
npm run build
```

构建结果位于：

```text
chrome-extension/.output/chrome-mv3
```

然后：

1. 打开 `chrome://extensions`
2. 开启右上角 **Developer mode**
3. 点击 **Load unpacked**
4. 选择 `chrome-extension/.output/chrome-mv3`

提交修改前，可以运行：

```bash
npm run typecheck
npm test
```

如果只需要在浏览器中预览 Extension UI，而不连接真实 Agent Helm runtime，可以使用项目提供的 Web Preview：

```bash
npm run dev:web
```

## Agent Helm Family

| 项目 | 定位 |
| --- | --- |
| [Agent Helm](https://github.com/BeforeWave/agent-helm) | ChatGPT 的本地工程能力、安全边界与执行控制层 |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | ChatGPT + DSH 的完整本地开发工作流 |
| **Agent Helm Extensions** | 浏览器及其他面向用户的 Agent Helm 集成 |

## Project Status

Agent Helm Extensions 目前处于积极开发阶段。

当前首先提供 Chrome Extension，后续可以在同一个 Extensions 产品边界下扩展其他用户界面与客户端集成。

> **让 ChatGPT 留在对话发生的地方，同时把它干净地连接到 Agent Helm 管理的真实本地工作。**
