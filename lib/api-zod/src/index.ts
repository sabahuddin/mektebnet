export * from "./generated/api";
export * from "./generated/types";
// Orval names path validators and query-parameter types alike when an
// operation has both. Keep validators public and give query types clear names.
export { GetGroupStatisticsReportParams, DownloadGroupStatisticsExcelParams } from "./generated/api";
export type { GetGroupStatisticsReportParams as GroupStatisticsReportQuery } from "./generated/types/getGroupStatisticsReportParams";
export type { DownloadGroupStatisticsExcelParams as GroupStatisticsExcelQuery } from "./generated/types/downloadGroupStatisticsExcelParams";
