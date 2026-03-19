import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OpenAIHelper } from './openai-helper.service';

// ---------------------------------------------------------------------------
// Function definitions exposed to OpenAI
// ---------------------------------------------------------------------------

const NUTRITION_FUNCTIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'calculate_nutrition',
      description: 'Calculates total nutritional information for a list of ingredients with quantities. Returns calories (kcal), protein (g), carbs (g), fats (g).',
      parameters: {
        type: 'object',
        properties: {
          ingredients: {
            type: 'array',
            description: 'List of ingredients with quantities',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Ingredient name' },
                quantity: { type: 'number', description: 'Amount in grams or ml' },
                unit: { type: 'string', enum: ['gram', 'ml'], description: 'Unit of measurement' },
              },
              required: ['name', 'quantity', 'unit'],
            },
          },
          servings: { type: 'number', description: 'Number of servings the total quantity makes' },
        },
        required: ['ingredients', 'servings'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_daily_totals',
      description: 'Calculates total daily nutritional intake from multiple meals. Returns combined calories, protein, carbs, fats and comparison to targets.',
      parameters: {
        type: 'object',
        properties: {
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                mealType: { type: 'string' },
                calories: { type: 'number' },
                protein: { type: 'number' },
                carbs: { type: 'number' },
                fats: { type: 'number' },
              },
              required: ['mealType', 'calories', 'protein', 'carbs', 'fats'],
            },
          },
          targets: {
            type: 'object',
            properties: {
              calories: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fats: { type: 'number' },
            },
          },
        },
        required: ['meals'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_recipe_portions',
      description: 'Recalculates ingredient quantities and nutrition when serving size changes.',
      parameters: {
        type: 'object',
        properties: {
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
              },
              required: ['name', 'quantity', 'unit'],
            },
          },
          originalServings: { type: 'number' },
          newServings: { type: 'number' },
        },
        required: ['ingredients', 'originalServings', 'newServings'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface DailyTotals extends NutritionInfo {
  meals: { mealType: string; calories: number; protein: number; carbs: number; fats: number }[];
  targets?: NutritionInfo;
  deficit?: NutritionInfo;
}

export interface DailyLog {
  date: string;
  totals: NutritionInfo;
  meals: { mealType: string; calories: number; protein: number; carbs: number; fats: number; recipeId?: string }[];
}

@Injectable()
export class NutritionService {
  private readonly logger = new Logger(NutritionService.name);

  constructor(
    private prisma: PrismaService,
    private openai: OpenAIHelper,
  ) {}

  // ────────── Function execution (called when AI requests a function) ──────────

  async executeFunction(name: string, args: any): Promise<any> {
    if (!args || typeof args !== 'object') {
      throw new Error(`Function "${name}": arguments must be an object, got ${typeof args}`);
    }
    switch (name) {
      case 'calculate_nutrition': {
        if (!Array.isArray(args.ingredients) || args.ingredients.length === 0) {
          throw new Error('calculate_nutrition: "ingredients" must be a non-empty array');
        }
        const servings = Number(args.servings);
        if (!isFinite(servings) || servings <= 0) {
          throw new Error(`calculate_nutrition: "servings" must be a positive number (got ${args.servings})`);
        }
        const validIngredients = args.ingredients.map((ing: any, i: number) => {
          if (!ing || typeof ing.name !== 'string' || !ing.name.trim()) {
            throw new Error(`calculate_nutrition: ingredient[${i}].name is missing or invalid`);
          }
          const qty = Number(ing.quantity);
          if (!isFinite(qty) || qty < 0) {
            throw new Error(`calculate_nutrition: ingredient[${i}].quantity is invalid (got ${ing.quantity})`);
          }
          return { name: ing.name.trim(), quantity: qty, unit: String(ing.unit || 'gram') };
        });
        return this.fnCalculateNutrition(validIngredients, servings);
      }
      case 'calculate_daily_totals': {
        if (!Array.isArray(args.meals)) {
          throw new Error('calculate_daily_totals: "meals" must be an array');
        }
        const validMeals = args.meals.map((m: any) => ({
          mealType: String(m?.mealType || 'other'),
          calories: isFinite(Number(m?.calories)) ? Number(m.calories) : 0,
          protein: isFinite(Number(m?.protein)) ? Number(m.protein) : 0,
          carbs: isFinite(Number(m?.carbs)) ? Number(m.carbs) : 0,
          fats: isFinite(Number(m?.fats)) ? Number(m.fats) : 0,
        }));
        const targets =
          args.targets && typeof args.targets === 'object'
            ? {
                calories: isFinite(Number(args.targets.calories)) ? Number(args.targets.calories) : 0,
                protein: isFinite(Number(args.targets.protein)) ? Number(args.targets.protein) : 0,
                carbs: isFinite(Number(args.targets.carbs)) ? Number(args.targets.carbs) : 0,
                fats: isFinite(Number(args.targets.fats)) ? Number(args.targets.fats) : 0,
              }
            : undefined;
        return this.fnCalculateDailyTotals(validMeals, targets);
      }
      case 'adjust_recipe_portions': {
        if (!Array.isArray(args.ingredients) || args.ingredients.length === 0) {
          throw new Error('adjust_recipe_portions: "ingredients" must be a non-empty array');
        }
        const originalServings = Number(args.originalServings);
        const newServings = Number(args.newServings);
        if (!isFinite(originalServings) || originalServings <= 0) {
          throw new Error(`adjust_recipe_portions: "originalServings" must be a positive number (got ${args.originalServings})`);
        }
        if (!isFinite(newServings) || newServings <= 0) {
          throw new Error(`adjust_recipe_portions: "newServings" must be a positive number (got ${args.newServings})`);
        }
        return this.fnAdjustPortions(args.ingredients, originalServings, newServings);
      }
      default:
        throw new Error(`Unknown function: "${name}"`);
    }
  }

  // ────────── Core function implementations ──────────

  /** calculate_nutrition: look up ingredients in DB and sum nutritional values */
  async fnCalculateNutrition(
    ingredients: { name: string; quantity: number; unit: string }[],
    servings: number,
  ): Promise<NutritionInfo & { perServing: NutritionInfo; details: any[] }> {
    const details: any[] = [];
    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFats = 0;

    for (const ing of ingredients) {
      const dbIng = await this.prisma.ingredient.findFirst({
        where: { label: { equals: ing.name.toLowerCase(), mode: 'insensitive' } },
      });

      let cal: number, prot: number, carb: number, fat: number;
      if (dbIng && dbIng.quantity > 0) {
        const factor = ing.quantity / dbIng.quantity;
        cal = dbIng.calories * factor;
        prot = dbIng.protein * factor;
        carb = dbIng.carbs * factor;
        fat = dbIng.fats * factor;
      } else {
        // Fallback: estimate ~1 kcal/g average (very rough)
        cal = ing.quantity * 1;
        prot = 0;
        carb = 0;
        fat = 0;
      }

      details.push({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        calories: Math.round(cal * 10) / 10,
        protein: Math.round(prot * 10) / 10,
        carbs: Math.round(carb * 10) / 10,
        fats: Math.round(fat * 10) / 10,
        fromDatabase: !!dbIng,
      });

      totalCal += cal;
      totalProt += prot;
      totalCarbs += carb;
      totalFats += fat;
    }

    const perServing = {
      calories: Math.round((totalCal / servings) * 10) / 10,
      protein: Math.round((totalProt / servings) * 10) / 10,
      carbs: Math.round((totalCarbs / servings) * 10) / 10,
      fats: Math.round((totalFats / servings) * 10) / 10,
    };

    return {
      calories: Math.round(totalCal * 10) / 10,
      protein: Math.round(totalProt * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fats: Math.round(totalFats * 10) / 10,
      perServing,
      details,
    };
  }

  /** calculate_daily_totals: sum meals and compare to targets */
  fnCalculateDailyTotals(
    meals: { mealType: string; calories: number; protein: number; carbs: number; fats: number }[],
    targets?: { calories?: number; protein?: number; carbs?: number; fats?: number },
  ): DailyTotals {
    const totals: NutritionInfo = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    for (const m of meals) {
      totals.calories += m.calories;
      totals.protein += m.protein;
      totals.carbs += m.carbs;
      totals.fats += m.fats;
    }

    const result: DailyTotals = { ...totals, meals };

    if (targets) {
      result.targets = {
        calories: targets.calories ?? 0,
        protein: targets.protein ?? 0,
        carbs: targets.carbs ?? 0,
        fats: targets.fats ?? 0,
      };
      result.deficit = {
        calories: (targets.calories ?? 0) - totals.calories,
        protein: (targets.protein ?? 0) - totals.protein,
        carbs: (targets.carbs ?? 0) - totals.carbs,
        fats: (targets.fats ?? 0) - totals.fats,
      };
    }

    return result;
  }

  /** adjust_recipe_portions */
  fnAdjustPortions(
    ingredients: { name: string; quantity: number; unit: string }[],
    originalServings: number,
    newServings: number,
  ) {
    const factor = newServings / originalServings;
    return {
      originalServings,
      newServings,
      factor,
      ingredients: ingredients.map((i) => ({
        ...i,
        quantity: Math.round(i.quantity * factor * 10) / 10,
      })),
    };
  }

  /**
   * Uses OpenAI function calling with the `adjust_recipe_portions` tool so
   * the AI model participates in the recalculation. Falls back to direct math
   * if the model unexpectedly skips the function call.
   */
  async adjustPortionsViaAI(
    ingredients: { name: string; quantity: number; unit: string }[],
    originalServings: number,
    newServings: number,
  ): Promise<{ originalServings: number; newServings: number; factor: number; ingredients: { name: string; quantity: number; unit: string }[] }> {
    const messages: any[] = [
      {
        role: 'system',
        content: 'You are a recipe assistant. Use the adjust_recipe_portions function to scale ingredient quantities for the new serving count.',
      },
      {
        role: 'user',
        content:
          `Adjust the following recipe from ${originalServings} serving(s) to ${newServings} serving(s):\n` +
          ingredients.map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`).join('\n'),
      },
    ];

    // temperature=0 / top_p=1.0 (default): forced function call must be 100%
    // deterministic — we need exact scaled quantities, not creative variation.
    const data = await this.openai.chat(messages, {
      tools: NUTRITION_FUNCTIONS,
      toolChoice: { type: 'function', function: { name: 'adjust_recipe_portions' } },
      temperature: 0,
    });

    const msg = data.choices?.[0]?.message;
    if (msg?.tool_calls?.length) {
      const tc = msg.tool_calls[0];
      const fnArgs = JSON.parse(tc.function.arguments);
      return this.executeFunction(tc.function.name, fnArgs);
    }

    // Fallback: direct math (should not normally be reached)
    return this.fnAdjustPortions(ingredients, originalServings, newServings);
  }

  // ────────── AI-driven nutritional analysis with function calling ──────────

  async analyzeNutrition(
    ingredients: { name: string; quantity: number; unit: string }[],
    servings: number,
    userContext?: string,
  ): Promise<{ nutrition: NutritionInfo; analysis: string }> {
    // temperature=0.3 / top_p=0.8: function-calling task requires high
    // determinism — we want consistent nutritional values, not creative variation.
    // Few-shot assistant turn demonstrates how to invoke calculate_nutrition.
    const messages: { role: string; content: string }[] = [
      {
        role: 'system',
        content: 'You are a nutritionist. Analyze meals and provide nutritional information. Use the calculate_nutrition function to get accurate nutritional data. After receiving the data, provide a brief analysis.',
      },
      // Few-shot: user asks → assistant immediately calls the function
      {
        role: 'user',
        content: 'Calculate the nutritional information for this recipe (2 servings):\n- chicken breast: 300 gram\n- olive oil: 15 ml\n- broccoli: 200 gram',
      },
      {
        role: 'assistant',
        content: null as any,
        tool_calls: [
          {
            id: 'call_example_001',
            type: 'function',
            function: {
              name: 'calculate_nutrition',
              arguments: JSON.stringify({
                ingredients: [
                  { name: 'chicken breast', quantity: 300, unit: 'gram' },
                  { name: 'olive oil', quantity: 15, unit: 'ml' },
                  { name: 'broccoli', quantity: 200, unit: 'gram' },
                ],
                servings: 2,
              }),
            },
          },
        ],
      } as any,
      {
        role: 'tool' as any,
        tool_call_id: 'call_example_001',
        content: JSON.stringify({ calories: 420, protein: 62, carbs: 14, fats: 14, perServing: { calories: 210, protein: 31, carbs: 7, fats: 7 } }),
      } as any,
      {
        role: 'assistant',
        content: 'This high-protein meal provides 210 kcal per serving with an excellent protein-to-fat ratio. The broccoli adds fibre and micronutrients while keeping carbs low.',
      },
      // Actual user request
      {
        role: 'user',
        content: `Calculate the nutritional information for this recipe (${servings} servings):\n${ingredients.map((i) => `- ${i.name}: ${i.quantity}${i.unit}`).join('\n')}${userContext ? `\n\nUser context: ${userContext}` : ''}`,
      },
    ];

    // First call — AI should request function calling
    let data = await this.openai.chat(messages, { tools: NUTRITION_FUNCTIONS, temperature: 0.3, topP: 0.8 });
    let msg = data.choices[0].message;

    // Process function calls (may require multiple rounds)
    let nutrition: NutritionInfo | null = null;
    const maxRounds = 5;
    for (let round = 0; round < maxRounds && msg.tool_calls?.length; round++) {
      messages.push(msg);

      for (const tc of msg.tool_calls) {
        let fnArgs: any;
        try {
          fnArgs = JSON.parse(tc.function.arguments);
        } catch {
          messages.push({ role: 'tool' as any, content: JSON.stringify({ error: 'Invalid JSON arguments' }) } as any);
          continue;
        }

        try {
          const result = await this.executeFunction(tc.function.name, fnArgs);
          if (tc.function.name === 'calculate_nutrition') {
            nutrition = { calories: result.calories, protein: result.protein, carbs: result.carbs, fats: result.fats };
          }
          const toolMsg: any = { role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id };
          messages.push(toolMsg);
        } catch (err: any) {
          const toolMsg: any = { role: 'tool', content: JSON.stringify({ error: err.message }), tool_call_id: tc.id };
          messages.push(toolMsg);
        }
      }

      data = await this.openai.chat(messages, { tools: NUTRITION_FUNCTIONS, temperature: 0.3, topP: 0.8 });
      msg = data.choices[0].message;
    }

    // If AI didn't call the function, compute directly
    if (!nutrition) {
      const computed = await this.fnCalculateNutrition(ingredients, servings);
      nutrition = { calories: computed.calories, protein: computed.protein, carbs: computed.carbs, fats: computed.fats };
    }

    return {
      nutrition,
      analysis: msg.content || 'Nutritional calculation complete.',
    };
  }

  // ────────── AI analysis for daily/weekly tracking ──────────

  async analyzeDailyIntake(
    userId: string,
    date: string,
    targets?: NutritionInfo,
  ): Promise<{ totals: DailyTotals; analysis: string }> {
    const startOfDay = new Date(date + 'T00:00:00Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const logs = await this.prisma.nutritionalLog.findMany({
      where: { userId, date: { gte: startOfDay, lte: endOfDay } },
      orderBy: { date: 'asc' },
    });

    const meals = logs.map((l) => ({
      mealType: l.mealType || 'other',
      calories: l.calories,
      protein: l.protein,
      carbs: l.carbs,
      fats: l.fats,
    }));

    // temperature=0.4 / top_p=0.85: slightly more creative than pure lookup —
    // allows varied feedback phrasing while staying tight for JSON output.
    // Few-shot shows a two-meal log → calculate_daily_totals call sequence.
    const messages: any[] = [
      {
        role: 'system',
        content: 'You are a nutritionist. Use the calculate_daily_totals function to compute the daily intake, then provide brief personalized feedback.',
      },
      // Few-shot example
      {
        role: 'user',
        content: 'Calculate daily nutritional totals for 2024-01-15:\nMeals: [{"mealType":"breakfast","calories":380,"protein":14,"carbs":58,"fats":9},{"mealType":"lunch","calories":520,"protein":42,"carbs":22,"fats":28}]\nTargets: {"calories":2000,"protein":150,"carbs":200,"fats":65}',
      },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_example_daily_001',
            type: 'function',
            function: {
              name: 'calculate_daily_totals',
              arguments: JSON.stringify({
                meals: [
                  { mealType: 'breakfast', calories: 380, protein: 14, carbs: 58, fats: 9 },
                  { mealType: 'lunch',     calories: 520, protein: 42, carbs: 22, fats: 28 },
                ],
                targets: { calories: 2000, protein: 150, carbs: 200, fats: 65 },
              }),
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_example_daily_001',
        content: JSON.stringify({ calories: 900, protein: 56, carbs: 80, fats: 37, deficit: { calories: 1100 } }),
      },
      {
        role: 'assistant',
        content: 'You have consumed 900 kcal so far, leaving a 1100 kcal deficit. Protein is on track; aim for another 60–70 g at dinner to hit your daily goal.',
      },
      // Actual request
      {
        role: 'user',
        content: `Calculate daily nutritional totals for ${date}:\nMeals: ${JSON.stringify(meals)}\n${targets ? `Targets: ${JSON.stringify(targets)}` : ''}`,
      },
    ];

    let data = await this.openai.chat(messages, { tools: NUTRITION_FUNCTIONS, temperature: 0.4, topP: 0.85 });
    let msg = data.choices[0].message;

    let totals: DailyTotals | null = null;
    const maxRounds = 5;
    for (let round = 0; round < maxRounds && msg.tool_calls?.length; round++) {
      messages.push(msg);

      for (const tc of msg.tool_calls) {
        let fnArgs: any;
        try {
          fnArgs = JSON.parse(tc.function.arguments);
        } catch {
          const toolMsg: any = { role: 'tool', content: JSON.stringify({ error: 'Invalid arguments' }), tool_call_id: tc.id };
          messages.push(toolMsg);
          continue;
        }

        try {
          const result = await this.executeFunction(tc.function.name, fnArgs);
          if (tc.function.name === 'calculate_daily_totals') totals = result;
          const toolMsg: any = { role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id };
          messages.push(toolMsg);
        } catch (err: any) {
          const toolMsg: any = { role: 'tool', content: JSON.stringify({ error: err.message }), tool_call_id: tc.id };
          messages.push(toolMsg);
        }
      }

      data = await this.openai.chat(messages, { tools: NUTRITION_FUNCTIONS, temperature: 0.4, topP: 0.85 });
      msg = data.choices[0].message;
    }

    if (!totals) {
      totals = this.fnCalculateDailyTotals(meals, targets);
    }

    return {
      totals,
      analysis: msg.content || 'Daily totals calculated.',
    };
  }

  // ────────── Weekly analysis ──────────

  async analyzeWeeklyIntake(
    userId: string,
    startDate: string,
    calorieTarget?: number,
  ): Promise<{ days: (DailyLog & { balance: number })[]; weeklyAvg: NutritionInfo; analysis: string; calorieTarget: number }> {
    const target = calorieTarget || (await this.getUserCalorieTarget(userId));
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const days = await this.groupLogsByDay(userId, start, end);
    const daysWithBalance = days.map((d) => ({ ...d, balance: Math.round(d.totals.calories - target) }));

    const dayCount = days.length || 1;
    const weeklyAvg: NutritionInfo = {
      calories: days.reduce((s, d) => s + d.totals.calories, 0) / dayCount,
      protein: days.reduce((s, d) => s + d.totals.protein, 0) / dayCount,
      carbs: days.reduce((s, d) => s + d.totals.carbs, 0) / dayCount,
      fats: days.reduce((s, d) => s + d.totals.fats, 0) / dayCount,
    };

    let analysis = '';
    try {
      // temperature=0.5 / top_p=0.85: balanced for conversational summary
      // prose — varied but still factual and grounded.
      analysis = await this.openai.chatText(
        `Weekly nutrition summary: ${JSON.stringify({ weeklyAvg, calorieTarget: target, daysLogged: days.length })}. Provide 2-3 bullet points of feedback on caloric balance.`,
        'You are a nutritionist. Be concise.',
        0.5,
        0.85,
      );
    } catch {
      analysis = 'Weekly analysis unavailable.';
    }

    return { days: daysWithBalance, weeklyAvg, analysis, calorieTarget: target };
  }

  // ────────── Monthly analysis ──────────

  async analyzeMonthlyIntake(
    userId: string,
    startDate: string,
    calorieTarget?: number,
  ): Promise<{ days: (DailyLog & { balance: number })[]; monthlyAvg: NutritionInfo; analysis: string; calorieTarget: number }> {
    const target = calorieTarget || (await this.getUserCalorieTarget(userId));
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    const days = await this.groupLogsByDay(userId, start, end);
    const daysWithBalance = days.map((d) => ({ ...d, balance: Math.round(d.totals.calories - target) }));

    const dayCount = days.length || 1;
    const monthlyAvg: NutritionInfo = {
      calories: days.reduce((s, d) => s + d.totals.calories, 0) / dayCount,
      protein: days.reduce((s, d) => s + d.totals.protein, 0) / dayCount,
      carbs: days.reduce((s, d) => s + d.totals.carbs, 0) / dayCount,
      fats: days.reduce((s, d) => s + d.totals.fats, 0) / dayCount,
    };

    let analysis = '';
    try {
      // temperature=0.5 / top_p=0.85: same rationale as weekly analysis —
      // readable narrative with consistent tonality.
      analysis = await this.openai.chatText(
        `Monthly nutrition summary: ${JSON.stringify({ monthlyAvg, calorieTarget: target, daysLogged: days.length })}. Provide 3-4 bullet points of feedback on trends and caloric balance.`,
        'You are a nutritionist. Be concise.',
        0.5,
        0.85,
      );
    } catch {
      analysis = 'Monthly analysis unavailable.';
    }

    return { days: daysWithBalance, monthlyAvg, analysis, calorieTarget: target };
  }

  // ────────── Shared helpers ──────────

  /** Group nutritional logs by calendar day for a given user and date range. */
  private async groupLogsByDay(userId: string, start: Date, end: Date): Promise<DailyLog[]> {
    const logs = await this.prisma.nutritionalLog.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    const dayMap = new Map<string, DailyLog>();
    for (const log of logs) {
      const dateStr = log.date.toISOString().split('T')[0];
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { date: dateStr, totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }, meals: [] });
      }
      const day = dayMap.get(dateStr)!;
      day.meals.push({
        mealType: log.mealType || 'other',
        calories: log.calories,
        protein: log.protein,
        carbs: log.carbs,
        fats: log.fats,
        recipeId: log.recipeId ?? undefined,
      });
      day.totals.calories += log.calories;
      day.totals.protein += log.protein;
      day.totals.carbs += log.carbs;
      day.totals.fats += log.fats;
    }
    return [...dayMap.values()];
  }

  /**
   * Estimate daily calorie target from the user's health profile using the
   * Harris-Benedict equation + activity multiplier + goal adjustment.
   */
  private async getUserCalorieTarget(userId: string): Promise<number> {
    const profile = await this.prisma.healthProfile.findUnique({ where: { userId } });
    if (!profile) return 2000;

    const w = profile.currentWeightKg || 70;
    const h = profile.heightCm || 170;
    const a = profile.age || 30;

    const bmr =
      profile.gender === 'female'
        ? 655 + 9.563 * w + 1.85 * h - 4.676 * a
        : 66 + 13.75 * w + 5.003 * h - 6.75 * a;

    const multipliers: Record<string, number> = {
      sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
    };
    const tdee = bmr * (multipliers[profile.activityLevel || ''] ?? 1.375);

    const goalAdj: Record<string, number> = {
      lose_weight: -500, gain_weight: 300, build_muscle: 200, maintain: 0, improve_fitness: 0,
    };
    return Math.round(tdee + (goalAdj[profile.primaryGoal || ''] ?? 0));
  }

  // ────────── Log a meal ──────────

  async logMeal(userId: string, data: {
    date: string;
    mealType?: string;
    description?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    recipeId?: string;
    mealPlanId?: string;
    isManual?: boolean;
  }) {
    return this.prisma.nutritionalLog.create({
      data: {
        userId,
        date: new Date(data.date),
        mealType: data.mealType,
        description: data.description || null,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        recipeId: data.recipeId,
        mealPlanId: data.mealPlanId,
        isManual: data.isManual ?? false,
      },
    });
  }

  /** Get user's daily logs for a date range */
  async getLogs(userId: string, startDate: string, endDate: string) {
    return this.prisma.nutritionalLog.findMany({
      where: {
        userId,
        date: {
          gte: new Date(startDate + 'T00:00:00Z'),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  /** Expose the function tool definitions for other services */
  getToolDefinitions() {
    return NUTRITION_FUNCTIONS;
  }
}
