export function Hero() {
  return (
    <div
      className="rs-app-draft-guide-hero w-full bg-white border-b border-border"
      style={{
        paddingTop: "clamp(16px, 2.4vw, 28px)",
        paddingBottom: "clamp(28px, 4vw, 52px)",
      }}
    >
      <div className="rs-app-draft-guide-hero__inner">
        {/* Kicker */}
        <p
          className="rs-app-draft-guide-hero__kicker"
          style={{
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#0B1F3A",
            marginBottom: "0",
          }}
        >
          Stat Chasers Draft Analysis
        </p>

        {/* Gold accent */}
        <div
          className="rs-app-draft-guide-hero__accent"
          style={{
            width: "60px",
            height: "4px",
            borderRadius: "999px",
            backgroundColor: "#C9A227",
            marginTop: "6px",
            marginBottom: "12px",
          }}
        />

        {/* Headline */}
        <h1
          className="rs-app-draft-guide-hero__title"
          style={{
            fontSize: "clamp(28px, 4.5vw, 56px)",
            fontWeight: 900,
            lineHeight: 1.0,
            color: "#070B1A",
            fontFamily: "Georgia, 'Times New Roman', serif",
            letterSpacing: "-0.01em",
            marginBottom: "12px",
            maxWidth: "1100px",
          }}
        >
          The Ultimate Redraft Draft Strategy Analysis
        </h1>

        {/* Subtitle */}
        <p
          className="rs-app-draft-guide-hero__subtitle"
          style={{
            fontSize: "clamp(15px, 1.8vw, 20px)",
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#070B1A",
            maxWidth: "900px",
            marginBottom: "10px",
          }}
        >
          What real Sleeper draft data reveals about which redraft strategies actually make the playoffs.
        </p>

        {/* Body copy */}
        <div
          className="rs-app-draft-guide-hero__copy"
          style={{ maxWidth: "850px" }}
        >
          <p
            style={{
              fontSize: "clamp(16px, 1.5vw, 19px)",
              lineHeight: 1.65,
              color: "#475569",
              marginBottom: "8px",
            }}
          >
            Analyze thousands of redraft teams across multiple seasons, league formats, draft slots,
            scoring settings, and roster builds. All powered by real Sleeper league data.
          </p>
          <p
            style={{
              fontSize: "clamp(16px, 1.5vw, 19px)",
              lineHeight: 1.65,
              color: "#475569",
              marginBottom: 0,
            }}
          >
            Compare 1QB vs Superflex, 10-team vs 12-team, TEP vs non-TEP, and year-over-year
            strategy trends to find the draft builds that consistently create an edge.
          </p>
        </div>
      </div>
    </div>
  );
}
