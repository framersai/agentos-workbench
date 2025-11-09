import secretCatalog from '../../../../packages/agentos/src/config/extension-secrets.json';

export interface SecretDefinition {
  id: string;
  label: string;
  description?: string;
  envVar?: string;
  docsUrl?: string;
  optional?: boolean;
}

export const secretDefinitions: SecretDefinition[] = secretCatalog as SecretDefinition[];
export const secretDefinitionMap = new Map(secretDefinitions.map((def) => [def.id, def]));
