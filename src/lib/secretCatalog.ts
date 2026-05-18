import extensionSecretDefinitions from '@framers/agentos/config/extension-secrets.json';

export interface ExtensionSecretDefinition {
  id: string;
  label: string;
  description?: string;
  envVar?: string;
  docsUrl?: string;
  optional?: boolean;
  providers?: string[];
}

const EXTENSION_SECRET_DEFINITIONS = extensionSecretDefinitions as ExtensionSecretDefinition[];

export type SecretDefinition = ExtensionSecretDefinition;

export const secretDefinitions: SecretDefinition[] = EXTENSION_SECRET_DEFINITIONS;
export const secretDefinitionMap = new Map(secretDefinitions.map((def) => [def.id, def]));
