import test from "node:test";
import assert from "node:assert/strict";
import { toAlertHistoryFilterParams } from "./taskOutcomeHealthFilters";

test("toAlertHistoryFilterParams maps all/all to undefined filters", () => {
  const params = toAlertHistoryFilterParams("all", "all");
  assert.equal(params.severity, undefined);
  assert.equal(params.acknowledged, undefined);
});

test("toAlertHistoryFilterParams maps severity and ack filters", () => {
  const params = toAlertHistoryFilterParams("critical", "unacknowledged");
  assert.equal(params.severity, "critical");
  assert.equal(params.acknowledged, false);
});

test("toAlertHistoryFilterParams maps acknowledged state", () => {
  const params = toAlertHistoryFilterParams("warning", "acknowledged");
  assert.equal(params.severity, "warning");
  assert.equal(params.acknowledged, true);
});
