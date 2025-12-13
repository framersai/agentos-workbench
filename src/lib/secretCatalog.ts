import {
  EXTENSION_SECRET_DEFINITIONS,
  type ExtensionSecretDefinition
} from '@framers/agentos';

export type SecretDefinition = ExtensionSecretDefinition;

export const secretDefinitions: SecretDefinition[] = EXTENSION_SECRET_DEFINITIONS;
export const secretDefinitionMap = new Map(secretDefinitions.map((def) => [def.id, def]));
