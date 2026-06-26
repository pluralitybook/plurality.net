import { execSync } from "node:child_process";

/** Short git SHA for ?v= on static JS (cache-bust after deploy). */
export default function () {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}