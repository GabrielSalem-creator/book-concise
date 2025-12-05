import { Card } from "@/components/ui/card";
import { BookOpen, CheckCircle2, Target, TrendingUp } from "lucide-react";

interface DashboardStatsProps {
  booksRead: number;
  readingStreak: number;
}

export const DashboardStats = ({ booksRead, readingStreak }: DashboardStatsProps) => {
  const stats = [
    {
      label: "Books Completed",
      value: booksRead,
      icon: CheckCircle2,
      gradient: "from-green-500 to-emerald-600",
    },
    {
      label: "Day Streak",
      value: readingStreak,
      icon: TrendingUp,
      gradient: "from-orange-500 to-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="region" aria-label="Reading statistics">
      {stats.map((stat, idx) => (
        <Card
          key={idx}
          className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-border/50 bg-card/50 backdrop-blur"
          role="status"
          aria-label={`${stat.label}: ${stat.value}`}
        >
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`} aria-hidden="true">
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} aria-hidden="true" />
        </Card>
      ))}
    </div>
  );
};