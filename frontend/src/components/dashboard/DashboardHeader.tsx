import { Volume2, VolumeX, LogOut } from "lucide-react";
import ThemeToggle from "../ThemeToggle";

interface DashboardHeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onLogout: () => void;
}

const DashboardHeader = ({
  soundEnabled,
  onToggleSound,
  onLogout,
}: DashboardHeaderProps) => {
  return (
    <header className="py-1">
      <div className="container mx-auto flex items-center justify-between py-3 px-4">
        <h1 className="font-heading text-xl font-bold">
          <span className="text-primary">Classic Chinese</span>{" "}
          <span className="text-secondary">Dashboard</span>
        </h1>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <button
            onClick={onToggleSound}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            aria-label="Toggle sound"
          >
            {soundEnabled ? (
              <Volume2 size={20} />
            ) : (
              <VolumeX size={20} className="text-muted-foreground" />
            )}
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
