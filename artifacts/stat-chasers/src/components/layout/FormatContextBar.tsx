import type { Filters } from "./FilterBar";

interface Props {
  filters: Filters;
  leagueCount?: number;
  teamCount?: number;
  teamCount2021?: number;
  teamCount2022?: number;
  teamCount2023?: number;
  teamCount2024?: number;
  teamCount2025?: number;
}

// Hardcoded colours — no color-mix() so they work in every WordPress environment
const NAVY        = '#0B1F3A';
const NAVY_MUTED  = 'rgba(11,31,58,0.55)';
const NAVY_FAINT  = 'rgba(11,31,58,0.30)';
const PALE_BG     = 'rgba(11,31,58,0.045)';
const PALE_BORDER = 'rgba(11,31,58,0.12)';

export function FormatContextBar({ filters, leagueCount, teamCount, teamCount2021, teamCount2022, teamCount2023, teamCount2024, teamCount2025 }: Props) {
  const isCompare = filters.season === "compare";

  const compareTeamCounts: Array<{ year: string; count: number }> = [
    teamCount2021 != null ? { year: "2021", count: teamCount2021 } : null,
    teamCount2022 != null ? { year: "2022", count: teamCount2022 } : null,
    teamCount2023 != null ? { year: "2023", count: teamCount2023 } : null,
    teamCount2024 != null ? { year: "2024", count: teamCount2024 } : null,
    teamCount2025 != null ? { year: "2025", count: teamCount2025 } : null,
  ].filter((x): x is { year: string; count: number } => x !== null);

  return (
    <div
      className="w-full border-b"
      style={{ backgroundColor: PALE_BG, borderColor: PALE_BORDER }}
    >
      <div className="w-full py-2.5 flex items-center justify-start gap-x-4 gap-y-2 flex-wrap">
        {/* Right — the current sample this combo resolves to */}
        <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap text-xs font-medium" style={{ color: NAVY_MUTED }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: NAVY_FAINT }}>
            Current sample
          </span>
          {isCompare ? (
            compareTeamCounts.map(({ year, count }, i) => (
              <span key={year} className="flex items-center gap-2.5">
                {i > 0 && <span style={{ color: NAVY_FAINT }}>|</span>}
                <span>
                  <span className="font-bold" style={{ color: NAVY }}>{count.toLocaleString()}</span>
                  {" "}teams ({year})
                </span>
              </span>
            ))
          ) : (
            <>
              {leagueCount != null && (
                <span>
                  <span className="font-bold" style={{ color: NAVY }}>{leagueCount.toLocaleString()}</span>
                  {" "}leagues
                </span>
              )}
              {leagueCount != null && teamCount != null && (
                <span style={{ color: NAVY_FAINT }}>·</span>
              )}
              {teamCount != null && (
                <span>
                  <span className="font-bold" style={{ color: NAVY }}>{teamCount.toLocaleString()}</span>
                  {" "}teams
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
