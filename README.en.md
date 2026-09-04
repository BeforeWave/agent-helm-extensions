<p align="right">
  <a href="./README.en.md"><b>English</b></a> | <a href="./README.md">中文</a>
</p>

# Agent Helm Extensions

> **Let ChatGPT in your browser work directly with your local projects — and call on your local coding agents when needed.**

**Agent Helm Extensions** currently provides the **Agent Helm Chrome Extension**.

You keep using ChatGPT in your browser as usual.

The difference is that ChatGPT can now understand your real project, edit files, run commands, and inspect results. When a task needs more execution power, it can also hand the work off to coding agents already connected on your machine.

The Extension associates the current ChatGPT Conversation with the local work happening behind it.

Right from the browser, you can see which project ChatGPT is using, what it has done locally, whether work has been handed off to an Agent, and how that work is progressing.

<img width="1000" alt="Agent Helm Chrome Extension" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## Quick Start

### 1. Manually Install the Chrome Extension

Download the matching **Agent Helm Chrome Extension** zip from [Releases](https://github.com/BeforeWave/agent-helm-extensions/releases).

After extracting it, open this page in Chrome:

```text
chrome://extensions
```

Enable **Developer mode**, choose **Load unpacked**, and select the extracted Extension directory.

After installation, the Extension checks whether the current machine can already connect to Agent Helm.

If Agent Helm is not installed locally, the Extension shows **Download Installer**:

* macOS: `Agent-Helm-Installer-0.1.0.pkg`
* Windows x64: `Agent-Helm-Installer-0.1.0-win32-x64.cmd`

The Installer and Extension use the same version, and the Installer installs the Agent Helm version pinned by that Extension Release.

Complete the installation, connection, and permission steps shown in the UI, then return to ChatGPT and start working.

<img width="900" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

### 2. One-Command Terminal Install

You can also complete the installation directly from a Terminal.

The Terminal installer handles Node/runtime, Agent Helm, and Native Messaging bridge setup, then extracts the matching Extension into Downloads.

After that, you only need to enable Developer mode in Chrome and choose **Load unpacked**.

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh
```

Install a specific Extension version:

```bash
curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh -s -- 0.1.0
```

Windows x64:

```powershell
irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1 | iex
```

Install a specific Extension version:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1))) -Version 0.1.0
```

Current Windows support is Windows x64, covering common Intel / AMD Windows 10 and Windows 11 systems. Windows ARM64 is not yet a supported target.

### 3. If Agent Helm Is Already Installed

If you already installed and configured Agent Helm from the command line, you can configure the Chrome integration directly:

```bash
agent-helm setup chrome
```

For more Agent Helm configuration and usage, see [Agent Helm](https://github.com/BeforeWave/agent-helm#2-configure).

Then return to the Extension, confirm that Agent Helm is connected, and start using it from ChatGPT.

## Start from the ChatGPT You Already Use

Open a Conversation on `chatgpt.com`. The Extension identifies the current Conversation and associates it with the corresponding local work.

Through Agent Helm, ChatGPT in your browser can:

* Understand the current project
* Find and read relevant files
* Edit files
* Run commands and development tools
* Inspect Diagnostics and Git state
* Check build, test, and execution results
* Hand work off to local Coding Agents
* Inspect the real results again after the Agent finishes

You no longer need to repeatedly paste code, errors, and project context into the chat, or reorganize the task before asking a local Agent to continue.

## Use Your Local Coding Agents

When a task is better suited for a Coding Agent to continue executing, ChatGPT can directly call a local Agent already connected through Agent Helm.

ChatGPT can first understand the project and the problem, then hand the work over.

You can still see:

* Which Agent received the task
* The associated Agent Session
* Current execution status
* Recent activity
* What ChatGPT and the Agent have each done

This keeps direct work by ChatGPT and execution by local Agents from becoming two disconnected workflows.

### See the Local Work Behind the Current Conversation

The Extension associates the current ChatGPT Conversation with the corresponding local work.

You can see:

* The project / Worktree in use
* Local actions performed by ChatGPT
* Current work status and recent activity
* Whether work has been handed off to a local Agent
* The associated Agent Session
* Previous Work History

<img width="900" alt="Agent Helm Work Detail" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

Even after leaving the original Conversation, you can return through Work History and see what happened locally.

### Manage Agent Helm from the Browser

The **Side Panel** is the main management interface.

From there, you can view and manage:

* Work associated with the current ChatGPT Conversation
* Local projects and Worktrees
* Connected Coding Agents
* Agent Sessions
* Work History
* Agent Helm connection and runtime status

<img width="420" alt="Agent Helm Side Panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

The toolbar **Popup** provides a quick view of installation and connection status.

### Local Projects and Security

Your projects and execution environment remain on your machine.

While working on a task, ChatGPT receives the local information needed to complete it, such as relevant files, project structure, Diagnostics, Git state, command output, and test results.

What it can access and execute depends on the currently authorized Workspace, capabilities, and permissions.

When ChatGPT performs local operations directly, Agent Helm provides the permissions and Sandbox protection.

When work is handed off to a local Coding Agent, that Agent runs under its own permissions and Sandbox configuration.

## Browser Permissions

Agent Helm Chrome Extension only requests browser permissions required by the product:

* **Native Messaging** — connects to the local Agent Helm installation
* **Side Panel** — provides the main browser interface
* **Storage** — stores Extension state locally
* **Notifications** — shows work status notifications
* **Alarms** — handles required background status updates

Download permission is only requested when needed to download the Agent Helm Installer.

Access to `chatgpt.com` is used to identify the current ChatGPT Conversation and associate it with the corresponding local work.

The Extension does not need access to your browsing activity on other websites, and it does not need to read the contents of your ChatGPT Conversations.

## Related Projects

| Project                                                            | Purpose                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [Agent Helm](https://github.com/BeforeWave/agent-helm)             | Lets ChatGPT in your browser work directly with local projects and use local Coding Agents when needed |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | Lets ChatGPT in your browser work with local projects and hand tasks off to DSH when needed            |

## Project Status

Agent Helm Extensions is under active development.
