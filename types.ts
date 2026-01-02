
export type TimeFrame = 'yearly' | 'monthly' | 'weekly' | 'daily';
export type GoalCategory = 'religious' | 'physical' | 'academic' | 'general';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  timestamp: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  timeFrame: TimeFrame;
  category: GoalCategory;
  completed: boolean;
  failed: boolean;
  points: number;
  parentId?: string;
  dueDate: string;
  isAiGenerated?: boolean;
  isPostponed?: boolean;
  timeLimitMinutes?: number;
  timerStartedAt?: string;
}

export interface Budget {
  monthlyLimit: number;
  dailyLimit: number;
  spentThisMonth: number;
  spentToday: number;
  rolloverBalance: number;
  expenses: Expense[];
}

export interface Reward {
  id: string;
  title: string;
  cost: number;
  icon: string;
  specialEffect?: 'rest_day';
}

export interface CategoryStats {
  level: number;
  exp: number;
}

export interface UserStats {
  totalPoints: number;
  goalsCompleted: number;
  isRestDay: boolean;
  lastDailyQuestDate?: string;
  categories: {
    religious: CategoryStats;
    physical: CategoryStats;
    academic: CategoryStats;
    general: CategoryStats;
  };
}
