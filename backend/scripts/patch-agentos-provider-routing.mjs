import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// agentos restructured the layout in 0.9.x — `cognitive_substrate/`
// became `cognition/substrate/`. Try the new path first, fall back to
// the legacy path. If neither exists the postinstall logs and skips
// instead of failing the install.
const CANDIDATE_PATHS = [
  path.resolve(process.cwd(), 'node_modules/@framers/agentos/dist/cognition/substrate/GMI.js'),
  path.resolve(process.cwd(), 'node_modules/@framers/agentos/dist/cognitive_substrate/GMI.js'),
];

async function findTarget() {
  for (const candidate of CANDIDATE_PATHS) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

const before = "const providerIdForModel = this.activePersona.defaultProviderId || this.config.defaultLlmProviderId;";
const after = "const providerIdForModel = preferredProviderIdFromInput || this.activePersona.defaultProviderId || this.config.defaultLlmProviderId;";

async function main() {
  const targetPath = await findTarget();
  if (!targetPath) {
    console.log('AgentOS GMI.js not found at expected paths — skipping provider-routing patch.');
    return;
  }
  const source = await readFile(targetPath, 'utf8');

  if (
    source.includes("const preferredProviderIdFromInput = turnInput.metadata?.options?.preferredProviderId;") &&
    source.includes(after)
  ) {
    console.log('AgentOS provider-routing patch already applied.');
    return;
  }

  if (
    !source.includes("const preferredModelIdFromInput = turnInput.metadata?.options?.preferredModelId;") ||
    !source.includes(before)
  ) {
    throw new Error(`Unable to locate expected AgentOS provider-routing block in ${targetPath}`);
  }

  const patched = source.replace(
    "const preferredModelIdFromInput = turnInput.metadata?.options?.preferredModelId;\n" +
      before,
    "const preferredModelIdFromInput = turnInput.metadata?.options?.preferredModelId;\n" +
      "const preferredProviderIdFromInput = turnInput.metadata?.options?.preferredProviderId;\n" +
      after
  );

  await writeFile(targetPath, patched, 'utf8');
  console.log('Applied AgentOS provider-routing patch.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
