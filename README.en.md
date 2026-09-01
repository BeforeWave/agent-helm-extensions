# Agent Helm Extensions

[中文](./README.md)

> **Keep ChatGPT where the conversation happens, while connecting it to the real local work managed by Agent Helm.**

**Agent Helm Extensions** provides browser and other user-facing integrations for [Agent Helm](https://github.com/BeforeWave/agent-helm).

The first integration is the **Agent Helm Chrome Extension**. It connects the ChatGPT experience in your browser with Agent Helm running locally on your machine.

```text
                    ChatGPT in Chrome
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
<img width="2166" height="1498" alt="workbench" src="https://github.com/user-attachments/assets/0c65c877-91d2-4453-a986-52d1bd13af5a" />

## ChatGPT in the browser, connected to real local work

A task can begin inside a ChatGPT conversation while the actual engineering work happens in a local Workspace.

Agent Helm Extension connects those two contexts.

From the browser, you can see:

- Agent Helm connection state
- local Workspaces
- available capabilities
- local Coding Agents
- Work History
- associated ChatGPT Conversations
- delegated Subagent Sessions

This gives the browser visibility into the real local work behind the conversation.

## Guided setup

### Recommended: start with the Chrome Extension

**The Chrome Extension can be your starting point, not just the final installation step.**

You can install the Agent Helm Chrome Extension first. The Extension checks whether the local Agent Helm environment is already available.

<img width="1988" height="1934" alt="20260831234846" src="https://github.com/user-attachments/assets/635dc6ec-429c-4553-ba8e-a9528afeeac3" />

If Agent Helm is not installed yet, the Extension guides you through the required installation and configuration, including:

- Agent Helm Core
- the required Node.js runtime
- Chrome Native Messaging registration
- Serena / Semantic Code Intelligence
- OpenAI tunnel-client
- Secure MCP Tunnel configuration
- ChatGPT Developer Mode / Connector configuration

Where automatic installation is supported, Agent Helm can perform the installation for you. When a step requires user authorization or an external action, the setup flow provides the official destination and the exact next step.

**You do not need to leave the browser first and research how to prepare the entire local environment yourself.**

```text
Install Chrome Extension
        │
        ▼
Detect local Agent Helm
        │
        ├── Installed ─────────────┐
        │                          │
        └── Missing               │
              │                   │
              ▼                   │
       Guide Agent Helm install   │
              │                   │
              ▼                   │
 Guide dependencies / Tunnel /    │
       ChatGPT connection         │
              │                   │
              └───────────────────┘
                        │
                        ▼
                       Ready
```

### Prefer the terminal?

You can also install and configure Agent Helm independently from the CLI:

```bash
npm install -g agent-helm
agent-helm setup
agent-helm setup chrome
```

### Already have Agent Helm installed and configured?

Skip directly to Chrome integration setup:

```bash
agent-helm setup chrome
```

Both entry points converge on the same Agent Helm setup flow.

If an external action is required, Agent Helm gives you the official destination and the next action instead of sending you away to search third-party documentation.

The current connection stack uses:

- **OpenAI tunnel-client** as Agent Helm's default Secure MCP Tunnel backend
- **Chrome Native Messaging** between the Extension and local Agent Helm Core
- Agent Helm Core for semantic code intelligence and sandboxed local execution

For the current Serena, Anthropic Sandbox Runtime, OpenAI tunnel-client backends, and the complete security model, see [Agent Helm](https://github.com/BeforeWave/agent-helm).

After setup, the normal runtime lifecycle stays simple:

```bash
agent-helm start
agent-helm status
```

## Browser Experience

Agent Helm Chrome Extension currently provides three main browser surfaces.

### Popup

Click the Agent Helm icon in the Chrome toolbar to quickly inspect and control:

- Agent Helm Service state
- Understand / Code / Command capabilities
- available Coding Agents
- Local Agent LSP
- Tunnel state

<img width="774" height="828" alt="chrome-plugin" src="https://github.com/user-attachments/assets/dec8f2ad-e632-444e-8290-4688e691cb23" />


### Side Panel

The Side Panel is the primary browser view for local work.

You can:

- browse Work History
- filter local work by Workspace
- add or switch Workspaces
- inspect work performed directly by ChatGPT
- inspect Subagent Sessions
- move between different Work records

<img width="786" height="1634" alt="chrome-pannle" src="https://github.com/user-attachments/assets/17fa7b87-c106-4449-aa4a-25de518f9d75" />


### Work Detail

Work Detail shows the complete context for an individual Work record, including:

- ChatGPT Direct Work
- Subagent Work
- activity timeline
- execution actions
- associated ChatGPT Conversations
- Workspace information
- the initial requirement and subsequent work context

When the current browser tab contains a `chatgpt.com` Conversation, the Extension can detect that Conversation and associate it with the corresponding Agent Helm Work History record.

<img width="2044" height="1516" alt="details" src="https://github.com/user-attachments/assets/fd371ede-b590-434c-ab4e-34610df3999f" />

## Work History

Agent Helm Extension makes it easier to move between a ChatGPT Conversation and the local work behind it.

```text
ChatGPT Conversation
        │
        ▼
       Work
     /      \
Direct Work  Subagent Sessions
```

You can answer practical questions such as:

- Which local work belongs to this Conversation?
- Which Workspace / Worktree was used?
- Was the task handled directly by ChatGPT or delegated to a Subagent?
- Which Agent Session should I reopen?
- What happened locally after I left the Conversation?
- Which ChatGPT Conversations are associated with this Work?

Work History is not intended to be just another chat log.

It connects:

**Conversation → Workspace → Direct Work → Subagent Sessions → actual execution history**

## The browser is not the execution boundary

The Chrome Extension is an interaction and presentation layer. It is not a privileged local execution runtime.

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

Filesystem access, command execution, environment access, networking, semantic capabilities, and Agent delegation remain controlled by Agent Helm.

Installing the Chrome Extension therefore does not give the browser unrestricted access to the local machine.

For the complete local capability boundary, security model, and sandbox enforcement model, see [Agent Helm](https://github.com/BeforeWave/agent-helm).

## How it connects

The browser connects to Agent Helm Core through:

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

ChatGPT connects to the local Agent Helm MCP service through the default path:

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

These two paths have different responsibilities:

- the Extension owns browser interaction and presentation
- Native Messaging connects the browser to local Agent Helm Core
- the Secure MCP Tunnel connects ChatGPT to the Agent Helm MCP endpoint
- Agent Helm Core owns local capabilities, policy, runtime lifecycle, and execution authority

This separation allows the browser experience to evolve independently without duplicating or bypassing Agent Helm's security boundary.

## Repository

The Chrome Extension source lives under:

```text
agent-helm-extensions/
└── chrome-extension/
```

The Extension is built with:

- React
- TypeScript
- WXT

Private browser identity and private release material are kept outside the public source tree.

## Development

The Chrome Extension development environment requires:

- Node.js 22+
- npm
- Google Chrome

Clone the repository and install dependencies:

```bash
git clone https://github.com/BeforeWave/agent-helm-extensions.git
cd agent-helm-extensions/chrome-extension
npm install
```

Run the Extension in WXT development mode:

```bash
npm run dev:extension
```

For a production-style unpacked build:

```bash
npm run build
```

The generated extension is available at:

```text
chrome-extension/.output/chrome-mv3
```

Then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Choose **Load unpacked**
4. Select `chrome-extension/.output/chrome-mv3`

Before submitting changes:

```bash
npm run typecheck
npm test
```

If you only want to preview the Extension UI without connecting to a real Agent Helm runtime, use the Web Preview:

```bash
npm run dev:web
```

## Agent Helm Family

| Project | Role |
| --- | --- |
| [Agent Helm](https://github.com/BeforeWave/agent-helm) | Local engineering capabilities, security boundary, and execution control layer for ChatGPT |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | Complete ChatGPT + DSH local development workflow |
| **Agent Helm Extensions** | Browser and other user-facing Agent Helm integrations |

## Project Status

Agent Helm Extensions is under active development.

The first integration is the Chrome Extension. Additional user-facing clients and integrations can evolve under the same Extensions product boundary.

> **Keep ChatGPT where the conversation happens, while connecting it cleanly to the real local work controlled by Agent Helm.**
