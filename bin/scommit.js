#!/usr/bin/env node

import { execSync } from "child_process";
import readline from "readline";

const MAX_PATCH_LINES = 120;
const DEFAULT_PATH = ".";
const VALID_ACTIONS = new Set(["y", "p", "e", "r", "n"]);

const colors = {
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m"
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function printInfo(message) {
  console.log(`${colors.cyan}${message}${colors.reset}`);
}

function printSuccess(message) {
  console.log(`${colors.green}${message}${colors.reset}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}${message}${colors.reset}`);
}

function printError(message) {
  console.error(`${colors.red}${message}${colors.reset}`);
}

function escapeShellArg(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runCommand(command, options = {}) {
  try {
    return execSync(command, {
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

function ensureGitRepository() {
  try {
    runCommand("git rev-parse --is-inside-work-tree");
  } catch {
    throw new Error("This command must be run inside a Git repository.");
  }
}

function ensureCodexAvailable() {
  try {
    runCommand("codex --version");
  } catch {
    throw new Error(
      "Codex CLI is not available. Please install it and make sure `codex` is in your PATH."
    );
  }
}

function getCurrentBranch() {
  return runCommand("git branch --show-current");
}

function getBranchTicket() {
  try {
    const branch = getCurrentBranch();
    const match = branch.match(/[A-Z]+-\d+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

function stagePaths(paths) {
  const safePaths = (paths.length > 0 ? paths : [DEFAULT_PATH])
    .map(escapeShellArg)
    .join(" ");

  runCommand(`git add ${safePaths}`);
}

function getStagedFiles() {
  return runCommand("git diff --cached --name-only");
}

function getDiffContext() {
  const files = runCommand("git diff --cached --name-only");
  const stat = runCommand("git diff --cached --stat");

  let patch = "";
  try {
    patch = runCommand(`git diff --cached -U3 | head -n ${MAX_PATCH_LINES}`);
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

function buildPrompt(context, ticket) {
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

function generateMessage(context, ticket) {
  const prompt = buildPrompt(context, ticket);
  return runCommand(`codex exec ${escapeShellArg(prompt)}`);
}

function normalizeMessage(raw, ticket) {
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

function commit(message) {
  const safeMessage = message.replace(/"/g, '\\"');
  execSync(`git commit -m "${safeMessage}"`, { stdio: "inherit" });
}

function pushCurrentBranch() {
  const branch = getCurrentBranch();

  try {
    execSync("git push", { stdio: "inherit" });
  } catch {
    execSync(`git push -u origin ${branch}`, { stdio: "inherit" });
  }
}

function printHelp() {
  console.log(`
smartcommit - generate Git commit messages with Codex

Usage:
  scommit [path ...]

Examples:
  scommit
  scommit .
  scommit src package.json

What it does:
  1. Stages the provided paths
  2. Reads the staged diff
  3. Asks Codex to generate a commit message
  4. Lets you commit, commit and push, edit, regenerate, or abort
`);
}

async function run() {
  const args = process.argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    rl.close();
    return;
  }

  try {
    ensureGitRepository();
    ensureCodexAvailable();

    stagePaths(args);

    const staged = getStagedFiles();
    if (!staged) {
      printWarning("No staged changes.");
      rl.close();
      process.exit(0);
    }

    const ticket = getBranchTicket();
    const context = getDiffContext();

    let message = normalizeMessage(generateMessage(context, ticket), ticket);

    while (true) {
      console.log();
      printInfo("Suggested commit:");
      printSuccess(message);
      console.log();

      const answer = (
        await ask("(y) commit  (p) commit+push  (e) edit  (r) regenerate  (n) abort: ")
      )
        .trim()
        .toLowerCase();

      if (!VALID_ACTIONS.has(answer)) {
        printWarning("Please choose one of: y, p, e, r, n.");
        continue;
      }

      if (answer === "y") {
        commit(message);
        break;
      }

      if (answer === "p") {
        commit(message);
        pushCurrentBranch();
        break;
      }

      if (answer === "e") {
        const edited = (await ask("Enter commit message: ")).trim();

        if (!edited) {
          printWarning("Commit message cannot be empty.");
          continue;
        }

        commit(edited);
        break;
      }

      if (answer === "r") {
        message = normalizeMessage(generateMessage(context, ticket), ticket);
        continue;
      }

      if (answer === "n") {
        printWarning("Commit aborted.");
        break;
      }
    }
  } catch (error) {
    printError(error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

run();
