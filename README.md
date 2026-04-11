

<p align="left">
  <img src="https://img.shields.io/badge/Codex-supported-0F172A?style=for-the-badge" alt="Codex supported" />
  <img src="https://img.shields.io/badge/Claude%20Code-supported-D97706?style=for-the-badge" alt="Claude Code supported" />
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/andihalberkamp/aiCommit/main/assets/aicommit-logo.png" alt="AICommit logo" width="320" />
</p>

# aicommit

Generate clean Git commit messages from staged changes using Codex or Claude Code.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Install using npm:](#install-using-npm)
  - [Install using Homebrew:](#install-using-homebrew)
- [Platform Notes](#platform-notes)
  - [macOS](#macos)
  - [Linux](#linux)
  - [Windows](#windows)
- [Usage](#usage)
  - [Stage everything and generate a commit](#stage-everything-and-generate-a-commit)
  - [Stage a specific folder](#stage-a-specific-folder)
  - [Stage multiple paths](#stage-multiple-paths)
  - [Choose the AI CLI explicitly](#choose-the-ai-cli-explicitly)
- [Typical Flow](#typical-flow)
- [Ticket Prefix Support](#ticket-prefix-support)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Features

- Stages files and folders you pass in
- Reads the staged Git diff
- Uses Codex or Claude Code to suggest a commit message
- Detects ticket IDs from the current branch name, such as `ABC-123`
- Lets you:
  - commit
  - commit and push
  - edit the message manually
  - regenerate the suggestion
  - abort

## Requirements

- Node.js 18 or newer
- Git
- Codex CLI or Claude Code installed and available in your shell

## Installation

### Install using npm:

```bash
npm install --global @ahalberkamp/aicommit
```

### Install using Homebrew:

```bash
brew tap andihalberkamp/tap
brew install andihalberkamp/tap/aicommit
```

## Platform Notes

### macOS

Make sure these are installed and available in your terminal:

- `node`
- `git`
- `codex`
- `claude` if you want to use Claude Code

### Linux

Install Node.js, Git, and either Codex or Claude Code with your preferred package manager or installer.

### Windows

Use one of these:

- PowerShell
- Windows Terminal
- Git Bash
- WSL

For the best experience, Git Bash or WSL is recommended.

## Usage

### Stage everything and generate a commit

```bash
aicommit
```

By default, `aicommit` tries `codex` first and falls back to `claude` if Codex is not installed.

### Stage a specific folder

```bash
aicommit src
```

### Stage multiple paths

```bash
aicommit src package.json README.md
```

### Choose the AI CLI explicitly

```bash
aicommit --provider codex
aicommit --provider claude
```

You can also set the provider permanently with an environment variable:

```bash
AICOMMIT_PROVIDER=claude aicommit src
```

## Typical Flow

When you run the command:

1. The provided paths are staged with `git add`
2. The staged diff is collected
3. The selected AI CLI generates a commit message
4. You choose one of these actions:

```text
(y) commit
(p) commit+push
(e) edit
(r) regenerate
(n) abort
```

## Ticket Prefix Support

If your current Git branch contains a ticket ID like:

```text
ABC-123-add-login-validation
```

`aicommit` will try to prefix the commit message like this:

```text
ABC-123: Improve login validation for empty password input.
```
## License

MIT. See [LICENSE](./LICENSE).
