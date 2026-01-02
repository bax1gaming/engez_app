
import { GoogleGenAI, Type } from "@google/genai";
import { GoalCategory, Expense } from "../types.ts";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const categorizeGoal = async (title: string, description: string): Promise<GoalCategory> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `صنف هذه المهمة: "${title} - ${description}" إلى واحدة من الفئات التالية فقط: (religious, physical, academic, general). رد بالكلمة الإنجليزية للفئة فقط.`,
    });
    const category = response.text?.trim().toLowerCase() as GoalCategory;
    const validCategories: GoalCategory[] = ['religious', 'physical', 'academic', 'general'];
    return validCategories.includes(category) ? category : 'general';
  } catch (e) {
    console.error("Categorization failed", e);
    return 'general';
  }
};

export const calculateRewardCost = async (rewardTitle: string): Promise<number> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بصفتك خبير في أنظمة التحفيز، كم يجب أن يكون سعر هذه المكافأة بالنقاط: "${rewardTitle}"؟ 
      ضع في اعتبارك أن المهام اليومية تعطي 10 نقاط والسنوية 500. 
      أعطني سعراً عادلاً (رقم فقط) بين 50 و 1500 بناءً على قيمة المكافأة.`,
    });
    const costText = response.text?.trim().replace(/[^0-9]/g, '') || "200";
    const cost = parseInt(costText);
    return isNaN(cost) ? 200 : cost;
  } catch (e) {
    return 250; // Default fallback
  }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const expenseSummary = expenses.map(e => `${e.description}: ${e.amount}ج`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بناءً على مصروفات اليوم: [${expenseSummary}] والحد اليومي المسموح به (${dailyLimit}ج)، أعطني نصيحة مالية مختصرة جداً وباللغة العربية المشجعة.`,
    });
    return response.text || "استمر في مراقبة مصروفاتك بحكمة!";
  } catch (e) {
    return "حافظ على توازنك المالي لتحقيق أهدافك!";
  }
};

export const generateGoalBreakdown = async (yearlyGoal: string) => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `أنت خبير إنتاجية وباحث. قم بتحليل هذا الهدف السنوي: "${yearlyGoal}".
      1. ابحث في أفضل الممارسات لتحقيقه.
      2. قسمه إلى 3 أهداف شهرية كبرى.
      3. لكل شهر، أعطني هدفين أسبوعيين محددين.
      4. اقترح "مهمة يومية" بسيطة.
      5. حدد فئة هذا الهدف (religious, physical, academic, general).
      رد بصيغة JSON فقط.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            monthlyGoals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  weeklySubGoals: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["title", "description", "weeklySubGoals"]
              }
            },
            suggestedDailyTask: { type: Type.STRING }
          },
          required: ["monthlyGoals", "suggestedDailyTask", "category"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Breakdown failed", e);
    return null;
  }
};

export const generateDailyQuest = async (currentMonthlyGoals: string[]) => {
  try {
    const ai = getAi();
    const goalsContext = currentMonthlyGoals.join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بناءً على أهدافي الشهرية: [${goalsContext}]، اقترح مهمة يومية واحدة وفئتها. الفئات المتاحة: religious, physical, academic, general.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ["title", "category"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { title: "خطوة صغيرة نحو أهدافك الكبيرة", category: 'general' };
  }
};
