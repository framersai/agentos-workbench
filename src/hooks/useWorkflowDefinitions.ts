import { useQuery } from "@tanstack/react-query";
import { listWorkflowDefinitions } from "@/lib/agentosClient";

export function useWorkflowDefinitions() {
  return useQuery({
    queryKey: ["agentos", "workflow-definitions"],
    queryFn: async () => listWorkflowDefinitions(),
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
}
