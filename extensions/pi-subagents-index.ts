import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type Logger, log } from "./logging.js";

export interface SubagentDiagnosticsDeps {
  log: Pick<Logger, "info" | "debug" | "error">;
  now: () => number;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
  heartbeatMs: number;
}

interface ToolResultLike {
  content?: Array<{ type?: string; text?: string }>;
  error?: string;
  details?: {
    mode?: string;
    progress?: ProgressEntryLike[];
    results?: Array<{ exitCode?: number }>;
  };
}

interface ProgressEntryLike {
  status?: string;
  toolCount?: number;
  durationMs?: number;
  currentTool?: string;
  recentOutput?: unknown[];
}

type ToolExecute = (
  id: string,
  params: unknown,
  signal: AbortSignal,
  onUpdate: ((result: ToolResultLike) => void) | undefined,
  ctx: unknown,
) => Promise<ToolResultLike>;

type ToolLike = {
  name?: string;
  execute?: ToolExecute;
  [key: string]: unknown;
};

interface ProgressSnapshot {
  mode: string;
  counts: string;
  toolCount: number;
  currentTools: string;
  recentOutput: string;
  durationMs?: number;
}

const DEFAULT_HEARTBEAT_MS = 15_000;
const TASK_PREVIEW_LIMIT = 160;
const RECENT_OUTPUT_LIMIT = 2;
const CURRENT_TOOL_LIMIT = 3;

function truncateInline(value: string | undefined, limit: number): string {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

function summarizeExitCodes(result: ToolResultLike): string {
  const exitCodes = Array.isArray(result.details?.results)
    ? result.details.results
        .map((entry) => entry?.exitCode)
        .filter((value): value is number => typeof value === "number")
    : [];

  if (exitCodes.length === 0) return "exitCodes=unknown";
  return `exitCodes=${exitCodes.join(",")}`;
}

export function extractProgressSnapshot(result: ToolResultLike): ProgressSnapshot | undefined {
  const details = result.details;
  const progress = Array.isArray(details?.progress) ? details.progress : [];
  if (progress.length === 0) return undefined;

  const statusCounts = new Map<string, number>();
  let toolCount = 0;
  let durationMs = 0;
  const currentTools: string[] = [];
  const recentOutput: string[] = [];

  for (const entry of progress) {
    const status = typeof entry?.status === "string" ? entry.status : "unknown";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    toolCount += typeof entry?.toolCount === "number" ? entry.toolCount : 0;
    durationMs = Math.max(durationMs, typeof entry?.durationMs === "number" ? entry.durationMs : 0);

    if (typeof entry?.currentTool === "string" && currentTools.length < CURRENT_TOOL_LIMIT) {
      currentTools.push(entry.currentTool);
    }

    if (Array.isArray(entry?.recentOutput)) {
      const tail = entry.recentOutput
        .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
        .slice(-RECENT_OUTPUT_LIMIT);
      for (const line of tail) {
        if (recentOutput.length >= RECENT_OUTPUT_LIMIT) recentOutput.shift();
        recentOutput.push(truncateInline(line, 80));
      }
    }
  }

  const counts = Array.from(statusCounts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}:${count}`)
    .join(",");

  return {
    mode: typeof details?.mode === "string" ? details.mode : "unknown",
    counts: counts || "unknown:0",
    toolCount,
    currentTools: currentTools.join("|") || "none",
    recentOutput: recentOutput.join(" || ") || "none",
    durationMs: durationMs > 0 ? durationMs : undefined,
  };
}

export function formatProgressSnapshot(snapshot: ProgressSnapshot): string {
  const durationPart = snapshot.durationMs !== undefined ? ` durationMs=${snapshot.durationMs}` : "";
  return `progressMode=${snapshot.mode} statuses=${snapshot.counts} toolCount=${snapshot.toolCount} currentTool=${snapshot.currentTools} recentOutput=${snapshot.recentOutput}${durationPart}`;
}

export function formatSubagentLabel(params: unknown): string {
  if (!params || typeof params !== "object") return "mode=unknown";

  const value = params as {
    agent?: unknown;
    task?: unknown;
    tasks?: unknown[];
    chain?: unknown[];
    action?: unknown;
  };

  if (typeof value.agent === "string" && typeof value.task === "string") {
    return `mode=single agent=${value.agent} task=${truncateInline(value.task, TASK_PREVIEW_LIMIT)}`;
  }

  if (Array.isArray(value.tasks)) {
    return `mode=parallel tasks=${value.tasks.length}`;
  }

  if (Array.isArray(value.chain)) {
    return `mode=chain steps=${value.chain.length}`;
  }

  if (typeof value.action === "string") {
    return `mode=management action=${value.action}`;
  }

  return "mode=unknown";
}

export function createSubagentExecuteWrapper(
  execute: ToolExecute,
  deps: SubagentDiagnosticsDeps = {
    log,
    now: Date.now,
    setInterval,
    clearInterval,
    heartbeatMs: DEFAULT_HEARTBEAT_MS,
  },
): ToolExecute {
  return async (id, params, signal, onUpdate, ctx) => {
    const startedAt = deps.now();
    const label = formatSubagentLabel(params);
    let latestSnapshot: ProgressSnapshot | undefined;
    let lastProgressKey: string | undefined;

    deps.log.info(`subagent start ${label}`);

    const heartbeat = deps.setInterval(() => {
      const elapsedMs = deps.now() - startedAt;
      const suffix = latestSnapshot ? ` ${formatProgressSnapshot(latestSnapshot)}` : " no-progress-yet";
      deps.log.debug(`subagent heartbeat ${label} elapsedMs=${elapsedMs}${suffix}`);
    }, deps.heartbeatMs);

    const wrappedOnUpdate = (result: ToolResultLike) => {
      const snapshot = extractProgressSnapshot(result);
      if (snapshot) {
        latestSnapshot = snapshot;
        const progressKey = JSON.stringify(snapshot);
        if (progressKey !== lastProgressKey) {
          lastProgressKey = progressKey;
          deps.log.debug(`subagent progress ${label} ${formatProgressSnapshot(snapshot)}`);
        }
      }
      onUpdate?.(result);
    };

    try {
      const result = await execute(id, params, signal, wrappedOnUpdate, ctx);
      const finalSnapshot = extractProgressSnapshot(result) ?? latestSnapshot;
      const durationMs = deps.now() - startedAt;
      const errorText = typeof result?.error === "string" ? ` error=${truncateInline(result.error, 160)}` : "";
      const snapshotText = finalSnapshot ? ` ${formatProgressSnapshot(finalSnapshot)}` : "";
      deps.log.info(
        `subagent finish ${label} durationMs=${durationMs} ${summarizeExitCodes(result)}${errorText}${snapshotText}`,
      );
      return result;
    } catch (error) {
      const durationMs = deps.now() - startedAt;
      const snapshotText = latestSnapshot ? ` ${formatProgressSnapshot(latestSnapshot)}` : "";
      deps.log.error(`subagent crash ${label} durationMs=${durationMs}${snapshotText}`, error);
      throw error;
    } finally {
      deps.clearInterval(heartbeat);
    }
  };
}

export function wrapRegisteredToolForDiagnostics(tool: ToolLike, deps?: SubagentDiagnosticsDeps): ToolLike {
  if (tool.name !== "subagent" || typeof tool.execute !== "function") return tool;
  return {
    ...tool,
    execute: createSubagentExecuteWrapper(tool.execute, deps),
  };
}

export function createDiagnosticPiProxy(pi: ExtensionAPI, deps?: SubagentDiagnosticsDeps): ExtensionAPI {
  const proxy = Object.create(pi) as ExtensionAPI;
  proxy.registerTool = ((tool: ToolLike) => {
    pi.registerTool(wrapRegisteredToolForDiagnostics(tool, deps) as never);
  }) as unknown as ExtensionAPI["registerTool"];
  return proxy;
}

export const __internal = {
  extractProgressSnapshot,
  formatProgressSnapshot,
  formatSubagentLabel,
  createSubagentExecuteWrapper,
  wrapRegisteredToolForDiagnostics,
  createDiagnosticPiProxy,
};
