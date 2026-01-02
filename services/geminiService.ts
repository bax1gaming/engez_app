
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
    // استخدام Gemini 3 Pro للمهام المعقدة مثل التخطيط الاستراتيجي
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `أنت خبير في التخطيط الاستراتيجي والتعلم الذاتي. 
      المطلوب: إنشاء "مسار تعلم" (Learning Path) احترافي للهدف السنوي: "${yearlyGoal}".
      
      يجب أن تتضمن الخطة:
      1. تقسيم الهدف إلى 3 مراحل شهرية متتابعة (بداية، تطوير، إتقان).
      2. لكل شهر، حدد مهمتين أسبوعيتين دقيقتين.
      3. حدد "عادة يومية" (Daily Habit) بسيطة جداً تضمن التقدم المستمر في هذا الهدف.
      
      يجب أن تكون المصطلحات المستخدمة في العناوين والوصف مرتبطة بعمق بمجال ${yearlyGoal}.
      
      رد بصيغة JSON فقط بهذا الهيكل:
      {
        "category": "academic" | "religious" | "physical" | "general",
        "learningPath": [
          {
            "monthTitle": "عنوان المرحلة الشهرية",
            "monthDescription": "وصف ما سيتم تحقيقه",
            "weeklySteps": ["خطوة الأسبوع 1", "خطوة الأسبوع 2"]
          }
        ],
        "persistentDailyTask": "المهمة اليومية المستمرة"
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            learningPath: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  monthTitle: { type: Type.STRING },
                  monthDescription: { type: Type.STRING },
                  weeklySteps: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["monthTitle", "monthDescription", "weeklySteps"]
              },
              minItems: 3
            },
            persistentDailyTask: { type: Type.STRING }
          },
          required: ["learningPath", "persistentDailyTask", "category"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (e) {
    console.error("Gemini 3 Pro Breakdown Error:", e);
    // نظام خطة احتياطية ذكي في حال فشل الـ API
    return {
      category: "general",
      learningPath: [
        { monthTitle: `مرحلة التأسيس في ${yearlyGoal}`, monthDescription: "بناء القواعد الأساسية وفهم الأدوات", weeklySteps: ["البحث عن أفضل المصادر", "وضع جدول تعلم ثابت"] },
        { monthTitle: `مرحلة التطبيق العملي`, monthDescription: "تطبيق ما تم تعلمه في مشاريع صغيرة", weeklySteps: ["إنجاز أول مشروع مصغر", "مراجعة الأخطاء وتصحيحها"] },
        { monthTitle: `مرحلة التوسع والإتقان`, monthDescription: "الوصول لمستوى متقدم ومشاركة المعرفة", weeklySteps: ["إنجاز مشروع نهائي متكامل", "تقييم مستوى الإتقان"] }
      ],
      persistentDailyTask: `30 دقيقة من التركيز على ${yearlyGoal}`
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
      contents: `بناءً على أهدافي الكبرى: [${goalsContext}]، اقترح مهمتين (2) محددتين وذكيتين لهذا اليوم. 
      اجعلها مهام تنفيذية بسيطة (Actionable).
      رد بصيغة JSON: { "tasks": [{ "title": "المهمة", "category": "الفئة" }] }`,
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
      contents: `بناءً على قيمة المكافأة: "${rewardTitle}"، كم نقطة تستحق؟ (رقم فقط من 50-2000).`,
    });
    return parseInt(response.text?.replace(/[^0-9]/g, '') || "200");
  } catch (e) { return 200; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const summary = expenses.map(e => `${e.description}: ${e.amount}`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `حلل هذه المصروفات: [${summary}] والحد اليومي (${dailyLimit}). قدم نصيحة مالية بالعربية.`,
    });
    return response.text || "حافظ على توازن ميزانيتك!";
  } catch (e) { return "استمر في مراقبة مصروفاتك!"; }
};
