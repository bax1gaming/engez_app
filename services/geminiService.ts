
import { GoogleGenAI, Type } from "@google/genai";
import { GoalCategory, Expense, Goal } from "../types.ts";

/**
 * Initializes the Gemini API client.
 * We create a new instance inside the functions to ensure the most current API key is used.
 */
const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure it is configured.");
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
 * Generates a hyper-specific breakdown for a given goal.
 * Uses strict prompt engineering to prevent generic 'one-size-fits-all' plans.
 */
export const generateGoalBreakdown = async (yearlyGoal: string) => {
  try {
    const ai = getAi();
    
    const prompt = `أنت الآن خبير استراتيجي ومنظم مناهج تعليمية عالمي. 
المهمة: قم بتحليل هذا الهدف السنوي بدقة متناهية: "${yearlyGoal}".

المطلوب: صمم خطة تنفيذية "تخصصية" و"تقنية" لهذا الهدف حصراً.

شروط صارمة جداً (Strict Constraints):
1. يمنع منعاً باتاً استخدام عبارات عامة مثل: (البحث، الاستعداد، التأسيس، البداية، مراجعة، تقييم، وضع خطة، مرحلة 1، مرحلة 2).
2. يجب أن تكون العناوين "فنية" تصف المادة العلمية أو العملية للهدف مباشرة.
   - إذا كان الهدف "CSS": العناوين يجب أن تكون (Box Model Deep Dive, Layouts with Flexbox & Grid, CSS Specificity & Cascade).
   - إذا كان الهدف "رياضة": العناوين يجب أن تكون (Hypertrophy Cycles, Compound Movements Mastery, Cardio Endurance Phase).
3. المهام الأسبوعية يجب أن تكون "تحديات تنفيذية ملموسة" مرتبطة حصراً بـ "${yearlyGoal}".
4. لا تقدم أبداً نفس الخطة لهدفين مختلفين.

رد بصيغة JSON فقط بالتنسيق التالي:
{
  "category": "الفئة بالإنجليزية",
  "monthlyGoals": [
    {
      "title": "عنوان تخصصي جداً (مثال: إتقان الـ Selectors في CSS)",
      "description": "وصف فني لما سيتم تعلمه في ${yearlyGoal}",
      "weeklySubGoals": [
        "مهمة عملية محددة جداً 1",
        "مهمة عملية محددة جداً 2"
      ]
    },
    { "title": "عنوان تخصصي للمرحلة التالية", "description": "...", "weeklySubGoals": ["...", "..."] },
    { "title": "عنوان تخصصي للمرحلة الأخيرة", "description": "...", "weeklySubGoals": ["...", "..."] }
  ],
  "suggestedDailyTask": "عادة ذرية تقنية مرتبطة بالهدف مباشرة"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 15000 }
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("Empty AI response");

    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
    const result = JSON.parse(jsonStr);

    if (!result.monthlyGoals || result.monthlyGoals.length === 0) {
      throw new Error("Invalid structure returned");
    }

    return { ...result, isSuccess: true };
  } catch (e) {
    console.error("Gemini AI breakdown failed. Triggering Dynamic Fallback Architecture.", e);
    
    // Dynamic Fallback: Instead of fixed steps, we generate a template using the user's keywords.
    const cleanGoal = yearlyGoal.replace(/تعلم|إتقان|دراسة|حفظ/g, "").trim() || yearlyGoal;
    
    return {
      category: "general",
      isSuccess: false,
      monthlyGoals: [
        { 
          title: `بناء القاعدة المعرفية لـ ${cleanGoal}`, 
          description: `التركيز على الأدوات والمبادئ الأساسية الخاصة بـ ${cleanGoal} لضمان انطلاقة صحيحة.`, 
          weeklySubGoals: [
            `تحديد الموارد التعليمية لـ ${cleanGoal} والبدء بالدرس الأول`,
            `تطبيق عملي على أساسيات ${cleanGoal} وإنشاء نموذج أولي`
          ] 
        },
        { 
          title: `التوسع والتمكن في ${cleanGoal}`, 
          description: `الانتقال إلى المهارات المتوسطة والمتقدمة في ${cleanGoal} مع زيادة وتيرة التطبيق.`, 
          weeklySubGoals: [
            `حل 3 تحديات برمجية أو عملية في ${cleanGoal}`,
            `بناء مشروع متكامل يعتمد على مهارات ${cleanGoal} التي اكتسبتها`
          ] 
        }
      ],
      suggestedDailyTask: `تخصيص 20 دقيقة للتدريب المكثف على ${cleanGoal}`
    };
  }
};

export const generateDailyTasksForProgress = async (yearlyGoals: Goal[]) => {
  try {
    if (yearlyGoals.length === 0) return [];
    const ai = getAi();
    const context = yearlyGoals.map(g => g.title).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `أهدافي الحالية هي: [${context}]. بناءً على هذه الأهداف، اقترح لي مهمتين (2) صغيرتين جداً يمكن إنجازهما في أقل من 15 دقيقة اليوم لضمان استمرار الزخم.
      رد بصيغة JSON: { "tasks": [{ "title": "مهمة سريعة", "category": "الفئة" }] }`,
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
      contents: `بناءً على الجهد المبذول، كم نقطة تستحق هذه المكافأة: "${rewardTitle}"؟ (بين 50 و 1500). رد بالرقم فقط.`,
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
      contents: `حلل مصروفاتي اليوم: [${summary}] مقارنة بحد يومي ${dailyLimit}. أعطني نصيحة مالية ذكية ومختصرة بالعربية.`,
    });
    return response.text || "حافظ على توازن ميزانيتك!";
  } catch (e) { return "راقب مصروفاتك بحذر."; }
};
