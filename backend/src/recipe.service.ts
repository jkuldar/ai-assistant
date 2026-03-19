import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OpenAIHelper } from './openai-helper.service';
import { NutritionService } from './nutrition.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecipeSearchParams {
  query?: string;           // free-text (name, ingredient, cuisine)
  dietaryTags?: string[];
  allergies?: string[];
  excludeIngredients?: string[];
  maxCalories?: number;
  minProtein?: number;
  maxTime?: number;
  cuisine?: string;
  meal?: string;
  limit?: number;
  offset?: number;
}

export interface RecipeDetail {
  id: string;
  title: string;
  cuisine: string;
  meal: string;
  servings: number;
  summary: string;
  time: number;
  difficultyLevel: string;
  dietaryTags: string[];
  source: string;
  img: string | null;
  ingredients: { id: string; ingredientId: string; label: string; quantity: number; unit: string; calories: number; protein: number; carbs: number; fats: number }[];
  preparation: { stepNumber: number; step: string; description: string; ingredientIds: string[] }[];
  nutrition: { calories: number; protein: number; carbs: number; fats: number };
}

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private prisma: PrismaService,
    private openai: OpenAIHelper,
    private nutritionService: NutritionService,
  ) {}

  // ────────── RAG: vector similarity search ──────────

  /**
   * Semantic search using cosine similarity between the query embedding and
   * stored recipe embeddings. Falls back to ILIKE text search when the
   * OpenAI embedding call fails. Both paths return nutrition/ingredient data
   * so that callers can apply all remaining filters in JavaScript.
   */
  async searchByVector(query: string, limit = 10): Promise<any[]> {
    // Nutrition+ingredient join used by both paths so callers can post-filter
    const nutritionSelect = `
      SELECT r.id, r.title, r.cuisine, r.meal, r.servings, r.summary, r.time,
             r.difficulty_level AS "difficultyLevel", r.dietary_tags AS "dietaryTags",
             r.source, r.img,
             COALESCE(SUM(ri.quantity * i.calories / NULLIF(i.quantity, 0)), 0) AS total_calories,
             COALESCE(SUM(ri.quantity * i.protein  / NULLIF(i.quantity, 0)), 0) AS total_protein,
             ARRAY_AGG(i.label) FILTER (WHERE i.label IS NOT NULL) AS ingredient_labels
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON ri."recipeId" = r.id
      LEFT JOIN ingredients i ON i.id = ri."ingredientId"
    `;

    // Try genuine cosine similarity via OpenAI embeddings
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await this.openai.embedding(query);
    } catch (e) {
      this.logger.warn(`Embedding request failed, falling back to text search: ${(e as Error).message}`);
    }

    if (queryEmbedding) {
      // Fetch all recipes that have a stored embedding (up to 2 000 — the
      // seed creates 550, so in practice this loads the full catalogue)
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `${nutritionSelect}
         WHERE r.embedding IS NOT NULL
         GROUP BY r.id`,
      );

      // Compute cosine similarity in JS and sort descending
      const scored = rows
        .map((r) => {
          try {
            const vec: number[] = JSON.parse(r.embedding as string ?? '[]');
            return { ...r, embedding: undefined, similarity: this.cosineSimilarity(queryEmbedding!, vec) };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as any[];

      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, limit);
    }

    // Fallback: ILIKE text search (embedding unavailable)
    return this.prisma.$queryRawUnsafe(
      `${nutritionSelect}
       WHERE r.title ILIKE $1 OR r.summary ILIKE $1 OR r.source = 'ai-generated'
       GROUP BY r.id
       ORDER BY r."createdAt" DESC
       LIMIT $2`,
      `%${query}%`,
      limit,
    );
  }

  /** Cosine similarity between two equal-length float vectors. */
  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < len; i++) {
      dot  += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ────────── Search & filter (combined SQL + vector) ──────────

  async search(params: RecipeSearchParams): Promise<{ recipes: any[]; total: number }> {
    const limit = Math.min(params.limit || 20, 100);
    const offset = params.offset || 0;

    // If there's a free-text query, use vector similarity
    if (params.query && params.query.trim()) {
      const vectorResults = await this.searchByVector(params.query, 100);
      let filtered = vectorResults;

      if (params.dietaryTags?.length) {
        filtered = filtered.filter((r) =>
          params.dietaryTags!.every((tag) => r.dietaryTags?.includes(tag)),
        );
      }
      if (params.cuisine) {
        filtered = filtered.filter((r) => r.cuisine.toLowerCase() === params.cuisine!.toLowerCase());
      }
      if (params.meal) {
        filtered = filtered.filter((r) => r.meal.toLowerCase() === params.meal!.toLowerCase());
      }
      if (params.maxTime) {
        filtered = filtered.filter((r) => r.time <= params.maxTime!);
      }
      // Nutrition filters (total_calories / total_protein are per whole recipe; divide by servings)
      if (params.maxCalories) {
        filtered = filtered.filter((r) => {
          const calPerServing = r.servings > 0 ? (r.total_calories ?? 0) / r.servings : 0;
          return calPerServing <= params.maxCalories!;
        });
      }
      if (params.minProtein) {
        filtered = filtered.filter((r) => {
          const protPerServing = r.servings > 0 ? (r.total_protein ?? 0) / r.servings : 0;
          return protPerServing >= params.minProtein!;
        });
      }
      // Allergen / excluded ingredient filters (check against ingredient_labels from JOIN)
      if (params.allergies?.length) {
        filtered = filtered.filter((r) =>
          !params.allergies!.some((a) =>
            (r.ingredient_labels as string[] || []).some((l) => l.toLowerCase().includes(a.toLowerCase())),
          ),
        );
      }
      if (params.excludeIngredients?.length) {
        filtered = filtered.filter((r) =>
          !params.excludeIngredients!.some((e) =>
            (r.ingredient_labels as string[] || []).some((l) => l.toLowerCase().includes(e.toLowerCase())),
          ),
        );
      }

      return { recipes: filtered.slice(offset, offset + limit), total: filtered.length };
    }

    // Prisma query for non-vector search
    const where: any = {};
    if (params.cuisine) where.cuisine = { equals: params.cuisine, mode: 'insensitive' };
    if (params.meal) where.meal = { equals: params.meal, mode: 'insensitive' };
    if (params.maxTime) where.time = { lte: params.maxTime };
    if (params.dietaryTags?.length) where.dietaryTags = { hasEvery: params.dietaryTags };

    // Allergen / excluded-ingredient filters at the DB level
    const andConditions: any[] = [];
    if (params.allergies?.length) {
      params.allergies.forEach((allergen) =>
        andConditions.push({
          ingredients: { none: { ingredient: { label: { contains: allergen, mode: 'insensitive' } } } },
        }),
      );
    }
    if (params.excludeIngredients?.length) {
      params.excludeIngredients.forEach((excl) =>
        andConditions.push({
          ingredients: { none: { ingredient: { label: { contains: excl, mode: 'insensitive' } } } },
        }),
      );
    }
    if (andConditions.length) where.AND = andConditions;

    const [recipes, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ingredients: { include: { ingredient: true } },
        },
      }),
      this.prisma.recipe.count({ where }),
    ]);

    // Nutrition post-filter (calories/protein are computed from ingredients)
    if (params.maxCalories || params.minProtein) {
      const filtered = recipes.filter((r: any) => {
        const ings = r.ingredients || [];
        const totalCal = ings.reduce((s: number, ri: any) => {
          const ing = ri.ingredient;
          return s + (ing && ing.quantity > 0 ? (ing.calories / ing.quantity) * ri.quantity : 0);
        }, 0);
        const totalProt = ings.reduce((s: number, ri: any) => {
          const ing = ri.ingredient;
          return s + (ing && ing.quantity > 0 ? (ing.protein / ing.quantity) * ri.quantity : 0);
        }, 0);
        const calPerServing  = r.servings > 0 ? totalCal  / r.servings : 0;
        const protPerServing = r.servings > 0 ? totalProt / r.servings : 0;
        if (params.maxCalories && calPerServing  > params.maxCalories) return false;
        if (params.minProtein  && protPerServing < params.minProtein)  return false;
        return true;
      });
      return { recipes: filtered, total: filtered.length };
    }

    return { recipes, total };
  }

  // ────────── Get full recipe detail ──────────

  async getById(id: string): Promise<RecipeDetail> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: { include: { ingredient: true } },
        preparation: { orderBy: { stepNumber: 'asc' } },
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const ingredients = recipe.ingredients.map((ri) => ({
      id: ri.id,
      ingredientId: ri.ingredientId,
      label: ri.ingredient.label,
      quantity: ri.quantity,
      unit: ri.ingredient.unit,
      calories: (ri.ingredient.calories / ri.ingredient.quantity) * ri.quantity,
      protein: (ri.ingredient.protein / ri.ingredient.quantity) * ri.quantity,
      carbs: (ri.ingredient.carbs / ri.ingredient.quantity) * ri.quantity,
      fats: (ri.ingredient.fats / ri.ingredient.quantity) * ri.quantity,
    }));

    const nutrition = {
      calories: ingredients.reduce((s, i) => s + i.calories, 0),
      protein: ingredients.reduce((s, i) => s + i.protein, 0),
      carbs: ingredients.reduce((s, i) => s + i.carbs, 0),
      fats: ingredients.reduce((s, i) => s + i.fats, 0),
    };

    return {
      id: recipe.id,
      title: recipe.title,
      cuisine: recipe.cuisine,
      meal: recipe.meal,
      servings: recipe.servings,
      summary: recipe.summary,
      time: recipe.time,
      difficultyLevel: recipe.difficultyLevel,
      dietaryTags: recipe.dietaryTags,
      source: recipe.source,
      img: recipe.img,
      ingredients,
      preparation: recipe.preparation.map((s) => ({
        stepNumber: s.stepNumber,
        step: s.step,
        description: s.description,
        ingredientIds: s.ingredientIds,
      })),
      nutrition,
    };
  }

  // ────────── RAG recipe generation ──────────

  async generateRecipe(preferences: {
    dietaryTags?: string[];
    cuisine?: string;
    meal?: string;
    allergies?: string[];
    dislikedIngredients?: string[];
    calorieTarget?: number;
    proteinTarget?: number;
  }): Promise<RecipeDetail> {
    // Step 1: Build a search query from preferences
    const searchTerms = [
      preferences.cuisine,
      preferences.meal,
      ...(preferences.dietaryTags || []),
    ].filter(Boolean).join(' ');

    // Step 2: Retrieve similar recipes from RAG database
    const similar = await this.searchByVector(
      searchTerms || 'healthy balanced meal',
      5,
    );

    // Step 3: Augment prompt with retrieved recipes
    const ragContext = similar
      .map((r) => `- "${r.title}" (${r.cuisine}, ${r.meal}): ${r.summary}`)
      .join('\n');

    const allergyClause = preferences.allergies?.length
      ? `MUST NOT contain: ${preferences.allergies.join(', ')}.`
      : '';
    const dislikedClause = preferences.dislikedIngredients?.length
      ? `Avoid these ingredients: ${preferences.dislikedIngredients.join(', ')}.`
      : '';
    const calorieClause = preferences.calorieTarget
      ? `Target around ${preferences.calorieTarget} kcal per serving.`
      : '';

    // temperature=0.8 / top_p=0.95: recipe generation is a genuinely creative
    // task — wide sampling pool ensures novel, varied recipes each time.
    // Few-shot example shows the exact required JSON schema.
    const FEW_SHOT_RECIPE_EXAMPLE =
      'Example input: Generate a unique Japanese breakfast recipe. Dietary tags: vegetarian. Target ~400 kcal per serving.\n' +
      'Example output:\n' +
      '{"title":"Miso Omelette with Pickled Daikon","cuisine":"Japanese","meal":"breakfast","servings":2,' +
      '"summary":"A silky rolled omelette seasoned with white miso, served with house-pickled daikon for a tangy contrast.","time":20,' +
      '"difficultyLevel":"easy","dietaryTags":["vegetarian","gluten-free"],' +
      '"ingredients":[{"label":"egg","quantity":240,"unit":"gram"},{"label":"white miso","quantity":15,"unit":"gram"},' +
      '{"label":"daikon","quantity":100,"unit":"gram"},{"label":"rice vinegar","quantity":20,"unit":"ml"}],' +
      '"preparation":[{"step":"Make dashi base","description":"Whisk eggs with miso and 2 tbsp water until smooth.","ingredientLabels":["egg","white miso"]},' +
      '{"step":"Cook tamagoyaki","description":"Cook in a rectangular omelette pan in three thin layers, rolling each.","ingredientLabels":["egg"]},' +
      '{"step":"Quick-pickle daikon","description":"Slice daikon thinly, toss with rice vinegar and a pinch of salt. Rest 10 min.","ingredientLabels":["daikon","rice vinegar"]}]}';

    const prompt = `${FEW_SHOT_RECIPE_EXAMPLE}

Now generate a NEW recipe (do not replicate the example):
Generate a unique ${preferences.cuisine || ''} ${preferences.meal || 'meal'} recipe.
Dietary tags: ${(preferences.dietaryTags || []).join(', ') || 'none specific'}.
${allergyClause}
${dislikedClause}
${calorieClause}

Here are similar recipes for inspiration (do NOT copy, create something new):
${ragContext}

Return ONLY valid JSON:
{
  "title": "Recipe Title",
  "cuisine": "cuisine",
  "meal": "${preferences.meal || 'dinner'}",
  "servings": 2-4,
  "summary": "1-2 sentences",
  "time": minutes,
  "difficultyLevel": "easy|medium|hard",
  "dietaryTags": ["tags"],
  "ingredients": [{"label": "name (lowercase)", "quantity": grams_or_ml, "unit": "gram|ml"}],
  "preparation": [{"step": "Title", "description": "Detail", "ingredientLabels": ["labels"]}]
}
Quantities: solids in grams, liquids in ml.`;

    const raw = await this.openai.chatText(prompt, 'You are a professional chef and nutritionist. Return only valid JSON.', 0.8, 0.95);
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Step 4: Save to database
    return this.saveGeneratedRecipe(parsed);
  }

  // ────────── Ingredient substitution ──────────

  async substituteIngredient(
    recipeId: string,
    ingredientId: string,
    reason?: string,
  ): Promise<RecipeDetail> {
    const recipe = await this.getById(recipeId);
    const ingToReplace = recipe.ingredients.find((i) => i.ingredientId === ingredientId);
    if (!ingToReplace) throw new NotFoundException('Ingredient not in this recipe');

    // temperature=0.6 / top_p=0.9: substitution needs moderate creativity to
    // suggest non-obvious alternatives while still respecting culinary context.
    // Few-shot shows the exact JSON schema expected.
    const FEW_SHOT_SUBSTITUTE_EXAMPLE =
      'Example: substitute "butter" (50 gram) in "Banana Bread", reason: dairy-free.\n' +
      'Expected output: {"label":"coconut oil","quantity":45,"unit":"gram","explanation":"Coconut oil is solid at room temperature like butter and gives a subtle sweetness that complements banana. Use 90% of the butter quantity to match fat content."}';

    const prompt = `${FEW_SHOT_SUBSTITUTE_EXAMPLE}

Now suggest a substitute for "${ingToReplace.label}" (${ingToReplace.quantity}${ingToReplace.unit}) in recipe "${recipe.title}".
${reason ? `Reason: ${reason}` : ''}
Other ingredients: ${recipe.ingredients.filter((i) => i.ingredientId !== ingredientId).map((i) => i.label).join(', ')}.
Return ONLY JSON: {"label": "substitute name (lowercase)", "quantity": number, "unit": "gram|ml", "explanation": "why this works"}`;

    const raw = await this.openai.chatText(prompt, 'You are a nutrition expert.', 0.6, 0.9);
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const sub = JSON.parse(cleaned);

    // Find or create the substitute ingredient
    let subIngredient = await this.prisma.ingredient.findUnique({ where: { label: sub.label.toLowerCase() } });
    if (!subIngredient) {
      subIngredient = await this.prisma.ingredient.create({
        data: {
          label: sub.label.toLowerCase(),
          unit: sub.unit === 'ml' ? 'ml' : 'gram',
          quantity: 100,
          calories: 0, carbs: 0, protein: 0, fats: 0,
        },
      });
    }

    // Replace in the join table
    await this.prisma.recipeIngredient.deleteMany({
      where: { recipeId, ingredientId },
    });
    await this.prisma.recipeIngredient.create({
      data: {
        recipeId,
        ingredientId: subIngredient.id,
        quantity: sub.quantity,
      },
    });

    return this.getById(recipeId);
  }

  // ────────── Portion adjustment ──────────

  async adjustPortions(recipeId: string, newServings: number): Promise<RecipeDetail> {
    const recipe = await this.getById(recipeId);

    // Use the adjust_recipe_portions function-calling tool so the AI model
    // is in the loop (satisfies the function-calling requirement).
    const adjusted = await this.nutritionService.adjustPortionsViaAI(
      recipe.ingredients.map((i) => ({ name: i.label, quantity: i.quantity, unit: i.unit })),
      recipe.servings,
      newServings,
    );

    const factor = adjusted.factor;
    return {
      ...recipe,
      servings: newServings,
      ingredients: recipe.ingredients.map((i, idx) => ({
        ...i,
        quantity: adjusted.ingredients[idx]?.quantity ?? Math.round(i.quantity * factor * 10) / 10,
        calories: i.calories * factor,
        protein: i.protein * factor,
        carbs: i.carbs * factor,
        fats: i.fats * factor,
      })),
      nutrition: {
        calories: recipe.nutrition.calories * factor,
        protein: recipe.nutrition.protein * factor,
        carbs: recipe.nutrition.carbs * factor,
        fats: recipe.nutrition.fats * factor,
      },
    };
  }

  // ────────── Save a generated recipe ──────────

  private async saveGeneratedRecipe(data: any): Promise<RecipeDetail> {
    // Generate embedding for the new recipe (stored as JSON string)
    const embText = `${data.title} - ${data.cuisine} ${data.meal}. ${data.summary}. Ingredients: ${data.ingredients.map((i: any) => i.label).join(', ')}. Tags: ${(data.dietaryTags || []).join(', ')}.`;
    const emb = await this.openai.embedding(embText);
    const vec = `[${emb.join(',')}]`;

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `INSERT INTO recipes (id, title, cuisine, meal, servings, summary, time, difficulty_level, dietary_tags, source, embedding, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'ai-generated', $9, NOW(), NOW())
       RETURNING id`,
      data.title,
      data.cuisine,
      data.meal || 'dinner',
      data.servings || 2,
      data.summary,
      data.time || 30,
      data.difficultyLevel || 'medium',
      data.dietaryTags || [],
      vec,
    );
    const recipeId = rows[0].id;

    // Link ingredients
    for (const ing of data.ingredients) {
      const label = ing.label.toLowerCase();
      let ingredient = await this.prisma.ingredient.findUnique({ where: { label } });
      if (!ingredient) {
        ingredient = await this.prisma.ingredient.create({
          data: { label, unit: ing.unit === 'ml' ? 'ml' : 'gram', quantity: 100, calories: 0, carbs: 0, protein: 0, fats: 0 },
        });
      }
      await this.prisma.$executeRaw`
        INSERT INTO recipe_ingredients (id, "recipeId", "ingredientId", quantity)
        VALUES (gen_random_uuid(), ${recipeId}, ${ingredient.id}, ${ing.quantity})
        ON CONFLICT ("recipeId", "ingredientId") DO NOTHING
      `;
    }

    // Steps
    const steps = data.preparation || [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await this.prisma.recipeStep.create({
        data: {
          recipeId,
          stepNumber: i + 1,
          step: s.step,
          description: s.description,
          ingredientIds: s.ingredientLabels || [],
        },
      });
    }

    return this.getById(recipeId);
  }
}
