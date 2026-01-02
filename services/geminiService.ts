
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
      contents: `صنف هذه المهمة: "${title} - ${description}" إلى فئة واحدة: (religious, physical, academic, general). رد بالكلمة فقط بالإنجليزية.`,
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `أنت خبير إنتاجية. حلل الهدف السنوي: "${yearlyGoal}". 
      قسمه إلى 3 أهداف شهرية فريدة ومرتبطة به تماماً. 
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("AI Breakdown Error:", e);
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
      contents: `بناءً على أهدافي: [${goalsContext}]، اقترح مهمتين مختلفتين وجديدتين تماماً لهذا اليوم فقط. 
      رد بصيغة JSON: { "tasks": [{ "title": "مهمة", "category": "general" }] }`,
      config: {
        responseMimeType: "application/json"
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
      contents: `كم نقطة تستحق مكافأة: "${rewardTitle}"؟ (رقم فقط من 50 إلى 2000).`,
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
      contents: `حلل المصروفات: [${summary}] بحد يومي ${dailyLimit}ج. أعط نصيحة مالية قصيرة جداً بالعربية.`,
    });
    return response.text || "وفر أكثر لتربح أكثر!";
  } catch (e) { return "حافظ على ميزانيتك!"; }
};
