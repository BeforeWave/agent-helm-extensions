<p align="right">
  <a href="./README.en.md"><b>English</b></a> | <a href="./README.md">中文</a>
</p>

# Agent Helm Extensions

> **Bring ChatGPT in your browser directly into your local development environment: understand the real codebase, work on local projects, and carry out engineering tasks without constantly copying and pasting files and logs.**

[**Agent Helm**](https://github.com/BeforeWave/agent-helm) **Extensions** lets ChatGPT in your browser actually work on your local projects.

After installing the **Agent Helm Chrome Extension**, you continue using the same ChatGPT you already use, but it is no longer limited to what is visible inside the chat window.

It can connect to an authorized local project, understand its actual current state, make changes based on your instructions, complete tasks, and inspect the real results afterward.

Local operations run within explicit permission boundaries and a **Sandbox**, so ChatGPT can actually get work done without gaining unrestricted access to your entire machine.

You can describe problems, request changes, discuss solutions, and review results just as you normally would. Longer-running tasks can also be handed off to a local Agent when needed.

```text
                    ChatGPT in Browser
                           │
                  Understand · Reason · Work
                           │
                           ▼
                  Agent Helm Extension
                           │
                    Sandbox Boundary
                           │
                           ▼
                      Local Project
```

<img width="2166" height="1498" alt="workbench" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## Let ChatGPT work on the real local project

A task may start in a ChatGPT Conversation, but the real project stays on your machine.

Agent Helm Extension connects the two.

You no longer need to keep copying code, logs, errors, and project context into the chat. ChatGPT can work directly from your authorized local project to understand the problem, make changes, and inspect the actual result.

From a user's perspective, the workflow stays simple:

* Describe what you want in ChatGPT
* Let ChatGPT understand the current project
* Let it handle changes directly
* Hand larger tasks off to a local Agent when needed
* Return to the same Conversation to continue discussing and reviewing the work

The Extension also associates the Conversation with its corresponding local work, so you can always see which project and which piece of work sit behind the current conversation.

## Guided Setup

### Recommended: start with the Chrome Extension

**The Chrome Extension itself is an installation entry point, not just the final step after the entire environment has already been prepared.**

You can install the Agent Helm Chrome Extension first.

The Extension automatically checks whether the required local environment is already available on your machine.

<img width="1988" height="1934" alt="20260831234846" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

If the environment is not ready yet, the Extension continues guiding you through the installation, configuration, and authorization required for Agent Helm, the local connection, and the ChatGPT connection.

Steps that can be completed automatically are handled for you. When user authorization or an external action is required, the setup flow gives you a clear next step.

**You do not need to leave the browser and figure out how to install and connect the entire local environment yourself.**

### Prefer the command line?

If you prefer the Terminal, you can also install and configure Agent Helm directly:

```bash
npm install -g agent-helm
agent-helm setup
agent-helm setup chrome
```

If Agent Helm is already installed and configured, you can go directly to Chrome setup:

```bash
agent-helm setup chrome
```

Whether you start from the Extension or the command line, both paths lead to the same Setup flow.

Once setup is complete:

```bash
agent-helm start
agent-helm status
```

Agent Helm:

https://github.com/BeforeWave/agent-helm

## Browser Experience

Agent Helm Chrome Extension currently provides three main browser surfaces.

### Popup

Click the Agent Helm icon in the Chrome toolbar to quickly confirm the local connection state and whether ChatGPT is ready to work locally.

<img width="774" height="828" alt="chrome-plugin" src="https://github.com/user-attachments/assets/dec8f2ad-e632-444e-8290-4688e691cb23" />

### Side Panel

The Side Panel is the main browser view for your work.

You can see the current Workspace and Work History, move between different pieces of work, and view both work completed directly by ChatGPT and tasks handed off to local Agents.

<img width="786" height="1634" alt="chrome-pannle" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />

### Work Detail

Work Detail shows the complete context for an individual piece of work.

You can see what ChatGPT has done, work performed by local Agents, activity history, associated Conversations, and the Workspace behind the work.

When the current tab contains a `chatgpt.com` Conversation, the Extension can recognize that Conversation and associate it with the corresponding local Work.

<img width="2044" height="1516" alt="details" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

## Work History

Real work often extends beyond a single ChatGPT Conversation.

ChatGPT may complete part of the task directly and hand a larger part off to a local Agent. You may also switch Workspaces, leave the Conversation, and return later to continue.

Work History brings that work back together.

You can always find:

* Which local work belongs to this Conversation
* Which Workspace / Worktree was used
* What ChatGPT has already completed
* Whether work was handed off to a local Agent
* Which Agent Session belongs to the task
* What happened after you left the Conversation
* Which ChatGPT Conversations are associated with a Work

Work History is not another copy of the chat transcript.

It connects:

**Conversation → Workspace → Direct Work → Agent Sessions → Actual Work History**

That means even if a piece of work continues for a long time, closing a tab or switching Conversations does not cause you to lose its context.

## Let ChatGPT actually work — safely

Letting ChatGPT work on a local project should not mean handing over your entire computer.

Agent Helm Extension connects only to the local work environment you authorize. What ChatGPT can access, where it can work, and what local operations it can perform are all constrained by explicit permission boundaries.

Local execution is further constrained by a **Sandbox**.

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
       Local Project
```

This does not rely on simply telling ChatGPT through a Prompt not to access anything else.

The actual restrictions are enforced at the local execution layer.

> **ChatGPT can actually enter the project and work, while what it can access and execute remains controlled by explicit local permissions and Sandbox boundaries.**

The complete local capability and security model is provided by Agent Helm:

https://github.com/BeforeWave/agent-helm

## Related Projects

These projects can all be used independently. You do not need to understand the entire product family first.

| Project              | Description                                                                            | Link                                           |
| -------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Agent Helm**       | Gives ChatGPT controlled capabilities to work locally.                                 | https://github.com/BeforeWave/agent-helm       |
| **DSH with ChatGPT** | Brings ChatGPT and DSH Coding Agents together in a more complete development workflow. | https://github.com/BeforeWave/dsh-with-chatgpt |

## How it connects

The Extension connects to the local environment through Chrome Native Messaging:

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
Agent Helm
```

ChatGPT connects to local Agent Helm through a Secure MCP Tunnel:

```text
ChatGPT
  │
  ▼
Secure MCP Tunnel
  │
  ▼
Agent Helm
```

The two connections serve different purposes:

* The Extension handles browser interaction and presentation
* Native Messaging connects the browser to local Agent Helm
* Secure MCP Tunnel connects ChatGPT to local Agent Helm
* Agent Helm handles the actual local work and security boundaries

From the user's perspective, once these connections are set up, you still work in the same ChatGPT you already use.

## Project Status

Agent Helm Extensions is under active development.

Agent Helm Chrome Extension is currently available.

> **Bring ChatGPT in your browser directly into your local development environment, where it can understand the real project and get work done while staying within clear local permission and Sandbox boundaries.**
