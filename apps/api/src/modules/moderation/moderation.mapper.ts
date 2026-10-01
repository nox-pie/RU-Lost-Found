import type { ModerationReportDto } from '@ru-lost-found/shared';
import { toPersonSummary } from '../users/person.mapper';
import type { ReportView } from './moderation.service';

export function toModerationReportDto({ report, item, people }: ReportView): ModerationReportDto {
  const person = (id: string) => toPersonSummary(id, people.get(id));
  return {
    id: report.id,
    reason: report.reason,
    details: report.details,
    status: report.status,
    flaggedBy: person(report.flaggedBy),
    item: item
      ? {
          id: item.id,
          title: item.title,
          type: item.type,
          status: item.status,
          photoUrl: item.images[0]?.url ?? null,
          reporter: person(item.reporterId),
        }
      : {
          id: report.itemId,
          title: 'Deleted post',
          type: 'LOST',
          status: 'REMOVED',
          photoUrl: null,
          reporter: toPersonSummary('', undefined),
        },
    resolution:
      report.resolvedBy && report.resolvedAt
        ? {
            by: person(report.resolvedBy),
            at: report.resolvedAt.toISOString(),
            note: report.resolutionNote,
          }
        : null,
    createdAt: report.createdAt.toISOString(),
  };
}
