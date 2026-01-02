
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Target, 
  ShoppingCart, 
  Wallet, 
  Plus, 
  CheckCircle, 
  Circle, 
  Gamepad2, 
  Coffee, 
  BrainCircuit,
  Trash2,
  Sparkles,
  Timer,
  AlertCircle,
  Clock,
  Heart,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Zap,
  Tag,
  ReceiptText,
  ArrowRightLeft,
  Coins,
  BedDouble,
  FastForward,
  Star,
  BookOpen,
  Dumbbell,
  Moon,
  TrendingUp,
  BarChart3,
  Save,
  Info
} from 'lucide-react';
import { Goal, Budget, Reward, UserStats, TimeFrame, Expense, GoalCategory } from './types.ts';
import { generateGoalBreakdown, calculateRewardCost, generateDailyQuest, categorizeGoal } from './services/geminiService.ts';

const INITIAL_REWARDS: Reward[] = [
  { id: '1', title: 'ساعة لعب ألعاب فيديو', cost: 100, icon: 'Gamepad2' },
  { id: '2', title: 'وقت استراحة قهوة 30 دقيقة', cost: 50, icon: 'Coffee' },
  { id: '3', title: 'مشاهدة حلقة مسلسل', cost: 80, icon: 'Target' },
  { id: '4', title: 'يوم راحة كامل (تأجيل مهام)', cost: 400, icon: 'BedDouble', specialEffect: 'rest_day' },
];

const FIXED_DAILY_TASKS: Goal[] = [
  { id: 'f-1', title: 'صلاة الصلوات كاملة', description: 'الالتزام بالفروض الخمسة في وقتها', timeFrame: 'daily', category: 'religious', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
  { id: 'f-2', title: 'تسبيح 100 مرة', description: 'أذكار وتسبيح لراحة البال', timeFrame: 'daily', category: 'religious', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
  { id: 'f-3', title: 'رياضة لمدة 30 دقيقة', description: 'نشاط بدني لتقوية الجسم', timeFrame: 'daily', category: 'physical', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
];

const CATEGORY_CONFIG: Record<GoalCategory, { label: string, icon: any, color: string, bg: string }> = {
  religious: { label: 'إيمانيات', icon: Moon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  physical: { label: 'بدني', icon: Dumbbell, color: 'text-rose-500', bg: 'bg-rose-50' },
  academic: { label: 'تطوير وعلم', icon: BookOpen, color: 'text-sky-500', bg: 'bg-sky-50' },
  general: { label: 'عام', icon: Target, color: 'text-indigo-500', bg: 'bg-indigo-50' }
};

const REWARD_ICONS: Record<string, any> = { Gamepad2, Coffee, Target, BedDouble };

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'goals' | 'shop' | 'budget' | 'stats'>('goals');
  const [isSaving, setIsSaving] = useState(false);

  // States with improved persistence logic
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('enjaz_goals');
    let loadedGoals: Goal[] = saved ? JSON.parse(saved) : [];
    const fixedIds = FIXED_DAILY_TASKS.map(t => t.id);
    const existingFixedIds = loadedGoals.filter(g => fixedIds.includes(g.id)).map(g => g.id);
    const missingFixed = FIXED_DAILY_TASKS.filter(f => !existingFixedIds.includes(f.id));
    return [...missingFixed, ...loadedGoals];
  });
  
  const [customRewards, setCustomRewards] = useState<Reward[]>(() => {
    const saved = localStorage.getItem('enjaz_custom_rewards');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [budget, setBudget] = useState<Budget>(() => {
    const saved = localStorage.getItem('enjaz_budget');
    return saved ? JSON.parse(saved) : { 
      monthlyLimit: 2000, 
      dailyLimit: 45, 
      spentThisMonth: 0, 
      spentToday: 0, 
      rolloverBalance: 0,
      expenses: [] 
    };
  });
  
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('enjaz_stats');
    const defaultStats: UserStats = { 
      totalPoints: 100, 
      goalsCompleted: 0, 
      isRestDay: false, 
      lastDailyQuestDate: '',
      categories: {
        religious: { level: 1, exp: 0 },
        physical: { level: 1, exp: 0 },
        academic: { level: 1, exp: 0 },
        general: { level: 1, exp: 0 }
      }
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultStats, 
          ...parsed,
          categories: { ...defaultStats.categories, ...(parsed.categories || {}) }
        };
      } catch (e) {
        return defaultStats;
      }
    }
    return defaultStats;
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem('enjaz_last_reset') || new Date().toDateString());
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [showRolloverDialog, setShowRolloverDialog] = useState<number | null>(null);

  // Auto-save logic
  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('enjaz_goals', JSON.stringify(goals));
    localStorage.setItem('enjaz_custom_rewards', JSON.stringify(customRewards));
    localStorage.setItem('enjaz_budget', JSON.stringify(budget));
    localStorage.setItem('enjaz_stats', JSON.stringify(stats));
    const timer = setTimeout(() => setIsSaving(false), 800);
    return () => clearTimeout(timer);
  }, [goals, customRewards, budget, stats]);

  // Daily Reset & AI Daily Quest
  useEffect(() => {
    const todayStr = new Date().toDateString();
    
    if (lastResetDate !== todayStr) {
      const yesterdayLimit = budget.dailyLimit + budget.rolloverBalance;
      const leftover = Math.max(0, yesterdayLimit - budget.spentToday);
      if (leftover > 0) setShowRolloverDialog(leftover);

      setGoals(prev => prev.map(g => {
        if (g.timeFrame === 'daily') {
          if (g.isPostponed) return { ...g, isPostponed: false, completed: false, failed: false };
          if (FIXED_DAILY_TASKS.some(f => f.id === g.id)) return { ...g, completed: false, failed: false };
          return null; 
        }
        return g;
      }).filter(Boolean) as Goal[]);

      setStats(prev => ({ ...prev, isRestDay: false }));
      setBudget(prev => ({ ...prev, spentToday: 0, rolloverBalance: 0, expenses: [] }));
      setLastResetDate(todayStr);
      localStorage.setItem('enjaz_last_reset', todayStr);
    }

    const checkAndGenerateQuest = async () => {
      if (stats.lastDailyQuestDate !== todayStr) {
        const monthlyTitles = goals.filter(g => g.timeFrame === 'monthly').map(g => g.title);
        if (monthlyTitles.length > 0) {
          try {
            const questData = await generateDailyQuest(monthlyTitles);
            const questGoal: Goal = {
              id: `ai-quest-${Date.now()}`,
              title: `✨ مهمة اليوم: ${questData.title}`,
              description: 'تم اختيارها بذكاء بناءً على أهدافك الشهرية',
              timeFrame: 'daily',
              category: questData.category as GoalCategory || 'general',
              completed: false,
              failed: false,
              points: 15,
              dueDate: new Date().toISOString(),
              isAiGenerated: true
            };
            setGoals(prev => [questGoal, ...prev]);
            setStats(prev => ({ ...prev, lastDailyQuestDate: todayStr }));
          } catch (e) {
            console.error("AI Quest generation failed", e);
          }
        }
      }
    };
    checkAndGenerateQuest();
  }, [lastResetDate]);

  const updateCategoryStats = (category: GoalCategory, points: number, reverse: boolean = false) => {
    setStats(prev => {
      const cat = prev.categories[category] || { level: 1, exp: 0 };
      let newExp = reverse ? cat.exp - points : cat.exp + points;
      let newLevel = cat.level;

      if (newExp >= 100) {
        newLevel += Math.floor(newExp / 100);
        newExp = newExp % 100;
      } else if (newExp < 0 && newLevel > 1) {
        newLevel -= 1;
        newExp += 100;
      }
      newExp = Math.max(0, newExp);

      return {
        ...prev,
        categories: {
          ...prev.categories,
          [category]: { level: newLevel, exp: newExp }
        }
      };
    });
  };

  const addGoal = async (title: string, type: TimeFrame) => {
    if (!title.trim()) return;
    setIsAiLoading(true);
    try {
      const category = await categorizeGoal(title, "");
      const newGoal: Goal = {
        id: Date.now().toString(),
        title,
        description: '',
        timeFrame: type,
        category,
        completed: false,
        failed: false,
        points: type === 'yearly' ? 500 : type === 'monthly' ? 100 : type === 'weekly' ? 50 : 10,
        dueDate: new Date().toISOString(),
      };
      setGoals([newGoal, ...goals]);
      setNewGoalText('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiBreakdown = async () => {
    if (!newGoalText.trim()) return;
    setIsAiLoading(true);
    try {
      const breakdown = await generateGoalBreakdown(newGoalText);
      if (breakdown) {
        const yearlyId = Date.now().toString();
        const mainCategory = breakdown.category as GoalCategory || 'general';
        const yearly: Goal = {
          id: yearlyId,
          title: newGoalText,
          description: 'تقسيم ذكي استراتيجي من Gemini',
          timeFrame: 'yearly',
          category: mainCategory,
          completed: false,
          failed: false,
          points: 500,
          dueDate: new Date().toISOString()
        };
        
        const subGoals: Goal[] = [];
        breakdown.monthlyGoals.forEach((m: any, idx: number) => {
          const mid = `${yearlyId}-m-${idx}`;
          subGoals.push({
            id: mid,
            title: m.title,
            description: m.description,
            timeFrame: 'monthly',
            category: mainCategory,
            completed: false,
            failed: false,
            points: 100,
            dueDate: new Date().toISOString(),
            isAiGenerated: true
          });
          m.weeklySubGoals.forEach((w: string, widx: number) => {
            subGoals.push({
              id: `${mid}-w-${widx}`,
              title: w,
              description: '',
              timeFrame: 'weekly',
              category: mainCategory,
              completed: false,
              failed: false,
              points: 50,
              dueDate: new Date().toISOString(),
              isAiGenerated: true
            });
          });
        });
        setGoals([yearly, ...subGoals, ...goals]);
        setNewGoalText('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.map(g => {
      if (g.id === id) {
        if (g.failed || g.isPostponed) return g;
        const newState = !g.completed;
        setStats(s => ({ 
          ...s, 
          totalPoints: s.totalPoints + (newState ? g.points : -g.points),
          goalsCompleted: newState ? s.goalsCompleted + 1 : Math.max(0, s.goalsCompleted - 1)
        }));
        updateCategoryStats(g.category, g.points, !newState);
        return { ...g, completed: newState };
      }
      return g;
    }));
  };

  const purchaseReward = (reward: Reward) => {
    if (stats.totalPoints >= reward.cost) {
      setStats(prev => ({
        ...prev,
        totalPoints: prev.totalPoints - reward.cost,
        isRestDay: reward.specialEffect === 'rest_day' ? true : prev.isRestDay
      }));
      alert(reward.specialEffect === 'rest_day' ? "تم تفعيل وضع الراحة! استرخِ اليوم." : "تم الشراء بنجاح!");
    } else {
      alert("نقاطك لا تكفي!");
    }
  };

  const addExpense = () => {
    if (!expenseAmount) return;
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) return;
    setBudget(prev => ({
      ...prev,
      spentToday: prev.spentToday + amount,
      spentThisMonth: prev.spentThisMonth + amount,
      expenses: [{ id: Date.now().toString(), amount, description: expenseNote || 'مصروف عام', timestamp: new Date().toISOString() }, ...prev.expenses]
    }));
    setExpenseAmount('');
    setExpenseNote('');
  };

  const dayName = new Date().toLocaleDateString('ar-EG', { weekday: 'long' });

  return (
    <div className="min-h-screen pb-28 max-w-2xl mx-auto bg-slate-50 shadow-2xl overflow-hidden flex flex-col font-['Cairo']">
      {/* Rollover Notification */}
      {showRolloverDialog !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <Coins className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">فائض ميزانية الأمس!</h2>
            <p className="text-slate-500 mb-6">تبقى معك <span className="text-indigo-600 font-black">{showRolloverDialog} ج</span>. كيف تود استثمارها؟</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setBudget(prev => ({ ...prev, rolloverBalance: showRolloverDialog })); setShowRolloverDialog(null); }}
                className="bg-indigo-600 text-white p-4 rounded-3xl font-black flex flex-col items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg"
              >
                <ArrowRightLeft className="w-6 h-6" /> ترحيل للميزانية
              </button>
              <button 
                onClick={() => { setStats(prev => ({ ...prev, totalPoints: prev.totalPoints + Math.floor(showRolloverDialog * 5) })); setShowRolloverDialog(null); }}
                className="bg-amber-500 text-white p-4 rounded-3xl font-black flex flex-col items-center gap-2 hover:bg-amber-600 transition-all shadow-lg"
              >
                <Trophy className="w-6 h-6" /> تحويل لنقاط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`p-6 sticky top-0 z-50 rounded-b-[2rem] shadow-lg transition-all duration-500 ${stats.isRestDay ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-2xl">
              {stats.isRestDay ? <BedDouble className="w-8 h-8" /> : <BrainCircuit className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">{stats.isRestDay ? 'يوم راحة' : 'إنجاز'}</h1>
                {isSaving && <Save className="w-3 h-3 opacity-50 animate-bounce" />}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full">
                <CalendarDays className="w-3 h-3" /> {dayName}
              </div>
            </div>
          </div>
          <div className="bg-white text-slate-800 p-3 rounded-3xl flex items-center gap-3 shadow-inner group hover:scale-105 transition-transform cursor-pointer">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span className="font-black text-xl">{stats.totalPoints}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto space-y-8 scroll-smooth">
        {activeTab === 'goals' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Input Section */}
            <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-indigo-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles className="w-32 h-32" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-black text-slate-800">خطة ذكية جديدة</h2>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    placeholder="اكتب هدف السنة أو هدف اليوم..."
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-indigo-500 focus:outline-none font-bold text-slate-800 transition-all pr-4"
                    disabled={isAiLoading}
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => addGoal(newGoalText, 'daily')} 
                    disabled={isAiLoading || !newGoalText.trim()}
                    className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-3xl font-black hover:bg-slate-200 transition-all disabled:opacity-50 active:scale-95"
                  >
                    إضافة عادي
                  </button>
                  <button 
                    onClick={handleAiBreakdown} 
                    disabled={isAiLoading || !newGoalText.trim()} 
                    className="bg-indigo-600 text-white px-6 rounded-3xl hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {isAiLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Sparkles className="w-5 h-5" /> تقسيم ذكي</>}
                  </button>
                </div>
              </div>
            </section>

            {/* Goals Lists */}
            {['daily', 'weekly', 'monthly', 'yearly'].map((type) => {
              const filtered = goals.filter(g => g.timeFrame === type);
              if (filtered.length === 0) return null;
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 px-4 uppercase tracking-widest flex items-center gap-2">
                    {type === 'daily' ? <Clock className="w-3 h-3" /> : type === 'weekly' ? <CalendarDays className="w-3 h-3" /> : <CalendarRange className="w-3 h-3" />}
                    {type === 'daily' ? 'المهام اليومية' : type === 'weekly' ? 'أسبوعية' : type === 'monthly' ? 'شهرية' : 'سنوية'}
                  </h3>
                  <div className="space-y-3">
                    {filtered.map(goal => {
                      const config = CATEGORY_CONFIG[goal.category];
                      const Icon = config.icon;
                      return (
                        <div key={goal.id} className={`group flex items-center gap-4 p-5 bg-white rounded-[2rem] border-2 transition-all duration-300 ${
                          goal.completed ? 'border-emerald-100 opacity-60 bg-emerald-50/10' : 
                          goal.failed ? 'border-red-100 bg-red-50' : 'border-slate-100 hover:border-indigo-200 hover:shadow-lg'
                        }`}>
                          <button onClick={() => toggleGoal(goal.id)} className="shrink-0 transition-transform active:scale-90">
                            {goal.completed ? <CheckCircle className="w-10 h-10 text-emerald-500 fill-white rounded-full shadow-sm" /> : <Circle className="w-10 h-10 text-slate-200 group-hover:text-indigo-300" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-bold text-lg truncate ${goal.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {goal.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color} text-[9px] font-black`}>
                                <Icon className="w-2.5 h-2.5" /> {config.label}
                              </div>
                              {goal.isAiGenerated && <span className="text-[9px] bg-indigo-50 text-indigo-400 px-2 py-0.5 rounded-full font-bold">ذكي</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-black text-slate-400">+{goal.points} ن</span>
                            <button onClick={() => setGoals(prev => prev.filter(g => g.id !== goal.id))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
              <TrendingUp className="absolute -right-4 -top-4 w-32 h-32 opacity-10 rotate-12" />
              <h2 className="text-2xl font-black mb-1">لوحة الإحصائيات</h2>
              <p className="text-slate-400 font-bold">مستوى تطورك في مختلف جوانب حياتك</p>
            </header>

            <div className="grid grid-cols-1 gap-4">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const catStats = stats.categories[key as GoalCategory] || { level: 1, exp: 0 };
                const Icon = config.icon;
                return (
                  <div key={key} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:border-indigo-200 transition-colors">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${config.bg} ${config.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-2">
                        <h3 className="font-black text-slate-800 text-lg">{config.label}</h3>
                        <span className="text-xs font-black text-indigo-600">مستوى {catStats.level}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${config.color.replace('text', 'bg')}`}
                          style={{ width: `${catStats.exp}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] font-black text-slate-400">{catStats.exp}/100 خبرة</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white">
                <BarChart3 className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-[10px] font-bold opacity-70">المهام المكتملة</p>
                <p className="text-3xl font-black">{stats.goalsCompleted}</p>
              </div>
              <div className="bg-emerald-500 p-6 rounded-[2.5rem] text-white">
                <Zap className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-[10px] font-bold opacity-70">إجمالي النقاط</p>
                <p className="text-3xl font-black">{stats.totalPoints}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
            <header className="bg-amber-400 p-8 rounded-[3rem] text-white shadow-xl text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              <ShoppingCart className="w-16 h-16 mx-auto mb-2 relative z-10" />
              <h2 className="text-2xl font-black relative z-10">متجر الجوائز</h2>
              <p className="text-amber-100 font-bold relative z-10">كافئ نفسك على اجتهادك</p>
            </header>
            <div className="grid grid-cols-2 gap-4">
              {INITIAL_REWARDS.map(reward => {
                const RewardIcon = REWARD_ICONS[reward.icon] || Tag;
                const canAfford = stats.totalPoints >= reward.cost;
                return (
                  <div key={reward.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 text-center space-y-3 shadow-sm hover:shadow-xl transition-all">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${reward.specialEffect === 'rest_day' ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                      <RewardIcon className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-slate-800 leading-tight h-10 flex items-center justify-center">{reward.title}</h3>
                    <p className="font-black text-indigo-600 text-xl">{reward.cost} ن</p>
                    <button 
                      onClick={() => purchaseReward(reward)} 
                      disabled={!canAfford}
                      className={`w-full py-3 rounded-2xl font-black transition-all ${canAfford ? 'bg-slate-900 text-white shadow-lg active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                      {canAfford ? 'شراء' : 'نقاط ناقصة'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-emerald-500 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
              <Wallet className="absolute -right-4 -top-4 w-32 h-32 opacity-10 rotate-12" />
              <h2 className="text-xl font-black mb-6">ميزانية اليوم</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/20">
                  <p className="text-[10px] font-bold opacity-80 mb-1">المتاح</p>
                  <p className="text-3xl font-black">{(budget.dailyLimit + budget.rolloverBalance - budget.spentToday).toLocaleString()} ج</p>
                </div>
                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/20">
                  <p className="text-[10px] font-bold opacity-80 mb-1">المصروف</p>
                  <p className="text-3xl font-black">{budget.spentToday.toLocaleString()} ج</p>
                </div>
              </div>
            </div>

            <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-emerald-50 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ReceiptText className="w-5 h-5 text-emerald-500" />
                <h3 className="font-black text-slate-800">إضافة مصروف جديد</h3>
              </div>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={expenseAmount} 
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="المبلغ"
                  className="w-24 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-emerald-500 font-black"
                />
                <input 
                  type="text" 
                  value={expenseNote} 
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="ملاحظة (اختياري)..."
                  className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-emerald-500 font-bold"
                />
                <button 
                  onClick={addExpense}
                  className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg active:scale-90 transition-transform"
                >
                  <Plus />
                </button>
              </div>
            </section>

            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 px-4 uppercase tracking-widest">المصاريف الأخيرة</h3>
              {budget.expenses.length === 0 ? (
                <div className="text-center p-8 bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-300 font-bold">لم تسجل أي مصروفات لليوم</div>
              ) : (
                budget.expenses.map(exp => (
                  <div key={exp.id} className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300">
                        <ReceiptText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{exp.description}</h4>
                        <p className="text-[9px] text-slate-400 font-bold">
                          {new Date(exp.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-red-500">-{exp.amount} ج</span>
                      <button 
                        onClick={() => setBudget(prev => ({ 
                          ...prev, 
                          spentToday: prev.spentToday - exp.amount, 
                          expenses: prev.expenses.filter(e => e.id !== exp.id) 
                        }))}
                        className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/90 backdrop-blur-xl border-t border-slate-100 p-5 flex justify-around items-center z-50 rounded-t-[3rem] shadow-2xl">
        <button onClick={() => setActiveTab('goals')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'goals' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <LayoutGrid className="w-7 h-7" />
          <span className="text-[10px] font-black">المهام</span>
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <BarChart3 className="w-7 h-7" />
          <span className="text-[10px] font-black">إحصائيات</span>
        </button>
        <button onClick={() => setActiveTab('shop')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'shop' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <ShoppingCart className="w-7 h-7" />
          <span className="text-[10px] font-black">المتجر</span>
        </button>
        <button onClick={() => setActiveTab('budget')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'budget' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <Wallet className="w-7 h-7" />
          <span className="text-[10px] font-black">الميزانية</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
