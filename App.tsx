
import React, { useState, useEffect } from 'react';
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
  Clock,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Zap,
  Tag,
  ReceiptText,
  BedDouble,
  TrendingUp,
  BarChart3,
  Save,
  BookOpen,
  Dumbbell,
  Moon,
  MessageSquareQuote,
  X,
  Loader2
} from 'lucide-react';
import { Goal, Budget, Reward, UserStats, TimeFrame, Expense, GoalCategory } from './types.ts';
import { generateGoalBreakdown, categorizeGoal, analyzeBudget, calculateRewardCost } from './services/geminiService.ts';

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

const REWARD_ICONS: Record<string, any> = { Gamepad2, Coffee, Target, BedDouble, Tag };

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'goals' | 'shop' | 'budget' | 'stats'>('goals');
  const [isSaving, setIsSaving] = useState(false);

  // State Persistence
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
      try { return JSON.parse(saved); } catch (e) { return defaultStats; }
    }
    return defaultStats;
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem('enjaz_last_reset') || new Date().toDateString());
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [aiBudgetAdvice, setAiBudgetAdvice] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');

  // Sync to Storage
  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('enjaz_goals', JSON.stringify(goals));
    localStorage.setItem('enjaz_custom_rewards', JSON.stringify(customRewards));
    localStorage.setItem('enjaz_budget', JSON.stringify(budget));
    localStorage.setItem('enjaz_stats', JSON.stringify(stats));
    const timer = setTimeout(() => setIsSaving(false), 800);
    return () => clearTimeout(timer);
  }, [goals, customRewards, budget, stats]);

  // Daily Reset
  useEffect(() => {
    const todayStr = new Date().toDateString();
    if (lastResetDate !== todayStr) {
      setGoals(prev => prev.map(g => {
        if (g.timeFrame === 'daily') {
          if (FIXED_DAILY_TASKS.some(f => f.id === g.id)) return { ...g, completed: false };
          return null; 
        }
        return g;
      }).filter(Boolean) as Goal[]);
      setStats(prev => ({ ...prev, isRestDay: false }));
      setBudget(prev => ({ ...prev, spentToday: 0, expenses: [] }));
      setLastResetDate(todayStr);
      localStorage.setItem('enjaz_last_reset', todayStr);
    }
  }, [lastResetDate]);

  const addGoal = async (title: string, type: TimeFrame) => {
    if (!title.trim()) return;
    setIsAiLoading(true);
    const tempId = Date.now().toString();
    const newGoal: Goal = {
      id: tempId,
      title,
      description: '',
      timeFrame: type,
      category: 'general',
      completed: false,
      failed: false,
      points: type === 'yearly' ? 500 : type === 'monthly' ? 100 : type === 'weekly' ? 50 : 10,
      dueDate: new Date().toISOString(),
    };
    
    setGoals(prev => [newGoal, ...prev]);
    setNewGoalText('');

    try {
      const category = await categorizeGoal(title, "");
      setGoals(prev => prev.map(g => g.id === tempId ? { ...g, category } : g));
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
          description: 'تقسيم ذكي استراتيجي',
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
        setGoals(prev => [yearly, ...subGoals, ...prev]);
        setNewGoalText('');
      }
    } catch (e) {
      console.error(e);
      alert("عذراً، حدث خطأ في التقسيم الذكي.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSmartBudgetAnalysis = async () => {
    if (budget.expenses.length === 0) {
      alert("سجل بعض المصروفات أولاً.");
      return;
    }
    setIsAiLoading(true);
    try {
      const advice = await analyzeBudget(budget.expenses, budget.dailyLimit);
      setAiBudgetAdvice(advice);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const addCustomReward = async () => {
    if (!newRewardTitle.trim()) return;
    setIsAiLoading(true);
    try {
      const cost = await calculateRewardCost(newRewardTitle);
      const newReward: Reward = {
        id: Date.now().toString(),
        title: newRewardTitle,
        cost: cost,
        icon: 'Tag'
      };
      setCustomRewards(prev => [newReward, ...prev]);
      setNewRewardTitle('');
      setIsAddingReward(false);
    } catch (e) {
      console.error(e);
      alert("تعذر حساب السعر.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.map(g => {
      if (g.id === id) {
        const newState = !g.completed;
        const ptsChange = newState ? g.points : -g.points;
        
        setStats(s => {
          const cat = s.categories[g.category];
          let newExp = newState ? cat.exp + g.points : Math.max(0, cat.exp - g.points);
          let newLevel = cat.level;
          if (newExp >= 100) { newLevel++; newExp -= 100; }
          
          return { 
            ...s, 
            totalPoints: s.totalPoints + ptsChange,
            goalsCompleted: newState ? s.goalsCompleted + 1 : Math.max(0, s.goalsCompleted - 1),
            categories: { ...s.categories, [g.category]: { level: newLevel, exp: newExp } }
          };
        });
        return { ...g, completed: newState };
      }
      return g;
    }));
  };

  const dayName = new Date().toLocaleDateString('ar-EG', { weekday: 'long' });

  return (
    <div className="min-h-screen pb-28 max-w-2xl mx-auto bg-slate-50 shadow-2xl overflow-hidden flex flex-col font-['Cairo']">
      
      {/* Header */}
      <header className={`p-6 sticky top-0 z-50 rounded-b-[2.5rem] shadow-xl transition-all duration-500 ${stats.isRestDay ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
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
          <div className="bg-white text-slate-800 px-4 py-2 rounded-3xl flex items-center gap-2 shadow-lg group hover:scale-105 transition-transform cursor-pointer">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="font-black text-lg">{stats.totalPoints}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto space-y-6 custom-scrollbar">
        
        {activeTab === 'goals' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-indigo-50 relative overflow-hidden">
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" /> خطة جديدة
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="ماذا تريد أن تنجز؟"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold"
                  onKeyDown={(e) => e.key === 'Enter' && addGoal(newGoalText, 'daily')}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => addGoal(newGoalText, 'daily')} 
                    disabled={isAiLoading || !newGoalText.trim()}
                    className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-black hover:bg-slate-200"
                  >
                    إضافة سريعة
                  </button>
                  <button 
                    onClick={handleAiBreakdown} 
                    disabled={isAiLoading || !newGoalText.trim()} 
                    className="bg-indigo-600 text-white px-6 rounded-2xl font-black flex items-center gap-2"
                  >
                    {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> تقسيم ذكي</>}
                  </button>
                </div>
              </div>
            </section>

            {['daily', 'weekly', 'monthly', 'yearly'].map((type) => {
              const filtered = goals.filter(g => g.timeFrame === type);
              if (filtered.length === 0) return null;
              return (
                <div key={type} className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 px-4 flex items-center gap-2 uppercase">
                    {type === 'daily' ? <Clock className="w-3 h-3" /> : <CalendarRange className="w-3 h-3" />}
                    {type === 'daily' ? 'مهام اليوم' : type === 'weekly' ? 'هذا الأسبوع' : type === 'monthly' ? 'هذا الشهر' : 'أهداف السنة'}
                  </h3>
                  <div className="space-y-2">
                    {filtered.map(goal => {
                      const config = CATEGORY_CONFIG[goal.category];
                      const Icon = config.icon;
                      return (
                        <div key={goal.id} className={`group flex items-center gap-4 p-4 bg-white rounded-[2rem] border-2 transition-all ${
                          goal.completed ? 'border-emerald-50 opacity-60 bg-emerald-50/20' : 'border-slate-50 hover:border-indigo-100'
                        }`}>
                          <button onClick={() => toggleGoal(goal.id)} className="shrink-0">
                            {goal.completed ? <CheckCircle className="w-8 h-8 text-emerald-500 fill-white rounded-full" /> : <Circle className="w-8 h-8 text-slate-200" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-bold text-slate-800 truncate ${goal.completed ? 'line-through text-slate-400' : ''}`}>{goal.title}</h4>
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color} text-[8px] font-black mt-1`}>
                              <Icon className="w-2.5 h-2.5" /> {config.label}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-indigo-500">+{goal.points}</span>
                            <button onClick={() => setGoals(prev => prev.filter(g => g.id !== goal.id))} className="block text-slate-200 hover:text-red-400 transition-colors mt-1">
                              <Trash2 className="w-3 h-3" />
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

        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
            <header className="bg-amber-400 p-8 rounded-[3rem] text-white shadow-xl text-center">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-2xl font-black">متجر الجوائز الذكي</h2>
              <button onClick={() => setIsAddingReward(true)} className="mt-4 bg-white/20 hover:bg-white/30 px-6 py-2 rounded-full font-black text-sm">+ إضافة جائزة</button>
            </header>

            {isAddingReward && (
              <div className="bg-white p-6 rounded-[2rem] border-2 border-amber-200 space-y-4 shadow-xl">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-slate-800">ما هي جائزتك؟</h3>
                  <button onClick={() => setIsAddingReward(false)}><X className="w-5 h-5 text-slate-300" /></button>
                </div>
                <input 
                  type="text" 
                  value={newRewardTitle} 
                  onChange={(e) => setNewRewardTitle(e.target.value)}
                  placeholder="مثلاً: وجبة مطعم، شراء لعبة..."
                  className="w-full p-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold"
                  disabled={isAiLoading}
                />
                <button 
                  onClick={addCustomReward} 
                  disabled={isAiLoading || !newRewardTitle.trim()}
                  className="w-full bg-amber-500 text-white p-3 rounded-xl font-black shadow-lg flex items-center justify-center gap-2"
                >
                  {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "إضافة وحساب التكلفة"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {[...INITIAL_REWARDS, ...customRewards].map(reward => {
                const RewardIcon = REWARD_ICONS[reward.icon] || Tag;
                const canAfford = stats.totalPoints >= reward.cost;
                return (
                  <div key={reward.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 text-center shadow-sm relative group">
                    {reward.id.length > 5 && (
                      <button onClick={() => setCustomRewards(prev => prev.filter(r => r.id !== reward.id))} className="absolute top-4 left-4 text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                    )}
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-500"><RewardIcon className="w-6 h-6" /></div>
                    <h3 className="font-bold text-slate-800 text-sm h-8 flex items-center justify-center">{reward.title}</h3>
                    <p className="font-black text-indigo-600 text-xl my-2">{reward.cost} ن</p>
                    <button 
                      onClick={() => {
                        if (canAfford) {
                          setStats(s => ({ ...s, totalPoints: s.totalPoints - reward.cost, isRestDay: reward.specialEffect === 'rest_day' ? true : s.isRestDay }));
                        } else alert("نقاطك لا تكفي!");
                      }}
                      className={`w-full py-2 rounded-xl font-black text-sm ${canAfford ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}
                    >
                      شراء
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
              <h2 className="text-xl font-black mb-6">الحساب الذكي اليومي</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                  <p className="text-[10px] font-bold opacity-80 mb-1">المتاح</p>
                  <p className="text-2xl font-black">{(budget.dailyLimit - budget.spentToday).toLocaleString()} ج</p>
                </div>
                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                  <p className="text-[10px] font-bold opacity-80 mb-1">المصروف</p>
                  <p className="text-2xl font-black">{budget.spentToday.toLocaleString()} ج</p>
                </div>
              </div>
              <button 
                onClick={handleSmartBudgetAnalysis}
                disabled={isAiLoading}
                className="w-full mt-6 bg-white text-emerald-600 p-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
              >
                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MessageSquareQuote className="w-4 h-4" /> تحليل المصروفات بالذكاء الاصطناعي</>}
              </button>
            </div>

            {aiBudgetAdvice && (
              <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-[2rem]">
                <p className="text-slate-700 font-bold leading-relaxed">{aiBudgetAdvice}</p>
              </div>
            )}

            <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-4">
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={expenseAmount} 
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="المبلغ"
                  className="w-24 p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-black"
                />
                <input 
                  type="text" 
                  value={expenseNote} 
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="ماذا اشتريت؟"
                  className="flex-1 p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold"
                />
                <button 
                  onClick={() => {
                    const amt = parseFloat(expenseAmount);
                    if (amt > 0) {
                      setBudget(prev => ({ 
                        ...prev, 
                        spentToday: prev.spentToday + amt, 
                        expenses: [{ id: Date.now().toString(), amount: amt, description: expenseNote || 'مصروف', timestamp: new Date().toISOString() }, ...prev.expenses]
                      }));
                      setExpenseAmount(''); setExpenseNote('');
                    }
                  }}
                  className="bg-emerald-500 text-white px-4 rounded-xl shadow-lg"
                >
                  <Plus />
                </button>
              </div>
            </section>

            <div className="space-y-3">
              {budget.expenses.map(exp => (
                <div key={exp.id} className="bg-white p-4 rounded-2xl border-2 border-slate-50 flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <ReceiptText className="w-5 h-5 text-slate-300" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{exp.description}</p>
                      <p className="text-[8px] text-slate-400">{new Date(exp.timestamp).toLocaleTimeString('ar-EG')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-red-500">-{exp.amount} ج</span>
                    <button onClick={() => setBudget(prev => ({ ...prev, spentToday: prev.spentToday - exp.amount, expenses: prev.expenses.filter(e => e.id !== exp.id) }))} className="text-slate-200 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <header className="bg-slate-900 text-white p-8 rounded-[3rem] relative overflow-hidden">
                <TrendingUp className="absolute right-0 top-0 w-32 h-32 opacity-10" />
                <h2 className="text-2xl font-black mb-2">تطورك الشخصي</h2>
                <div className="flex items-center gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-black">{stats.goalsCompleted}</p>
                    <p className="text-[9px] font-bold text-slate-400">مهمة منجزة</p>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="text-center">
                    <p className="text-2xl font-black">{stats.totalPoints}</p>
                    <p className="text-[9px] font-bold text-slate-400">إجمالي النقاط</p>
                  </div>
                </div>
             </header>

             <div className="grid grid-cols-1 gap-4">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const catStats = stats.categories[key as GoalCategory] || { level: 1, exp: 0 };
                return (
                  <div key={key} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.bg} ${config.color}`}>
                      <config.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-2">
                        <span className="font-black text-slate-800">{config.label}</span>
                        <span className="text-[10px] font-black text-indigo-500">مستوى {catStats.level}</span>
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div className={`h-full ${config.color.replace('text', 'bg')} transition-all duration-1000`} style={{ width: `${catStats.exp}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
             </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/90 backdrop-blur-xl border-t border-slate-100 p-4 flex justify-around items-center z-50 rounded-t-[2.5rem] shadow-2xl">
        <button onClick={() => setActiveTab('goals')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'goals' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <LayoutGrid className="w-6 h-6" />
          <span className="text-[9px] font-black">المهام</span>
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <BarChart3 className="w-6 h-6" />
          <span className="text-[9px] font-black">الإحصائيات</span>
        </button>
        <button onClick={() => setActiveTab('shop')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'shop' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <ShoppingCart className="w-6 h-6" />
          <span className="text-[9px] font-black">المتجر</span>
        </button>
        <button onClick={() => setActiveTab('budget')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'budget' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <Wallet className="w-6 h-6" />
          <span className="text-[9px] font-black">الميزانية</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
