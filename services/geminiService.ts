
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
      contents: `صنف هذه المهمة: "${title}" إلى واحدة من الفئات: (religious, physical, academic, general). رد بالكلمة الإنجليزية فقط.`,
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
    // استخدام موديل فلاش لسرعة الاستجابة وتجنب الـ Timeouts
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بصفتك خبير إنتاجية، قم بتقسيم الهدف السنوي: "${yearlyGoal}" إلى خطة عمل.
      يجب أن تحتوي الخطة على: 
      1. تصنيف (religious, physical, academic, general).
      2. ثلاث مراحل شهرية (كل مرحلة لها عنوان ووصف ومهمتين أسبوعيتين).
      3. مهمة يومية واحدة بسيطة.
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
                  weeklySubGoals: { type: Type.ARRAY, items: { type: Type.STRING } }
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

    const text = response.text;
    if (!text) throw new Error("Empty response");
    const result = JSON.parse(text);
    return result;
  } catch (e) {
    console.error("AI Breakdown Error:", e);
    // نظام "الخطة الذكية الاحتياطية" - يتم صياغتها برمجياً بناءً على مدخل المستخدم لضمان عدم الفشل
    return {
      category: "general",
      monthlyGoals: [
        { 
          title: `مرحلة التأسيس لـ ${yearlyGoal}`, 
          description: "وضع القواعد الأساسية والبدء بالخطوات الأولى", 
          weeklySubGoals: ["تحديد الموارد المطلوبة", "تخصيص وقت يومي ثابت"] 
        },
        { 
          title: `مرحلة التطوير المستمر`, 
          description: "بناء العادات اللازمة للنجاح في هذا الهدف", 
          weeklySubGoals: ["تطبيق عملي للمهارات", "قياس النتائج الأسبوعية"] 
        },
        { 
          title: `مرحلة الإتقان والوصول`, 
          description: "تحويل الهدف إلى إنجاز ملموس وحقيقي", 
          weeklySubGoals: ["المراجعة النهائية للإنجاز", "تثبيت النتائج المحققة"] 
        }
      ],
      suggestedDailyTask: `خطوة صغيرة مستمرة نحو ${yearlyGoal}`
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
      contents: `أهدافي هي: [${goalsContext}]. اقترح لي مهمتين يوميتين لليوم. رد بصيغة JSON: { "tasks": [{ "title": "...", "category": "general" }] }`,
      config: { responseMimeType: "application/json" }
    });
    const data = JSON.parse(response.text || "{}");
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
      contents: `كم نقطة تستحق مكافأة: "${rewardTitle}"؟ رد برقم فقط.`,
    });
    return parseInt(response.text?.replace(/[^0-9]/g, '') || "200");
  } catch (e) { return 200; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const summary = expenses.map(e => `${e.description}: ${e.amount}ج`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `حلل هذه المصروفات: [${summary}] بحد ${dailyLimit}ج. أعط نصيحة مالية قصيرة جداً.`,
    });
    return response.text || "حافظ على توازن ميزانيتك!";
  } catch (e) { return "استمر في مراقبة مصروفاتك!"; }
};
