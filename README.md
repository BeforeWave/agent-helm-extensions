# Agent Helm Extensions

> **Connect the ChatGPT interfaces you already use to the real local work happening through Agent Helm.**

**Agent Helm Extensions** provides browser and other user-facing integrations for [Agent Helm](https://github.com/BeforeWave/agent-helm).

The first integration is the Agent Helm Chrome Extension. It connects the active ChatGPT browser experience with Agent Helm running locally on your machine.

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

## ChatGPT in the browser, connected to real local work

A task can begin inside a ChatGPT conversation while the actual engineering work happens in a local Workspace.

The extension connects those two contexts.

It can surface:

- Agent Helm connection state
- local Workspaces
- available local capabilities
- local coding agents
- Work History
- associated ChatGPT Conversations
- delegated Subagent Sessions

This gives the browser visibility into the real local work behind the conversation.

## Guided setup

Browser integration requires a few local and browser-side setup steps, but you should not need to research or assemble those steps yourself.

**Agent Helm detects what is missing and guides you through the required installation, connection, and authorization steps.**

Install Agent Helm:

```bash
npm install -g agent-helm
```

Configure Agent Helm itself:

```bash
agent-helm setup
```

Then configure Chrome:

```bash
agent-helm setup chrome
```

The Chrome setup continues the same guided flow for browser-specific installation, Native Messaging, and user-authorized connection steps. When something requires an external action, the guide gives you the official destination and the exact next step instead of sending you off to search for documentation.

The guided connection currently uses **OpenAI tunnel-client** as Agent Helm's default Secure MCP Tunnel backend. Semantic code intelligence and sandboxed execution remain Agent Helm Core responsibilities; see [Agent Helm](https://github.com/BeforeWave/agent-helm) for the current backends and security model.

After setup, normal runtime lifecycle stays simple:

```bash
agent-helm start
agent-helm status
```

## Work History

The extension makes it easier to move between a ChatGPT conversation and the local work associated with it.

```text
ChatGPT Conversation
        │
        ▼
       Work
     /      \
Direct Work  Subagent Sessions
```

You can answer practical questions such as:

- Which local work belongs to this conversation?
- Which Workspace / Worktree was used?
- Was the task handled directly or delegated?
- Which Agent Session should I reopen?
- What happened after I left the conversation?

## The browser is not the execution boundary

The Chrome extension is an interaction and presentation layer. It is not a privileged local execution runtime.

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

Installing the extension therefore does not give the browser unrestricted access to the local machine.

For the full local security model, see [Agent Helm](https://github.com/BeforeWave/agent-helm).

## How it connects

```text
Chrome
  │
  ▼
Agent Helm Extension
  │
  ▼
Native Messaging Host
  │
  ▼
Agent Helm Core
```

This separation is intentional:

- the extension owns browser interaction and presentation
- Native Messaging connects browser and local runtime
- Agent Helm owns local capability, policy, and execution authority

The browser experience can therefore evolve independently without duplicating or bypassing Agent Helm's security boundary.

## Repository

The public repository currently contains the Chrome integration:

```text
agent-helm-extensions/
└── chrome-extension/
```

The extension is built with React and WXT.

Private browser identity and release material are kept outside the public source tree.

## Agent Helm Family

| Project | Role |
| --- | --- |
| [Agent Helm](https://github.com/BeforeWave/agent-helm) | Local engineering capabilities, security boundary, and execution control layer |
| [DSH with ChatGPT](https://github.com/BeforeWave/dsh-with-chatgpt) | Complete ChatGPT + DSH development workflow |
| **Agent Helm Extensions** | Browser and other user-facing integrations |

## Project Status

Agent Helm Extensions is under active development.

> **Keep ChatGPT where the conversation happens, while connecting it cleanly to the local work controlled by Agent Helm.**
