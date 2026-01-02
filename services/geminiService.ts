
import { GoogleGenAI, Type } from "@google/genai";
import { GoalCategory, Expense, Goal } from "../types.ts";

const getAi = () => {
  const apiKey = process.env.API_KEY;
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

export const categorizeGoal = async (title: string, description: string): Promise<GoalCategory> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `أنت مساعد ذكي. صنف المهمة التالية: "${title}" إلى واحدة من هذه الفئات حصراً: (religious, physical, academic, general). رد بالكلمة الإنجليزية فقط.`,
    });
    const category = response.text?.trim().toLowerCase() as GoalCategory;
    const valid: GoalCategory[] = ['religious', 'physical', 'academic', 'general'];
    return valid.includes(category) ? category : 'general';
  } catch (e) {
    return 'general';
  }
};

export const generateGoalBreakdown = async (yearlyGoal: string) => {
  try {
    const ai = getAi();
    // استخدام موديل Pro للتقسيم المعقد لضمان خطوات ذكية وغير مكررة
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `أنت خبير إنتاجية عالمي. قم بتحليل الهدف السنوي التالي وصمم له خطة عمل "فريدة ومبتكرة وغير تقليدية": "${yearlyGoal}".
      
      المطلوب:
      1. تصنيف دقيق للهدف.
      2. ثلاث مراحل شهرية (كل مرحلة لها عنوان حماسي، وصف تفصيلي، ومهمتين أسبوعيتين محددتين جداً).
      3. مهمة يومية "جوهرية" (Atomic Habit) تساعد في تحقيق هذا الهدف.
      
      يجب أن تكون جميع الخطوات مرتبطة "حصرياً" وبشكل مباشر بالهدف: "${yearlyGoal}". لا تستخدم عبارات عامة مكررة.
      
      رد بصيغة JSON فقط بهذا التنسيق:
      {
        "category": "الفئة",
        "monthlyGoals": [
          {
            "title": "عنوان فريد",
            "description": "وصف دقيق",
            "weeklySubGoals": ["مهمة 1", "مهمة 2"]
          }
        ],
        "suggestedDailyTask": "مهمة يومية"
      }`,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4000 } // السماح للموديل بالتفكير لإنتاج خطة أفضل
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("استجابة فارغة من الموديل");
    
    // محاولة تنظيف النص في حال وجود Markdown
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("خطأ في التقسيم الذكي:", e);
    // نظام احتياطي أكثر ذكاءً يعتمد على كلمات الهدف
    return {
      category: "general",
      monthlyGoals: [
        { 
          title: `مرحلة استكشاف ${yearlyGoal}`, 
          description: `البحث المعمق وجمع الأدوات اللازمة للنجاح في ${yearlyGoal}`, 
          weeklySubGoals: [`وضع خطة زمنية لـ ${yearlyGoal}`, "البحث عن أفضل المصادر"] 
        },
        { 
          title: `مرحلة الانطلاق الفعلي`, 
          description: `تطبيق أول 30% من متطلبات ${yearlyGoal}`, 
          weeklySubGoals: ["التغلب على أول عقبة تقنية", "تحقيق أول إنجاز ملموس"] 
        },
        { 
          title: `مرحلة التثبيت والنتائج`, 
          description: `تحويل ${yearlyGoal} إلى واقع يومي مستدام`, 
          weeklySubGoals: ["مراجعة الجودة النهائية", "الاحتفال بتحقيق الهدف"] 
        }
      ],
      suggestedDailyTask: `تخصيص 15 دقيقة للعمل على ${yearlyGoal}`
    };
  }
};

export const generateDailyTasksForProgress = async (yearlyGoals: Goal[]) => {
  try {
    if (yearlyGoals.length === 0) return [];
    const ai = getAi();
    const goalsContext = yearlyGoals.map(g => g.title).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بناءً على الأهداف السنوية: [${goalsContext}]، اقترح مهمتين (2) ذكيتين لليوم فقط لتسريع الإنجاز.
      رد بصيغة JSON: { "tasks": [{ "title": "مهمة حماسية", "category": "الفئة بالإنجليزية" }] }`,
      config: { responseMimeType: "application/json" }
    });
    const cleanJson = response.text?.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJson || "{}");
    return data.tasks || [];
  } catch (e) {
    return [];
  }
};

export const calculateRewardCost = async (rewardTitle: string): Promise<number> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `كم نقطة تستحق مكافأة: "${rewardTitle}" في نظام إنتاجية؟ رد برقم فقط بين 50 و 1500.`,
    });
    return parseInt(response.text?.replace(/[^0-9]/g, '') || "200");
  } catch (e) { return 250; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const summary = expenses.map(e => `${e.description}: ${e.amount}ج`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `حلل المصروفات: [${summary}] بحد يومي ${dailyLimit}ج. أعط نصيحة مالية ذكية ومختصرة جداً بالعربية.`,
    });
    return response.text || "وفر اليوم لتربح غداً!";
  } catch (e) { return "حافظ على ميزانيتك!"; }
};
