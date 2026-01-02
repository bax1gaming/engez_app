
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

/**
 * دالة التحليل الذكي مع نظام محاولات مزدوج لضمان العمل في Vercel
 */
export const generateGoalBreakdown = async (yearlyGoal: string) => {
  const modelsToTry = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const ai = getAi();
      const prompt = `أنت الآن خبير تقني متخصص في بناء المسارات التعليمية (Roadmaps). 
المهمة: قم بتحليل الهدف التالي: "${yearlyGoal}" وتوليد خطة تعلم تقنية متدرجة.

شروط حتمية:
1. إذا كان الهدف برمجياً (مثل CSS)، يجب أن تبدأ المهام بـ (Syntax, Selectors) ثم (Box Model, Flexbox) ثم (Advanced Grid, Animations).
2. لا تستخدم أبداً جمل عامة مثل "البحث" أو "الاستعداد". استخدم مصطلحات المادة العلمية نفسها.
3. يجب أن تكون كل مرحلة شهرية عبارة عن "قفزة نوعية" في المهارة.

رد بصيغة JSON حصراً بهذا التنسيق:
{
  "category": "الفئة",
  "monthlyGoals": [
    {
      "title": "عنوان تقني محدد (مثلاً: إتقان الـ Selectors و Syntax)",
      "description": "وصف ما سيتم تعلمه تقنياً في ${yearlyGoal}",
      "weeklySubGoals": [
        "مهمة برمجية/عملية دقيقة 1",
        "مهمة برمجية/عملية دقيقة 2"
      ]
    },
    { "title": "المرحلة التقنية التالية", "description": "...", "weeklySubGoals": ["...", "..."] },
    { "title": "مرحلة الاحتراف والتطبيق", "description": "...", "weeklySubGoals": ["...", "..."] }
  ],
  "suggestedDailyTask": "عادة تقنية يومية"
}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: modelName.includes('pro') ? 12000 : 0 }
        }
      });

      const text = response.text?.trim();
      if (!text) continue;

      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
      const result = JSON.parse(jsonStr);

      if (result.monthlyGoals && result.monthlyGoals.length > 0) {
        return { ...result, isSuccess: true, usedModel: modelName };
      }
    } catch (e) {
      lastError = e;
      console.warn(`Model ${modelName} failed, trying next...`, e);
    }
  }

  // إذا فشلت كل المحاولات، نقوم بتوليد خطة "شبه ذكية" تعتمد على الكلمات المفتاحية
  const topic = yearlyGoal.replace(/تعلم|إتقان|دراسة|حفظ/g, "").trim() || yearlyGoal;
  return {
    category: "general",
    isSuccess: false,
    monthlyGoals: [
      { 
        title: `إتقان أساسيات وقواعد ${topic}`, 
        description: `التركيز على الـ Syntax والمفاهيم الجوهرية لـ ${topic}.`, 
        weeklySubGoals: [
          `تطبيق عملي على أول 3 دروس في ${topic}`,
          `بناء نموذج مصغر يختبر فهمك لأساسيات ${topic}`
        ] 
      },
      { 
        title: `المفاهيم المتقدمة في ${topic}`, 
        description: `الانتقال إلى الاحتراف في ${topic} عبر مشاريع حقيقية.`, 
        weeklySubGoals: [
          `تنفيذ مشروع "تحدي" يجمع كل ما تعلمته في ${topic}`,
          `مراجعة الأخطاء الشائعة وتحسين جودة العمل في ${topic}`
        ] 
      }
    ],
    suggestedDailyTask: `ممارسة ${topic} لمدة 20 دقيقة يومياً`
  };
};

export const generateDailyTasksForProgress = async (yearlyGoals: Goal[]) => {
  try {
    if (yearlyGoals.length === 0) return [];
    const ai = getAi();
    const context = yearlyGoals.map(g => g.title).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `أهدافي: [${context}]. اقترح مهمتين صغيرتين جداً لليوم. JSON: { "tasks": [{ "title": "مهمة", "category": "الفئة" }] }`,
      config: { responseMimeType: "application/json" }
    });
    const data = JSON.parse(response.text?.match(/\{[\s\S]*\}/)?.[0] || "{}");
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
      contents: `تكلفة مكافأة "${rewardTitle}" بالنقاط (50-1500). رقم فقط.`,
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
      contents: `حلل: [${summary}] بحد ${dailyLimit}. نصيحة مالية بالعربية.`,
    });
    return response.text || "وفر اليوم لتربح غداً!";
  } catch (e) { return "راقب مصروفاتك."; }
};
