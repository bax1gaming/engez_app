
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
      contents: `صنف هذه المهمة: "${title} - ${description}" إلى واحدة من الفئات التالية فقط: (religious, physical, academic, general). رد بالكلمة الإنجليزية للفئة فقط بدون أي تشكيل أو كلمات إضافية.`,
    });
    const category = response.text?.trim().toLowerCase() as GoalCategory;
    const validCategories: GoalCategory[] = ['religious', 'physical', 'academic', 'general'];
    return validCategories.includes(category) ? category : 'general';
  } catch (e) {
    return 'general';
  }
};

export const generateGoalBreakdown = async (yearlyGoal: string) => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `أنت خبير إنتاجية عالمي. قم بعمل خطة فريدة ومخصصة جداً للهدف التالي: "${yearlyGoal}".
      يجب أن تكون الخطة عملية، واقعية، ومقسمة زمنياً.
      رد بصيغة JSON فقط تتبع هذا المخطط بالضبط:
      {
        "category": "religious" | "physical" | "academic" | "general",
        "monthlyGoals": [
          {
            "title": "عنوان شهر مخصص للهدف",
            "description": "ما سنحققه في هذا الشهر",
            "weeklySubGoals": ["خطوة أسبوع 1", "خطوة أسبوع 2"]
          }
        ],
        "suggestedDailyTask": "مهمة يومية مستمرة وبسيطة"
      }
      ملاحظة: لا تستخدم خططاً عامة، بل اجعل العناوين مرتبطة مباشرة بـ ${yearlyGoal}.`,
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
              },
              minItems: 3,
              maxItems: 3
            },
            suggestedDailyTask: { type: Type.STRING }
          },
          required: ["monthlyGoals", "suggestedDailyTask", "category"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("AI Breakdown failed", e);
    return null;
  }
};

export const generateDailyTasksForProgress = async (yearlyGoals: Goal[]) => {
  try {
    if (yearlyGoals.length === 0) return [];
    const ai = getAi();
    const goalsContext = yearlyGoals.map(g => g.title).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بناءً على أهدافي الكبيرة لهذا العام: [${goalsContext}]، اقترح لي 2 من المهام اليومية المحددة والذكية (Smart Tasks) لأقوم بها اليوم لكي أتقدم في هذه الأهداف.
      رد بصيغة JSON فقط:
      {
        "tasks": [
          { "title": "اسم المهمة", "category": "الفئة بالإنجليزية" }
        ]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING }
                },
                required: ["title", "category"]
              }
            }
          }
        }
      }
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
      contents: `بصفتك خبير تحفيز، ما السعر العادل بالنقاط للمكافأة: "${rewardTitle}"؟ (رقم فقط بين 50 و 2000).`,
    });
    const cost = parseInt(response.text?.replace(/[^0-9]/g, '') || "200");
    return isNaN(cost) ? 200 : cost;
  } catch (e) { return 250; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const expenseSummary = expenses.map(e => `${e.description}: ${e.amount}ج`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `حلل هذه المصروفات: [${expenseSummary}] والحد (${dailyLimit}ج). أعطِ نصيحة مالية ذكية ومختصرة بالعربية.`,
    });
    return response.text || "استمر في مراقبة مصروفاتك!";
  } catch (e) { return "حافظ على توازنك المالي!"; }
};
