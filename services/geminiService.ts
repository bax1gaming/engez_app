
import { GoogleGenAI, Type } from "@google/genai";
import { GoalCategory } from "../types.ts";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const categorizeGoal = async (title: string, description: string): Promise<GoalCategory> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `صنف هذه المهمة: "${title} - ${description}" إلى واحدة من الفئات التالية فقط: (religious, physical, academic, general). رد بالكلمة الإنجليزية للفئة فقط.`,
  });
  const category = response.text?.trim().toLowerCase() as GoalCategory;
  const validCategories: GoalCategory[] = ['religious', 'physical', 'academic', 'general'];
  return validCategories.includes(category) ? category : 'general';
};

export const generateGoalBreakdown = async (yearlyGoal: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return null;
  }
};

export const generateDailyQuest = async (currentMonthlyGoals: string[]) => {
  const ai = getAi();
  const goalsContext = currentMonthlyGoals.join(", ");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { title: response.text?.trim() || "مهمة جديدة", category: 'general' };
  }
};

export const calculateRewardCost = async (rewardTitle: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `كم يجب أن يكون سعر هذه المكافأة بالنقاط: "${rewardTitle}"؟ رد فقط برقم صحيح بين 50 و 2000.`,
  });

  const costText = response.text?.trim().replace(/[^0-9]/g, '') || "200";
  const cost = parseInt(costText);
  return isNaN(cost) ? 200 : cost;
};
