
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Target, ShoppingCart, Wallet, Plus, CheckCircle, Circle, 
  Gamepad2, Coffee, BrainCircuit, Trash2, Sparkles, Clock, 
  CalendarDays, CalendarRange, LayoutGrid, Zap, Tag, ReceiptText, 
  BedDouble, TrendingUp, BarChart3, Save, BookOpen, Dumbbell, 
  Moon, MessageSquareQuote, X, Loader2, Sparkle
} from 'lucide-react';
import { Goal, Budget, Reward, UserStats, TimeFrame, Expense, GoalCategory } from './types.ts';
import { 
  generateGoalBreakdown, 
  categorizeGoal, 
  analyzeBudget, 
  calculateRewardCost,
  generateDailyTasksForProgress 
} from './services/geminiService.ts';

const INITIAL_REWARDS: Reward[] = [
  { id: '1', title: 'ساعة لعب ألعاب فيديو', cost: 100, icon: 'Gamepad2' },
  { id: '2', title: 'وقت استراحة قهوة 30 دقيقة', cost: 50, icon: 'Coffee' },
  { id: '3', title: 'مشاهدة حلقة مسلسل', cost: 80, icon: 'Target' },
  { id: '4', title: 'يوم راحة كامل', cost: 400, icon: 'BedDouble', specialEffect: 'rest_day' },
];

const FIXED_DAILY_TASKS: Goal[] = [
  { id: 'f-1', title: 'صلاة الصلوات كاملة', description: 'الالتزام بالفروض', timeFrame: 'daily', category: 'religious', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
  { id: 'f-3', title: 'رياضة لمدة 30 دقيقة', description: 'نشاط بدني', timeFrame: 'daily', category: 'physical', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
];

const CATEGORY_CONFIG: Record<GoalCategory, { label: string, icon: any, color: string, bg: string }> = {
  religious: { label: 'إيمانيات', icon: Moon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  physical: { label: 'بدني', icon: Dumbbell, color: 'text-rose-500', bg: 'bg-rose-50' },
  academic: { label: 'تطوير وعلم', icon: BookOpen, color: 'text-sky-500', bg: 'bg-sky-50' },
  general: { label: 'عام', icon: Target, color: 'text-indigo-500', bg: 'bg-indigo-50' }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'goals' | 'shop' | 'budget' | 'stats'>('goals');
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Persistence logic with robust error checking
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_goals_v2');
      let loaded = saved ? JSON.parse(saved) : [];
      // Ensure fixed tasks always exist
      const fixedIds = FIXED_DAILY_TASKS.map(t => t.id);
      const existingFixed = loaded.filter((g: any) => fixedIds.includes(g.id)).map((g: any) => g.id);
      const missingFixed = FIXED_DAILY_TASKS.filter(f => !existingFixed.includes(f.id));
      return [...missingFixed, ...loaded];
    } catch (e) { return FIXED_DAILY_TASKS; }
  });
  
  const [customRewards, setCustomRewards] = useState<Reward[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_custom_rewards_v2');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [budget, setBudget] = useState<Budget>(() => {
    try {
      const saved = localStorage.getItem('enjaz_budget_v2');
      return saved ? JSON.parse(saved) : { monthlyLimit: 2000, dailyLimit: 45, spentThisMonth: 0, spentToday: 0, rolloverBalance: 0, expenses: [] };
    } catch (e) { return { monthlyLimit: 2000, dailyLimit: 45, spentThisMonth: 0, spentToday: 0, rolloverBalance: 0, expenses: [] }; }
  });
  
  const [stats, setStats] = useState<UserStats>(() => {
    const d: UserStats = { 
      totalPoints: 100, goalsCompleted: 0, isRestDay: false, categories: {
        religious: { level: 1, exp: 0 }, physical: { level: 1, exp: 0 }, academic: { level: 1, exp: 0 }, general: { level: 1, exp: 0 }
      }
    };
    try {
      const saved = localStorage.getItem('enjaz_stats_v2');
      return saved ? JSON.parse(saved) : d;
    } catch (e) { return d; }
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem('enjaz_last_reset_v2') || new Date().toDateString());
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [aiBudgetAdvice, setAiBudgetAdvice] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');

  // Sync state with local storage
  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('enjaz_goals_v2', JSON.stringify(goals));
    localStorage.setItem('enjaz_custom_rewards_v2', JSON.stringify(customRewards));
    localStorage.setItem('enjaz_budget_v2', JSON.stringify(budget));
    localStorage.setItem('enjaz_stats_v2', JSON.stringify(stats));
    const t = setTimeout(() => setIsSaving(false), 800);
    return () => clearTimeout(t);
  }, [goals, customRewards, budget, stats]);

  // Handle Daily Resets & AI Suggestions
  useEffect(() => {
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      const performDailyReset = async () => {
        setIsAiLoading(true);
        const filtered = goals.map(g => {
          if (g.timeFrame === 'daily') {
            if (FIXED_DAILY_TASKS.some(f => f.id === g.id)) return { ...g, completed: false };
            return null; // Remove other daily tasks
          }
          return g;
        }).filter(Boolean) as Goal[];

        const yearly = filtered.filter(g => g.timeFrame === 'yearly');
        let newAiTasks: Goal[] = [];
        if (yearly.length > 0) {
          try {
            const suggestions = await generateDailyTasksForProgress(yearly);
            newAiTasks = suggestions.map((t: any, i: number) => ({
              id: `ai-gen-d-${Date.now()}-${i}`,
              title: t.title,
              description: 'مهمة ذكية مقترحة اليوم',
              timeFrame: 'daily',
              category: (t.category || 'general').toLowerCase() as GoalCategory,
              completed: false, failed: false, points: 15, dueDate: new Date().toISOString(), isAiGenerated: true
            }));
          } catch (e) { console.error("Reset AI Error", e); }
        }

        setGoals([...newAiTasks, ...filtered]);
        setStats(s => ({ ...s, isRestDay: false }));
        setBudget(b => ({ ...b, spentToday: 0, expenses: [] })); 
        setLastResetDate(today);
        localStorage.setItem('enjaz_last_reset_v2', today);
        setIsAiLoading(false);
      };
      performDailyReset();
    }
  }, [lastResetDate]);

  const addGoal = async (title: string, type: TimeFrame) => {
    if (!title.trim()) return;
    setIsAiLoading(true);
    const id = Date.now().toString();
    const g: Goal = {
      id, title, description: '', timeFrame: type, category: 'general', 
      completed: false, failed: false, points: type === 'yearly' ? 500 : type === 'monthly' ? 100 : type === 'weekly' ? 50 : 10,
      dueDate: new Date().toISOString(),
    };
    setGoals(prev => [g, ...prev]);
    setNewGoalText('');
    try {
      const cat = await categorizeGoal(title, "");
      setGoals(prev => prev.map(x => x.id === id ? { ...x, category: cat } : x));
    } catch (e) {} finally { setIsAiLoading(false); }
  };

  const handleAiBreakdown = async () => {
    if (!newGoalText.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await generateGoalBreakdown(newGoalText);
      if (res && res.monthlyGoals) {
        const yId = Date.now().toString();
        const cat = (res.category || 'general').toLowerCase() as GoalCategory;
        
        const yearlyGoal: Goal = { 
          id: yId, title: newGoalText, description: 'هدف سنوي طموح', 
          timeFrame: 'yearly', category: cat, completed: false, failed: false, points: 500, dueDate: new Date().toISOString() 
        };
        
        const subTasks: Goal[] = [];
        res.monthlyGoals.forEach((m: any, mIdx: number) => {
          const mId = `${yId}-m-${mIdx}`;
          subTasks.push({ id: mId, title: m.title, description: m.description, timeFrame: 'monthly', category: cat, completed: false, failed: false, points: 100, dueDate: new Date().toISOString(), isAiGenerated: true });
          m.weeklySubGoals.forEach((w: string, wIdx: number) => {
            subTasks.push({ id: `${mId}-w-${wIdx}`, title: w, description: '', timeFrame: 'weekly', category: cat, completed: false, failed: false, points: 50, dueDate: new Date().toISOString(), isAiGenerated: true });
          });
        });
        
        if (res.suggestedDailyTask) {
          subTasks.push({ id: `${yId}-daily-habit`, title: res.suggestedDailyTask, description: 'عادة يومية ذكية', timeFrame: 'daily', category: cat, completed: false, failed: false, points: 15, dueDate: new Date().toISOString(), isAiGenerated: true });
        }
        
        setGoals(p => [yearlyGoal, ...subTasks, ...p]);
        setNewGoalText('');
      }
    } catch (e) {
      alert("تعذر التقسيم الذكي حالياً، سأضيفه كهدف عادي.");
      await addGoal(newGoalText, 'yearly');
    } finally { setIsAiLoading(false); }
  };

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.map(g => {
      if (g.id === id) {
        const ns = !g.completed;
        const pc = ns ? g.points : -g.points;
        setStats(s => {
          const c = s.categories[g.category] || { level: 1, exp: 0 };
          let ex = ns ? c.exp + g.points : Math.max(0, c.exp - g.points);
          let lv = c.level;
          while (ex >= 100) { lv++; ex -= 100; }
          return { 
            ...s, totalPoints: s.totalPoints + pc, goalsCompleted: ns ? s.goalsCompleted + 1 : Math.max(0, s.goalsCompleted - 1),
            categories: { ...s.categories, [g.category]: { level: lv, exp: ex } }
          };
        });
        return { ...g, completed: ns };
      }
      return g;
    }));
  };

  return (
    <div className="min-h-screen pb-28 max-w-2xl mx-auto bg-slate-50 shadow-2xl overflow-hidden flex flex-col font-['Cairo']">
      
      {/* HEADER SECTION */}
      <header className={`p-6 sticky top-0 z-50 rounded-b-[2.5rem] shadow-xl transition-all duration-500 ${stats.isRestDay ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-2xl shadow-inner">
              {stats.isRestDay ? <BedDouble className="w-8 h-8" /> : <BrainCircuit className="w-8 h-8 animate-pulse" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">إنجاز</h1>
                {isSaving && <Save className="w-3 h-3 opacity-50 animate-bounce" />}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full border border-white/5">
                <CalendarDays className="w-3 h-3" /> {new Date().toLocaleDateString('ar-EG', { weekday: 'long' })}
              </div>
            </div>
          </div>
          <div className="bg-white text-slate-800 px-5 py-2.5 rounded-3xl flex items-center gap-2 shadow-xl transform active:scale-95 transition-all cursor-pointer">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="font-black text-xl">{stats.totalPoints}</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 overflow-y-auto space-y-6 custom-scrollbar">
        
        {/* GOALS TAB */}
        {activeTab === 'goals' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {isAiLoading && (
              <div className="bg-white border-2 border-indigo-100 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-sm animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                <p className="font-black text-indigo-600 text-sm">Gemini Pro يحلل أهدافك الآن...</p>
              </div>
            )}

            <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-indigo-50 relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                <Plus className="w-5 h-5 text-indigo-500" /> حدد هدفك السنوي
              </h2>
              <div className="space-y-4 relative z-10">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="مثال: إتقان البرمجة بـ React"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white focus:outline-none font-bold text-slate-800 shadow-inner transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiBreakdown()}
                />
                <div className="flex gap-2">
                  <button onClick={() => addGoal(newGoalText, 'daily')} className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-black hover:bg-slate-200 transition-colors">إضافة بسيطة</button>
                  <button onClick={handleAiBreakdown} className="bg-indigo-600 text-white px-8 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all hover:shadow-indigo-200">
                    <Sparkles className="w-5 h-5" /> تقسيم ذكي
                  </button>
                </div>
              </div>
            </section>

            {/* GOAL LISTS */}
            {['daily', 'weekly', 'monthly', 'yearly'].map((t) => {
              const items = goals.filter(g => g.timeFrame === t);
              if (items.length === 0) return null;
              return (
                <div key={t} className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 px-4 flex items-center gap-2 uppercase tracking-widest">
                    {t === 'daily' ? <Clock className="w-3 h-3" /> : <CalendarRange className="w-3 h-3" />}
                    {t === 'daily' ? 'اليوم' : t === 'weekly' ? 'الأسبوع' : t === 'monthly' ? 'الشهر' : 'السنة'}
                  </h3>
                  <div className="space-y-2">
                    {items.map(g => (
                      <div key={g.id} className={`flex items-center gap-4 p-5 bg-white rounded-[2.2rem] border-2 transition-all ${g.completed ? 'border-emerald-50 opacity-60 bg-emerald-50/10' : 'border-slate-50 hover:border-indigo-100 shadow-sm hover:shadow-md'}`}>
                        <button onClick={() => toggleGoal(g.id)} className="shrink-0 transform active:scale-90 transition-transform">
                          {g.completed ? <CheckCircle className="w-8 h-8 text-emerald-500 fill-white rounded-full" /> : <Circle className="w-8 h-8 text-slate-200" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-slate-800 text-sm leading-snug ${g.completed ? 'line-through text-slate-400' : ''}`}>
                            {g.title} {g.isAiGenerated && <Sparkle className="inline w-3 h-3 text-indigo-400 ml-1" />}
                          </h4>
                          <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${CATEGORY_CONFIG[g.category]?.bg} ${CATEGORY_CONFIG[g.category]?.color} text-[9px] font-black mt-1.5 shadow-sm`}>
                            {CATEGORY_CONFIG[g.category]?.label}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">+{g.points}</span>
                          <button onClick={() => setGoals(p => p.filter(x => x.id !== g.id))} className="block text-slate-200 hover:text-red-400 mt-2 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SHOP TAB */}
        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
             <header className="bg-amber-400 p-8 rounded-[3rem] text-white shadow-xl text-center relative overflow-hidden">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-80" />
              <h2 className="text-2xl font-black">متجر الجوائز</h2>
              <p className="text-xs text-amber-100 font-bold mt-1">حول نقاطك إلى لحظات سعيدة</p>
              <button onClick={() => setIsAddingReward(true)} className="mt-5 bg-white text-amber-500 px-6 py-2.5 rounded-full font-black text-sm shadow-lg hover:bg-amber-50 transition-colors">+ جائزة جديدة</button>
            </header>

            {isAddingReward && (
              <div className="bg-white p-6 rounded-[2.5rem] border-2 border-amber-200 space-y-4 animate-in zoom-in-95 shadow-lg">
                <div className="flex justify-between items-center">
                   <h3 className="font-black text-slate-800">جائزة مخصصة</h3>
                   <button onClick={() => setIsAddingReward(false)} className="text-slate-300 hover:text-red-400"><X /></button>
                </div>
                <input type="text" value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} placeholder="مثلاً: الخروج لتناول الآيس كريم" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold focus:border-amber-400 focus:outline-none" />
                <button onClick={async () => {
                  if (!newRewardTitle.trim()) return;
                  setIsAiLoading(true);
                  const c = await calculateRewardCost(newRewardTitle);
                  setCustomRewards([{ id: Date.now().toString(), title: newRewardTitle, cost: c, icon: 'Tag' }, ...customRewards]);
                  setNewRewardTitle(''); setIsAddingReward(false); setIsAiLoading(false);
                }} className="w-full bg-amber-500 text-white p-4 rounded-2xl font-black shadow-lg transform active:scale-95 transition-all">تقدير السعر بالذكاء الاصطناعي</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {[...INITIAL_REWARDS, ...customRewards].map(r => (
                <div key={r.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 text-center shadow-sm hover:shadow-md transition-all group">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-500 group-hover:scale-110 transition-transform"><Tag className="w-6 h-6" /></div>
                  <h3 className="font-bold text-slate-800 text-sm h-10 flex items-center justify-center leading-tight">{r.title}</h3>
                  <p className="font-black text-indigo-600 text-xl my-2">{r.cost} ن</p>
                  <button onClick={() => {
                    if (stats.totalPoints >= r.cost) {
                      setStats(s => ({ ...s, totalPoints: s.totalPoints - r.cost }));
                      alert(`استحققت ${r.title}! تم الخصم من رصيدك.`);
                    } else alert("لا تمتلك نقاط كافية حالياً.");
                  }} className="w-full py-2.5 mt-2 rounded-2xl font-black text-xs bg-slate-900 text-white hover:bg-black transition-colors">استبدال النقاط</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUDGET TAB */}
        {activeTab === 'budget' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-emerald-500 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
              <div className="absolute -left-5 -bottom-5 w-32 h-32 bg-white/10 rounded-full"></div>
              <h2 className="text-xl font-black mb-4 flex items-center gap-2"><Wallet className="w-5 h-5" /> إدارة المصروفات</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-5 rounded-3xl backdrop-blur-md border border-white/20">
                  <p className="text-[10px] font-bold opacity-70">المتبقي للتصرف</p>
                  <p className="text-2xl font-black">{(budget.dailyLimit - budget.spentToday).toLocaleString()} ج</p>
                </div>
                <button 
                  onClick={async () => {
                    if (budget.expenses.length === 0) return alert("سجل بعض العمليات أولاً.");
                    setIsAiLoading(true);
                    const advice = await analyzeBudget(budget.expenses, budget.dailyLimit);
                    setAiBudgetAdvice(advice);
                    setIsAiLoading(false);
                  }} 
                  className="bg-white text-emerald-600 rounded-3xl font-black text-xs px-2 shadow-lg hover:bg-emerald-50 transition-colors"
                >
                  نصيحة مالية ذكية
                </button>
              </div>
            </div>

            {aiBudgetAdvice && (
              <div className="bg-indigo-50 p-6 rounded-[2.5rem] border-2 border-indigo-100 font-bold text-slate-700 animate-in slide-in-from-top-4 relative">
                <button onClick={() => setAiBudgetAdvice(null)} className="absolute top-4 left-4 text-slate-300 hover:text-slate-500"><X className="w-5 h-5" /></button>
                <div className="flex items-start gap-3">
                  <MessageSquareQuote className="w-6 h-6 text-indigo-400 shrink-0" />
                  <p className="text-sm leading-relaxed pt-1">{aiBudgetAdvice}</p>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-4 px-1">سجل شراء جديد</h3>
              <div className="flex gap-2">
                <input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="المبلغ" className="w-24 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-black focus:border-emerald-500 focus:bg-white outline-none transition-all" />
                <input type="text" value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="مثلاً: اشتراك إنترنت، غذاء..." className="flex-1 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold focus:border-emerald-500 focus:bg-white outline-none transition-all" />
                <button onClick={() => {
                  const a = parseFloat(expenseAmount);
                  if (a > 0) {
                    setBudget(p => ({ 
                      ...p, 
                      spentToday: p.spentToday + a, 
                      expenses: [{ id: Date.now().toString(), amount: a, description: expenseNote || 'مصروف عام', timestamp: new Date().toISOString() }, ...p.expenses] 
                    }));
                  }
                  setExpenseAmount(''); setExpenseNote('');
                }} className="bg-emerald-500 text-white px-5 rounded-2xl shadow-lg active:scale-90 transition-all"><Plus className="w-6 h-6" /></button>
              </div>
            </div>

            {/* EXPENSE HISTORY */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 px-5 uppercase tracking-widest">تاريخ العمليات اليوم</h3>
              {budget.expenses.length === 0 ? (
                <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 text-center">
                  <ReceiptText className="w-10 h-10 text-slate-200 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-300 font-bold text-xs uppercase tracking-tight">لا توجد مشتريات مسجلة</p>
                </div>
              ) : (
                <div className="space-y-2 px-1">
                  {budget.expenses.map(e => (
                    <div key={e.id} className="bg-white p-5 rounded-[2.2rem] border-2 border-slate-50 flex justify-between items-center shadow-sm hover:border-emerald-100 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 rounded-xl text-slate-400"><ReceiptText className="w-5 h-5" /></div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{e.description}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{new Date(e.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-rose-500 text-lg">-{e.amount.toLocaleString()} ج</span>
                        <button 
                          onClick={() => setBudget(p => ({ ...p, spentToday: Math.max(0, p.spentToday - e.amount), expenses: p.expenses.filter(x => x.id !== e.id) }))} 
                          className="text-slate-200 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="bg-slate-900 text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-60 h-60 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <h2 className="text-2xl font-black mb-8 relative z-10">إحصائيات الإنجاز</h2>
                <div className="grid grid-cols-2 gap-5 relative z-10">
                  <div className="bg-white/10 p-6 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                    <p className="text-4xl font-black mb-1">{stats.goalsCompleted}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إجمالي المهام</p>
                  </div>
                  <div className="bg-white/10 p-6 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                    <p className="text-4xl font-black mb-1">{stats.totalPoints}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">رصيد النقاط</p>
                  </div>
                </div>
             </div>
             
             <div className="space-y-4">
               <h3 className="text-[10px] font-black text-slate-400 px-5 uppercase tracking-widest">تحليل المهارات</h3>
               {Object.entries(CATEGORY_CONFIG).map(([k, c]) => {
                  const s = stats.categories[k as GoalCategory] || { level: 1, exp: 0 };
                  const CatIcon = c.icon;
                  return (
                    <div key={k} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className={`w-14 h-14 rounded-[1.5rem] ${c.bg} ${c.color} flex items-center justify-center shrink-0 shadow-sm`}>
                        <CatIcon className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-black text-slate-800 text-sm">{c.label}</p>
                          <p className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">مستوى {s.level}</p>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full ${c.color.replace('text', 'bg')} rounded-full transition-all duration-1000 ease-out`} 
                            style={{ width: `${Math.min(100, s.exp)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
               })}
             </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-6 py-5 flex justify-around items-center z-50 rounded-t-[3rem] shadow-[0_-15px_40px_rgba(0,0,0,0.08)]">
        {[
          { id: 'goals', icon: LayoutGrid, label: 'المهام' },
          { id: 'stats', icon: BarChart3, label: 'الإحصائيات' },
          { id: 'shop', icon: ShoppingCart, label: 'المتجر' },
          { id: 'budget', icon: Wallet, label: 'الميزانية' }
        ].map((btn) => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === btn.id ? 'text-indigo-600 scale-110 -translate-y-1' : 'text-slate-300 hover:text-slate-400'}`}
          >
            <btn.icon className={`w-6 h-6 ${activeTab === btn.id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[10px] font-black">{btn.label}</span>
            {activeTab === btn.id && <div className="w-1 h-1 bg-indigo-600 rounded-full animate-in zoom-in"></div>}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
