#!/usr/bin/env bun
/**
 * CLI entry point. Library code lives in sync-translations.ts.
 *
 * Usage: bun scripts/sync-translations-bin.ts [--dry-run]
 */
import { main } from "./sync-translations";

await main({ dryRun: process.argv.includes("--dry-run") });
