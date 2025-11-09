import type { WorkflowDefinition } from "@/types/workflow";
import type { ExtensionPack } from "@framers/agentos/extensions/manifest";
import {
  EXTENSION_KIND_WORKFLOW,
  type WorkflowDescriptor
} from "@framers/agentos/extensions/types";

const researchAndPublish: WorkflowDefinition = {
  id: "local.research-and-publish",
  displayName: "Research & Publish",
  description:
    "Two-seat workflow that gathers fresh market signals and produces a publishable briefing without leaving your browser.",
  roles: [
    {
      roleId: "signals_researcher",
      displayName: "Signals Researcher",
      description: "Scans the landscape for recent updates tied to the active goal.",
      personaId: "voice_assistant_persona",
      metadata: { cadence: "continuous" }
    },
    {
      roleId: "publishing_editor",
      displayName: "Publishing Editor",
      description: "Shapes the findings into a succinct update for stakeholders.",
      personaId: "voice_assistant_persona",
      metadata: { style: "executive_summary" }
    }
  ],
  tasks: [
    {
      id: "gather-signals",
      name: "Gather signals",
      description: "Collect and synthesize the five most relevant developments linked to the user's request.",
      executor: {
        type: "gmi",
        roleId: "signals_researcher",
        instructions:
          "Summarize the most recent developments that influence the active goal. Bucket findings as Signals, Risks, and Opportunities."
      }
    },
    {
      id: "draft-update",
      name: "Draft update",
      description: "Turn the research digest into a ready-to-share update.",
      dependsOn: ["gather-signals"],
      executor: {
        type: "gmi",
        roleId: "publishing_editor",
        instructions:
          "Using the research summary, craft a crisp update that highlights what changed, why it matters, and what action is recommended."
      }
    }
  ],
  metadata: {
    requiredSecrets: ["openrouter.apiKey"]
  }
};

const monitorAndAlert: WorkflowDefinition = {
  id: "local.monitor-and-alert",
  displayName: "Monitor & Alert",
  description: "Continuously watch a theme and raise an alert when notable changes occur.",
  roles: [
    {
      roleId: "observer",
      displayName: "Observer",
      description: "Reviews incoming signals and scores their relevance.",
      personaId: "voice_assistant_persona",
      metadata: { cadence: "hourly" }
    },
    {
      roleId: "notifier",
      displayName: "Notifier",
      description: "Drafts the alert that would be sent to stakeholders.",
      personaId: "voice_assistant_persona",
      metadata: { channel: "slack" }
    }
  ],
  tasks: [
    {
      id: "scan-theme",
      name: "Scan theme",
      executor: {
        type: "gmi",
        roleId: "observer",
        instructions:
          "Check for new articles, releases, or analyst chatter related to the selected theme. Score each signal from 1-5 for impact."
      }
    },
    {
      id: "issue-alert",
      name: "Issue alert",
      dependsOn: ["scan-theme"],
      executor: {
        type: "gmi",
        roleId: "notifier",
        instructions:
          "If any signals scored 4 or higher, produce an alert message that explains the change, its impact, and the recommended action."
      },
      metadata: {
        escalation: "slack_webhook"
      }
    }
  ],
  metadata: {
    requiredSecrets: ["openrouter.apiKey", "serper.apiKey"]
  }
};

export const LOCAL_WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [researchAndPublish, monitorAndAlert];

/**
 * Returns an extension pack so the embedded AgentOS runtime can register the
 * local workflow definitions as if they were shipped from the registry.
 */
export function createLocalWorkflowPack(): ExtensionPack {
  const descriptors: WorkflowDescriptor[] = LOCAL_WORKFLOW_DEFINITIONS.map((definition) => ({
    id: definition.id,
    kind: EXTENSION_KIND_WORKFLOW,
    payload: {
      definition: JSON.parse(JSON.stringify(definition))
    },
    metadata: {
      origin: "agentos-client-local"
    }
  }));

  return {
    name: "agentos-client-local-workflows",
    version: "0.1.0",
    descriptors
  };
}
