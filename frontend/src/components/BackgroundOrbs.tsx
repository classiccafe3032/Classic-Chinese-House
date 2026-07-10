interface OrbConfig {
  size: string;
  blur: string;
  opacity: string;
  color: string;
  position: React.CSSProperties;
}

const defaultOrbs: OrbConfig[] = [
  { size: "w-4 h-4", blur: "blur-[2px]", opacity: "opacity-40", color: "bg-secondary", position: { top: "20%", left: "10%", animationDuration: "6s" } },
  { size: "w-6 h-6", blur: "blur-[4px]", opacity: "opacity-20", color: "bg-primary", position: { top: "50%", right: "15%", animationDelay: "2s", animationDuration: "8s" } },
  { size: "w-3 h-3", blur: "blur-[1px]", opacity: "opacity-50", color: "bg-secondary", position: { bottom: "15%", left: "30%", animationDelay: "4s", animationDuration: "7s" } },
  { size: "w-8 h-8", blur: "blur-[8px]", opacity: "opacity-15", color: "bg-secondary", position: { top: "10%", right: "30%", animationDelay: "1s", animationDuration: "10s" } },
  { size: "w-5 h-5", blur: "blur-[3px]", opacity: "opacity-30", color: "bg-primary", position: { bottom: "40%", right: "40%", animationDelay: "3s", animationDuration: "9s" } },
];

interface Props {
  orbs?: OrbConfig[];
  showShimmer?: boolean;
}

const BackgroundOrbs = ({ orbs = defaultOrbs, showShimmer = false }: Props) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden chinese-pattern">
    <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px]" />
    {orbs.map((orb, i) => (
      <div
        key={i}
        className={`absolute rounded-full animate-ember ${orb.size} ${orb.blur} ${orb.opacity} ${orb.color}`}
        style={orb.position}
      />
    ))}
    {showShimmer && (
      <div className="absolute inset-0 opacity-[0.03] animate-shimmer-drift bg-gradient-to-r from-transparent via-foreground to-transparent" />
    )}
  </div>
);

export default BackgroundOrbs;
