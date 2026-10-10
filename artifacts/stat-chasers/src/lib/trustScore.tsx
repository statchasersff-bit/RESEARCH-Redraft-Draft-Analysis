export type TrustTier = {
  label: string;
  bg: string;
  text: string;
  border: string;
  rank: number;
};

export function getTrustTier(sampleSize: number): TrustTier {
  if (sampleSize >= 5000)
    return { label: "Elite Sample", bg: "#16a34a", text: "#fff",   border: "#16a34a", rank: 5 };
  if (sampleSize >= 1000)
    return { label: "Strong Sample", bg: "#f0fdf4", text: "#15803d", border: "#22c55e", rank: 4 };
  if (sampleSize >= 250)
    return { label: "Reliable",      bg: "#f0f4ff", text: "#1e3a6e", border: "#93a8d4", rank: 3 };
  if (sampleSize >= 50)
    return { label: "Directional",   bg: "#fffbeb", text: "#b45309", border: "#fbbf24", rank: 2 };
  return   { label: "Insufficient",  bg: "transparent", text: "#9ca3af", border: "#e5e7eb", rank: 1 };
}

export function TrustBadge({ sampleSize }: { sampleSize: number }) {
  const tier = getTrustTier(sampleSize);
  return (
    <span
      style={{
        background: tier.bg,
        color: tier.text,
        borderColor: tier.border,
      }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap"
    >
      {tier.label}
    </span>
  );
}
