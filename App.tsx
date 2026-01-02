
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
  const [aiStatus, setAiStatus] = useState('');

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v4_goals');
      let loaded = saved ? JSON.parse(saved) : [];
      const fixedIds = FIXED_DAILY_TASKS.map(t => t.id);
      const existingFixed = loaded.filter((g: any) => fixedIds.includes(g.id)).map((g: any) => g.id);
      const missingFixed = FIXED_DAILY_TASKS.filter(f => !existingFixed.includes(f.id));
      return [...missingFixed, ...loaded];
    } catch (e) { return FIXED_DAILY_TASKS; }
  });
  
  const [customRewards, setCustomRewards] = useState<Reward[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v4_rewards');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [budget, setBudget] = useState<Budget>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v4_budget');
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
      const saved = localStorage.getItem('enjaz_v4_stats');
      return saved ? JSON.parse(saved) : d;
    } catch (e) { return d; }
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem('enjaz_v4_reset') || new Date().toDateString());
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [aiBudgetAdvice, setAiBudgetAdvice] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');

  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('enjaz_v4_goals', JSON.stringify(goals));
    localStorage.setItem('enjaz_v4_rewards', JSON.stringify(customRewards));
    localStorage.setItem('enjaz_v4_budget', JSON.stringify(budget));
    localStorage.setItem('enjaz_v4_stats', JSON.stringify(stats));
    const t = setTimeout(() => setIsSaving(false), 800);
    return () => clearTimeout(t);
  }, [goals, customRewards, budget, stats]);

  useEffect(() => {
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      const reset = async () => {
        setIsAiLoading(true);
        setAiStatus('جاري مراجعة تقدمك وتحديث المهام...');
        const base = goals.map(g => {
          if (g.timeFrame === 'daily') {
            return FIXED_DAILY_TASKS.some(f => f.id === g.id) ? { ...g, completed: false } : null;
          }
          return g;
        }).filter(Boolean) as Goal[];

        const yearly = base.filter(g => g.timeFrame === 'yearly');
        if (yearly.length > 0) {
          try {
            const suggestions = await generateDailyTasksForProgress(yearly);
            const aiTasks = suggestions.map((t: any, i: number) => ({
              id: `ai-d-${Date.now()}-${i}`,
              title: t.title,
              description: 'مهمة حصرية من Gemini Pro',
              timeFrame: 'daily',
              category: (t.category || 'general').toLowerCase() as GoalCategory,
              completed: false, failed: false, points: 20, dueDate: new Date().toISOString(), isAiGenerated: true
            }));
            setGoals([...aiTasks, ...base]);
          } catch (e) { setGoals(base); }
        } else {
          setGoals(base);
        }
        
        setStats(s => ({ ...s, isRestDay: false }));
        setBudget(b => ({ ...b, spentToday: 0, expenses: [] })); 
        setLastResetDate(today);
        localStorage.setItem('enjaz_v4_reset', today);
        setIsAiLoading(false);
      };
      reset();
    }
  }, [lastResetDate]);

  const handleAiBreakdown = async () => {
    if (!newGoalText.trim()) return;
    setIsAiLoading(true);
    setAiStatus(`Gemini Pro يقوم بتحليل "${newGoalText}" الآن...`);
    try {
      const res = await generateGoalBreakdown(newGoalText);
      if (res && res.monthlyGoals) {
        const yId = Date.now().toString();
        const cat = (res.category || 'general').toLowerCase() as GoalCategory;
        
        const mainGoal: Goal = { 
          id: yId, title: newGoalText, description: 'هدف سنوي محوري', 
          timeFrame: 'yearly', category: cat, completed: false, failed: false, points: 500, dueDate: new Date().toISOString() 
        };
        
        const subTasks: Goal[] = [];
        res.monthlyGoals.forEach((m: any, mIdx: number) => {
          const mId = `${yId}-m-${mIdx}`;
          subTasks.push({ 
            id: mId, title: m.title, description: m.description, 
            timeFrame: 'monthly', category: cat, completed: false, failed: false, 
            points: 100, dueDate: new Date().toISOString(), isAiGenerated: true, parentId: yId 
          });
          
          m.weeklySubGoals.forEach((w: string, wIdx: number) => {
            subTasks.push({ 
              id: `${mId}-w-${wIdx}`, title: w, description: '', 
              timeFrame: 'weekly', category: cat, completed: false, failed: false, 
              points: 50, dueDate: new Date().toISOString(), isAiGenerated: true, parentId: mId 
            });
          });
        });
        
        if (res.suggestedDailyTask) {
          subTasks.push({ 
            id: `${yId}-daily-h`, title: res.suggestedDailyTask, description: 'عادة جوهرية مقترحة', 
            timeFrame: 'daily', category: cat, completed: false, failed: false, 
            points: 25, dueDate: new Date().toISOString(), isAiGenerated: true, parentId: yId 
          });
        }
        
        setGoals(p => [mainGoal, ...subTasks, ...p]);
        setNewGoalText('');
      }
    } catch (e) {
      alert("تعذر التحليل التفصيلي حالياً، سأضيف الهدف بشكل مبسط.");
      const id = Date.now().toString();
      setGoals(p => [{ id, title: newGoalText, description: '', timeFrame: 'yearly', category: 'general', completed: false, failed: false, points: 500, dueDate: new Date().toISOString() }, ...p]);
      setNewGoalText('');
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
    <div className="min-h-screen pb-32 max-w-2xl mx-auto bg-slate-50 shadow-2xl flex flex-col font-['Cairo']">
      
      {/* HEADER */}
      <header className={`p-8 sticky top-0 z-50 rounded-b-[3rem] shadow-xl transition-all duration-700 ${stats.isRestDay ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl shadow-inner backdrop-blur-md">
              {stats.isRestDay ? <BedDouble className="w-8 h-8" /> : <BrainCircuit className="w-8 h-8 animate-pulse" />}
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter">إنجاز</h1>
              <div className="flex items-center gap-2 text-[10px] font-bold opacity-80 bg-black/10 px-2 py-1 rounded-full mt-1">
                <CalendarDays className="w-3 h-3" /> {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          </div>
          <div className="bg-white text-slate-800 px-6 py-3 rounded-3xl flex items-center gap-2 shadow-2xl transform active:scale-90 transition-transform">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span className="font-black text-2xl">{stats.totalPoints}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar">
        {activeTab === 'goals' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
            {isAiLoading && (
              <div className="bg-white p-8 rounded-[2.5rem] flex flex-col items-center gap-4 shadow-lg border-2 border-indigo-100 animate-pulse text-center">
                <div className="relative">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                  <Sparkles className="w-6 h-6 text-amber-400 absolute -top-2 -right-2 animate-bounce" />
                </div>
                <p className="font-black text-indigo-600 px-4 leading-relaxed">{aiStatus}</p>
                <p className="text-[10px] text-slate-400 font-bold">قد يستغرق Gemini Pro بضع ثوانٍ للتفكير العميق...</p>
              </div>
            )}

            <section className="bg-white p-8 rounded-[3rem] shadow-2xl border border-indigo-50 relative overflow-hidden group">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-50/50 rounded-full group-hover:scale-125 transition-transform duration-1000"></div>
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 relative z-10">
                <Target className="w-6 h-6 text-indigo-500" /> ما هو هدفك الكبير؟
              </h2>
              <div className="space-y-5 relative z-10">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="مثال: إتقان الخط العربي، بناء تطبيق جوال، حفظ سورة البقرة..."
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] focus:border-indigo-500 focus:bg-white focus:outline-none font-bold text-slate-800 shadow-inner transition-all placeholder:text-slate-300"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiBreakdown()}
                />
                <button 
                  onClick={handleAiBreakdown} 
                  disabled={!newGoalText.trim() || isAiLoading}
                  className="w-full bg-indigo-600 text-white p-5 rounded-[1.8rem] font-black flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 disabled:bg-slate-200 disabled:shadow-none transition-all transform active:scale-[0.98] group"
                >
                  <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  تحليل وتقسيم ذكي (Gemini Pro)
                </button>
              </div>
            </section>

            {/* LISTS BY TIMEFRAME */}
            {['daily', 'weekly', 'monthly', 'yearly'].map((t) => {
              const items = goals.filter(g => g.timeFrame === t);
              if (items.length === 0) return null;
              return (
                <div key={t} className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 px-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                    {t === 'daily' ? <Clock className="w-4 h-4" /> : <CalendarRange className="w-4 h-4" />}
                    {t === 'daily' ? 'قائمة اليوم' : t === 'weekly' ? 'مهام الأسبوع' : t === 'monthly' ? 'أهداف الشهر' : 'الرؤية السنوية'}
                  </h3>
                  <div className="space-y-3">
                    {items.map(g => (
                      <div key={g.id} className={`flex items-center gap-5 p-6 bg-white rounded-[2.5rem] border-2 transition-all group ${g.completed ? 'border-emerald-50 opacity-60 bg-emerald-50/20' : 'border-slate-50 hover:border-indigo-100 shadow-sm hover:shadow-xl'}`}>
                        <button onClick={() => toggleGoal(g.id)} className="shrink-0 transform active:scale-75 transition-transform">
                          {g.completed ? <CheckCircle className="w-10 h-10 text-emerald-500 fill-white rounded-full shadow-lg" /> : <Circle className="w-10 h-10 text-slate-200 group-hover:text-indigo-200" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-slate-800 text-base leading-tight ${g.completed ? 'line-through text-slate-400' : ''}`}>
                            {g.title} {g.isAiGenerated && <Sparkle className="inline w-3 h-3 text-indigo-400 ml-1 animate-pulse" />}
                          </h4>
                          <div className="flex items-center gap-2 mt-2">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl ${CATEGORY_CONFIG[g.category]?.bg} ${CATEGORY_CONFIG[g.category]?.color} text-[10px] font-black shadow-sm`}>
                              {React.createElement(CATEGORY_CONFIG[g.category]?.icon, { className: "w-3 h-3" })}
                              {CATEGORY_CONFIG[g.category]?.label}
                            </div>
                            {g.description && <span className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{g.description}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl shadow-inner">+{g.points}</span>
                          <button onClick={() => setGoals(p => p.filter(x => x.id !== g.id))} className="block text-slate-200 hover:text-rose-500 mt-3 transition-colors p-1 opacity-0 group-hover:opacity-100">
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

        {/* SHOP TAB */}
        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-left-6 duration-700">
             <header className="bg-amber-400 p-10 rounded-[3rem] text-white shadow-2xl text-center relative overflow-hidden">
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/20 rounded-full animate-pulse"></div>
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-90 drop-shadow-lg" />
              <h2 className="text-3xl font-black">متجر الجوائز</h2>
              <p className="text-sm text-amber-100 font-bold mt-2">حوّل عرقك وجهدك إلى متعة مستحقة</p>
              <button onClick={() => setIsAddingReward(true)} className="mt-8 bg-white text-amber-500 px-8 py-3 rounded-full font-black text-sm shadow-xl hover:bg-amber-50 transition-all transform active:scale-95">+ أضف مكافأة مخصصة</button>
            </header>

            {isAddingReward && (
              <div className="bg-white p-8 rounded-[3rem] border-4 border-amber-200 space-y-5 animate-in zoom-in-95 shadow-2xl">
                <div className="flex justify-between items-center">
                   <h3 className="font-black text-slate-800 text-xl">كافئ نفسك بشيء تحبه</h3>
                   <button onClick={() => setIsAddingReward(false)} className="text-slate-300 hover:text-rose-500 transition-colors"><X /></button>
                </div>
                <input 
                  type="text" 
                  value={newRewardTitle} 
                  onChange={(e) => setNewRewardTitle(e.target.value)} 
                  placeholder="مثال: الخروج مع الأصدقاء، وجبة مفضلة..." 
                  className="w-full p-5 bg-slate-50 rounded-[1.8rem] border-2 border-slate-100 font-bold focus:border-amber-400 focus:outline-none shadow-inner" 
                />
                <button 
                  onClick={async () => {
                    if (!newRewardTitle.trim()) return;
                    setIsAiLoading(true);
                    setAiStatus('Gemini يقيم قيمة مكافأتك...');
                    const c = await calculateRewardCost(newRewardTitle);
                    setCustomRewards([{ id: Date.now().toString(), title: newRewardTitle, cost: c, icon: 'Tag' }, ...customRewards]);
                    setNewRewardTitle(''); setIsAddingReward(false); setIsAiLoading(false);
                  }} 
                  className="w-full bg-amber-500 text-white p-5 rounded-[1.8rem] font-black shadow-xl transform active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" /> تقدير التكلفة بالذكاء الاصطناعي
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5">
              {[...INITIAL_REWARDS, ...customRewards].map(r => (
                <div key={r.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 text-center shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-[3rem] -translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                  <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-500 group-hover:scale-110 transition-transform shadow-sm">
                    <Tag className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base h-12 flex items-center justify-center leading-snug px-2">{r.title}</h3>
                  <div className="flex items-center justify-center gap-1 my-4">
                    <Zap className="w-5 h-5 text-indigo-600 fill-indigo-600" />
                    <span className="font-black text-indigo-600 text-2xl">{r.cost}</span>
                  </div>
                  <button 
                    onClick={() => {
                      if (stats.totalPoints >= r.cost) {
                        setStats(s => ({ ...s, totalPoints: s.totalPoints - r.cost }));
                        alert(`مبروك! استمتع بـ ${r.title}.`);
                      } else alert("رصيدك لا يكفي حالياً، استمر في الإنجاز!");
                    }} 
                    className="w-full py-4 rounded-2xl font-black text-sm bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
                  >
                    شراء الآن
                  </button>
                  <button 
                    onClick={() => setCustomRewards(p => p.filter(x => x.id !== r.id))}
                    className="absolute top-4 left-4 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUDGET TAB */}
        {activeTab === 'budget' && (
          <div className="space-y-6 animate-in slide-in-from-right-6 duration-700">
            <div className="bg-emerald-500 text-white p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
              <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full animate-pulse"></div>
              <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><Wallet className="w-7 h-7" /> ذكاء الميزانية</h2>
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-white/10 p-6 rounded-[2rem] backdrop-blur-md border border-white/20 shadow-inner">
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">المتاح لليوم</p>
                  <p className="text-3xl font-black">{(budget.dailyLimit - budget.spentToday).toLocaleString()} ج</p>
                </div>
                <button 
                  onClick={async () => {
                    if (budget.expenses.length === 0) return alert("قم بتسجيل بعض المصروفات أولاً.");
                    setIsAiLoading(true);
                    setAiStatus('Gemini Pro يحلل نمط استهلاكك...');
                    const advice = await analyzeBudget(budget.expenses, budget.dailyLimit);
                    setAiBudgetAdvice(advice);
                    setIsAiLoading(false);
                  }} 
                  className="bg-white text-emerald-600 rounded-[2rem] font-black text-xs px-4 shadow-xl hover:bg-emerald-50 transition-all transform active:scale-95"
                >
                  تحليل مالي ذكي
                </button>
              </div>
            </div>

            {aiBudgetAdvice && (
              <div className="bg-indigo-50 p-8 rounded-[3rem] border-2 border-indigo-100 font-bold text-slate-700 animate-in slide-in-from-top-6 relative shadow-sm">
                <button onClick={() => setAiBudgetAdvice(null)} className="absolute top-6 left-6 text-slate-300 hover:text-indigo-500"><X className="w-6 h-6" /></button>
                <div className="flex items-start gap-4">
                  <div className="bg-white p-3 rounded-2xl shadow-md text-indigo-500">
                    <MessageSquareQuote className="w-8 h-8" />
                  </div>
                  <p className="text-base leading-relaxed pt-1 pr-2">{aiBudgetAdvice}</p>
                </div>
              </div>
            )}

            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" /> تسجيل عملية شراء
              </h3>
              <div className="flex gap-3">
                <input 
                  type="number" 
                  value={expenseAmount} 
                  onChange={(e) => setExpenseAmount(e.target.value)} 
                  placeholder="المبلغ" 
                  className="w-28 p-5 bg-slate-50 rounded-[1.5rem] border-2 border-slate-100 font-black focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-inner" 
                />
                <input 
                  type="text" 
                  value={expenseNote} 
                  onChange={(e) => setExpenseNote(e.target.value)} 
                  placeholder="مثلاً: قهوة، مواصلات..." 
                  className="flex-1 p-5 bg-slate-50 rounded-[1.5rem] border-2 border-slate-100 font-bold focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-inner" 
                />
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
                  className="bg-emerald-500 text-white px-6 rounded-[1.5rem] shadow-xl active:scale-[0.85] transition-all"
                >
                  <CheckCircle className="w-7 h-7" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 px-6 uppercase tracking-[0.2em]">المشتريات الأخيرة</h3>
              {budget.expenses.length === 0 ? (
                <div className="bg-white/50 border-4 border-dashed border-slate-100 rounded-[3rem] py-20 text-center">
                  <ReceiptText className="w-16 h-16 text-slate-200 mx-auto mb-4 opacity-30" />
                  <p className="text-slate-300 font-black text-sm">لم تسجل أي مصروفات اليوم</p>
                </div>
              ) : (
                <div className="space-y-3 px-1">
                  {budget.expenses.map(e => (
                    <div key={e.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 flex justify-between items-center shadow-sm hover:border-emerald-100 transition-all group">
                      <div className="flex items-center gap-5">
                        <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-emerald-500 transition-colors shadow-inner">
                          <ReceiptText className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-base">{e.description}</p>
                          <p className="text-[10px] text-slate-400 font-black mt-1">
                            {new Date(e.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <span className="font-black text-rose-500 text-xl">-{e.amount.toLocaleString()} ج</span>
                        <button 
                          onClick={() => setBudget(p => ({ ...p, spentToday: Math.max(0, p.spentToday - e.amount), expenses: p.expenses.filter(x => x.id !== e.id) }))} 
                          className="text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
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
          <div className="space-y-8 animate-in fade-in duration-1000">
             <div className="bg-slate-900 text-white p-12 rounded-[3.5rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <h2 className="text-3xl font-black mb-10 relative z-10 flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-indigo-400" /> خارطة الإنجاز
                </h2>
                <div className="grid grid-cols-2 gap-6 relative z-10">
                  <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-inner group">
                    <p className="text-5xl font-black mb-2 group-hover:scale-110 transition-transform">{stats.goalsCompleted}</p>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">مهمة مكتملة</p>
                  </div>
                  <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-inner group">
                    <p className="text-5xl font-black mb-2 text-indigo-400 group-hover:scale-110 transition-transform">{stats.totalPoints}</p>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">إجمالي الخبرة</p>
                  </div>
                </div>
             </div>
             
             <div className="space-y-5">
               <h3 className="text-xs font-black text-slate-400 px-8 uppercase tracking-[0.2em]">تطور المهارات</h3>
               {Object.entries(CATEGORY_CONFIG).map(([k, c]) => {
                  const s = stats.categories[k as GoalCategory] || { level: 1, exp: 0 };
                  const CatIcon = c.icon;
                  return (
                    <div key={k} className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 flex items-center gap-8 shadow-sm hover:shadow-xl transition-all group">
                      <div className={`w-20 h-20 rounded-[2rem] ${c.bg} ${c.color} flex items-center justify-center shrink-0 shadow-lg transform group-hover:rotate-6 transition-transform`}>
                        <CatIcon className="w-10 h-10" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-3">
                          <p className="font-black text-slate-800 text-lg">{c.label}</p>
                          <p className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">المستوى {s.level}</p>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-50">
                          <div 
                            className={`h-full ${c.color.replace('text', 'bg')} rounded-full transition-all duration-1000 ease-out relative`} 
                            style={{ width: `${Math.min(100, s.exp)}%` }} 
                          >
                            <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse"></div>
                          </div>
                        </div>
                        <p className="text-[9px] font-bold text-slate-300 mt-2 text-left uppercase">{s.exp} / 100 EXP</p>
                      </div>
                    </div>
                  );
               })}
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/90 backdrop-blur-3xl border-t border-slate-100 px-10 py-6 flex justify-around items-center z-50 rounded-t-[3.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
        {[
          { id: 'goals', icon: LayoutGrid, label: 'المهام' },
          { id: 'stats', icon: BarChart3, label: 'النمو' },
          { id: 'shop', icon: ShoppingCart, label: 'المكافآت' },
          { id: 'budget', icon: Wallet, label: 'المالية' }
        ].map((btn) => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-2 transition-all duration-500 ${activeTab === btn.id ? 'text-indigo-600 scale-125 -translate-y-2' : 'text-slate-300 hover:text-slate-400'}`}
          >
            <btn.icon className={`w-7 h-7 ${activeTab === btn.id ? 'stroke-[3px]' : 'stroke-2'}`} />
            <span className="text-[10px] font-black">{btn.label}</span>
            {activeTab === btn.id && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-in zoom-in"></div>}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
