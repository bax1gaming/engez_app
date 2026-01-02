
import { GoogleGenAI, Type } from "@google/genai";
import { GoalCategory, Expense, Goal } from "../types.ts";

const getAi = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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
 * يقوم هذا التابع بتحليل الهدف السنوي وتحويله إلى خطة عمل دقيقة.
 * تم تحسينه ليكون "عدائياً" ضد القوالب الجاهزة.
 */
export const generateGoalBreakdown = async (yearlyGoal: string) => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `أنت الآن خبير استراتيجي متخصص جداً في المجال المتعلق بهذا الهدف: "${yearlyGoal}".

المهمة المطلوبة:
توليد خطة عمل "فريدة وحصرية" لهذا الهدف حصراً. لا تستخدم أي جمل عامة تصلح لأي هدف آخر.

القواعد الصارمة:
1. إذا كان الهدف "تعلم CSS"، يجب أن تتحدث المهام عن (Selectors, Flexbox, Grid, Animations, Specificity).
2. إذا كان الهدف "حفظ سورة البقرة"، يجب أن تتحدث المهام عن (أرباع، أثمان، مراجعة المتشابهات، ربط الآيات).
3. يمنع منعاً باتاً استخدام كلمات مثل: "الاستعداد"، "البحث"، "التأسيس"، "البداية"، "الخاتمة"، "المراجعة العامة".
4. يجب أن يكون كل عنوان "وصفاً فنياً" للمرحلة.
5. المهام الأسبوعية يجب أن تكون خطوات تقنية/عملية يمكن تنفيذها فوراً.

رد بصيغة JSON فقط بالتنسيق التالي:
{
  "category": "religious/physical/academic/general",
  "monthlyGoals": [
    {
      "title": "عنوان فني تخصصي جداً للمرحلة الأولى",
      "description": "ما هو الإنجاز النوعي الذي سيتحقق في ${yearlyGoal} خلال هذا الشهر؟",
      "weeklySubGoals": [
        "خطوة تنفيذية رقم 1 شديدة التحديد",
        "خطوة تنفيذية رقم 2 شديدة التحديد"
      ]
    },
    { "title": "...", "description": "...", "weeklySubGoals": ["...", "..."] },
    { "title": "...", "description": "...", "weeklySubGoals": ["...", "..."] }
  ],
  "suggestedDailyTask": "عادة ذرية يومية (Habit) مرتبطة تقنياً بالهدف"
}`,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 15000 } // ميزانية تفكير عالية جداً لضمان عدم التكرار
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("Empty AI Response");

    // تنظيف JSON من أي علامات Markdown قد يضيفها الموديل
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text;
    const result = JSON.parse(jsonStr);

    // التحقق من صحة البيانات
    if (!result.monthlyGoals || result.monthlyGoals.length < 1) {
      throw new Error("Invalid structure returned");
    }

    return result;
  } catch (e) {
    console.error("AI Error:", e);
    // نظام احتياطي ديناميكي يقوم بصياغة المهام بناءً على اسم الهدف لمنع القوالب الثابتة
    const keywords = yearlyGoal.split(' ');
    const mainKey = keywords.length > 1 ? keywords[keywords.length - 1] : yearlyGoal;
    
    return {
      category: "general",
      monthlyGoals: [
        { 
          title: `بناء القاعدة الصلبة لـ ${yearlyGoal}`, 
          description: `التركيز على الأدوات الأساسية والمهارات الأولية الضرورية لنجاح ${yearlyGoal}.`, 
          weeklySubGoals: [`تطبيق عملي على أول فصل في ${mainKey}`, `إعداد بيئة العمل الخاصة بـ ${yearlyGoal}`] 
        },
        { 
          title: `تعميق ممارسة ${yearlyGoal}`, 
          description: `الوصول إلى مستوى متوسط عبر ممارسة ${mainKey} بشكل يومي ومكثف.`, 
          weeklySubGoals: [`إنجاز مشروع صغير يعتمد على ${mainKey}`, `حل 3 مشكلات معقدة في ${yearlyGoal}`] 
        }
      ],
      suggestedDailyTask: `التدرب لمدة 15 دقيقة على ${mainKey}`
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
      contents: `أهدافي الحالية: [${context}]. اقترح لي مهمتين (2) صغيرتين جداً للقيام بهما اليوم لضمان عدم التوقف.
      رد بصيغة JSON: { "tasks": [{ "title": "اسم المهمة", "category": "الفئة" }] }`,
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
      contents: `كم نقطة تستحق هذه المكافأة: "${rewardTitle}"؟ (المدى 50-1500). رد برقم فقط.`,
    });
    return parseInt(response.text?.replace(/[^0-9]/g, '') || "200");
  } catch (e) { return 250; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const history = expenses.slice(0, 5).map(e => `${e.description}: ${e.amount}`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `هذه مصروفاتي اليوم: [${history}]. الحد المسموح: ${dailyLimit}. أعطني نصيحة مالية قوية ومختصرة جداً بالعربية.`,
    });
    return response.text || "وفر اليوم لترتاح غداً!";
  } catch (e) { return "راقب مصروفاتك!"; }
};
