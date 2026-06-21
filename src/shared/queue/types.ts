export type AnalyticsJobMessage =
  | DetectInactiveCustomersMessage
  | FetchExternalDataMessage
  | SendEmailMessage;

export type DetectInactiveCustomersMessage = {
  type: "detect-inactive-customers";
  jobId: string;
  organizationId: string;
  branchId: string | null;
  days: number;
  triggeredBy: string;
  triggeredAt: string;
};

export type FetchExternalDataMessage = {
  type: "fetch-external-data";
  jobId: string;
  organizationId: string;
  sourceId: string;
  triggeredBy: string;
};

export type SendEmailMessage = {
  type: "send-email";
  jobId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
};

export function isDetectInactiveCustomers(
  msg: AnalyticsJobMessage,
): msg is DetectInactiveCustomersMessage {
  return msg.type === "detect-inactive-customers";
}

export function isFetchExternalData(
  msg: AnalyticsJobMessage,
): msg is FetchExternalDataMessage {
  return msg.type === "fetch-external-data";
}

export function isSendEmail(msg: AnalyticsJobMessage): msg is SendEmailMessage {
  return msg.type === "send-email";
}
