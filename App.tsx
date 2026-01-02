
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Target, ShoppingCart, Wallet, Plus, CheckCircle, Circle, 
  Gamepad2, Coffee, BrainCircuit, Trash2, Sparkles, Clock, 
  CalendarDays, CalendarRange, LayoutGrid, Zap, Tag, ReceiptText, 
  BedDouble, TrendingUp, BarChart3, Save, BookOpen, Dumbbell, 
  Moon, MessageSquareQuote, X, Loader2, Sparkle, RefreshCcw, AlertCircle, Info, RotateCcw
} from 'lucide-react';
import { Goal, Budget, Reward, UserStats, TimeFrame, Expense, GoalCategory } from './types.ts';
import { 
  generateGoalBreakdown, 
  analyzeBudget, 
  calculateRewardCost 
} from './services/geminiService.ts';

const STORAGE_KEY = 'enjaz_v10_data';

const INITIAL_REWARDS: Reward[] = [
  { id: '1', title: 'ساعة لعب ألعاب فيديو', cost: 100, icon: 'Gamepad2' },
  { id: '2', title: 'استراحة قهوة 30 دقيقة', cost: 50, icon: 'Coffee' },
  { id: '3', title: 'مشاهدة حلقة مسلسل', cost: 80, icon: 'Target' },
  { id: '4', title: 'يوم راحة كامل', cost: 400, icon: 'BedDouble' },
];

const FIXED_DAILY_TASKS: Goal[] = [
  { id: 'f-1', title: 'صلاة الصلوات كاملة', description: 'الالتزام بالفروض', timeFrame: 'daily', category: 'religious', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
  { id: 'f-2', title: 'رياضة لمدة 30 دقيقة', description: 'نشاط بدني', timeFrame: 'daily', category: 'physical', completed: false, failed: false, points: 10, dueDate: new Date().toISOString() },
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

  // Unified State Management
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_goals`);
    const loaded = saved ? JSON.parse(saved) : [];
    const fixedIds = FIXED_DAILY_TASKS.map(t => t.id);
    const existingFixed = loaded.filter((g: any) => fixedIds.includes(g.id)).map((g: any) => g.id);
    const missingFixed = FIXED_DAILY_TASKS.filter(f => !existingFixed.includes(f.id));
    return [...missingFixed, ...loaded];
  });
  
  const [customRewards, setCustomRewards] = useState<Reward[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_rewards`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [budget, setBudget] = useState<Budget>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_budget`);
    return saved ? JSON.parse(saved) : { monthlyLimit: 2000, dailyLimit: 45, spentThisMonth: 0, spentToday: 0, rolloverBalance: 0, expenses: [] };
  });
  
  const [stats, setStats] = useState<UserStats>(() => {
    const d: UserStats = { 
      totalPoints: 100, goalsCompleted: 0, isRestDay: false, categories: {
        religious: { level: 1, exp: 0 }, physical: { level: 1, exp: 0 }, academic: { level: 1, exp: 0 }, general: { level: 1, exp: 0 }
      }
    };
    const saved = localStorage.getItem(`${STORAGE_KEY}_stats`);
    return saved ? JSON.parse(saved) : d;
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [aiBudgetAdvice, setAiBudgetAdvice] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem(`${STORAGE_KEY}_reset`) || new Date().toDateString());

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_goals`, JSON.stringify(goals));
    localStorage.setItem(`${STORAGE_KEY}_rewards`, JSON.stringify(customRewards));
    localStorage.setItem(`${STORAGE_KEY}_budget`, JSON.stringify(budget));
    localStorage.setItem(`${STORAGE_KEY}_stats`, JSON.stringify(stats));
  }, [goals, customRewards, budget, stats]);

  useEffect(() => {
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      setGoals(prev => prev.map(g => g.timeFrame === 'daily' ? { ...g, completed: false } : g));
      setBudget(prev => ({ ...prev, spentToday: 0 }));
      setLastResetDate(today);
      localStorage.setItem(`${STORAGE_KEY}_reset`, today);
    }
  }, [lastResetDate]);

  const handleAiBreakdown = async (titleOverride?: string) => {
    const targetTitle = titleOverride || newGoalText;
    if (!targetTitle.trim()) return;
    
    setIsAiLoading(true);
    setShowAiError(false);
    setAiStatus(`جاري بناء المسار الذكي لـ "${targetTitle}"...`);
    
    try {
      const res = await generateGoalBreakdown(targetTitle);
      if (!res.isSuccess) setShowAiError(true);

      const yId = Date.now().toString();
      const cat = (res.category || 'general').toLowerCase() as GoalCategory;
      const validCats: GoalCategory[] = ['religious', 'physical', 'academic', 'general'];
      const finalCat = validCats.includes(cat) ? cat : 'general';
      
      const mainGoal: Goal = { 
        id: yId, title: targetTitle, description: 'هدف استراتيجي', 
        timeFrame: 'yearly', category: finalCat, completed: false, failed: false, points: 500, dueDate: new Date().toISOString() 
      };
      
      const subTasks: Goal[] = [];
      res.monthlyGoals.forEach((m: any, mIdx: number) => {
        const mId = `${yId}-m-${mIdx}`;
        subTasks.push({ 
          id: mId, title: m.title, description: m.description, 
          timeFrame: 'monthly', category: finalCat, completed: false, failed: false, 
          points: 100, dueDate: new Date().toISOString(), isAiGenerated: res.isSuccess, parentId: yId 
        });
        m.weeklySubGoals.forEach((w: string, wIdx: number) => {
          subTasks.push({ 
            id: `${mId}-w-${wIdx}`, title: w, description: '', 
            timeFrame: 'weekly', category: finalCat, completed: false, failed: false, 
            points: 50, dueDate: new Date().toISOString(), isAiGenerated: res.isSuccess, parentId: mId 
          });
        });
      });
      
      if (res.suggestedDailyTask) {
        subTasks.push({ 
          id: `${yId}-daily-h`, title: res.suggestedDailyTask, description: 'عادة يومية ذكية', 
          timeFrame: 'daily', category: finalCat, completed: false, failed: false, 
          points: 25, dueDate: new Date().toISOString(), isAiGenerated: res.isSuccess, parentId: yId 
        });
      }
      
      setGoals(p => [mainGoal, ...subTasks, ...p.filter(g => g.id !== (titleOverride ? titleOverride : null))]);
      setNewGoalText('');
    } catch (e) {
      alert("خطأ في التحليل الذكي.");
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
    if (window.confirm("حذف الهدف وتفرعاته؟")) {
      setGoals(p => p.filter(g => g.id !== id && g.parentId !== id && !p.some(parent => parent.id === g.parentId && parent.parentId === id)));
    }
  };

  const resetAllProgress = () => {
    if (window.confirm("هل أنت متأكد من مسح كافة البيانات؟ لا يمكن التراجع.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen pb-32 max-w-2xl mx-auto bg-slate-50 shadow-2xl flex flex-col font-['Cairo']">
      
      {/* HEADER */}
      <header className="p-8 sticky top-0 z-50 rounded-b-[3.5rem] shadow-xl bg-indigo-600 text-white flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md"><BrainCircuit className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-black">إنجاز</h1>
            <p className="text-[10px] opacity-70 font-bold">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>
        <div className="bg-white text-slate-800 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-lg">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-black text-xl">{stats.totalPoints}</span>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar">
        {activeTab === 'goals' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
            {isAiLoading && (
              <div className="bg-white p-8 rounded-[2.5rem] flex flex-col items-center gap-4 shadow-xl border-2 border-indigo-100 animate-pulse">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="font-black text-indigo-700 text-sm">{aiStatus}</p>
              </div>
            )}
            {showAiError && (
              <div className="bg-amber-50 border-2 border-amber-100 p-5 rounded-[2rem] flex items-center gap-3">
                <Info className="w-6 h-6 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-800 font-bold">تم استخدام التخطيط الاحتياطي لضمان استمرار عملك.</p>
              </div>
            )}
            <section className="bg-white p-8 rounded-[3rem] shadow-lg border border-indigo-50">
              <h2 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2"><Target className="w-6 h-6 text-indigo-500" /> هدف جديد</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="مثال: تعلم أساسيات التصميم"
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiBreakdown()}
                />
                <button 
                  onClick={() => handleAiBreakdown()} 
                  disabled={!newGoalText.trim() || isAiLoading}
                  className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                >
                  <Sparkles className="w-5 h-5" /> تحليل ذكي للمسار
                </button>
              </div>
            </section>
            {['daily', 'weekly', 'monthly', 'yearly'].map((t) => {
              const items = goals.filter(g => g.timeFrame === t);
              if (items.length === 0) return null;
              return (
                <div key={t} className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 px-6 uppercase tracking-widest">{t === 'daily' ? 'اليوم' : t === 'weekly' ? 'الأسبوع' : t === 'monthly' ? 'الشهر' : 'السنة'}</h3>
                  <div className="space-y-3">
                    {items.map(g => (
                      <div key={g.id} className={`flex items-center gap-4 p-6 bg-white rounded-[2.5rem] border-2 transition-all ${g.completed ? 'opacity-40 grayscale border-slate-50' : 'shadow-sm border-slate-50 hover:border-indigo-100'}`}>
                        <button onClick={() => toggleGoal(g.id)} className="shrink-0">
                          {g.completed ? <CheckCircle className="w-10 h-10 text-emerald-500" /> : <Circle className="w-10 h-10 text-slate-200" />}
                        </button>
                        <div className="flex-1">
                          <h4 className={`font-bold text-slate-800 text-md ${g.completed ? 'line-through' : ''}`}>{g.title}</h4>
                          <div className={`inline-block px-2.5 py-0.5 rounded-lg mt-1.5 ${CATEGORY_CONFIG[g.category]?.bg} ${CATEGORY_CONFIG[g.category]?.color} text-[9px] font-black`}>{CATEGORY_CONFIG[g.category]?.label}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-indigo-600 font-black text-[10px]">+{g.points}</span>
                          <button onClick={() => deleteGoalGroup(g.id)} className="p-1.5 text-slate-200 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
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
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="bg-slate-900 text-white p-10 rounded-[3.5rem] shadow-xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-transparent"></div>
                <h2 className="text-2xl font-black mb-8 relative z-10">إحصائيات التقدم</h2>
                <div className="grid grid-cols-2 gap-5 relative z-10">
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10">
                    <p className="text-4xl font-black mb-1">{stats.goalsCompleted}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">مهمة مكتملة</p>
                  </div>
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10">
                    <p className="text-4xl font-black mb-1 text-indigo-400">{stats.totalPoints}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">إجمالي النقاط</p>
                  </div>
                </div>
             </div>
             <div className="space-y-4">
               {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                  const s = stats.categories[key as GoalCategory] || { level: 1, exp: 0 };
                  const Icon = cfg.icon;
                  return (
                    <div key={key} className="bg-white p-7 rounded-[2.5rem] border-2 border-slate-50 flex items-center gap-6 shadow-sm">
                      <div className={`w-16 h-16 rounded-2xl ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}><Icon className="w-8 h-8" /></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-2">
                          <p className="font-black text-slate-800 text-sm">{cfg.label}</p>
                          <p className="text-[10px] font-black text-indigo-600">المستوى {s.level}</p>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                          <div className={`h-full ${cfg.color.replace('text', 'bg')} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, s.exp)}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
               })}
             </div>
             <button onClick={resetAllProgress} className="w-full p-4 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 hover:text-rose-600 transition-colors"><RotateCcw className="w-4 h-4" /> تصفير كافة البيانات</button>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-left-6 duration-500">
             <header className="bg-amber-400 p-10 rounded-[3rem] text-white shadow-xl text-center">
              <ShoppingCart className="w-16 h-16 mx-auto mb-3" />
              <h2 className="text-2xl font-black">المتجر</h2>
              <button onClick={() => setIsAddingReward(true)} className="mt-6 bg-white text-amber-500 px-8 py-3 rounded-full font-black text-xs shadow-md">+ مكافأة جديدة</button>
            </header>
            {isAddingReward && (
              <div className="bg-white p-8 rounded-[2.5rem] border-4 border-amber-100 space-y-5 shadow-xl">
                <div className="flex justify-between items-center"><h3 className="font-black text-slate-800">أضف رغبتك</h3><button onClick={() => setIsAddingReward(false)}><X className="w-6 h-6 text-slate-300" /></button></div>
                <input type="text" value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} placeholder="مثال: وجبة مفضلة" className="w-full p-4 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold outline-none" />
                <button onClick={async () => {
                    if (!newRewardTitle.trim()) return;
                    setIsAiLoading(true);
                    const c = await calculateRewardCost(newRewardTitle);
                    setCustomRewards([{ id: Date.now().toString(), title: newRewardTitle, cost: c, icon: 'Tag' }, ...customRewards]);
                    setNewRewardTitle(''); setIsAddingReward(false); setIsAiLoading(false);
                  }} className="w-full bg-amber-500 text-white p-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2"><Sparkles className="w-5 h-5" /> تقدير التكلفة (AI)</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {[...INITIAL_REWARDS, ...customRewards].map(r => (
                <div key={r.id} className="bg-white p-7 rounded-[2.5rem] border-2 border-slate-50 text-center shadow-sm">
                  <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-amber-500"><Tag className="w-7 h-7" /></div>
                  <h3 className="font-bold text-slate-800 text-sm h-10 flex items-center justify-center">{r.title}</h3>
                  <p className="font-black text-indigo-600 text-xl my-4">{r.cost} ن</p>
                  <button onClick={() => {
                      if (stats.totalPoints >= r.cost) { setStats(s => ({ ...s, totalPoints: s.totalPoints - r.cost })); alert("استمتع بمكافأتك!"); } else alert("نقاطك لا تكفي!");
                    }} className="w-full py-3.5 rounded-xl font-black text-[10px] bg-slate-900 text-white shadow-md active:scale-95">شراء</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6 animate-in slide-in-from-right-6 duration-500">
            <div className="bg-emerald-500 text-white p-10 rounded-[3rem] shadow-xl text-center">
              <h2 className="text-2xl font-black mb-6 flex items-center justify-center gap-3"><Wallet className="w-7 h-7" /> الرقابة المالية</h2>
              <p className="text-4xl font-black mb-2">{(budget.dailyLimit - budget.spentToday).toLocaleString()} ج</p>
              <p className="text-[10px] font-bold opacity-70">الميزانية اليومية المتبقية</p>
              <button onClick={async () => {
                  if (budget.expenses.length === 0) return alert("سجل مصروفاتك.");
                  setIsAiLoading(true);
                  const advice = await analyzeBudget(budget.expenses, budget.dailyLimit);
                  setAiBudgetAdvice(advice);
                  setIsAiLoading(false);
                }} className="mt-6 bg-white text-emerald-600 px-8 py-3 rounded-full font-black text-xs shadow-md">نصيحة ذكية</button>
            </div>
            {aiBudgetAdvice && (
              <div className="bg-indigo-50 p-8 rounded-[2rem] border-2 border-indigo-100 relative shadow-sm flex items-start gap-4">
                <button onClick={() => setAiBudgetAdvice(null)} className="absolute top-4 left-4 text-slate-300"><X className="w-5 h-5" /></button>
                <div className="bg-white p-3 rounded-xl text-indigo-500 shadow-md"><MessageSquareQuote className="w-6 h-6" /></div>
                <p className="text-sm font-bold text-slate-700 leading-relaxed pr-2">{aiBudgetAdvice}</p>
              </div>
            )}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-500" /> إضافة مصروف</h3>
              <div className="flex gap-3">
                <input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="المبلغ" className="w-24 p-4 bg-slate-50 rounded-xl border-2 border-slate-100 font-black outline-none" />
                <input type="text" value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="الوصف" className="flex-1 p-4 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold outline-none" />
                <button onClick={() => {
                    const a = parseFloat(expenseAmount);
                    if (a > 0) setBudget(p => ({ ...p, spentToday: p.spentToday + a, expenses: [{ id: Date.now().toString(), amount: a, description: expenseNote || 'مصروف عام', timestamp: new Date().toISOString() }, ...p.expenses] }));
                    setExpenseAmount(''); setExpenseNote('');
                  }} className="bg-emerald-500 text-white px-6 rounded-xl shadow-lg active:scale-90"><CheckCircle className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="space-y-3">
               {budget.expenses.map(e => (
                <div key={e.id} className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl text-slate-400"><ReceiptText className="w-6 h-6" /></div>
                    <div><p className="font-bold text-slate-800 text-sm">{e.description}</p><p className="text-[9px] text-slate-400 font-bold">{new Date(e.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-rose-500 text-lg">-{e.amount} ج</span>
                    <button onClick={() => setBudget(p => ({ ...p, spentToday: Math.max(0, p.spentToday - e.amount), expenses: p.expenses.filter(x => x.id !== e.id) }))} className="text-slate-200 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-8 py-5 flex justify-around items-center z-50 rounded-t-[3rem] shadow-2xl">
        {[
          { id: 'goals', icon: LayoutGrid, label: 'الأهداف' },
          { id: 'stats', icon: BarChart3, label: 'التقدم' },
          { id: 'shop', icon: ShoppingCart, label: 'المتجر' },
          { id: 'budget', icon: Wallet, label: 'المالية' }
        ].map((btn) => (
          <button key={btn.id} onClick={() => setActiveTab(btn.id as any)} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === btn.id ? 'text-indigo-600 scale-110 -translate-y-2' : 'text-slate-300'}`}>
            <btn.icon className={`w-6 h-6 ${activeTab === btn.id ? 'stroke-[3px]' : 'stroke-2'}`} />
            <span className="text-[9px] font-black">{btn.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
