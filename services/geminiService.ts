
import { GoogleGenAI, Type } from "@google/genai";
import { GoalCategory, Expense } from "../types.ts";

// Helper to ensure we always get a fresh instance with the latest key
const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is not defined in process.env");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

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
    return 250;
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
    // Using Pro for complex reasoning tasks to ensure JSON reliability on Vercel
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `أنت خبير إنتاجية. حلل هذا الهدف السنوي: "${yearlyGoal}".
      قسمه إلى 3 أهداف شهرية، ولكل شهر هدفين أسبوعيين، واقترح مهمة يومية.
      رد بصيغة JSON فقط تتبع هذا المخطط:
      {
        "category": "religious" | "physical" | "academic" | "general",
        "monthlyGoals": [
          {
            "title": "عنوان الشهر",
            "description": "وصف قصير",
            "weeklySubGoals": ["هدف 1", "هدف 2"]
          }
        ],
        "suggestedDailyTask": "مهمة يومية"
      }`,
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
    
    const text = response.text;
    if (!text) throw new Error("Empty AI response");
    return JSON.parse(text);
  } catch (e) {
    console.error("AI Breakdown failed, triggering fallback", e);
    // Return a structured fallback to prevent UI crash
    return {
      category: "general",
      monthlyGoals: [
        { title: "بداية الخطة", description: "البدء في تنفيذ الخطوات الأولى", weeklySubGoals: ["تحديد المتطلبات", "وضع جدول زمني"] },
        { title: "مرحلة التركيز", description: "تكثيف العمل على الهدف", weeklySubGoals: ["المداومة اليومية", "تقييم الأداء"] },
        { title: "الاستمرارية", description: "الحفاظ على المكتسبات", weeklySubGoals: ["مراجعة نهائية", "الاحتفال بالإنجاز"] }
      ],
      suggestedDailyTask: "القيام بخطوة صغيرة اليوم"
    };
  }
};
