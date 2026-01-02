
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
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [showAiError, setShowAiError] = useState(false);

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v7_goals');
      let loaded = saved ? JSON.parse(saved) : [];
      const fixedIds = FIXED_DAILY_TASKS.map(t => t.id);
      const existingFixed = loaded.filter((g: any) => fixedIds.includes(g.id)).map((g: any) => g.id);
      const missingFixed = FIXED_DAILY_TASKS.filter(f => !existingFixed.includes(f.id));
      return [...missingFixed, ...loaded];
    } catch (e) { return FIXED_DAILY_TASKS; }
  });
  
  const [customRewards, setCustomRewards] = useState<Reward[]>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v7_rewards');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [budget, setBudget] = useState<Budget>(() => {
    try {
      const saved = localStorage.getItem('enjaz_v7_budget');
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
      const saved = localStorage.getItem('enjaz_v7_stats');
      return saved ? JSON.parse(saved) : d;
    } catch (e) { return d; }
  });
  
  const [newGoalText, setNewGoalText] = useState('');
  const [lastResetDate, setLastResetDate] = useState(() => localStorage.getItem('enjaz_v7_reset') || new Date().toDateString());
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [aiBudgetAdvice, setAiBudgetAdvice] = useState<string | null>(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');

  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('enjaz_v7_goals', JSON.stringify(goals));
    localStorage.setItem('enjaz_v7_rewards', JSON.stringify(customRewards));
    localStorage.setItem('enjaz_v7_budget', JSON.stringify(budget));
    localStorage.setItem('enjaz_v7_stats', JSON.stringify(stats));
    const t = setTimeout(() => setIsSaving(false), 800);
    return () => clearTimeout(t);
  }, [goals, customRewards, budget, stats]);

  useEffect(() => {
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      const reset = async () => {
        setIsAiLoading(true);
        setAiStatus('يتم الآن تحديث مهامك اليومية بذكاء مخصص...');
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
              description: 'مهمة مستوحاة من أهدافك',
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
        localStorage.setItem('enjaz_v7_reset', today);
        setIsAiLoading(false);
      };
      reset();
    }
  }, [lastResetDate]);

  const handleAiBreakdown = async (titleOverride?: string) => {
    const targetTitle = titleOverride || newGoalText;
    if (!targetTitle.trim()) return;
    
    setIsAiLoading(true);
    setShowAiError(false);
    setAiStatus(`Gemini Pro يقوم بتفكيك "${targetTitle}" وتصميم منهج خاص...`);
    
    try {
      const res = await generateGoalBreakdown(targetTitle);
      
      if (!res.isSuccess) {
        setShowAiError(true);
      }

      const yId = Date.now().toString();
      const cat = (res.category || 'general').toLowerCase() as GoalCategory;
      
      const mainGoal: Goal = { 
        id: yId, title: targetTitle, description: 'هدف استراتيجي مخصص', 
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
          id: `${yId}-daily-h`, title: res.suggestedDailyTask, description: 'عادة جوهرية مخصصة', 
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
      alert("عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى التحقق من مفتاح الـ API الخاص بك.");
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
    if (window.confirm("حذف الهدف وجميع تفرعاته؟")) {
      setGoals(p => p.filter(g => g.id !== id && g.parentId !== id && !p.some(parent => parent.id === g.parentId && parent.parentId === id)));
    }
  };

  return (
    <div className="min-h-screen pb-32 max-w-2xl mx-auto bg-slate-50 shadow-2xl flex flex-col font-['Cairo']">
      
      {/* HEADER */}
      <header className={`p-8 sticky top-0 z-50 rounded-b-[3.5rem] shadow-xl transition-all duration-700 ${stats.isRestDay ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-[1.2rem] shadow-inner backdrop-blur-md">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">إنجاز</h1>
              <div className="flex items-center gap-2 text-[10px] font-bold opacity-80 bg-black/10 px-2 py-1 rounded-full mt-1">
                <CalendarDays className="w-3 h-3" /> {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          </div>
          <div className="bg-white text-slate-800 px-6 py-3 rounded-[2rem] flex items-center gap-2 shadow-2xl transform active:scale-90 transition-transform cursor-pointer">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span className="font-black text-2xl">{stats.totalPoints}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar">
        {activeTab === 'goals' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
            
            {/* AI LOADING OVERLAY */}
            {isAiLoading && (
              <div className="bg-white p-10 rounded-[3rem] flex flex-col items-center gap-5 shadow-2xl border-4 border-indigo-100 text-center animate-pulse">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <Sparkles className="w-8 h-8 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                </div>
                <div className="space-y-2">
                  <p className="font-black text-indigo-700 text-lg px-4">{aiStatus}</p>
                  <p className="text-xs text-slate-400 font-bold">يتم استخدام Gemini 3 Pro لضمان خطة غير تقليدية ومخصصة لك.</p>
                </div>
              </div>
            )}

            {/* AI ALERT FOR FALLBACK */}
            {showAiError && (
              <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex items-start gap-4">
                <Info className="w-8 h-8 text-amber-500 shrink-0" />
                <div>
                  <h4 className="font-black text-amber-800 text-sm">تم تفعيل التخطيط الذكي الاحتياطي</h4>
                  <p className="text-xs text-amber-700/80 font-bold leading-relaxed mt-1">
                    تعذر الوصول المباشر لـ Gemini Pro، قمنا بإنشاء خطة ديناميكية تعتمد على كلماتك المفتاحية. يمكنك محاولة "إعادة التحليل" لاحقاً.
                  </p>
                </div>
              </div>
            )}

            <section className="bg-white p-8 rounded-[3.5rem] shadow-2xl border border-indigo-50 relative overflow-hidden group">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 relative z-10">
                <Target className="w-7 h-7 text-indigo-500" /> حدد هدفك بوضوح
              </h2>
              <div className="space-y-5 relative z-10">
                <input
                  type="text"
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  placeholder="مثال: إتقان CSS Grid و Flexbox"
                  className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-indigo-500 focus:bg-white focus:outline-none font-bold text-slate-800 shadow-inner transition-all pr-14"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiBreakdown()}
                />
                <button 
                  onClick={() => handleAiBreakdown()} 
                  disabled={!newGoalText.trim() || isAiLoading}
                  className="w-full bg-indigo-600 text-white p-6 rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all transform active:scale-[0.98] group"
                >
                  <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  تقسيم ذكي مخصص (AI)
                </button>
              </div>
            </section>

            {/* LISTS BY TIMEFRAME */}
            {['daily', 'weekly', 'monthly', 'yearly'].map((t) => {
              const items = goals.filter(g => g.timeFrame === t);
              if (items.length === 0) return null;
              return (
                <div key={t} className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 px-8 flex items-center gap-2 uppercase tracking-[0.25em]">
                    {t === 'daily' ? 'مهام اليوم' : t === 'weekly' ? 'هذا الأسبوع' : t === 'monthly' ? 'هذا الشهر' : 'الرؤية السنوية'}
                  </h3>
                  <div className="space-y-3">
                    {items.map(g => (
                      <div key={g.id} className={`flex items-center gap-5 p-7 bg-white rounded-[3rem] border-2 transition-all group ${g.completed ? 'opacity-50 grayscale' : 'shadow-sm hover:shadow-xl'}`}>
                        <button onClick={() => toggleGoal(g.id)} className="shrink-0 transform active:scale-75 transition-transform">
                          {g.completed ? <CheckCircle className="w-12 h-12 text-emerald-500" /> : <Circle className="w-12 h-12 text-slate-200" />}
                        </button>
                        <div className="flex-1">
                          <h4 className={`font-bold text-slate-800 text-lg ${g.completed ? 'line-through' : ''}`}>
                            {g.title} {g.isAiGenerated && <Sparkle className="inline w-3 h-3 text-indigo-400 ml-1" />}
                          </h4>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl mt-2 ${CATEGORY_CONFIG[g.category]?.bg} ${CATEGORY_CONFIG[g.category]?.color} text-[10px] font-black`}>
                            {CATEGORY_CONFIG[g.category]?.label}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           <span className="text-indigo-600 font-black text-xs">+{g.points}</span>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {g.timeFrame === 'yearly' && (
                               <button onClick={() => handleAiBreakdown(g.title)} className="p-2 text-slate-300 hover:text-indigo-500">
                                 <RefreshCcw className="w-4 h-4" />
                               </button>
                            )}
                            <button onClick={() => deleteGoalGroup(g.id)} className="p-2 text-slate-200 hover:text-rose-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* OTHER TABS AS PLACEHOLDERS FOR CONTEXT */}
        {activeTab !== 'goals' && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
             <Info className="w-16 h-16 mb-4 opacity-20" />
             <p className="font-black text-sm">هذا القسم قيد الاستعراض، ركز على أهدافك أولاً!</p>
             <button onClick={() => setActiveTab('goals')} className="mt-4 text-indigo-500 font-bold underline">العودة للأهداف</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 backdrop-blur-3xl border-t border-slate-100 px-12 py-7 flex justify-around items-center z-50 rounded-t-[4rem] shadow-2xl">
        {[
          { id: 'goals', icon: LayoutGrid, label: 'الأهداف' },
          { id: 'stats', icon: BarChart3, label: 'التقدم' },
          { id: 'shop', icon: ShoppingCart, label: 'المكافآت' },
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
