<p align="right">
  <a href="./README.en.md"><b>English</b></a> | <a href="./README.md">中文</a>
</p>

# Agent Helm Extensions

> **Connect ChatGPT in your browser to your local development environment, with a browser panel for managing connections, projects, Agents, and the work in progress.**

**Agent Helm Extensions** currently provides the **Agent Helm Chrome Extension**.

After installing the Extension, you continue using the same ChatGPT. ChatGPT connects to local Agent Helm through **Secure MCP** and works inside the projects you authorize; the Extension provides installation, configuration, status, and work controls in the browser.

```text
                    ChatGPT in Browser
                           │
                       Secure MCP
                           │
                           ▼
                       Agent Helm
                    /              \
                   /                \
          Authorized Local      Local Coding
              Project               Agent
                   \                /
                    \              /
                       Actual Work

                           ▲
                           │
                  Native Messaging
                           │
               Agent Helm Chrome Extension
                           │
                    Browser Control Panel
```

**Your project and the actual execution environment stay on your computer.**

When ChatGPT works, Agent Helm returns the information needed for the current task through MCP, such as relevant file contents, errors, project state, and command output.

Local operations run according to the projects and permissions you authorize and are protected by a Sandbox. If the required security protections are unavailable, the related operation is rejected.

<img width="2166" height="1498" alt="workbench" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## Quick Start

### Recommended: Install the Chrome Extension First

Install the **Agent Helm Chrome Extension** first.

The Extension checks whether your computer is ready to connect to Agent Helm.

<img width="1988" height="1934" alt="Agent Helm install required" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

If local components still need to be installed, the Extension shows **Install required** and provides **Download Installer**.

Follow the on-screen steps to complete installation and authorization. The Extension then continues checking the connection state.

Return to ChatGPT when setup is complete and start working.

### You Can Also Start from the Command Line

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

## Browser Control Panel

Agent Helm Chrome Extension provides a Popup, Side Panel, and Work Detail view.

### Popup

Click the Agent Helm icon in the Chrome toolbar to quickly check the current state and use common controls.

If the local environment is not ready yet, installation and setup guidance is also available here.

<img width="774" height="828" alt="chrome-plugin" src="https://github.com/user-attachments/assets/dec8f2ad-e632-444e-8290-4688e691cb23" />

### Side Panel

**The Side Panel is Agent Helm's main control panel in the browser.**

From here you can:

- View and adjust the local connection state
- Manage currently available capabilities
- Manage local Coding Agents
- Complete required connection setup
- Select a local project
- Add a new local project
- See the work associated with the current ChatGPT Conversation
- Switch between different pieces of work
- Open detailed information for a specific piece of work

<img width="786" height="1634" alt="chrome-panel" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

### Work Detail

Work Detail shows the details of a specific piece of work.

You can see:

- Work already completed by ChatGPT
- Execution by local Agents
- Activity records
- Associated ChatGPT Conversations
- The project / Worktree in use

<img width="2044" height="1516" alt="details" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

## ChatGPT Conversations and Local Work

When the current tab contains a `chatgpt.com` Conversation, the Extension can identify that Conversation and associate it with the corresponding local work.

That lets the browser panel show which piece of work belongs to the current Conversation and lets you open that work to see later execution activity.

## Work History

A piece of work may continue for a long time and may span both direct ChatGPT work and local Agent execution.

Agent Helm organizes those work records together.

In the Side Panel, you can view them by project and reopen a specific Work Detail view.

You can see:

- The ChatGPT Conversation associated with the work
- The project / Worktree in use
- What ChatGPT has already completed
- Whether a local Agent was used
- The corresponding Agent Session
- Recent execution activity

That makes previous work easy to find again and continue.

## What Passes Between Your Local Project and ChatGPT

Project files, Git state, tools, and commands use your local environment as their source of current state.

When ChatGPT works through Agent Helm, Agent Helm returns the information needed for the current task through MCP, including:

- Relevant file contents
- Errors and diagnostics
- Project state
- Git information
- Command output
- Other information needed for the current task

The Chrome Extension mainly provides installation, configuration, status display, and browser controls for work.

## Security Boundaries

Local file access, command execution, and Coding Agent use follow the work scope and permission limits of the project currently authorized in Agent Helm.

On supported environments, local commands run in a Sandbox that restricts access to local resources such as files, commands, environment variables, and the network.

If the required security protections are unavailable, the related operation is rejected.

For the complete Agent Helm documentation, see:

[**Agent Helm**](https://github.com/BeforeWave/agent-helm)

## Browser Permissions

Agent Helm Chrome Extension requests only the browser permissions required for product functionality.

The production version currently uses:

- Native Messaging, to connect to local Agent Helm
- Side Panel, for the browser control panel
- Storage, for local Extension state
- Notifications, for work status notifications
- Alarms, for required background status updates

Download permission is requested only when the Agent Helm Installer needs to be downloaded.

Access to `chatgpt.com` is used to identify the current ChatGPT Conversation and associate it with the corresponding local work.

## Related Projects

| Project | Purpose | Link |
| --- | --- | --- |
| **Agent Helm** | Let ChatGPT connect to local projects and get work done | [Agent Helm](https://github.com/BeforeWave/agent-helm) |
| **DSH with ChatGPT** | Let ChatGPT use DSH Sessions for larger tasks that need sustained execution | [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) |

## Project Status

Agent Helm Extensions is under active development.

Agent Helm Chrome Extension is currently available.
