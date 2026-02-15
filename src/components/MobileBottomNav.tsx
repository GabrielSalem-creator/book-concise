import { useNavigate, useLocation } from "react-router-dom";
import { Moon, Library as LibraryIcon, Compass, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Home", icon: Moon },
  { path: "/library", label: "Library", icon: LibraryIcon },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/chat", label: "Chat", icon: MessageSquare },
];

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-morphism border-t border-primary/20 bg-background/95 backdrop-blur-xl safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-all duration-200 ${
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={`Go to ${item.label}`}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : ""}`} />
              <span className={`text-[10px] font-medium ${isActive ? "font-semibold" : ""}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
