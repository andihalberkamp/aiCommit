import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrompt,
  escapeShellArg,
  HELP_TEXT,
  normalizeMessage,
  pushCurrentBranch,
  runCli,
  stagePaths
} from "../lib/aicommit.js";

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function createInterfaceStub(answers = []) {
  const prompts = [];
  let closed = false;

  return {
    prompts,
    get closed() {
      return closed;
    },
    question(prompt, callback) {
      prompts.push(prompt);
      callback(answers.shift() ?? "");
    },
    close() {
      closed = true;
    }
  };
}

test("escapeShellArg escapes apostrophes for safe git add commands", () => {
  assert.equal(escapeShellArg("src/it's-ready.js"), "'src/it'\\''s-ready.js'");
});

test("stagePaths stages the current directory by default and escapes custom paths", () => {
  const commands = [];
  const runCommandImpl = (command) => {
    commands.push(command);
    return "";
  };

  stagePaths([], runCommandImpl);
  stagePaths(["src", "docs/it's.md"], runCommandImpl);

  assert.deepEqual(commands, ["git add '.'", "git add 'src' 'docs/it'\\''s.md'"]);
});

test("buildPrompt includes the ticket rule only when a ticket is present", () => {
  const withTicket = buildPrompt("Changed files:\napp.js", "ABC-123");
  const withoutTicket = buildPrompt("Changed files:\napp.js", null);

  assert.match(withTicket, /start with "ABC-123:"/);
  assert.match(withTicket, /ABC-123: Prevent duplicate order creation during payment retry\./);
  assert.doesNotMatch(withoutTicket, /start with "/);
});

test("normalizeMessage trims quotes and adds the missing period", () => {
  assert.equal(normalizeMessage('"improve prompt formatting"', null), "Improve prompt formatting.");
  assert.equal(
    normalizeMessage("ABC-123 improve prompt formatting", "ABC-123"),
    "ABC-123: improve prompt formatting."
  );
});

test("pushCurrentBranch falls back to setting upstream when plain git push fails", () => {
  const calls = [];
  const exec = (command) => {
    calls.push(command);

    if (command === "git push") {
      throw new Error("missing upstream");
    }

    return "";
  };

  pushCurrentBranch({
    exec,
    getCurrentBranchImpl: () => "feature/test-branch"
  });

  assert.deepEqual(calls, ["git push", "git push -u origin feature/test-branch"]);
});

test("runCli prints help without creating a readline interface", async () => {
  const logs = [];
  let createInterfaceCalled = false;

  const result = await runCli({
    argv: ["--help"],
    log: (message) => logs.push(message),
    createInterface() {
      createInterfaceCalled = true;
      throw new Error("readline should not be created for help");
    }
  });

  assert.equal(result.status, "help");
  assert.equal(createInterfaceCalled, false);
  assert.equal(logs[0], HELP_TEXT);
});

test("runCli stops cleanly when no staged changes exist", async () => {
  const logs = [];
  const rl = createInterfaceStub();
  const commands = [];

  const exec = (command) => {
    commands.push(command);

    switch (command) {
      case "git rev-parse --is-inside-work-tree":
        return "true";
      case "codex --version":
        return "1.0.0";
      case "git add '.'":
        return "";
      case "git diff --cached --name-only":
        return "";
      default:
        throw new Error(`Unexpected command: ${command}`);
    }
  };

  const result = await runCli({
    argv: [],
    exec,
    createInterface: () => rl,
    log: (message) => logs.push(message),
    errorLog: (message) => logs.push(message)
  });

  assert.equal(result.status, "no-staged");
  assert.equal(rl.closed, true);
  assert.deepEqual(commands, [
    "git rev-parse --is-inside-work-tree",
    "codex --version",
    "git add '.'",
    "git diff --cached --name-only"
  ]);
  assert.ok(logs.some((message) => stripAnsi(message).includes("No staged changes.")));
});

test("runCli commits the normalized Codex message on confirmation", async () => {
  const logs = [];
  const rl = createInterfaceStub(["y"]);
  let commitCommand = null;

  const exec = (command) => {
    if (command === "git rev-parse --is-inside-work-tree") {
      return "true";
    }

    if (command === "codex --version") {
      return "1.0.0";
    }

    if (command === "git add 'src'") {
      return "";
    }

    if (command === "git diff --cached --name-only") {
      return "src/index.js";
    }

    if (command === "git branch --show-current") {
      return "ABC-123-add-tests";
    }

    if (command === "git diff --cached --stat") {
      return " src/index.js | 1 +";
    }

    if (command === "git diff --cached -U3 | head -n 120") {
      return "+ console.log('test');";
    }

    if (command.startsWith("codex exec ")) {
      return "improve test coverage";
    }

    if (command.startsWith('git commit -m "')) {
      commitCommand = command;
      return "";
    }

    throw new Error(`Unexpected command: ${command}`);
  };

  const result = await runCli({
    argv: ["src"],
    exec,
    createInterface: () => rl,
    log: (message) => logs.push(message),
    errorLog: (message) => logs.push(message)
  });

  assert.equal(result.status, "committed");
  assert.equal(result.message, "ABC-123: improve test coverage.");
  assert.equal(commitCommand, 'git commit -m "ABC-123: improve test coverage."');
  assert.equal(rl.closed, true);
  assert.deepEqual(rl.prompts, ["(y) commit  (p) commit+push  (e) edit  (r) regenerate  (n) abort: "]);
  assert.ok(logs.some((message) => stripAnsi(message).includes("Suggested commit:")));
});
