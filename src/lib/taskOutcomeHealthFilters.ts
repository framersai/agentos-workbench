export type AlertSeverityFilter = "all" | "critical" | "warning";
export type AlertAckFilter = "all" | "acknowledged" | "unacknowledged";

export function toAlertHistoryFilterParams(
  severityFilter: AlertSeverityFilter,
  ackFilter: AlertAckFilter
): { severity?: "critical" | "warning"; acknowledged?: boolean } {
  const severity = severityFilter === "all" ? undefined : severityFilter;
  const acknowledged =
    ackFilter === "acknowledged" ? true : ackFilter === "unacknowledged" ? false : undefined;
  return {
    severity,
    acknowledged,
  };
}
