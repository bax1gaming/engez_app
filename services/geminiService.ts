
import { GoogleGenAI, Type } from "@google/genai";
import { GoalCategory, Expense, Goal } from "../types.ts";

const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

export const categorizeGoal = async (title: string, description: string): Promise<GoalCategory> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `صنف هذا الهدف: "${title}" إلى فئة واحدة فقط: (religious, physical, academic, general). رد بالكلمة الإنجليزية فقط.`,
    });
    const category = response.text?.trim().toLowerCase() as GoalCategory;
    const valid: GoalCategory[] = ['religious', 'physical', 'academic', 'general'];
    return valid.includes(category) ? category : 'general';
  } catch (e) {
    return 'general';
  }
};

export const generateGoalBreakdown = async (yearlyGoal: string) => {
  // استخدام Flash كخيار أول في Vercel لسرعة الاستجابة وتجنب الـ Timeout
  const modelsToTry = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
  
  for (const modelName of modelsToTry) {
    try {
      const ai = getAi();
      const prompt = `أنت خبير مسارات تعلم. حلل الهدف: "${yearlyGoal}".
المطلوب: خطة تقنية متدرجة. ابدأ بالأساسيات ثم الاحتراف. استخدم مصطلحات فنية دقيقة.
رد بصيغة JSON:
{
  "category": "الفئة بالإنجليزية",
  "monthlyGoals": [
    {
      "title": "عنوان تقني محدد",
      "description": "وصف فني",
      "weeklySubGoals": ["مهمة 1", "مهمة 2"]
    }
  ],
  "suggestedDailyTask": "عادة يومية"
}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          // تقليل ميزانية التفكير لضمان سرعة الرد في بيئة الويب
          thinkingConfig: { thinkingBudget: modelName.includes('pro') ? 4000 : 0 }
        }
      });

      const text = response.text?.trim();
      if (!text) continue;

      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
      const result = JSON.parse(jsonStr);

      if (result.monthlyGoals && result.monthlyGoals.length > 0) {
        return { ...result, isSuccess: true };
      }
    } catch (e) {
      console.warn(`Model ${modelName} failed, trying next...`);
    }
  }

  const topic = yearlyGoal.replace(/تعلم|إتقان|دراسة|حفظ/g, "").trim() || yearlyGoal;
  return {
    category: "general",
    isSuccess: false,
    monthlyGoals: [
      { 
        title: `إتقان أساسيات ${topic}`, 
        description: `التركيز على القواعد الجوهرية لـ ${topic}.`, 
        weeklySubGoals: [`دراسة المدخل الأساسي لـ ${topic}`, `تطبيق عملي بسيط`] 
      },
      { 
        title: `الاحتراف في ${topic}`, 
        description: `بناء مشاريع متقدمة في ${topic}.`, 
        weeklySubGoals: [`تحدي مستوى متوسط`, `إنجاز مشروع كامل`] 
      }
    ],
    suggestedDailyTask: `التدرب على ${topic} لمدة 15 دقيقة`
  };
};

export const generateDailyTasksForProgress = async (yearlyGoals: Goal[]) => {
  try {
    if (yearlyGoals.length === 0) return [];
    const ai = getAi();
    const context = yearlyGoals.map(g => g.title).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بناءً على أهدافي: [${context}]، اعطني مهمتين سريعتين لليوم. JSON: { "tasks": [{ "title": "مهمة", "category": "الفئة" }] }`,
      config: { responseMimeType: "application/json" }
    });
    const data = JSON.parse(response.text?.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return data.tasks || [];
  } catch (e) { return []; }
};

export const calculateRewardCost = async (rewardTitle: string): Promise<number> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `كم نقطة تستحق مكافأة "${rewardTitle}" (50-1000)؟ رد بالرقم فقط.`,
    });
    return parseInt(response.text?.replace(/[^0-9]/g, '') || "200");
  } catch (e) { return 250; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const summary = expenses.slice(0, 5).map(e => `${e.description}: ${e.amount}`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `حلل هذه المصروفات: [${summary}] بحد يومي ${dailyLimit}. نصيحة مالية قصيرة جداً بالعربية.`,
    });
    return response.text || "راقب مصروفاتك بحكمة.";
  } catch (e) { return "استمر في مراقبة ميزانيتك."; }
};
