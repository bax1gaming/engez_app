
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
      contents: `صنف هذه المهمة: "${title} - ${description}" إلى فئة واحدة فقط: (religious, physical, academic, general). رد بالكلمة الإنجليزية للفئة فقط بدون أي نص إضافي.`,
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
      contents: `أنت خبير إنتاجية عالمي. قم بتحليل الهدف السنوي التالي بدقة فائقة: "${yearlyGoal}". 
      صمم خطة استراتيجية فريدة تتكون من 3 أهداف شهرية (كل شهر له عنوان ووصف وخطتين أسبوعيتين) بالإضافة إلى مهمة يومية واحدة مستمرة.
      يجب أن تكون جميع العناوين والوصف مرتبطة بشكل مباشر وحصري بالهدف: "${yearlyGoal}".
      رد بصيغة JSON فقط تتبع هذا المخطط:
      {
        "category": "الفئة بالإنجليزية",
        "monthlyGoals": [
          {
            "title": "عنوان الشهر مخصص",
            "description": "وصف المهمة الشهرية",
            "weeklySubGoals": ["مهمة الأسبوع 1", "مهمة الأسبوع 2"]
          }
        ],
        "suggestedDailyTask": "مهمة يومية بسيطة"
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
                  weeklySubGoals: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "description", "weeklySubGoals"]
              },
              minItems: 3
            },
            suggestedDailyTask: { type: Type.STRING }
          },
          required: ["monthlyGoals", "suggestedDailyTask", "category"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    if (!result.monthlyGoals || result.monthlyGoals.length === 0) throw new Error("Invalid structure");
    return result;
  } catch (e) {
    console.error("AI Breakdown Error, providing local fallback:", e);
    // نظام خطة احتياطية فورية لضمان عدم توقف التطبيق
    return {
      category: "general",
      monthlyGoals: [
        { title: `البدء في ${yearlyGoal}`, description: "وضع حجر الأساس والبدء بالخطوات الأولى", weeklySubGoals: ["تحديد المتطلبات الأساسية", "تنظيم الجدول الزمني"] },
        { title: `تطوير مهارات ${yearlyGoal}`, description: "التركيز على الجوانب التقنية والتطبيقية", weeklySubGoals: ["تطبيق عملي مكثف", "مراجعة التقدم وتعديل المسار"] },
        { title: `إتقان ${yearlyGoal}`, description: "الوصول إلى النتائج النهائية المطلوبة", weeklySubGoals: ["إنهاء المهام الكبرى", "تقييم الإنجاز النهائي"] }
      ],
      suggestedDailyTask: `خطوة صغيرة نحو ${yearlyGoal}`
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
      contents: `بناءً على أهدافي السنوية الحالية: [${goalsContext}]، اقترح مهمتين (2) محددتين وذكيتين للقيام بهما اليوم لضمان التقدم المستمر. 
      اجعل المهام جديدة تماماً ومبتكرة.
      رد بصيغة JSON فقط: { "tasks": [{ "title": "مهمة محددة", "category": "الفئة بالإنجليزية" }] }`,
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
      contents: `بصفتك خبير أنظمة تحفيز، كم نقطة (Points) تستحق هذه المكافأة: "${rewardTitle}"؟ (رد برقم فقط بين 50 و 2000 بناءً على قيمة الجائزة).`,
    });
    const cost = parseInt(response.text?.replace(/[^0-9]/g, '') || "200");
    return isNaN(cost) ? 200 : cost;
  } catch (e) { return 250; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const summary = expenses.map(e => `${e.description}: ${e.amount}ج`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `بناءً على قائمة مصروفاتي اليوم: [${summary}] وحد المصروف اليومي (${dailyLimit}ج)، أعطني نصيحة مالية ذكية ومختصرة ومشجعة باللغة العربية.`,
    });
    return response.text || "وفر اليوم لترتاح غداً!";
  } catch (e) { return "حافظ على ميزانيتك لتحقيق أهدافك!"; }
};
