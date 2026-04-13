import { EventEmitter } from "node:events";

export interface BuildPiArgsLike {
  buildPiArgs: (input: unknown) => { args: string[]; env: Record<string, string | undefined>; tempDir?: string };
}

export interface ChildProcessLike extends EventEmitter {
  stdout: EventEmitter & { on(event: "data", listener: (chunk: Buffer | string) => void): unknown };
  stderr: EventEmitter;
  kill(signal?: string): boolean;
  killed?: boolean;
  exitCode?: number | null;
  pid?: number;
}

export interface ExecutionModuleLike {
  runSync: (...args: unknown[]) => Promise<unknown>;
}

const NO_EXTENSIONS_FLAG = "--no-extensions";
const NO_SKILLS_FLAG = "--no-skills";

function findTaskArgIndex(args: string[]): number {
  const index = args.findIndex((arg) => arg.startsWith("Task:") || arg.startsWith("@"));
  return index === -1 ? args.length : index;
}

export function patchBuildPiArgsModule(moduleUnderTest: BuildPiArgsLike): void {
  const current = moduleUnderTest.buildPiArgs as typeof moduleUnderTest.buildPiArgs & { __spxPatched?: boolean };
  if (current.__spxPatched) return;

  const original = current;
  const patched = ((input: unknown) => {
    const result = original(input);
    const value = input as { skills?: unknown } | undefined;

    if (!result.args.includes(NO_EXTENSIONS_FLAG)) {
      result.args.splice(findTaskArgIndex(result.args), 0, NO_EXTENSIONS_FLAG);
    }

    if (value?.skills !== undefined && !result.args.includes(NO_SKILLS_FLAG)) {
      result.args.splice(findTaskArgIndex(result.args), 0, NO_SKILLS_FLAG);
    }

    return result;
  }) as typeof moduleUnderTest.buildPiArgs & { __spxPatched?: boolean };

  patched.__spxPatched = true;
  moduleUnderTest.buildPiArgs = patched;
}

export function wrapChildForLogicalCompletion(child: ChildProcessLike): ChildProcessLike {
  const proxy = new EventEmitter() as ChildProcessLike;
  proxy.stdout = child.stdout;
  proxy.stderr = child.stderr as ChildProcessLike["stderr"];
  proxy.kill = (signal?: string) => child.kill(signal);

  Object.defineProperty(proxy, "killed", { get: () => child.killed });
  Object.defineProperty(proxy, "exitCode", { get: () => child.exitCode });
  Object.defineProperty(proxy, "pid", { get: () => child.pid });

  let closed = false;
  let buffer = "";

  const emitLogicalClose = () => {
    if (closed) return;
    closed = true;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000);
    proxy.emit("close", 0);
  };

  const processLine = (line: string) => {
    if (!line.trim()) return;

    let evt: { type?: string } | undefined;
    try {
      evt = JSON.parse(line) as { type?: string };
    } catch {
      return;
    }

    if (evt.type === "agent_end") {
      emitLogicalClose();
    }
  };

  child.stdout.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) processLine(line);
  });

  child.on("error", (error) => {
    if (closed) return;
    closed = true;
    proxy.emit("error", error);
  });

  child.on("close", (code) => {
    if (closed) return;
    closed = true;
    proxy.emit("close", code);
  });

  return proxy;
}

export function patchExecutionModule(
  moduleUnderTest: ExecutionModuleLike,
  patchedRunSync: (...args: unknown[]) => Promise<unknown>,
): void {
  const current = moduleUnderTest.runSync as typeof moduleUnderTest.runSync & { __spxPatched?: boolean };
  if (current.__spxPatched) return;

  const replacement = patchedRunSync as typeof moduleUnderTest.runSync & { __spxPatched?: boolean };
  replacement.__spxPatched = true;
  moduleUnderTest.runSync = replacement;
}
