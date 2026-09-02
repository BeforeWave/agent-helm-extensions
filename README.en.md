<p align="right">
  <a href="./README.en.md"><b>English</b></a> | <a href="./README.md">中文</a>
</p>

# Agent Helm Extensions

> **Let ChatGPT in your browser directly understand and operate your local development environment, while using a browser extension to manage connections, projects, agents, and local work.**

**Agent Helm Extensions** currently provides the **Agent Helm Chrome Extension**.

It lets you keep using ChatGPT as usual while giving it access to real local projects to understand code, analyze problems, edit files, run commands, and use local Coding Agents when needed.

The Chrome Extension is Agent Helm's installation and management interface in the browser. You can check connection status, manage projects and agents, and track the local work associated with the current ChatGPT Conversation.

<img width="2166" height="1498" alt="Agent Helm Chrome Extension" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## Quick Start

### Recommended: Start with the Chrome Extension

Install the **Agent Helm Chrome Extension** first.

The Extension checks whether your computer is ready to connect to Agent Helm.

<img width="1988" height="1934" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

If local components are missing, the Extension shows **Installation Required** and provides an option to **Download Installer**.

Follow the on-screen guide to complete installation and authorization. The Extension will then continue checking the connection. Once connected, return to ChatGPT and start working.

### Or Start from the Command Line

```bash
npm install -g agent-helm
agent-helm setup
agent-helm setup chrome
```

If Agent Helm is already installed and configured:

```bash
agent-helm setup chrome
```

Common commands:

```bash
agent-helm start
agent-helm status
agent-helm doctor
agent-helm stop
```

## Manage Agent Helm in the Browser

The toolbar **Popup** provides a quick view of connection and installation status, while the **Side Panel** is the primary management interface.

From the Side Panel, you can manage:

* Agent Helm's local connection and available capabilities
* Local Coding Agents
* Local projects and Worktrees
* The Work associated with the current ChatGPT Conversation
* Previous Work and execution history

<img width="786" height="1634" alt="Agent Helm Side Panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

When the current tab contains a `chatgpt.com` Conversation, the Extension identifies that Conversation and associates it with the corresponding local Work.

You can see which project ChatGPT is currently using, local execution progress, and any associated Agent Session. Previous work is retained in Work History so you can find it again and continue later.

Work Detail shows the Conversation, project / Worktree, local operations, Agent Session, and recent execution activity for a specific piece of work.

<img width="2044" height="1516" alt="Agent Helm Work Detail" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

## Local Projects and Security

Your projects and actual execution environment remain on your computer.

When ChatGPT works through Agent Helm, it receives only the local information needed for the current task, such as relevant files, code structure, diagnostics, Git state, command output, and execution results.

What ChatGPT can access and execute is determined by the currently authorized Workspace, capabilities, and permissions. Local file access, command execution, and Coding Agent usage are protected by Agent Helm's permission boundaries and Sandbox. If the required safety protections cannot be established, the operation is rejected.

## Browser Permissions

Agent Helm Chrome Extension only requests browser permissions required by its product features:

* **Native Messaging** — connects to the local Agent Helm
* **Side Panel** — provides the browser management interface
* **Storage** — stores local Extension state
* **Notifications** — displays work status notifications
* **Alarms** — performs necessary background status updates

Download permission is requested only when needed to download the Agent Helm Installer.

Access to `chatgpt.com` is used to identify the current ChatGPT Conversation and associate it with the corresponding local Work.

## Related Projects

| Project                                                            | Purpose                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [Agent Helm](https://github.com/BeforeWave/agent-helm)             | Connect ChatGPT to and let it operate your local development environment  |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | Let ChatGPT direct DSH Sessions to carry out larger, longer-running tasks |
