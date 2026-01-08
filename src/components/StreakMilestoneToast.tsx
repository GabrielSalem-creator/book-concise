import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Flame, Trophy, Crown, Star, Zap } from "lucide-react";

interface StreakMilestoneToastProps {
  streak: number;
  previousStreak: number;
}

export const useStreakMilestoneToast = () => {
  const { toast } = useToast();
  const shownMilestones = useRef<Set<number>>(new Set());

  const checkAndShowMilestone = (streak: number) => {
    // Define milestones
    const milestones = [
      { day: 3, title: "3 Day Streak! 🔥", description: "You're building momentum!", icon: "flame" },
      { day: 7, title: "Week Champion! ⚡", description: "One full week! Amazing!", icon: "zap" },
      { day: 14, title: "Two Week Warrior! 🏆", description: "Incredible dedication!", icon: "trophy" },
      { day: 21, title: "Three Weeks Strong! ⭐", description: "You're in the elite!", icon: "star" },
      { day: 30, title: "LEGENDARY! 👑", description: "30 days! Absolutely incredible!", icon: "crown" },
    ];

    const milestone = milestones.find(m => m.day === streak);
    
    if (milestone && !shownMilestones.current.has(streak)) {
      shownMilestones.current.add(streak);
      
      toast({
        title: milestone.title,
        description: milestone.description,
        duration: 5000,
      });
    }
  };

  return { checkAndShowMilestone };
};
