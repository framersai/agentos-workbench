const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
const ensureLeadingSlash = (value: string): string => (value.startsWith("/") ? value : `/${value}`);

const RAW_BASE_URL = (import.meta.env.VITE_AGENTOS_BASE_URL as string | undefined) ?? "/api/agentos";
const RAW_STREAM_PATH = (import.meta.env.VITE_AGENTOS_STREAM_PATH as string | undefined) ?? "/stream";
const RAW_WORKFLOW_DEFINITIONS_PATH =
  (import.meta.env.VITE_AGENTOS_WORKFLOW_DEFINITIONS_PATH as string | undefined) ?? "/workflows/definitions";
const RAW_PERSONAS_PATH = (import.meta.env.VITE_AGENTOS_PERSONAS_PATH as string | undefined) ?? "/personas";

export const agentOSConfig = {
  baseUrl: trimTrailingSlash(RAW_BASE_URL),
  streamPath: ensureLeadingSlash(RAW_STREAM_PATH),
  workflowDefinitionsPath: ensureLeadingSlash(RAW_WORKFLOW_DEFINITIONS_PATH),
  personasPath: ensureLeadingSlash(RAW_PERSONAS_PATH),
  withCredentials: String(import.meta.env.VITE_AGENTOS_WITH_CREDENTIALS ?? "true").toLowerCase() === "true",
  defaultUserId: (import.meta.env.VITE_AGENTOS_WORKBENCH_USER_ID as string | undefined) ?? "agentos-workbench-user"
};

export const buildAgentOSUrl = (path: string): string => {
  const normalized = ensureLeadingSlash(path);
  return agentOSConfig.baseUrl === ""
    ? normalized
    : `${agentOSConfig.baseUrl}${normalized}`;
};
