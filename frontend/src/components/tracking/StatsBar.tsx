interface StatItem {
  label: string;
  value: string;
  highlight?: boolean;
}

export function StatsBar({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{s.label}</p>
          <p className={`text-xl font-bold ${s.highlight ? "text-primary" : "text-foreground"}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
