
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
      contents: `أنت مساعد ذكي. صنف الهدف التالي: "${title}" إلى واحدة من هذه الفئات حصراً: (religious, physical, academic, general). رد بالكلمة الإنجليزية فقط.`,
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
      model: 'gemini-3-pro-preview',
      contents: `أنت خبير إنتاجية متخصص في التخطيط الاستراتيجي. 
      المطلوب: تحليل الهدف السنوي التالي: "${yearlyGoal}" وتقديم خطة عمل مخصصة بالكامل.

      شروط حاسمة:
      1. يمنع منعاً باتاً استخدام عبارات عامة مثل "البحث"، "الاستعداد"، "التنفيذ"، "مراجعة النتائج".
      2. يجب أن تكون جميع العناوين والمهام "مرتبطة تقنياً وعملياً" بطبيعة الهدف "${yearlyGoal}".
      3. إذا كان الهدف "تعلم برمجة"، يجب أن تتحدث المهام عن لغات برمجة، بيئات تطوير، مشاريع برمجية.
      4. إذا كان الهدف "حفظ قرآن"، يجب أن تتحدث المهام عن أجزاء، سور، مراجعة، تجويد.
      5. قدم 3 مراحل شهرية، وكل مرحلة لها مهمتان أسبوعيتان "ملموستان جداً".

      رد بصيغة JSON فقط بالتنسيق التالي:
      {
        "category": "religious/physical/academic/general",
        "monthlyGoals": [
          {
            "title": "عنوان فريد ومخصص جداً للمرحلة",
            "description": "وصف دقيق لما سيتم فعله بخصوص ${yearlyGoal}",
            "weeklySubGoals": [
              "مهمة أسبوعية رقم 1 مخصصة وعملية",
              "مهمة أسبوعية رقم 2 مخصصة وعملية"
            ]
          }
        ],
        "suggestedDailyTask": "مهمة يومية متناهية الصغر (Atomic Habit) تدعم الهدف مباشرة"
      }`,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 12000 }
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("استجابة فارغة");

    // تنظيف JSON بشكل احترافي للتعامل مع أي زوائد من الموديل
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;
    
    const parsed = JSON.parse(cleanJson);
    
    // التحقق من أن الموديل لم يعطنا نتائج عامة (بفحص الكلمات الشائعة في القوالب الثابتة)
    const genericWords = ["مرحلة 1", "الاستعداد", "البحث", "استكشاف"];
    const isGeneric = parsed.monthlyGoals?.some((m: any) => 
      genericWords.some(word => m.title.includes(word))
    );

    if (isGeneric && !yearlyGoal.includes("بحث")) {
      console.warn("AI returned potentially generic content, but returning it anyway as fallback might be worse.");
    }

    return parsed;
  } catch (e) {
    console.error("خطأ في التحليل الذكي، جاري المحاكاة الديناميكية بناءً على المدخلات:", e);
    // نظام احتياطي "ذكي" يدمج كلمات المستخدم لضمان الخصوصية حتى في حال الفشل
    return {
      category: "general",
      monthlyGoals: [
        { 
          title: `إتقان أساسيات ${yearlyGoal}`, 
          description: `التركيز على بناء حجر الأساس في ${yearlyGoal} وتوفير المتطلبات التقنية والبدنية والذهنية اللازمة للبدء.`, 
          weeklySubGoals: [`إعداد جدول زمني خاص بـ ${yearlyGoal}`, `تحديد أول خطوة عملية في ${yearlyGoal} وتنفيذها`] 
        },
        { 
          title: `التوسع في ممارسة ${yearlyGoal}`, 
          description: `الانتقال إلى مرحلة التطبيق المتقدم لـ ${yearlyGoal} وقياس النتائج الملموسة.`, 
          weeklySubGoals: [`تجاوز أول عقبة حقيقية في ${yearlyGoal}`, `تحقيق إنجاز بنسبة 40% في ${yearlyGoal}`] 
        }
      ],
      suggestedDailyTask: `تخصيص 20 دقيقة للتركيز الكامل على ${yearlyGoal}`
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
      contents: `بناءً على الأهداف السنوية الحالية: [${goalsContext}]، ما هما المهمتان الأكثر أهمية لإنجازهما اليوم لضمان التقدم؟
      رد بـ JSON: { "tasks": [{ "title": "مهمة محددة جداً", "category": "الفئة" }] }`,
      config: { responseMimeType: "application/json" }
    });
    const text = response.text?.trim() || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;
    const data = JSON.parse(cleanJson);
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
      contents: `قيم تكلفة المكافأة التالية بالنقاط (بين 50 و 1500): "${rewardTitle}". رد برقم فقط.`,
    });
    return parseInt(response.text?.replace(/[^0-9]/g, '') || "150");
  } catch (e) { return 200; }
};

export const analyzeBudget = async (expenses: Expense[], dailyLimit: number): Promise<string> => {
  try {
    const ai = getAi();
    const summary = expenses.map(e => `${e.description}: ${e.amount}ج`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `حلل المصروفات: [${summary}] بحد يومي ${dailyLimit}ج. أعط نصيحة مالية ذكية ومختصرة جداً بالعربية.`,
    });
    return response.text || "وفر اليوم لتربح غداً!";
  } catch (e) { return "حافظ على ميزانيتك!"; }
};
