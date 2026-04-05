[![npm downloads](https://img.shields.io/npm/dm/%40ahalberkamp%2Faicommit?logo=npm)](https://www.npmjs.com/package/@ahalberkamp/aicommit)
<p align="center">
  <img src="https://raw.githubusercontent.com/andihalberkamp/aiCommit/main/assets/aicommit-logo.png" alt="AICommit logo" width="320" />
</p>

# aicommit

Generate clean Git commit messages from staged changes using Codex.

## Features

- Stages files and folders you pass in
- Reads the staged Git diff
- Uses Codex to suggest a commit message
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
- Codex CLI installed and available in your shell

## Installation

### Option 1: Install from npm

```bash
npm install --global @ahalberkamp/aicommit
```

After that, you can run:

```bash
aicommit
```

If you install it locally into a project instead:

```bash
npm install @ahalberkamp/aicommit
./node_modules/.bin/aicommit
```

### Option 2: Run locally from the repository

```bash
git clone https://github.com/andihalberkamp/aiCommit.git
cd aicommit
npm install
npm link
```

After that, you can run:

```bash
aicommit
```

### Option 3: Use directly with Node.js

```bash
node ./bin/aicommit.js
```

## Platform Notes

### macOS

Make sure these are installed and available in your terminal:

- `node`
- `git`
- `codex`

### Linux

Install Node.js, Git, and the Codex CLI with your preferred package manager or installer.

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

### Stage a specific folder

```bash
aicommit src
```

### Stage multiple paths

```bash
aicommit src package.json README.md
```

## Typical Flow

When you run the command:

1. The provided paths are staged with `git add`
2. The staged diff is collected
3. Codex generates a commit message
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

## Example

Suggested commit:

```text
ABC-123: Prevent duplicate order creation during payment retry.
```

## Troubleshooting

### `codex: command not found`

Install the Codex CLI and make sure it is available in your `PATH`.

### `aicommit: command not found`

If you installed with `npm install @ahalberkamp/aicommit`, the binary is local to the project.
Run it with `./node_modules/.bin/aicommit`, or install it globally with
`npm install --global @ahalberkamp/aicommit`.

### `This command must be run inside a Git repository`

Run `aicommit` from inside a Git repository.

### `No staged changes`

The paths you passed in may not contain any changes, or your files may already be committed.

## Security Notes

Before publishing or using this tool broadly:

- do not hardcode secrets
- do not embed private repository URLs
- do not rely on company-specific branch naming rules unless documented

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT. See [LICENSE](./LICENSE).
