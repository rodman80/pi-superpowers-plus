import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const testHomeDir = path.join(os.tmpdir(), `pi-superpowers-plus-vitest-${process.pid}`);

fs.mkdirSync(path.join(testHomeDir, ".pi", "agent"), { recursive: true });

process.env.HOME = testHomeDir;
process.env.PI_CODING_AGENT_DIR = path.join(testHomeDir, ".pi", "agent");
