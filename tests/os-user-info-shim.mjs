import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const os = require("node:os");

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "codex",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null
  });
}
