<p align="right">
  <a href="./README.en.md">English</a> | <a href="./README.md"><b>中文</b></a>
</p>

# Agent Helm Extensions

> **让浏览器里的 ChatGPT 直接使用你的本地项目，也能调用你本地的 Coding Agent。**

**Agent Helm Extensions** 目前提供 **Agent Helm Chrome Extension**。

你还是用平时浏览器里的 ChatGPT。

区别是，现在它可以直接理解真实项目、修改文件、运行命令、检查结果；需要更多执行能力时，也可以把任务交给你本地已经接入的 Coding Agent。

Extension 会把当前 ChatGPT Conversation 和本地正在发生的工作关联起来。

你可以直接在浏览器里看到 ChatGPT 当前用了哪个项目、在本地做过什么、任务有没有交给 Agent，以及现在进行到哪。

<img width="2166" height="1498" alt="Agent Helm Chrome Extension" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## 从你正在用的 ChatGPT 开始

打开 `chatgpt.com` 里的一个 Conversation，Extension 会识别当前对话，并关联它对应的本地工作。

通过 Agent Helm，浏览器里的 ChatGPT 可以直接：

* 理解当前项目
* 查找和读取相关文件
* 修改文件
* 运行命令和工程工具
* 查看 Diagnostics 和 Git 状态
* 检查构建、测试和实际执行结果
* 把任务交给本地 Coding Agent
* Agent 完成后重新检查真实结果

不需要反复把代码、报错和项目上下文复制进聊天框，也不用为了调用本地 Agent 再重新整理一遍任务。

## 调用你本地的 Coding Agent

当任务更适合交给 Coding Agent 继续执行时，ChatGPT 可以直接调用当前已经接入 Agent Helm 的本地 Agent。

ChatGPT 可以先把项目和问题搞清楚，再把任务交出去。

之后你仍然可以看到：

* 任务交给了哪个 Agent
* 对应的 Agent Session
* 当前执行状态
* 最近的执行活动
* ChatGPT 和 Agent 分别做过什么

这样，ChatGPT 自己处理和本地 Agent 执行，不再是两套互相割裂的工作。

## 当前 Conversation 的本地工作，一眼就能看到

Extension 会把当前 ChatGPT Conversation 和对应的本地工作关联起来。

你可以看到：

* 当前使用的项目 / Worktree
* ChatGPT 做过的本地操作
* 当前工作状态和最近活动
* 是否已经交给本地 Agent
* 关联的 Agent Session
* 历史工作记录

<img width="2044" height="1516" alt="Agent Helm Work Detail" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

即使你已经离开原来的 Conversation，之后也可以从 Work History 里重新找到这项工作，看看当时在本地发生了什么。

## 在浏览器里管理 Agent Helm

**Side Panel** 是主要的管理入口。

你可以直接查看和管理：

* 当前 ChatGPT Conversation 对应的 Work
* 本地项目和 Worktree
* 已接入的 Coding Agent
* Agent Session
* Work History
* Agent Helm 的连接和运行状态

<img width="786" height="1634" alt="Agent Helm Side Panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

工具栏里的 **Popup** 用来快速查看安装和连接状态。

## 快速开始

### 推荐：从 Chrome Extension 开始

安装 **Agent Helm Chrome Extension**。

Extension 会检查当前电脑是否已经可以连接 Agent Helm。

<img width="1988" height="1934" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

如果本地还没有 Agent Helm，Extension 会显示 **Download Installer**：

- macOS：\`Agent-Helm-Installer-0.1.0.pkg\`
- Windows x64：\`Agent-Helm-Installer-0.1.0-win32-x64.cmd\`

Installer 与 Extension 使用相同版本，并安装该 Extension Release 固定的 Agent Helm 版本。

按照页面完成安装、连接和授权后，回到 ChatGPT 就可以开始使用。

### Terminal 一键安装

macOS / Linux：

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh
\`\`\`

指定 Extension 版本：

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh -s -- 0.1.0
\`\`\`

Windows x64：

\`\`\`powershell
irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1 | iex
\`\`\`

指定 Extension 版本：

\`\`\`powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1))) -Version 0.1.0
\`\`\`

Terminal 安装会完成 Node/runtime、Agent Helm 和 Native Messaging bridge，并把匹配的 Extension 解压到 Downloads。最后只需要在 Chrome 中打开 Developer mode，选择 **Load unpacked**。

当前 Windows 支持范围为 Windows x64，即常见 Intel / AMD Windows 10、Windows 11。Windows ARM64 暂不作为正式支持平台。

如果已经安装并配置过 Agent Helm：

\`\`\`bash
agent-helm setup chrome
\`\`\`

常用命令：

\`\`\`bash
agent-helm start
agent-helm status
agent-helm doctor
agent-helm stop
\`\`\`

## 本地项目与安全

项目和实际执行环境仍然在你的电脑上。

ChatGPT 在处理当前任务时，会获得完成这项工作需要的本地信息，例如相关文件、项目结构、Diagnostics、Git 状态、命令输出和测试结果。

它能访问哪些项目、能执行哪些操作，由当前授权的 Workspace、能力和权限决定。

ChatGPT 自己执行本地操作时，使用 Agent Helm 提供的权限和 Sandbox 保护。

任务交给本地 Coding Agent 后，则按照对应 Agent 自身的权限和 Sandbox 配置执行。

## 浏览器权限

Agent Helm Chrome Extension 只申请产品功能需要的浏览器权限：

* **Native Messaging**：连接本地 Agent Helm
* **Side Panel**：提供浏览器里的主要管理界面
* **Storage**：保存 Extension 本地状态
* **Notifications**：显示工作状态通知
* **Alarms**：进行必要的后台状态更新

下载 Agent Helm Installer 时，才会额外申请下载权限。

对 `chatgpt.com` 的访问用于识别当前 ChatGPT Conversation，并把它和对应的本地工作关联起来。

Extension 不需要读取其他网站的浏览信息，也不需要读取 ChatGPT Conversation 的正文内容。

## 相关项目

| 项目                                                                 | 用途                                             |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| [Agent Helm](https://github.com/BeforeWave/agent-helm)             | 让浏览器里的 ChatGPT 直接使用本地项目，并在需要时调用本地 Coding Agent |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | 让浏览器里的 ChatGPT 使用本地项目，并在需要时把任务交给 DSH           |

## 项目状态

Agent Helm Extensions 正在持续开发中。
