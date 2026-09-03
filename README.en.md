<p align="right">
  <a href="./README.en.md"><b>English</b></a> | <a href="./README.md">中文</a>
</p>

# Agent Helm Extensions

> **Let ChatGPT in your browser work directly with your local projects — and call on your local coding agents when needed.**

**Agent Helm Extensions** currently provides the **Agent Helm Chrome Extension**.

You keep using ChatGPT in the browser as usual.

The difference is that ChatGPT can now understand your real project, edit files, run commands, and inspect actual results. When a task needs more execution power, it can also hand work off to coding agents already running on your machine.

The extension connects the current ChatGPT conversation with the local work happening behind it.

Right from the browser, you can see which project ChatGPT is using, what it has done locally, whether work has been handed off to an agent, and how that work is progressing.

<img width="2166" height="1498" alt="Agent Helm Chrome Extension" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## Start from the ChatGPT You Already Use

Open a conversation on `chatgpt.com`, and the extension associates it with the corresponding local work.

Through Agent Helm, ChatGPT in your browser can:

* Understand the current project
* Find and read relevant files
* Edit files
* Run commands and development tools
* Inspect diagnostics and Git state
* Check build, test, and execution results
* Hand work off to local coding agents
* Come back afterward and inspect the real results

You no longer need to keep pasting code, errors, and project context into the conversation, or restate the whole task before asking a local agent to continue.

## Use Your Local Coding Agents

When a task is better suited for a coding agent to keep working on, ChatGPT can call a local agent already connected through Agent Helm.

ChatGPT can first understand the project and the problem, then hand the task over with the relevant context.

You can still see:

* Which agent received the task
* The associated agent session
* Current execution status
* Recent activity
* What ChatGPT and the agent have each done

Direct work by ChatGPT and execution by local agents no longer have to live in separate, disconnected workflows.

## See the Local Work Behind the Current Conversation

The extension associates the current ChatGPT conversation with its local work.

You can see:

* The project / worktree in use
* Local actions performed by ChatGPT
* Current work status and recent activity
* Whether work has been handed off to a local agent
* The associated agent session
* Previous work history

<img width="2044" height="1516" alt="Agent Helm Work Detail" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

Even after leaving the original conversation, you can come back through Work History and see what happened locally.

## Manage Agent Helm from the Browser

The **Side Panel** is the main management interface.

From there, you can view and manage:

* Work associated with the current ChatGPT conversation
* Local projects and worktrees
* Connected coding agents
* Agent sessions
* Work History
* Agent Helm connection and runtime status

<img width="786" height="1634" alt="Agent Helm Side Panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

The toolbar **Popup** provides a quick view of installation and connection status.

## Quick Start

### Recommended: Start with the Chrome Extension

Install the **Agent Helm Chrome Extension**.

The extension checks whether your machine is ready to connect to Agent Helm.

<img width="1988" height="1934" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

If a required local component is missing, the extension will tell you and provide the Agent Helm Installer.

Complete the installation, connection, and permission steps, then return to ChatGPT and start working.

### Or Set It Up from the Command Line

```bash id="31j18x"
npm install -g agent-helm
agent-helm setup
agent-helm setup chrome
```

If Agent Helm is already installed and configured:

```bash id="tco7r0"
agent-helm setup chrome
```

Common commands:

```bash id="cc3x8z"
agent-helm start
agent-helm status
agent-helm doctor
agent-helm stop
```

## Local Projects and Security

Your projects and execution environment remain on your machine.

While working on a task, ChatGPT receives the local information needed to complete it, such as relevant files, project structure, diagnostics, Git state, command output, and test results.

What it can access and execute depends on the currently authorized Workspace, capabilities, and permissions.

When ChatGPT performs local operations directly, Agent Helm provides the permission and sandbox boundary.

When work is handed off to a local coding agent, that agent executes under its own permissions and sandbox configuration.

## Browser Permissions

Agent Helm Chrome Extension only requests browser permissions required by the product:

* **Native Messaging** — connects to the local Agent Helm installation
* **Side Panel** — provides the main browser interface
* **Storage** — stores extension state locally
* **Notifications** — shows work status notifications
* **Alarms** — handles required background status updates

Download permission is only requested when needed to download the Agent Helm Installer.

Access to `chatgpt.com` is used to identify the current ChatGPT conversation and associate it with the corresponding local work.

The extension does not need access to your browsing activity on other websites, and it does not need to read the contents of your ChatGPT conversations.

## Related Projects

| Project                                                            | Purpose                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [Agent Helm](https://github.com/BeforeWave/agent-helm)             | Lets ChatGPT in your browser work directly with local projects and use local coding agents when needed |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | Lets ChatGPT in your browser work with local projects and hand tasks off to DSH when needed            |

## Project Status

Agent Helm Extensions is under active development.
