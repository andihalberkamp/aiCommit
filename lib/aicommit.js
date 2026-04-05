import { execSync } from "child_process";
import readline from "readline";

export const MAX_PATCH_LINES = 120;
export const DEFAULT_PATH = ".";
export const VALID_ACTIONS = new Set(["y", "p", "e", "r", "n"]);

export const colors = {
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m"
};

export const HELP_TEXT = `
aicommit - generate Git commit messages with Codex

Usage:
  aicommit [path ...]

Examples:
  aicommit
  aicommit .
  aicommit src package.json

What it does:
  1. Stages the provided paths
  2. Reads the staged diff
  3. Asks Codex to generate a commit message
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

export function ensureGitRepository(runCommandImpl = runCommand) {
  try {
    runCommandImpl("git rev-parse --is-inside-work-tree");
  } catch {
    throw new Error("This command must be run inside a Git repository.");
  }
}

export function ensureCodexAvailable(runCommandImpl = runCommand) {
  try {
    runCommandImpl("codex --version");
  } catch {
    throw new Error(
      "Codex CLI is not available. Please install it and make sure `codex` is in your PATH."
    );
  }
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

export function generateMessage(context, ticket, runCommandImpl = runCommand) {
  const prompt = buildPrompt(context, ticket);
  return runCommandImpl(`codex exec ${escapeShellArg(prompt)}`);
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
  }
} = {}) {
  if (argv.includes("-h") || argv.includes("--help")) {
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
    ensureCodexAvailable(runCommandImpl);

    stagePaths(argv, runCommandImpl);

    const staged = getStagedFiles(runCommandImpl);
    if (!staged) {
      printer.warning("No staged changes.");
      return { status: "no-staged" };
    }

    const ticket = getBranchTicket(getCurrentBranchImpl);
    const context = getDiffContext(runCommandImpl);

    let message = normalizeMessage(generateMessage(context, ticket, runCommandImpl), ticket);

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
        message = normalizeMessage(generateMessage(context, ticket, runCommandImpl), ticket);
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
