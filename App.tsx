
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
  { id: 'f-1', title: 'صلاة الصلوات كاملة', description: 'الالتزام بالفروض في وقتها', timeFrame: 'daily', category: 'religious', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
  { id: 'f-3', title: 'رياضة لمدة 30 دقيقة', description: 'نشاط بدني لتقوية الجسم', timeFrame: 'daily', category: 'physical', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
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

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_goals');
      let loaded = saved ? JSON.parse(saved) : [];
      const fixedIds = FIXED_DAILY_TASKS.map(t => t.id);
      const existingFixed = loaded.filter((g: any) => fixedIds.includes(g.id)).map((g: any) => g.id);
      const missingFixed = FIXED_DAILY_TASKS.filter(f => !existingFixed.includes(f.id));
      return [...missingFixed, ...loaded];
    } catch (e) { return FIXED_DAILY_TASKS; }
  });
  
  const [customRewards, setCustomRewards] = useState<Reward[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_custom_rewards');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [budget, setBudget] = useState<Budget>(() => {
    try {
      const saved = localStorage.getItem('enjaz_budget');
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
      const saved = localStorage.getItem('enjaz_stats');
      return saved ? JSON.parse(saved) : d;
    } catch (e) { return d; }
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem('enjaz_last_reset') || new Date().toDateString());
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [aiBudgetAdvice, setAiBudgetAdvice] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');

  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('enjaz_goals', JSON.stringify(goals));
    localStorage.setItem('enjaz_custom_rewards', JSON.stringify(customRewards));
    localStorage.setItem('enjaz_budget', JSON.stringify(budget));
    localStorage.setItem('enjaz_stats', JSON.stringify(stats));
    const t = setTimeout(() => setIsSaving(false), 800);
    return () => clearTimeout(t);
  }, [goals, customRewards, budget, stats]);

  useEffect(() => {
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      const performReset = async () => {
        setIsAiLoading(true);
        const cleaned = goals.map(g => {
          if (g.timeFrame === 'daily') {
            if (FIXED_DAILY_TASKS.some(f => f.id === g.id)) return { ...g, completed: false };
            return null;
          }
          return g;
        }).filter(Boolean) as Goal[];

        const yearly = cleaned.filter(g => g.timeFrame === 'yearly');
        let newAiTasks: Goal[] = [];
        if (yearly.length > 0) {
          try {
            const suggestions = await generateDailyTasksForProgress(yearly);
            newAiTasks = suggestions.map((t: any, i: number) => ({
              id: `ai-daily-${Date.now()}-${i}`,
              title: t.title,
              description: 'مهمة ذكية مقترحة للتقدم في أهدافك السنوية',
              timeFrame: 'daily',
              category: (t.category || 'general').toLowerCase() as GoalCategory,
              completed: false, failed: false, points: 15, dueDate: new Date().toISOString(), isAiGenerated: true
            }));
          } catch (e) { console.error("Dynamic reset error", e); }
        }

        setGoals([...newAiTasks, ...cleaned]);
        setStats(s => ({ ...s, isRestDay: false }));
        setBudget(b => ({ ...b, spentToday: 0, expenses: [] }));
        setLastResetDate(today);
        localStorage.setItem('enjaz_last_reset', today);
        setIsAiLoading(false);
      };
      performReset();
    }
  }, [lastResetDate, goals]);

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
      if (res && res.learningPath) {
        const yId = Date.now().toString();
        const cat = (res.category || 'general').toLowerCase() as GoalCategory;
        const yearly: Goal = { id: yId, title: newGoalText, description: 'مسار تعلم ذكي بواسطة Gemini 3', timeFrame: 'yearly', category: cat, completed: false, failed: false, points: 500, dueDate: new Date().toISOString() };
        
        const subs: Goal[] = [];
        res.learningPath.forEach((m: any, idx: number) => {
          const mId = `${yId}-m-${idx}`;
          subs.push({ id: mId, title: m.monthTitle, description: m.monthDescription, timeFrame: 'monthly', category: cat, completed: false, failed: false, points: 100, dueDate: new Date().toISOString(), isAiGenerated: true });
          m.weeklySteps.forEach((w: string, wIdx: number) => {
            subs.push({ id: `${mId}-w-${wIdx}`, title: w, description: '', timeFrame: 'weekly', category: cat, completed: false, failed: false, points: 50, dueDate: new Date().toISOString(), isAiGenerated: true });
          });
        });
        
        if (res.persistentDailyTask) {
          subs.push({ id: `${yId}-d`, title: res.persistentDailyTask, description: 'عادة يومية مستمرة لتعزيز الهدف', timeFrame: 'daily', category: cat, completed: false, failed: false, points: 15, dueDate: new Date().toISOString(), isAiGenerated: true });
        }
        
        setGoals(p => [yearly, ...subs, ...p]);
        setNewGoalText('');
      }
    } catch (e) {
      alert("عذراً، حدث خطأ أثناء التواصل مع Gemini. يرجى المحاولة مرة أخرى.");
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
      
      <header className={`p-6 sticky top-0 z-50 rounded-b-[2.5rem] shadow-xl transition-all duration-500 ${stats.isRestDay ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-2xl">
              {stats.isRestDay ? <BedDouble className="w-8 h-8" /> : <BrainCircuit className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black">{stats.isRestDay ? 'يوم راحة' : 'إنجاز'}</h1>
                {isSaving && <Save className="w-3 h-3 opacity-50 animate-bounce" />}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full">
                <CalendarDays className="w-3 h-3" /> {new Date().toLocaleDateString('ar-EG', { weekday: 'long' })}
              </div>
            </div>
          </div>
          <div className="bg-white text-slate-800 px-4 py-2 rounded-3xl flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="font-black text-lg">{stats.totalPoints}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-6 custom-scrollbar">
        
        {activeTab === 'goals' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {isAiLoading && (
              <div className="bg-indigo-600/10 border-2 border-indigo-200 p-4 rounded-3xl flex items-center justify-center gap-3 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span className="font-black text-indigo-600 text-sm">Gemini 3 Pro يخطط لمسار تعلمك...</span>
              </div>
            )}

            <section className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-indigo-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles className="w-32 h-32 text-indigo-200" />
              </div>
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" /> هدف جديد
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="ما هو هدفك الكبير؟ (مثلاً: تعلم تطوير المواقع)"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold text-slate-800"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiBreakdown()}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => addGoal(newGoalText, 'daily')} 
                    disabled={isAiLoading || !newGoalText.trim()}
                    className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-black hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    إضافة بسيطة
                  </button>
                  <button 
                    onClick={handleAiBreakdown} 
                    disabled={isAiLoading || !newGoalText.trim()}
                    className="bg-indigo-600 text-white px-6 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-5 h-5" /> مسار تعلم ذكي
                  </button>
                </div>
              </div>
            </section>

            {['daily', 'weekly', 'monthly', 'yearly'].map((t) => {
              const f = goals.filter(g => g.timeFrame === t);
              if (f.length === 0) return null;
              return (
                <div key={t} className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 px-4 flex items-center gap-2 uppercase tracking-widest">
                    {t === 'daily' ? <Clock className="w-3 h-3" /> : <CalendarRange className="w-3 h-3" />}
                    {t === 'daily' ? 'اليوم' : t === 'weekly' ? 'الأسبوع' : t === 'monthly' ? 'الشهر' : 'أهداف السنة'}
                  </h3>
                  <div className="space-y-2">
                    {f.map(g => {
                      const config = CATEGORY_CONFIG[g.category] || CATEGORY_CONFIG.general;
                      const CatIcon = config.icon;
                      return (
                        <div key={g.id} className={`flex items-center gap-4 p-4 bg-white rounded-[2rem] border-2 transition-all ${g.completed ? 'border-emerald-50 opacity-60 bg-emerald-50/20 shadow-none' : 'border-slate-50 hover:border-indigo-100 shadow-sm'}`}>
                          <button onClick={() => toggleGoal(g.id)} className="shrink-0 transition-transform active:scale-90">
                            {g.completed ? <CheckCircle className="w-8 h-8 text-emerald-500 fill-white rounded-full" /> : <Circle className="w-8 h-8 text-slate-200" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-bold text-slate-800 truncate ${g.completed ? 'line-through text-slate-400' : ''}`}>
                              {g.title} {g.isAiGenerated && <Sparkle className="inline w-3 h-3 text-indigo-400 ml-1" />}
                            </h4>
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color} text-[8px] font-black mt-1`}>
                              <CatIcon className="w-2.5 h-2.5" /> {config.label}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-black text-indigo-500">+{g.points}</span>
                            <button onClick={() => setGoals(p => p.filter(x => x.id !== g.id))} className="block text-slate-200 hover:text-red-400 transition-colors mt-1">
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

        {/* Tab content for Shop, Budget, Stats remains the same for consistency */}
        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
             <header className="bg-amber-400 p-8 rounded-[3rem] text-white shadow-xl text-center relative overflow-hidden">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-2xl font-black">متجر الجوائز</h2>
              <button onClick={() => setIsAddingReward(true)} className="mt-4 bg-white/20 px-6 py-2 rounded-full font-black text-sm hover:bg-white/30 transition-all">+ جائزة جديدة</button>
            </header>
            
            {isAddingReward && (
              <div className="bg-white p-6 rounded-[2rem] border-2 border-amber-200 space-y-4 animate-in zoom-in">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-slate-800">ما هي جائزتك؟</h3>
                  <button onClick={() => setIsAddingReward(false)}><X className="w-5 h-5 text-slate-300" /></button>
                </div>
                <input type="text" value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} placeholder="اسم الجائزة..." className="w-full p-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold focus:outline-none focus:border-amber-400" />
                <button onClick={async () => {
                  if (!newRewardTitle.trim()) return;
                  setIsAiLoading(true);
                  const c = await calculateRewardCost(newRewardTitle);
                  setCustomRewards([{ id: Date.now().toString(), title: newRewardTitle, cost: c, icon: 'Tag' }, ...customRewards]);
                  setNewRewardTitle(''); setIsAddingReward(false); setIsAiLoading(false);
                }} className="w-full bg-amber-500 text-white p-3 rounded-xl font-black shadow-lg">إضافة وحساب السعر بالذكاء الاصطناعي</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {[...INITIAL_REWARDS, ...customRewards].map(r => (
                <div key={r.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 text-center shadow-sm relative group hover:shadow-md transition-all">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-2 text-amber-500"><Tag className="w-5 h-5" /></div>
                  <h3 className="font-bold text-slate-800 text-sm h-8 flex items-center justify-center leading-tight">{r.title}</h3>
                  <p className="font-black text-indigo-600 text-lg my-1">{r.cost} ن</p>
                  <button onClick={() => {
                    if (stats.totalPoints >= r.cost) {
                      setStats(s => ({ ...s, totalPoints: s.totalPoints - r.cost }));
                      alert(`تم شراء ${r.title}! استمتع بمكافأتك.`);
                    } else alert("نقاطك غير كافية!");
                  }} className="w-full py-2 mt-2 rounded-xl font-black text-sm bg-slate-900 text-white active:scale-95 transition-transform">شراء</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-emerald-500 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
              <TrendingUp className="absolute right-0 top-0 w-32 h-32 opacity-10 pointer-events-none" />
              <h2 className="text-xl font-black mb-4 flex items-center gap-2"><Wallet className="w-5 h-5" /> الميزانية اليومية</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm">
                  <p className="text-[10px] font-bold opacity-80">المتبقي للتصرف اليوم</p>
                  <p className="text-2xl font-black">{(budget.dailyLimit - budget.spentToday).toLocaleString()} ج</p>
                </div>
                <button 
                  onClick={async () => {
                    if (budget.expenses.length === 0) return alert("سجل بعض المشتريات أولاً.");
                    setIsAiLoading(true);
                    const ad = await analyzeBudget(budget.expenses, budget.dailyLimit);
                    setAiBudgetAdvice(ad);
                    setIsAiLoading(false);
                  }} 
                  className="bg-white text-emerald-600 rounded-3xl font-black text-xs hover:bg-slate-50 transition-colors shadow-lg"
                >
                  تحليل Gemini
                </button>
              </div>
            </div>

            {aiBudgetAdvice && (
              <div className="bg-indigo-50 p-5 rounded-[2rem] border-2 border-indigo-100 font-bold text-slate-700 animate-in slide-in-from-top-4 flex items-start gap-3">
                <MessageSquareQuote className="w-6 h-6 text-indigo-400 shrink-0" />
                <p className="text-sm leading-relaxed">{aiBudgetAdvice}</p>
                <button onClick={() => setAiBudgetAdvice(null)}><X className="w-4 h-4 text-slate-300" /></button>
              </div>
            )}

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-4">إضافة مصروف</h3>
              <div className="flex gap-2">
                <input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="0" className="w-24 p-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-black focus:outline-none focus:border-emerald-500" />
                <input type="text" value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="التفاصيل..." className="flex-1 p-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold focus:outline-none focus:border-emerald-500" />
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
                }} className="bg-emerald-500 text-white px-4 rounded-xl shadow-md active:scale-95 transition-all"><Plus /></button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 px-4 uppercase tracking-wider">سجل اليوم</h3>
              {budget.expenses.length === 0 ? (
                <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2rem] py-12 text-center">
                  <ReceiptText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-300 font-bold text-xs">لا توجد مصروفات مسجلة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {budget.expenses.map(e => (
                    <div key={e.id} className="bg-white p-4 rounded-2xl border-2 border-slate-50 flex justify-between items-center group shadow-sm hover:border-emerald-100 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><ReceiptText className="w-5 h-5" /></div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{e.description}</p>
                          <p className="text-[8px] text-slate-400">{new Date(e.timestamp).toLocaleTimeString('ar-EG')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-rose-500">-{e.amount.toLocaleString()} ج</span>
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

        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="bg-slate-900 text-white p-8 rounded-[3rem] relative overflow-hidden shadow-2xl">
                <BarChart3 className="absolute right-0 top-0 w-32 h-32 opacity-10 pointer-events-none" />
                <h2 className="text-2xl font-black mb-6">مستوى تقدمك</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 p-5 rounded-3xl">
                    <p className="text-3xl font-black">{stats.goalsCompleted}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">إنجاز كلي</p>
                  </div>
                  <div className="bg-white/10 p-5 rounded-3xl">
                    <p className="text-3xl font-black">{stats.totalPoints}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">نقاط مجمعة</p>
                  </div>
                </div>
             </div>
             
             <div className="space-y-4">
               {Object.entries(CATEGORY_CONFIG).map(([k, c]) => {
                  const s = stats.categories[k as GoalCategory] || { level: 1, exp: 0 };
                  const CatIcon = c.icon;
                  return (
                    <div key={k} className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 flex items-center gap-5 shadow-sm">
                      <div className={`w-12 h-12 rounded-2xl ${c.bg} ${c.color} flex items-center justify-center shrink-0`}>
                        <CatIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-black text-sm text-slate-800">{c.label}</p>
                          <p className="text-xs font-black text-indigo-500">مستوى {s.level}</p>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 backdrop-blur-xl border-t border-slate-100 p-4 flex justify-around items-center z-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
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
