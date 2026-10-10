import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 15;

interface AuditEntry {
  league_id: string;
  season: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
  notes?: string;
}

interface AuditData {
  total_leagues: number;
  succeeded: number;
  skipped: number;
  failed: number;
  entries: AuditEntry[];
}

interface Props {
  data?: AuditData;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertCircle className="h-4 w-4 text-yellow-500" />;
}

function statusRowClass(status: string) {
  if (status === "success") return "hover:bg-green-50/50";
  if (status === "failed") return "hover:bg-red-50/50 bg-red-50/20";
  return "hover:bg-yellow-50/50 bg-yellow-50/20";
}

export function LeagueAuditTable({ data }: Props) {
  const [page, setPage] = useState(0);

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No audit data available yet.
      </p>
    );
  }

  const totalPages = Math.ceil(data.entries.length / PAGE_SIZE);
  const pageEntries = data.entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, data.entries.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="font-medium">{data.succeeded}</span>
          <span className="text-muted-foreground">succeeded</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{data.skipped}</span>
          <span className="text-muted-foreground">skipped</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="font-medium">{data.failed}</span>
          <span className="text-muted-foreground">failed</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Total: {data.total_leagues}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">League ID</TableHead>
              <TableHead className="font-semibold">Season</TableHead>
              <TableHead className="font-semibold">Reason</TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageEntries.map((entry, i) => (
              <TableRow
                key={page * PAGE_SIZE + i}
                className={`transition-colors ${statusRowClass(entry.status)}`}
                data-testid={`audit-row-${i}`}
              >
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon status={entry.status} />
                    <span className="text-sm capitalize">{entry.status}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {entry.league_id}
                </TableCell>
                <TableCell className="text-sm">{entry.season}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.reason ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.notes ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {start}–{end} of {data.entries.length} leagues
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="px-3 py-1.5 text-xs font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
