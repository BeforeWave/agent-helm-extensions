<p align="right">
  <a href="./README.en.md">English</a> | <a href="./README.md"><b>中文</b></a>
</p>

# Agent Helm Extensions

> **让浏览器里的 ChatGPT 直接理解和操作你的本地开发环境，并通过浏览器Extension 管理连接、项目、Agent 和本地工作。**

**Agent Helm Extensions** 当前提供 **Agent Helm Chrome Extension**。

它让你继续使用原来的 ChatGPT，同时让 ChatGPT 基于真实的本地项目理解代码、分析问题、修改文件、运行命令，并在需要时使用本地 Coding Agent。

Chrome Extension 是 Agent Helm 在浏览器里的安装和管理入口，可以直接查看连接状态、管理项目和 Agent，并跟踪当前 ChatGPT Conversation 对应的本地工作。

<img width="2166" height="1498" alt="Agent Helm Chrome Extension" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## 快速开始

### 推荐：先安装 Chrome Extension

先安装 **Agent Helm Chrome Extension**。

Extension 会检查当前电脑是否已经准备好连接 Agent Helm。

<img width="1988" height="1934" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

如果缺少本地组件，Extension 会显示 **需要安装**，并提供 **下载安装器**。

按照页面引导完成安装和授权后，Extension 会继续检查连接状态。连接完成后，回到 ChatGPT 即可开始使用。

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

## 在浏览器中管理 Agent Helm

工具栏中的 **Popup** 用于快速查看连接和安装状态；**Side Panel** 是主要的管理界面。

你可以在 Side Panel 中管理：

* Agent Helm 的本地连接和可用能力
* 本地 Coding Agent
* 本地项目和 Worktree
* 当前 ChatGPT Conversation 对应的 Work
* 历史 Work 和执行记录

<img width="786" height="1634" alt="Agent Helm Side Panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

当当前标签页打开的是 `chatgpt.com` Conversation 时，Extension 会识别当前 Conversation，并关联对应的本地 Work。

你可以直接看到 ChatGPT 当前使用的项目、本地执行进展和关联的 Agent Session。过去的工作也会保留在 Work History 中，方便之后重新找到并继续。

进入 Work Detail 后，可以查看这项工作的 Conversation、项目 / Worktree、本地操作、Agent Session 和最近的执行活动。

<img width="2044" height="1516" alt="Agent Helm Work Detail" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

## 本地项目与安全

项目和实际执行环境仍然在你的电脑上。

ChatGPT 通过 Agent Helm 工作时，只会根据当前任务获得必要的本地信息，例如相关文件、代码结构、诊断、Git 状态、命令输出和执行结果。

实际能够访问和执行什么，由当前授权的 Workspace、能力和权限决定。本地文件访问、命令执行和 Coding Agent 使用都受到 Agent Helm 的权限边界和 Sandbox 保护；需要的安全保护无法建立时，相关操作会被拒绝。

## 浏览器权限

Agent Helm Chrome Extension 只申请产品功能需要的浏览器权限：

* **Native Messaging**：连接本地 Agent Helm
* **Side Panel**：提供浏览器里的管理界面
* **Storage**：保存 Extension 本地状态
* **Notifications**：显示工作状态通知
* **Alarms**：进行必要的后台状态更新

下载权限只在需要下载 Agent Helm Installer 时按需申请。

对 `chatgpt.com` 的访问用于识别当前 ChatGPT Conversation，并将它与对应的本地工作关联。

## 相关项目

| 项目                                                                 | 用途                                 |
| ------------------------------------------------------------------ | ---------------------------------- |
| [Agent Helm](https://github.com/BeforeWave/agent-helm)             | 让 ChatGPT 连接并操作本地开发环境              |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | 让 ChatGPT 指挥 DSH Session 持续执行较大的任务 |
