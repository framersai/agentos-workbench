import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const targetPath = path.resolve(
  process.cwd(),
  'node_modules/@framers/agentos/dist/cognitive_substrate/GMI.js'
);

const before = "const providerIdForModel = this.activePersona.defaultProviderId || this.config.defaultLlmProviderId;";
const after = "const providerIdForModel = preferredProviderIdFromInput || this.activePersona.defaultProviderId || this.config.defaultLlmProviderId;";

async function main() {
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
