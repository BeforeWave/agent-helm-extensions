<p align="right">
  <a href="./README.en.md">English</a> | <a href="./README.md"><b>中文</b></a>
</p>

<div align="center">

# Agent Helm Extensions

**告别复制粘贴与Token额度焦虑！让网页版 ChatGPT 直连本地项目、运行代码，按需调度其他Agent。**

[![Release](https://img.shields.io/github/v/release/BeforeWave/agent-helm-extensions?color=blue\&style=flat-square)](https://github.com/BeforeWave/agent-helm-extensions/releases)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome\&style=flat-square)](#-快速开始)
[![License](https://img.shields.io/github/license/BeforeWave/agent-helm-extensions?style=flat-square)](./LICENSE)

</div>

<br />

<p align="center">
  <img width="1000" alt="Agent Helm Chrome Extension Overview" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />
</p>

---

## 💡 为什么需要 Agent Helm？

网页版 ChatGPT 有很强的模型能力，但原本无法直接访问你的本地项目、文件和终端。处理真实工程时，代码、报错和执行结果仍要在浏览器、IDE 和终端之间反复搬运。

本地 Coding Agent 可以直接操作工程，但长时间 Coding 又会持续消耗模型 Token 和额度。

**Agent Helm Extensions** 把两者连接起来：

* **ChatGPT 直接动手 Coding：** 读取和修改本地文件、运行终端命令、检查 Diagnostics、Git、构建和测试结果，让 `chatgpt.com` 里的模型真正参与本地开发。
* **减少 Token 额度焦虑：** 直接使用 ChatGPT 中已有的模型能力完成大量代码理解、修改和验证，无需额外配置按量计费的模型 API Key。
* **多 Agent 协同：** 遇到更繁重或耗时更长的任务时，ChatGPT 可以把已经理解好的项目上下文和任务直接交给本地 Coding Agent 继续执行。
* **独立网络代理支持：** ChatGPT Tunnel 可以单独配置 HTTP / HTTPS 代理，不需要开启系统全局 VPN。

---

## ⚡ 快速开始

### 1. Terminal 一键安装（推荐）

一键脚本会自动完成所需 Runtime、Agent Helm 本地服务和 Native Messaging Bridge，并把匹配的 Extension 解压到 Downloads。

**macOS：**

```bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh
```

> 指定 Extension 版本：
> `curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh -s -- 0.1.0`

**Linux（best-effort）：**

```bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh
```

**Windows x64：**

```powershell
irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1 | iex
```

> 指定 Extension 版本：
> `& ([scriptblock]::Create((irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1))) -Version 0.1.0`

脚本完成后，在 Chrome 打开 `chrome://extensions`，开启右上角 **Developer mode（开发者模式）**，点击 **Load unpacked（加载已解压的扩展程序）**，选择 Downloads 中的 Extension 目录即可。

---

### 2. 手动安装 Chrome Extension

1. 从 [Releases](https://github.com/BeforeWave/agent-helm-extensions/releases) 下载对应版本的 **Agent Helm Chrome Extension** zip 并解压。
2. 在 Chrome 中打开 `chrome://extensions`。
3. 开启 **Developer mode**，点击 **Load unpacked**，选择解压后的 Extension 目录。
4. Extension 会自动检查本地 Agent Helm；如果尚未安装，会显示 **Download Installer**：

* **macOS:** `Agent-Helm-Installer-<version>.pkg`
* **Windows x64:** `Agent-Helm-Installer-<version>-win32-x64.cmd`

<p align="center">
  <img width="900" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />
</p>

按照 Extension 中的引导完成 Agent Helm 和 ChatGPT Tunnel 配置即可。

---

### 3. 已经安装 Agent Helm

如果此前已经安装并配置了 Agent Helm，直接配置 Chrome integration：

```bash
agent-helm setup chrome
```

更多配置和使用方式见 [Agent Helm](https://github.com/BeforeWave/agent-helm#2-configure)。

---

## 🛠️ 工作流与核心功能

### 1. 让 ChatGPT 直接处理本地项目

打开 `chatgpt.com` 中的 Conversation，Extension 会识别当前对话，并显示与它关联的本地工作。

通过 Agent Helm，ChatGPT 可以直接：

* 理解项目结构
* 查找和读取代码
* 修改本地文件
* 运行终端命令和工程工具
* 查看 Diagnostics 和 Git 状态
* 执行构建与测试
* 检查真实运行结果

ChatGPT 可以自己完成从理解、修改到验证的完整 Coding 工作，不再依赖你手工搬运项目上下文。

### 2. 必要时调用本地 Coding Agent

任务规模更大或执行时间更长时，ChatGPT 可以直接调用已经接入 Agent Helm 的本地 Coding Agent。

ChatGPT 可以先把项目、问题和方案搞清楚，再把任务交出去。执行过程中你仍然可以看到：

* 任务交给了哪个 Agent
* 对应的 Agent Session
* 当前执行状态与最近活动
* ChatGPT 和 Agent 分别做过什么

ChatGPT 自己动手和本地 Agent 协作，都在同一条工作链路中。

### 3. 可视化状态与 Work History

Extension 会把当前 ChatGPT Conversation 和对应的本地工作关联起来：

* **当前工作感知：** 查看当前项目 / Worktree、ChatGPT 的本地操作和关联的 Agent Session。
* **Work History：** 离开原来的 Conversation 后，也可以重新找到这项工作，查看当时的执行过程和结果。

<p align="center">
  <img width="900" alt="Agent Helm Work Detail" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />
</p>

### 4. Side Panel 管理

工具栏里的 **Side Panel** 是主要管理入口，可以直接查看和管理：

* 当前 Work
* 项目 / Worktree
* 已接入的 Coding Agent
* Agent Session
* Work History
* Agent Helm 连接和运行状态
* ChatGPT Tunnel 状态

<p align="center">
  <img width="420" alt="Agent Helm Side Panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />
</p>

---

## 🔒 隐私与安全沙盒

项目和实际执行环境始终留在你的本地电脑上：

* **权限控制：** ChatGPT 能访问哪些项目、执行哪些操作，由当前 Workspace 的实际授权和能力决定。
* **沙盒运行：** ChatGPT 自己执行本地操作时受到 Agent Helm 的权限和 Sandbox 保护；任务交给本地 Coding Agent 后，按照对应 Agent 自身的权限和 Sandbox 配置执行。
* **隐私最小化：** 对 `chatgpt.com` 的访问仅用于识别当前 Conversation 并关联本地工作。Extension 不需要读取其他网站的浏览信息，也不需要读取 Conversation 正文内容。

### 浏览器权限说明

| 权限需求                 | 用途说明                            |
| -------------------- | ------------------------------- |
| **Native Messaging** | 连接本地 Agent Helm                 |
| **Side Panel**       | 提供浏览器里的主要管理界面                   |
| **Storage & Alarms** | 保存 Extension 本地状态与进行后台状态更新      |
| **Notifications**    | 显示工作完成与状态更新通知                   |
| **Downloads**        | 仅在下载 Agent Helm Installer 时额外申请 |

---

## 🔗 相关项目

| 项目                                                                 | 与本项目的关系                                          |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| [Agent Helm](https://github.com/BeforeWave/agent-helm)             | 本项目依赖的本地运行时，提供代码理解、文件与命令操作、Sandbox 和 Agent 协作能力。 |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | Agent Helm 的 DSH 集成，让 ChatGPT 可以把任务交给 DSH 执行。    |

---

## 📌 项目状态

Agent Helm Extensions 正在持续开发与积极迭代中。欢迎提交 Issue 与 Pull Request！
