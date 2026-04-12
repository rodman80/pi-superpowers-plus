import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const MANAGED_MARKER = "managedBy: pi-superpowers-plus";
const SOURCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");

function getUserAgentDir(): string {
  const homeDir = os.homedir();
  const legacyDir = path.join(homeDir, ".pi", "agent", "agents");
  const modernDir = path.join(homeDir, ".agents");
  return fs.existsSync(modernDir) ? modernDir : legacyDir;
}

function isUnmanaged(targetPath: string): boolean {
  if (!fs.existsSync(targetPath)) return false;
  return !fs.readFileSync(targetPath, "utf-8").includes(MANAGED_MARKER);
}

function shouldOverwrite(targetPath: string): boolean {
  if (!fs.existsSync(targetPath)) return true;
  return fs.readFileSync(targetPath, "utf-8").includes(MANAGED_MARKER);
}

function syncManagedAgents(): void {
  const homeDir = os.homedir();
  const legacyDir = path.join(homeDir, ".pi", "agent", "agents");
  const modernDir = path.join(homeDir, ".agents");
  const targetDir = getUserAgentDir();
  const syncingToModernDir = targetDir === modernDir;
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(SOURCE_DIR)) {
    if (!entry.startsWith("spx-") || !entry.endsWith(".md")) continue;

    const sourcePath = path.join(SOURCE_DIR, entry);
    const targetPath = path.join(targetDir, entry);
    const legacyPath = path.join(legacyDir, entry);

    if (syncingToModernDir && isUnmanaged(legacyPath)) {
      // Preserve legacy-only customizations when upstream discovery merges both dirs.
      if (fs.existsSync(targetPath) && shouldOverwrite(targetPath)) {
        fs.rmSync(targetPath);
      }
      continue;
    }

    if (!shouldOverwrite(targetPath)) continue;

    fs.copyFileSync(sourcePath, targetPath);
  }
}

export const __internal = {
  MANAGED_MARKER,
  SOURCE_DIR,
  getUserAgentDir,
  isUnmanaged,
  shouldOverwrite,
  syncManagedAgents,
};

export default function piSubagentsAgentSyncExtension(pi: ExtensionAPI): void {
  pi.on("session_start", () => {
    syncManagedAgents();
  });
}
