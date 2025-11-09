import { useQuery } from "@tanstack/react-query";
import { listPersonas, type ListPersonaFilters } from "@/lib/agentosClient";
import type { PersonaDefinition } from "@/state/sessionStore";
import type { AgentOSPersonaSummary } from "@/types/agentos";

const normalizePersonaSummary = (summary: AgentOSPersonaSummary): PersonaDefinition | null => {
  const id = typeof summary.id === "string" && summary.id.trim().length > 0 ? summary.id.trim() : undefined;
  if (!id) {
    return null;
  }

  const displayNameSource = [summary.displayName, summary.name, summary.label, id].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );

  const tags =
    Array.isArray(summary.tags) && summary.tags.length > 0
      ? summary.tags.map(String)
      : Array.isArray(summary.strengths) && summary.strengths.length > 0
        ? summary.strengths.map(String)
        : Array.isArray(summary.activationKeywords) && summary.activationKeywords.length > 0
          ? summary.activationKeywords.map(String)
          : undefined;

  const traits =
    summary.personalityTraits && typeof summary.personalityTraits === "object"
      ? Object.keys(summary.personalityTraits).filter((key) => typeof key === "string" && key.trim().length > 0)
      : undefined;

  const capabilities =
    Array.isArray(summary.allowedCapabilities) && summary.allowedCapabilities.length > 0
      ? summary.allowedCapabilities.filter((item): item is string => typeof item === "string")
      : undefined;

  return {
    id,
    displayName: displayNameSource?.trim() ?? id,
    description: typeof summary.description === "string" ? summary.description : undefined,
    tags,
    traits,
    capabilities,
    metadata: summary,
    source: "remote"
  };
};

export interface UsePersonasOptions {
  userId?: string;
  filters?: ListPersonaFilters;
  enabled?: boolean;
  staleTimeMs?: number;
}

export function usePersonas(options: UsePersonasOptions = {}) {
  const { userId, filters, enabled = true, staleTimeMs = 5 * 60 * 1000 } = options;
  const normalizedFilters: ListPersonaFilters | undefined = filters
    ? {
        capability: filters.capability
          ? (Array.isArray(filters.capability)
              ? filters.capability.map((capability) => capability.trim()).filter(Boolean).sort()
              : [filters.capability.trim()]).filter(Boolean)
          : undefined,
        tier: filters.tier
          ? (Array.isArray(filters.tier)
              ? filters.tier.map((tier) => tier.trim()).filter(Boolean).sort()
              : [filters.tier.trim()]).filter(Boolean)
          : undefined,
        search: filters.search?.trim() ? filters.search.trim() : undefined
      }
    : undefined;

  return useQuery({
    queryKey: ["agentos", "personas", userId ?? null, normalizedFilters ?? {}],
    enabled,
    staleTime: staleTimeMs,
    queryFn: ({ signal }) =>
      listPersonas({
        userId,
        filters: normalizedFilters,
        signal
      }),
    select: (summaries: AgentOSPersonaSummary[]): PersonaDefinition[] =>
      summaries
        .map((summary) => normalizePersonaSummary(summary))
        .filter((persona): persona is PersonaDefinition => persona !== null)
  });
}
