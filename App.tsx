
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Target, ShoppingCart, Wallet, Plus, CheckCircle, Circle, 
  Gamepad2, Coffee, BrainCircuit, Trash2, Sparkles, Clock, 
  CalendarDays, CalendarRange, LayoutGrid, Zap, Tag, ReceiptText, 
  BedDouble, TrendingUp, BarChart3, Save, BookOpen, Dumbbell, 
  Moon, MessageSquareQuote, X, Loader2, Sparkle, RefreshCcw, AlertCircle, Info
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
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [showAiError, setShowAiError] = useState(false);

  // States with localStorage persistence
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v9_goals');
      let loaded = saved ? JSON.parse(saved) : [];
      const fixedIds = FIXED_DAILY_TASKS.map(t => t.id);
      const existingFixed = loaded.filter((g: any) => fixedIds.includes(g.id)).map((g: any) => g.id);
      const missingFixed = FIXED_DAILY_TASKS.filter(f => !existingFixed.includes(f.id));
      return [...missingFixed, ...loaded];
    } catch (e) { return FIXED_DAILY_TASKS; }
  });
  
  const [customRewards, setCustomRewards] = useState<Reward[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v9_rewards');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [budget, setBudget] = useState<Budget>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v9_budget');
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
      const saved = localStorage.getItem('enjaz_v9_stats');
      return saved ? JSON.parse(saved) : d;
    } catch (e) { return d; }
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [aiBudgetAdvice, setAiBudgetAdvice] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem('enjaz_v9_reset') || new Date().toDateString());

  useEffect(() => {
    localStorage.setItem('enjaz_v9_goals', JSON.stringify(goals));
    localStorage.setItem('enjaz_v9_rewards', JSON.stringify(customRewards));
    localStorage.setItem('enjaz_v9_budget', JSON.stringify(budget));
    localStorage.setItem('enjaz_v9_stats', JSON.stringify(stats));
  }, [goals, customRewards, budget, stats]);

  // Handle daily reset
  useEffect(() => {
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      setGoals(prev => prev.map(g => g.timeFrame === 'daily' ? { ...g, completed: false } : g));
      setBudget(prev => ({ ...prev, spentToday: 0 }));
      setLastResetDate(today);
      localStorage.setItem('enjaz_v9_reset', today);
    }
  }, [lastResetDate]);

  const handleAiBreakdown = async (titleOverride?: string) => {
    const targetTitle = titleOverride || newGoalText;
    if (!targetTitle.trim()) return;
    
    setIsAiLoading(true);
    setShowAiError(false);
    setAiStatus(`جاري بناء مسار تعلم تخصصي لـ "${targetTitle}"...`);
    
    try {
      const res = await generateGoalBreakdown(targetTitle);
      if (!res.isSuccess) setShowAiError(true);

      const yId = Date.now().toString();
      const cat = (res.category || 'general').toLowerCase() as GoalCategory;
      
      const mainGoal: Goal = { 
        id: yId, title: targetTitle, description: 'هدف استراتيجي', 
        timeFrame: 'yearly', category: cat, completed: false, failed: false, points: 500, dueDate: new Date().toISOString() 
      };
      
      const subTasks: Goal[] = [];
      res.monthlyGoals.forEach((m: any, mIdx: number) => {
        const mId = `${yId}-m-${mIdx}`;
        subTasks.push({ 
          id: mId, title: m.title, description: m.description, 
          timeFrame: 'monthly', category: cat, completed: false, failed: false, 
          points: 100, dueDate: new Date().toISOString(), isAiGenerated: res.isSuccess, parentId: yId 
        });
        
        m.weeklySubGoals.forEach((w: string, wIdx: number) => {
          subTasks.push({ 
            id: `${mId}-w-${wIdx}`, title: w, description: '', 
            timeFrame: 'weekly', category: cat, completed: false, failed: false, 
            points: 50, dueDate: new Date().toISOString(), isAiGenerated: res.isSuccess, parentId: mId 
          });
        });
      });
      
      if (res.suggestedDailyTask) {
        subTasks.push({ 
          id: `${yId}-daily-h`, title: res.suggestedDailyTask, description: 'عادة يومية مقترحة', 
          timeFrame: 'daily', category: cat, completed: false, failed: false, 
          points: 25, dueDate: new Date().toISOString(), isAiGenerated: res.isSuccess, parentId: yId 
        });
      }
      
      if (titleOverride) {
         setGoals(p => [mainGoal, ...subTasks, ...p.filter(g => g.title !== titleOverride)]);
      } else {
         setGoals(p => [mainGoal, ...subTasks, ...p]);
      }
      setNewGoalText('');
    } catch (e) {
      alert("حدث خطأ في الاتصال بالذكاء الاصطناعي.");
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

  const deleteGoalGroup = (id: string) => {
    if (window.confirm("هل تريد حذف هذا الهدف وجميع تفرعاته؟")) {
      setGoals(p => p.filter(g => g.id !== id && g.parentId !== id && !p.some(parent => parent.id === g.parentId && parent.parentId === id)));
    }
  };

  return (
    <div className="min-h-screen pb-32 max-w-2xl mx-auto bg-slate-50 shadow-2xl flex flex-col font-['Cairo']">
      
      {/* HEADER */}
      <header className="p-8 sticky top-0 z-50 rounded-b-[3.5rem] shadow-xl bg-indigo-600 text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-[1.2rem] shadow-inner backdrop-blur-md">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">إنجاز</h1>
              <div className="flex items-center gap-2 text-[10px] font-bold opacity-80 mt-1">
                <CalendarDays className="w-3 h-3" /> {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          </div>
          <div className="bg-white text-slate-800 px-6 py-3 rounded-[2rem] flex items-center gap-2 shadow-2xl transform active:scale-90 transition-transform">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span className="font-black text-2xl">{stats.totalPoints}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar">
        {activeTab === 'goals' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
            {isAiLoading && (
              <div className="bg-white p-10 rounded-[3rem] flex flex-col items-center gap-5 shadow-2xl border-4 border-indigo-100 text-center animate-pulse">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                <p className="font-black text-indigo-700">{aiStatus}</p>
              </div>
            )}
            {showAiError && (
              <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex items-start gap-4">
                <Info className="w-8 h-8 text-amber-500 shrink-0" />
                <div>
                  <h4 className="font-black text-amber-800 text-sm">التخطيط الاحتياطي مفعّل</h4>
                  <p className="text-xs text-amber-700/80 font-bold leading-relaxed mt-1">تعذر الوصول للموديل الاحترافي، تم إنشاء خطة مبنية على الكلمات المفتاحية.</p>
                </div>
              </div>
            )}
            <section className="bg-white p-8 rounded-[3.5rem] shadow-2xl border border-indigo-50">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><Target className="w-7 h-7 text-indigo-500" /> حدد هدفك التعليمي</h2>
              <div className="space-y-5">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="مثال: إتقان CSS Grid و Flexbox"
                  className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-800 shadow-inner transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiBreakdown()}
                />
                <button 
                  onClick={() => handleAiBreakdown()} 
                  disabled={!newGoalText.trim() || isAiLoading}
                  className="w-full bg-indigo-600 text-white p-6 rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-6 h-6" /> تحليل وبناء مسار التعلم الذكي
                </button>
              </div>
            </section>
            {['daily', 'weekly', 'monthly', 'yearly'].map((t) => {
              const items = goals.filter(g => g.timeFrame === t);
              if (items.length === 0) return null;
              return (
                <div key={t} className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 px-8 flex items-center gap-2 uppercase tracking-[0.2em]">
                    {t === 'daily' ? <Clock className="w-4 h-4" /> : <CalendarRange className="w-4 h-4" />}
                    {t === 'daily' ? 'اليوم' : t === 'weekly' ? 'الأسبوع' : t === 'monthly' ? 'الشهر' : 'الرؤية السنوية'}
                  </h3>
                  <div className="space-y-3">
                    {items.map(g => (
                      <div key={g.id} className={`flex items-center gap-5 p-7 bg-white rounded-[3rem] border-2 transition-all group ${g.completed ? 'border-emerald-50 opacity-50 bg-emerald-50/10' : 'border-slate-50 hover:border-indigo-100 shadow-sm hover:shadow-xl'}`}>
                        <button onClick={() => toggleGoal(g.id)} className="shrink-0 transition-transform active:scale-75">
                          {g.completed ? <CheckCircle className="w-12 h-12 text-emerald-500" /> : <Circle className="w-12 h-12 text-slate-200" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-slate-800 text-lg leading-tight ${g.completed ? 'line-through text-slate-400' : ''}`}>
                            {g.title} {g.isAiGenerated && <Sparkle className="inline w-3 h-3 text-indigo-400 ml-1" />}
                          </h4>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl mt-2 ${CATEGORY_CONFIG[g.category]?.bg} ${CATEGORY_CONFIG[g.category]?.color} text-[10px] font-black shadow-sm`}>
                            {CATEGORY_CONFIG[g.category]?.label}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <span className="text-[12px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl shadow-inner">+{g.points}</span>
                          <button onClick={() => deleteGoalGroup(g.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-4 h-4" />
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

        {activeTab === 'stats' && (
          <div className="space-y-10 animate-in fade-in duration-700">
             <div className="bg-slate-900 text-white p-14 rounded-[4.5rem] relative overflow-hidden shadow-2xl text-center">
                <h2 className="text-4xl font-black mb-12 flex items-center justify-center gap-4"><BarChart3 className="w-10 h-10 text-indigo-400" /> تحليل النمو</h2>
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-xl">
                    <p className="text-6xl font-black mb-3">{stats.goalsCompleted}</p>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">إنجاز كلي</p>
                  </div>
                  <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-xl">
                    <p className="text-6xl font-black mb-3 text-indigo-400">{stats.totalPoints}</p>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">إجمالي الخبرة</p>
                  </div>
                </div>
             </div>
             <div className="space-y-6">
               {Object.entries(CATEGORY_CONFIG).map(([k, c]) => {
                  const s = stats.categories[k as GoalCategory] || { level: 1, exp: 0 };
                  const CatIcon = c.icon;
                  return (
                    <div key={k} className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 flex items-center gap-10 shadow-sm hover:shadow-2xl transition-all group">
                      <div className={`w-24 h-24 rounded-[2.5rem] ${c.bg} ${c.color} flex items-center justify-center shrink-0 shadow-xl transform group-hover:rotate-6 transition-transform`}>
                        <CatIcon className="w-12 h-12" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-4">
                          <p className="font-black text-slate-800 text-xl">{c.label}</p>
                          <p className="text-sm font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-2xl shadow-inner">المستوى {s.level}</p>
                        </div>
                        <div className="h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-50">
                          <div className={`h-full ${c.color.replace('text', 'bg')} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, s.exp)}%` }}></div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-300 mt-3">{s.exp} / 100 خبرة (EXP)</p>
                      </div>
                    </div>
                  );
               })}
             </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-left-6 duration-700">
             <header className="bg-amber-400 p-10 rounded-[3.5rem] text-white shadow-2xl text-center relative overflow-hidden">
              <ShoppingCart className="w-20 h-20 mx-auto mb-4 opacity-90 drop-shadow-xl" />
              <h2 className="text-3xl font-black">متجر الجوائز</h2>
              <button onClick={() => setIsAddingReward(true)} className="mt-8 bg-white text-amber-500 px-10 py-4 rounded-full font-black text-sm shadow-xl hover:bg-amber-50 transition-all transform active:scale-95">+ مكافأة مخصصة</button>
            </header>
            {isAddingReward && (
              <div className="bg-white p-10 rounded-[3.5rem] border-4 border-amber-200 space-y-6 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center">
                   <h3 className="font-black text-slate-800 text-2xl">ما الذي ترغب به؟</h3>
                   <button onClick={() => setIsAddingReward(false)} className="text-slate-300 hover:text-rose-500 transition-colors"><X className="w-8 h-8" /></button>
                </div>
                <input type="text" value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} placeholder="مثال: رحلة نهاية الأسبوع" className="w-full p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 font-bold focus:border-amber-400 outline-none shadow-inner" />
                <button 
                  onClick={async () => {
                    if (!newRewardTitle.trim()) return;
                    setIsAiLoading(true);
                    const c = await calculateRewardCost(newRewardTitle);
                    setCustomRewards([{ id: Date.now().toString(), title: newRewardTitle, cost: c, icon: 'Tag' }, ...customRewards]);
                    setNewRewardTitle(''); setIsAddingReward(false); setIsAiLoading(false);
                  }} 
                  className="w-full bg-amber-500 text-white p-6 rounded-[2rem] font-black shadow-xl hover:bg-amber-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  <Sparkles className="w-6 h-6" /> تقدير التكلفة (AI)
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              {[...INITIAL_REWARDS, ...customRewards].map(r => (
                <div key={r.id} className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 text-center shadow-sm hover:shadow-2xl transition-all group">
                  <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-amber-500"><Tag className="w-10 h-10" /></div>
                  <h3 className="font-bold text-slate-800 text-lg h-14 flex items-center justify-center">{r.title}</h3>
                  <div className="flex items-center justify-center gap-2 my-5"><Zap className="w-6 h-6 text-indigo-600 fill-indigo-600" /><span className="font-black text-indigo-600 text-3xl">{r.cost}</span></div>
                  <button 
                    onClick={() => {
                      if (stats.totalPoints >= r.cost) {
                        setStats(s => ({ ...s, totalPoints: s.totalPoints - r.cost }));
                        alert(`مبروك! استمتع بـ ${r.title}.`);
                      } else alert("نقاطك لا تكفي!");
                    }} 
                    className="w-full py-5 rounded-[1.8rem] font-black text-sm bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
                  >شراء الآن</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6 animate-in slide-in-from-right-6 duration-700">
            <div className="bg-emerald-500 text-white p-12 rounded-[4rem] shadow-2xl text-center relative overflow-hidden">
              <h2 className="text-3xl font-black mb-8 flex items-center justify-center gap-4"><Wallet className="w-9 h-9" /> الرقابة المالية</h2>
              <p className="text-5xl font-black mb-4">{(budget.dailyLimit - budget.spentToday).toLocaleString()} ج</p>
              <p className="text-[11px] font-bold opacity-80 uppercase tracking-widest">الميزانية اليومية المتبقية</p>
              <button 
                onClick={async () => {
                  if (budget.expenses.length === 0) return alert("سجل مصروفاتك أولاً.");
                  setIsAiLoading(true);
                  const advice = await analyzeBudget(budget.expenses, budget.dailyLimit);
                  setAiBudgetAdvice(advice);
                  setIsAiLoading(false);
                }} 
                className="mt-8 bg-white text-emerald-600 px-10 py-4 rounded-full font-black text-sm shadow-xl hover:bg-emerald-50 transition-all transform active:scale-95"
              >نصيحة مالية ذكية</button>
            </div>
            {aiBudgetAdvice && (
              <div className="bg-indigo-50 p-10 rounded-[3.5rem] border-4 border-indigo-100 font-bold text-slate-700 animate-in slide-in-from-top-6 relative shadow-sm">
                <button onClick={() => setAiBudgetAdvice(null)} className="absolute top-8 left-8 text-slate-300 hover:text-indigo-500"><X className="w-8 h-8" /></button>
                <div className="flex items-start gap-5">
                  <div className="bg-white p-4 rounded-[1.5rem] shadow-lg text-indigo-500 shrink-0"><MessageSquareQuote className="w-10 h-10" /></div>
                  <p className="text-lg leading-relaxed pt-2 pr-2">{aiBudgetAdvice}</p>
                </div>
              </div>
            )}
            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
              <h3 className="text-base font-black text-slate-800 mb-8 flex items-center gap-3"><Plus className="w-6 h-6 text-emerald-500" /> إضافة عملية شراء</h3>
              <div className="flex gap-4">
                <input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="المبلغ" className="w-32 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 font-black focus:border-emerald-500 outline-none shadow-inner" />
                <input type="text" value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="الوصف" className="flex-1 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 font-bold focus:border-emerald-500 outline-none shadow-inner" />
                <button 
                  onClick={() => {
                    const a = parseFloat(expenseAmount);
                    if (a > 0) {
                      setBudget(p => ({ 
                        ...p, 
                        spentToday: p.spentToday + a, 
                        expenses: [{ id: Date.now().toString(), amount: a, description: expenseNote || 'مصروف عام', timestamp: new Date().toISOString() }, ...p.expenses] 
                      }));
                    }
                    setExpenseAmount(''); setExpenseNote('');
                  }} 
                  className="bg-emerald-500 text-white px-8 rounded-[2rem] shadow-2xl active:scale-[0.85] transition-all"
                ><CheckCircle className="w-8 h-8" /></button>
              </div>
            </div>
            <div className="space-y-4">
               {budget.expenses.map(e => (
                <div key={e.id} className="bg-white p-7 rounded-[3rem] border-2 border-slate-50 flex justify-between items-center shadow-sm group hover:border-emerald-100 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="p-5 bg-slate-50 rounded-[1.5rem] text-slate-400 group-hover:text-emerald-500 transition-colors shadow-inner"><ReceiptText className="w-7 h-7" /></div>
                    <div>
                      <p className="font-bold text-slate-800 text-lg">{e.description}</p>
                      <p className="text-[11px] text-slate-400 font-black mt-1">{new Date(e.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-black text-rose-500 text-2xl">-{e.amount.toLocaleString()} ج</span>
                    <button onClick={() => setBudget(p => ({ ...p, spentToday: Math.max(0, p.spentToday - e.amount), expenses: p.expenses.filter(x => x.id !== e.id) }))} className="text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-6 h-6" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 backdrop-blur-3xl border-t border-slate-100 px-12 py-7 flex justify-around items-center z-50 rounded-t-[4rem] shadow-2xl">
        {[
          { id: 'goals', icon: LayoutGrid, label: 'الأهداف' },
          { id: 'stats', icon: BarChart3, label: 'التقدم' },
          { id: 'shop', icon: ShoppingCart, label: 'المتجر' },
          { id: 'budget', icon: Wallet, label: 'المالية' }
        ].map((btn) => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-2.5 transition-all duration-500 ${activeTab === btn.id ? 'text-indigo-600 scale-125 -translate-y-3' : 'text-slate-300 hover:text-slate-400'}`}
          >
            <btn.icon className={`w-8 h-8 ${activeTab === btn.id ? 'stroke-[3.5px]' : 'stroke-2'}`} />
            <span className="text-[11px] font-black">{btn.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
