import extensionSecretDefinitions from '../../agentos/src/core/config/extension-secrets.json';

export interface SecretDefinition {
  id: string;
  label: string;
  description?: string;
  envVar?: string;
  docsUrl?: string;
  optional?: boolean;
  providers?: string[];
}

export const secretDefinitions = extensionSecretDefinitions as SecretDefinition[];
export const secretDefinitionMap = new Map(secretDefinitions.map((def) => [def.id, def]));
