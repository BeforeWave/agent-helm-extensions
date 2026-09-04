<p align="right">
  <a href="./README.en.md"><b>English</b></a> | <a href="./README.md">中文</a>
</p>

<div align="center">

# Agent Helm Extensions

**Say goodbye to copy-pasting and Token quota anxiety. Let ChatGPT on the web connect directly to your local project, run code, and bring in other Agents when needed.**

[![Release](https://img.shields.io/github/v/release/BeforeWave/agent-helm-extensions?color=blue\&style=flat-square)](https://github.com/BeforeWave/agent-helm-extensions/releases)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome\&style=flat-square)](#-quick-start)
[![License](https://img.shields.io/github/license/BeforeWave/agent-helm-extensions?style=flat-square)](./LICENSE)

</div>

<br />

<p align="center">
  <img width="1000" alt="Agent Helm Chrome Extension Overview" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />
</p>

---

## 💡 Why Agent Helm?

ChatGPT on the web has strong models, but it normally cannot access your local project, files, or terminal. When working on real codebases, source files, errors, and execution results still have to be moved back and forth between the browser, IDE, and terminal.

Local Coding Agents can operate directly on the project, but long-running coding work can continuously consume model Tokens and quota.

**Agent Helm Extensions** connects both sides:

* **Let ChatGPT code directly:** Read and modify local files, run terminal commands, inspect Diagnostics and Git state, and execute builds and tests so the models in `chatgpt.com` can participate directly in local development.
* **Reduce Token quota pressure:** Use the model capabilities already available in ChatGPT for code understanding, editing, and verification, without configuring an additional usage-based model API key.
* **Multi-Agent collaboration:** For heavier or longer-running tasks, ChatGPT can hand the already-understood project context and task directly to a local Coding Agent for continued execution.
* **Independent proxy support:** ChatGPT Tunnel can use its own HTTP / HTTPS proxy without requiring a system-wide VPN.

---

## ⚡ Quick Start

### 1. One-Command Terminal Install (Recommended)

The install script sets up the required Runtime, the local Agent Helm service, and the Native Messaging Bridge, then extracts the matching Extension into Downloads.

**macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh
```

> Install a specific Extension version:
> `curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh -s -- 0.1.0`

**Linux (best-effort):**

```bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh
```

**Windows x64:**

```powershell
irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1 | iex
```

> Install a specific Extension version:
> `& ([scriptblock]::Create((irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1))) -Version 0.1.0`

After the script finishes, open `chrome://extensions` in Chrome, enable **Developer mode**, click **Load unpacked**, and select the Extension directory in Downloads.

---

### 2. Manually Install the Chrome Extension

1. Download the matching **Agent Helm Chrome Extension** zip from [Releases](https://github.com/BeforeWave/agent-helm-extensions/releases) and extract it.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted Extension directory.
4. The Extension checks the local Agent Helm installation automatically. If Agent Helm is missing, it shows **Download Installer**:

* **macOS:** `Agent-Helm-Installer-<version>.pkg`
* **Windows x64:** `Agent-Helm-Installer-<version>-win32-x64.cmd`

<p align="center">
  <img width="900" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />
</p>

Follow the guidance in the Extension to complete Agent Helm and ChatGPT Tunnel setup.

---

### 3. If Agent Helm Is Already Installed

If Agent Helm is already installed and configured, set up the Chrome integration directly:

```bash
agent-helm setup chrome
```

For more configuration and usage details, see [Agent Helm](https://github.com/BeforeWave/agent-helm#2-configure).

---

## 🛠️ Workflow & Core Features

### 1. Let ChatGPT Work Directly on Local Projects

Open a Conversation on `chatgpt.com`. The Extension detects the current conversation and shows the local work associated with it.

Through Agent Helm, ChatGPT can directly:

* Understand the project structure
* Find and read code
* Modify local files
* Run terminal commands and development tools
* Inspect Diagnostics and Git state
* Run builds and tests
* Check real execution results

ChatGPT can handle the full coding loop from understanding to editing to verification, without requiring you to manually move project context into the conversation.

### 2. Call Your Local Coding Agents When Needed

For larger tasks or longer-running execution, ChatGPT can directly call a local Coding Agent already connected through Agent Helm.

ChatGPT can first understand the project, problem, and solution, then hand the task over. During execution, you can still see:

* Which Agent received the task
* The associated Agent Session
* Current execution status and recent activity
* What ChatGPT and the Agent have each done

Direct work by ChatGPT and collaboration with local Agents stay within the same workflow.

### 3. Visual Status & Work History

The Extension associates the current ChatGPT Conversation with the corresponding local work:

* **Current work awareness:** See the current project / Worktree, local actions performed by ChatGPT, and associated Agent Sessions.
* **Work History:** Return to previous work after leaving the original Conversation and review what happened during execution.

<p align="center">
  <img width="900" alt="Agent Helm Work Detail" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />
</p>

### 4. Side Panel Management

The **Side Panel** is the main management interface. From the browser, you can directly view and manage:

* Current Work
* Projects / Worktrees
* Connected Coding Agents
* Agent Sessions
* Work History
* Agent Helm connection and runtime status
* ChatGPT Tunnel status

<p align="center">
  <img width="420" alt="Agent Helm Side Panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />
</p>

---

## 🔒 Privacy & Security Sandbox

Your projects and actual execution environment remain on your local machine:

* **Permission control:** Which projects ChatGPT can access and which operations it can perform are determined by the permissions and capabilities granted to the current Workspace.
* **Sandboxed execution:** When ChatGPT performs local operations directly, it runs under Agent Helm permissions and Sandbox protection. Tasks delegated to local Coding Agents run under the permissions and Sandbox configuration of those Agents.
* **Minimal browser access:** Access to `chatgpt.com` is only used to identify the current Conversation and associate it with local work. The Extension does not need to read browsing information from other websites or the contents of ChatGPT Conversations.

### Browser Permissions

| Permission           | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| **Native Messaging** | Connect to the local Agent Helm runtime                           |
| **Side Panel**       | Provide the main browser management interface                     |
| **Storage & Alarms** | Store local Extension state and perform background status updates |
| **Notifications**    | Show work completion and status updates                           |
| **Downloads**        | Requested only when downloading the Agent Helm Installer          |

---

## 🔗 Related Projects

| Project                                                            | Relationship to this project                                                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [Agent Helm](https://github.com/BeforeWave/agent-helm)             | The local runtime used by this project, providing code intelligence, file and command operations, Sandbox protection, and Agent collaboration. |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | Agent Helm's DSH integration, allowing ChatGPT to hand tasks off to DSH for execution.                                                         |

---

## 📌 Project Status

Agent Helm Extensions is under active development and iteration. Issues and Pull Requests are welcome.
