import { execSync } from "child_process";
import readline from "readline";

export const MAX_PATCH_LINES = 120;
export const DEFAULT_PATH = ".";
export const VALID_ACTIONS = new Set(["y", "p", "e", "r", "n"]);
export const DEFAULT_PROVIDER = "codex";
export const SUPPORTED_PROVIDERS = {
  codex: {
    displayName: "Codex",
    versionCommand: "codex --version",
    buildPromptCommand(prompt) {
      return `codex exec ${escapeShellArg(prompt)}`;
    }
  },
  claude: {
    displayName: "Claude Code",
    versionCommand: "claude --version",
    buildPromptCommand(prompt) {
      return `claude -p ${escapeShellArg(prompt)}`;
    }
  }
};

export const colors = {
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m"
};

export const HELP_TEXT = `
aicommit - generate Git commit messages with Codex or Claude Code

Usage:
  aicommit [path ...]
  aicommit --provider codex [path ...]
  aicommit --provider claude [path ...]

Examples:
  aicommit
  aicommit .
  aicommit src package.json
  aicommit --provider claude src

Options:
  --provider <codex|claude>  Choose the AI CLI.

Environment variable:
  AICOMMIT_PROVIDER          Same as --provider, set the chosen provider permanently.

What it does:
  1. Stages the provided paths
  2. Reads the staged diff
  3. Asks the selected AI CLI to generate a commit message
  4. Lets you commit, commit and push, edit, regenerate, or abort
`;

export function createPrinter({
  log = console.log,
  errorLog = console.error,
  palette = colors
} = {}) {
  return {
    info(message) {
      log(`${palette.cyan}${message}${palette.reset}`);
    },
    success(message) {
      log(`${palette.green}${message}${palette.reset}`);
    },
    warning(message) {
      log(`${palette.yellow}${message}${palette.reset}`);
    },
    error(message) {
      errorLog(`${palette.red}${message}${palette.reset}`);
    },
    line(message = "") {
      log(message);
    }
  };
}

export function createAsk(rl) {
  return (question) => new Promise((resolve) => rl.question(question, resolve));
}

export function escapeShellArg(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function runCommand(command, options = {}, exec = execSync) {
  try {
    return exec(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...options
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString()?.trim();
    const stdout = error?.stdout?.toString()?.trim();
    const detail = stderr || stdout || error.message;
    throw new Error(`Command failed: ${command}\n${detail}`);
  }
}

export function normalizeProviderName(value) {
  return String(value).trim().toLowerCase();
}

export function getProviderConfig(providerName) {
  const normalizedProvider = normalizeProviderName(providerName);
  const provider = SUPPORTED_PROVIDERS[normalizedProvider];

  if (!provider) {
    throw new Error(
      `Unsupported provider "${providerName}". Use one of: ${Object.keys(SUPPORTED_PROVIDERS).join(", ")}.`
    );
  }

  return { name: normalizedProvider, ...provider };
}

export function parseCliArgs(argv, env = process.env) {
  const paths = [];
  let requestedProvider = env.AICOMMIT_PROVIDER ?? null;
  let showHelp = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      showHelp = true;
      continue;
    }

    if (arg === "--provider") {
      index += 1;

      if (index >= argv.length) {
        throw new Error("Missing value for --provider. Use --provider codex or --provider claude.");
      }

      requestedProvider = argv[index];
      continue;
    }

    if (arg.startsWith("--provider=")) {
      requestedProvider = arg.slice("--provider=".length);
      continue;
    }

    paths.push(arg);
  }

  return {
    paths,
    showHelp,
    requestedProvider: requestedProvider ? normalizeProviderName(requestedProvider) : null
  };
}

export function ensureGitRepository(runCommandImpl = runCommand) {
  try {
    runCommandImpl("git rev-parse --is-inside-work-tree");
  } catch {
    throw new Error("This command must be run inside a Git repository.");
  }
}

export function isProviderAvailable(providerName, runCommandImpl = runCommand) {
  const provider = getProviderConfig(providerName);

  try {
    runCommandImpl(provider.versionCommand);
    return true;
  } catch {
    return false;
  }
}

export function resolveProvider(requestedProvider, runCommandImpl = runCommand) {
  if (requestedProvider) {
    const provider = getProviderConfig(requestedProvider);

    if (!isProviderAvailable(provider.name, runCommandImpl)) {
      throw new Error(
        `${provider.displayName} CLI is not available. Please install it and make sure \`${provider.name}\` is in your PATH.`
      );
    }

    return provider;
  }

  if (isProviderAvailable(DEFAULT_PROVIDER, runCommandImpl)) {
    return getProviderConfig(DEFAULT_PROVIDER);
  }

  if (isProviderAvailable("claude", runCommandImpl)) {
    return getProviderConfig("claude");
  }

  throw new Error(
    "Neither Codex nor Claude Code CLI is available. Please install `codex` or `claude`, or choose one with --provider."
  );
}

export function getCurrentBranch(runCommandImpl = runCommand) {
  return runCommandImpl("git branch --show-current");
}

export function getBranchTicket(getCurrentBranchImpl = getCurrentBranch) {
  try {
    const branch = getCurrentBranchImpl();
    const match = branch.match(/[A-Z]+-\d+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export function stagePaths(paths, runCommandImpl = runCommand) {
  const safePaths = (paths.length > 0 ? paths : [DEFAULT_PATH])
    .map(escapeShellArg)
    .join(" ");

  runCommandImpl(`git add ${safePaths}`);
}

export function getStagedFiles(runCommandImpl = runCommand) {
  return runCommandImpl("git diff --cached --name-only");
}

export function getDiffContext(runCommandImpl = runCommand) {
  const files = runCommandImpl("git diff --cached --name-only");
  const stat = runCommandImpl("git diff --cached --stat");

  let patch = "";
  try {
    patch = runCommandImpl(`git diff --cached -U3 | head -n ${MAX_PATCH_LINES}`);
  } catch {
    patch = "";
  }

  return `
Changed files:
${files || "(none)"}

Diff summary:
${stat || "(none)"}

Patch snippet:
${patch || "(none)"}
`;
}

export function buildPrompt(context, ticket) {
  return `
Write a git commit message as ONE complete sentence.

Rules:
- imperative mood
- start with a capital letter
- end with a period
- max 90 characters
${ticket ? `- start with "${ticket}:"` : ""}
- do not add prefixes like fix:, feat:, chore:

Example:
${
  ticket
    ? `${ticket}: Prevent duplicate order creation during payment retry.`
    : "Prevent duplicate order creation during payment retry."
}

${context}
`;
}

export function generateMessage(context, ticket, providerName = DEFAULT_PROVIDER, runCommandImpl = runCommand) {
  const provider = getProviderConfig(providerName);
  const prompt = buildPrompt(context, ticket);
  return runCommandImpl(provider.buildPromptCommand(prompt));
}

export function normalizeMessage(raw, ticket) {
  let message = raw.trim().split("\n")[0].trim();
  message = message.replace(/^["'`]+|["'`]+$/g, "");

  if (ticket) {
    if (!message.startsWith(ticket)) {
      message = `${ticket}: ${message}`;
    }

    if (message.startsWith(`${ticket} `)) {
      message = `${ticket}: ${message.slice(ticket.length + 1)}`;
    }
  }

  if (message.length > 0) {
    message = message.charAt(0).toUpperCase() + message.slice(1);
  }

  if (!message.endsWith(".")) {
    message += ".";
  }

  return message;
}

export function commit(message, exec = execSync) {
  const safeMessage = message.replace(/"/g, '\\"');
  exec(`git commit -m "${safeMessage}"`, { stdio: "inherit" });
}

export function pushCurrentBranch({
  exec = execSync,
  getCurrentBranchImpl = () => getCurrentBranch((command, options) => runCommand(command, options, exec))
} = {}) {
  const branch = getCurrentBranchImpl();

  try {
    exec("git push", { stdio: "inherit" });
  } catch {
    exec(`git push -u origin ${branch}`, { stdio: "inherit" });
  }
}

export function printHelp(log = console.log) {
  log(HELP_TEXT);
}

export async function runCli({
  argv = process.argv.slice(2),
  exec = execSync,
  createInterface = readline.createInterface,
  input = process.stdin,
  output = process.stdout,
  log = console.log,
  errorLog = console.error,
  setExitCode = (code) => {
    process.exitCode = code;
  },
  env = process.env
} = {}) {
  const { paths, showHelp, requestedProvider } = parseCliArgs(argv, env);

  if (showHelp) {
    printHelp(log);
    return { status: "help" };
  }

  const printer = createPrinter({ log, errorLog });
  const runCommandImpl = (command, options = {}) => runCommand(command, options, exec);
  const getCurrentBranchImpl = () => getCurrentBranch(runCommandImpl);
  let rl;

  try {
    rl = createInterface({ input, output });
    const ask = createAsk(rl);

    ensureGitRepository(runCommandImpl);
    const provider = resolveProvider(requestedProvider, runCommandImpl);

    stagePaths(paths, runCommandImpl);

    const staged = getStagedFiles(runCommandImpl);
    if (!staged) {
      printer.warning("No staged changes.");
      return { status: "no-staged" };
    }

    const ticket = getBranchTicket(getCurrentBranchImpl);
    const context = getDiffContext(runCommandImpl);

    let message = normalizeMessage(generateMessage(context, ticket, provider.name, runCommandImpl), ticket);

    while (true) {
      printer.line();
      printer.info("Suggested commit:");
      printer.success(message);
      printer.line();

      const answer = (
        await ask("(y) commit  (p) commit+push  (e) edit  (r) regenerate  (n) abort: ")
      )
        .trim()
        .toLowerCase();

      if (!VALID_ACTIONS.has(answer)) {
        printer.warning("Please choose one of: y, p, e, r, n.");
        continue;
      }

      if (answer === "y") {
        commit(message, exec);
        return { status: "committed", message };
      }

      if (answer === "p") {
        commit(message, exec);
        pushCurrentBranch({ exec, getCurrentBranchImpl });
        return { status: "pushed", message };
      }

      if (answer === "e") {
        const edited = (await ask("Enter commit message: ")).trim();

        if (!edited) {
          printer.warning("Commit message cannot be empty.");
          continue;
        }

        commit(edited, exec);
        return { status: "committed", message: edited };
      }

      if (answer === "r") {
        message = normalizeMessage(generateMessage(context, ticket, provider.name, runCommandImpl), ticket);
        continue;
      }

      printer.warning("Commit aborted.");
      return { status: "aborted" };
    }
  } catch (error) {
    printer.error(error.message);
    setExitCode(1);
    return { status: "error", error };
  } finally {
    rl?.close();
  }
}
