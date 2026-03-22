# Üvi

# App is available on URL -> https://counting-calories-production.up.railway.app

# Testing questions are answered in file -> testing.md







A wellness platform with AI-powered meal planning, recipe management, nutritional analysis, health tracking, data visualization, and a conversational AI wellness assistant — powered by OpenAI.

## Tech Stack

- **Backend:** NestJS + PostgreSQL + Prisma ORM
- **Frontend:** Vanilla JavaScript + Chart.js + Vite
- **AI:** OpenAI gpt-4.1-mini (insights, meal planning, embeddings) + gpt-4o-mini (chat assistant with function calling)
- **Deployment:** Railway

## Features

### Project 1 — Health & Wellness
- Email/password registration with email verification
- OAuth 2.0 (Google + GitHub)
- JWT session management (access + refresh tokens)
- Password reset via email
- Two-Factor Authentication (TOTP)
- Health profile (demographics, physical metrics, fitness goals)
- BMI calculation and wellness score (0–100)
- Weight and activity logging with history
- Weekly and monthly summaries
- AI-powered personalized health insights with caching
- Charts and data visualization dashboard
- Privacy settings and data export (JSON)
- Rate limiting (60 req/min)

### Project 2 — Nutrition & Meal Planning
- AI-generated daily and weekly meal plans (3-step sequential prompting)
- Flexible meal structures (configurable meals + snacks per day)
- Meal swapping between days and reordering within a day
- Manual meal additions and individual meal regeneration
- Recipe database with 500+ recipes and 500+ ingredients (RAG with vector embeddings)
- Recipe search with filters: dietary tags, allergies, cuisine, calories, protein, prep time
- AI recipe generation grounded in RAG-retrieved data
- AI-driven ingredient substitution
- Portion adjustment with automatic nutritional recalculation via function calling
- Shopping list generation from meal plans or individual meals (11 food categories)
- Daily, weekly, and monthly nutritional tracking with AI analysis
- Macro breakdown pie charts, progress bars, and caloric trend lines
- Cross-feature integration: nutrition updates wellness score, allergies auto-filter recipes, BMI/activity drive calorie targets

### Project 3 — AI Wellness Assistant
- Conversational chat interface for natural-language interaction with platform data
- OpenAI function calling with 4 data-access tools: `get_health_metrics`, `get_nutrition_data`, `get_meal_plan`, `get_recipe_info`
- Multi-turn conversation with sliding-window context management (last 10 messages)
- Up to 3 sequential tool-call rounds per request for complex queries
- Health metrics queries: weight, BMI, activity, sleep, stress, wellness score, progress
- Nutrition queries: daily calorie/macro intake, meal breakdowns
- Meal plan queries: today's meals, upcoming meals, plan details
- Recipe queries: ingredients, preparation steps, nutritional info
- General wellness advice with safety guardrails (no medical diagnoses, suggests professional consultation)
- Typing indicator and loading states in the chat UI
- Protected by existing JWT authentication

## Usage Guide

### Getting Started
1. **Register** an account (email/password or OAuth) and verify your email.
2. **Complete your health profile** — demographics, measurements, activity level, dietary preferences, allergies, and goals. All input fields are pre-filled when editing so you never re-enter data.
3. **Dashboard** shows BMI, wellness score, goal progress, today's nutrition summary, and AI insights.

### Meal Planning
1. Navigate to **Food → Meals**.
2. Click **Preferences** to set timezone, meals/day, snacks/day, meal times, cuisine preferences, disliked ingredients, and macro targets. Calorie targets are auto-calculated from your BMI, weight goals, and activity level if not set manually.
3. Click **Generate Plan** and choose daily or weekly. The AI uses 3-step sequential prompting (strategy → structure with RAG → nutritional refinement) to create a balanced plan.
4. **Customize** the plan: regenerate individual meals, swap meals between days, reorder within a day, or add custom meals manually.
5. Click **Shopping List** to auto-generate a categorized ingredient list from the plan.

### Recipes
1. Navigate to **Food → Recipes**.
2. **Search** by name, ingredient, or cuisine. Apply filters for dietary tags, max calories, min protein, prep time, and allergens (auto-populated from your health profile).
3. View full **recipe details** — ingredients, step-by-step instructions, and nutritional breakdown.
4. **Adjust portions** via the servings dropdown — quantities and nutrition recalculate automatically (via AI function calling).
5. **Substitute ingredients** — click "Substitute" on any ingredient to get AI-driven alternatives based on your preferences.
6. Click **AI Generate Recipe** to create a new recipe from scratch based on your dietary profile.

### Nutrition Tracking
1. Navigate to **Food → Nutrition**.
2. **Log food** entries with calories and macros.
3. Switch between **Daily / Weekly / Monthly** views.
4. Daily view: macro progress bars, pie chart, AI analysis, and food log table.
5. Weekly/Monthly view: average macros, caloric deficit/surplus trend line chart, and AI summary.
6. Today's nutrition also appears on the main **Dashboard**.

### Shopping Lists
1. Navigate to **Food → Shopping**.
2. Lists are auto-generated from meal plans. Items are grouped by category (dairy, produce, grains, protein, etc.).
3. Check off items, adjust quantities, or remove items individually.

### AI Chat Assistant
1. Click **Chat** in the navigation bar.
2. Ask questions in natural language — the assistant has access to your health data, nutrition logs, meal plans, and recipes.
3. Example questions:
   - "What's my current BMI?"
   - "How many calories did I eat today?"
   - "What's on my meal plan for today?"
   - "Tell me about my dinner recipe"
   - "How can I improve my sleep?"
   - "Am I making progress toward my weight goal?"
4. The assistant remembers context within the conversation (up to 10 messages), so follow-up questions like "Can you tell me more about that?" work naturally.
5. The assistant will never provide medical diagnoses — it suggests consulting a healthcare provider for medical concerns.

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 15+

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd counting-calories
   ```

2. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Fill in your values in .env
   npm install
   npx prisma migrate deploy
   npm run start:dev
   ```

3. **Seed the database** (requires `OPENAI_API_KEY` in `.env`)
   ```bash
   cd backend
   npx ts-node prisma/seed.ts
   ```
   This generates 550+ recipes and 550+ ingredients with vector embeddings for RAG.

4. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and set the following:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) |
| `ENCRYPTION_KEY` | Field encryption key (32 chars) |
| `FRONTEND_URL` | Frontend URL for CORS and redirects |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `SMTP_FROM` | From address for emails |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback URL |
| `OPENAI_API_KEY` | OpenAI API key |

> In development, emails are logged to the console instead of being sent.

## Deployment (Railway)

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for full setup instructions.

The project uses two Railway services (backend + frontend) connected to a Railway PostgreSQL database.

## Prompt Engineering Strategy

### Sequential Prompting (Meal Plan Generation)

Meal plan generation uses a 3-step sequential prompting pipeline where each step feeds its output into the next:

1. **Step 1 — Strategy Assessment** (`temperature=0.5, top_p=0.85`): Analyzes the user's dietary preferences, allergies, calorie targets, and macro goals to produce a high-level meal strategy (calorie distribution, macro balance, cuisine rotation, key nutrients). Moderate determinism ensures strategies are grounded but still vary per user.

2. **Step 2 — Meal Structure with RAG** (`temperature=0.7, top_p=0.95`): Takes the strategy from Step 1 and combines it with up to 30 recipes retrieved by vector similarity from the RAG database. Produces a structured JSON array of meals with recipe IDs or custom names. Higher creativity allows diverse meal selection across days.

3. **Step 3 — Nutritional Refinement** (`temperature=0.3, top_p=0.8`): Reviews the generated plan's per-day calorie totals against targets. Uses function calling for nutritional computations. Suggests adjustments if any day is >20% off target. Low temperature ensures reproducible, trustworthy calorie adjustments.

This breakdown improves quality over a single-prompt approach because each step is focused: strategy handles the "what" at a high level, structure handles the "which recipes", and refinement handles the "is the math right".

### Few-Shot Examples

Every AI prompt includes one or more few-shot examples that demonstrate the expected output format:
- Strategy prompt: shows a sample user → strategy mapping
- Meal structure prompt: shows a sample 2-day plan as a JSON array
- Refinement prompt: shows a day that needs adjustment and a day that doesn't
- Nutrition function calling: shows a user request → function call → tool result → assistant analysis sequence
- Recipe generation: shows a complete recipe JSON with all required fields
- Ingredient substitution: shows the substitution JSON format with explanation
- Health insights: shows the 6-category JSON format (assessment, foodRecommendations, mealTiming, portionSizes, ingredientAlternatives, mealPlanOptimization)

### Iterative Refinement

- Step 3 of meal planning acts as a refinement pass on the output from Steps 1–2.
- Function calling supports multi-round loops (up to 5 rounds) — if the AI requests multiple functions, each result is fed back and the model continues until it produces a final text response.

## AI Chat Assistant Architecture

### Two-Layer Design

The chat assistant follows a two-layer architecture:

1. **Conversation Layer** — Handles the chat interface, message history, input validation, and response rendering. The frontend maintains conversation history in-memory and sends it with each request. The backend enforces a sliding window of the last 10 messages to manage token usage.

2. **Data Access Layer** — Connects to platform features via OpenAI function calling. When the AI determines it needs user data to answer a question, it invokes one or more tool functions that query Prisma directly.

### Function Calling Tools

| Function | Description | Parameters |
|---|---|---|
| `get_health_metrics` | Reads weight, BMI, activity, sleep, stress, wellness score, progress | `metric_type` (enum), `time_period` (optional) |
| `get_nutrition_data` | Reads nutrition logs with calorie/macro totals for a date | `date` (YYYY-MM-DD) |
| `get_meal_plan` | Reads active meal plan meals for a date | `date` (YYYY-MM-DD) |
| `get_recipe_info` | Reads full recipe with ingredients, steps, nutritional info | `recipeId` (UUID) |

The assistant supports up to 3 sequential tool-call rounds per request, allowing it to gather data from multiple sources before composing a response.

### System Prompt Design

The chat system prompt defines:
- **Role and capabilities** — wellness assistant that can access health data, nutrition, meal plans, and recipes
- **Tone** — warm, encouraging, concise, practical
- **Data usage** — instructs the model to use tools to look up real data before answering
- **Safety guardrails** — no medical diagnoses, no unsafe weight loss recommendations, suggests professional consultation
- **Current date** — injected dynamically so the model can reason about "today" and "this week"

### Conversation Memory

- Sliding window of the last 10 messages (user + assistant turns)
- History is maintained client-side and sent with each request
- The backend trims to the window size before passing to OpenAI
- No server-side persistence of chat history — conversations are ephemeral per session

## AI Model Selection Rationale

The application uses **gpt-4.1-mini** for insight generation, meal planning, and recipe tasks, and **gpt-4o-mini** for the chat assistant. Models were chosen for the following reasons:

| Factor | Rationale |
|---|---|
| **Nutritional accuracy** | gpt-4.1-mini produces reliable structured JSON for nutritional data and follows function calling correctly |
| **Format consistency** | Consistently returns valid JSON when instructed, reducing parse failures |
| **Context length** | 128k context window accommodates large RAG recipe sets (30+ recipes in a single prompt) |
| **Cost and latency** | Significantly cheaper and faster than gpt-4o while maintaining adequate quality for meal planning |
| **Function calling** | Native tool/function calling support makes nutritional calculation delegation reliable |
| **Chat assistant (gpt-4o-mini)** | Optimized for conversational interactions — fast response times, strong instruction following, and reliable function calling at low cost |

Temperature and top_p are tuned per task:
- **Deterministic tasks** (function calling, portion scaling): `temperature=0, top_p=1.0` — exact numerical results
- **Structured output** (meal structure, refinement): `temperature=0.3–0.5, top_p=0.8–0.85` — reproducible but slightly varied
- **Creative tasks** (recipe generation, meal variety): `temperature=0.7–0.8, top_p=0.95` — wide sampling for novel results
- **Narrative tasks** (health insights, analysis summaries): `temperature=0.5–0.7, top_p=0.85–0.9` — readable prose that stays grounded
- **Chat assistant**: `temperature=0.7` — conversational and natural while staying factual when referencing user data

## Data Model Documentation

### Recipe

```json
{
  "id": "uuid",
  "title": "Mediterranean Quinoa Bowl",
  "cuisine": "Mediterranean",
  "meal": "lunch",
  "servings": 2,
  "ingredients": [
    { "id": "uuid", "ingredientId": "uuid", "label": "quinoa", "quantity": 180, "unit": "gram" }
  ],
  "summary": "A refreshing quinoa bowl with vegetables and feta",
  "time": 25,
  "difficultyLevel": "easy",
  "dietaryTags": ["vegetarian", "gluten-free"],
  "source": "rag-database | ai-generated | user-created",
  "img": null,
  "preparation": [
    { "stepNumber": 1, "step": "Cook quinoa", "description": "Rinse and cook in water.", "ingredientIds": ["uuid"] }
  ],
  "nutrition": { "calories": 425, "protein": 12.5, "carbs": 48.3, "fats": 22.7 }
}
```

All measurements standardized: solids in **grams (g)**, liquids in **milliliters (ml)**, energy in **kilocalories (kcal)**, time in **minutes**.

### Ingredient

```json
{
  "id": "uuid",
  "label": "quinoa",
  "unit": "gram",
  "quantity": 100,
  "calories": 368,
  "carbs": 64,
  "protein": 14,
  "fats": 6,
  "embedding": "[vector...]"
}
```

Nutritional values are per reference quantity (typically 100g or 100ml). Vector embeddings are generated with `text-embedding-3-small` for RAG similarity search.

### Meal Plan

```
MealPlan → has many MealPlanMeals (each linked to a Recipe or custom)
         → has a preferencesSnapshot (JSON copy of user prefs at creation time)
         → versioned (multiple versions for the same date range)
```

### Key Relationships

- `User` → `HealthProfile` (1:1) — demographics, BMI, dietary preferences, allergies
- `User` → `MealPlanPreferences` (1:1) — timezone, meal times, cuisine prefs, macro targets
- `User` → `MealPlan` (1:many) → `MealPlanMeal` (1:many) → `Recipe` (optional)
- `Recipe` → `RecipeIngredient` (1:many) → `Ingredient` (many:1)
- `Recipe` → `RecipeStep` (1:many) — preparation steps with ingredient references
- `User` → `NutritionalLog` (1:many) — daily food logging
- `User` → `ShoppingList` (1:many) → `ShoppingListItem` (1:many)

## Error Handling Approach

### OpenAI API Reliability (`openai-helper.service.ts`)

All OpenAI calls go through a centralized `callWithRetry()` method that handles:

| Error Type | Handling |
|---|---|
| **Rate limits (429)** | Exponential backoff retry (1s → 2s → 4s), max 3 attempts |
| **Server errors (500+)** | Same exponential backoff retry |
| **Timeouts** | 60-second `AbortController` timeout per request; retried up to 3 times |
| **Network failures** | `ECONNRESET` and `fetch failed` errors retried with backoff |
| **Non-retryable errors** | Thrown immediately with descriptive message |

### Function Calling Error Handling (`nutrition.service.ts`)

- **Invalid JSON arguments**: caught in `JSON.parse` try/catch, error message returned as tool response
- **Missing required parameters**: validated before execution (e.g. "ingredients must be a non-empty array")
- **Invalid values**: type-checked with `isFinite`, positive number assertions
- **Execution errors**: caught per function call, error returned via tool response so the model can recover
- **Fallback**: if the AI doesn't call any function after 5 rounds, direct computation is used as fallback

### AI Insight Fallbacks (`ai.service.ts`)

- If the API key is missing → returns last cached insight (if any), otherwise a user-friendly message
- If profile or consent is missing → specific guidance message telling the user what to do
- If the API call fails for any reason → falls back to the most recent valid cached insight
- Cache duration: 24 hours per context hash

### Meal Plan Generation Fallbacks (`meal-planning.service.ts`)

- If Step 2 JSON parsing fails → a `generateFallbackStructure()` creates a basic plan from available RAG recipes
- If Step 3 refinement fails → the plan proceeds unchanged (refinement is non-blocking)
- If a recipe lookup fails during nutritional analysis → the recipe ID is cleared and AI estimates nutrition instead

### Frontend Error Handling

- All API calls wrapped in try/catch with `showToast('...', 'error')` user feedback
- Token refresh on 401 with automatic retry of the original request
- Graceful empty states when data is unavailable (e.g. "No nutrition data for this day")

## API Endpoints

### Auth
- `POST /auth/register` - Register
- `POST /auth/login` - Login
- `POST /auth/verify-email?code=` - Verify email
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `GET /auth/google` - Google OAuth
- `GET /auth/github` - GitHub OAuth
- `POST /auth/2fa/generate` - Generate 2FA secret
- `POST /auth/2fa/enable` - Enable 2FA
- `POST /auth/2fa/disable` - Disable 2FA

### Health Profile
- `POST /health-profile` - Create profile
- `GET /health-profile` - Get profile
- `PATCH /health-profile/:id` - Update profile
- `POST /health-profile/weight-history` - Log weight
- `GET /health-profile/weight-history` - Get weight history
- `POST /health-profile/activity` - Log activity
- `GET /health-profile/activity` - Get activity history
- `GET /health-profile/progress` - Goal progress
- `GET /health-profile/milestones` - Achievements
- `GET /health-profile/summary/weekly` - Weekly summary
- `GET /health-profile/summary/monthly` - Monthly summary

### AI
- `GET /ai/insight` - Get personalized insights (cached 24h)
- `GET /ai/insights/history` - Insight history
- `POST /ai/invalidate-cache` - Force regeneration
- `POST /ai/chat` - Chat with the AI wellness assistant (`{ message, conversationHistory }`)

### Privacy
- `GET /privacy-settings` - Get settings
- `PATCH /privacy-settings` - Update settings
- `GET /data-export` - Export all user data (JSON)

### Recipes
- `GET /recipes` - Search/filter recipes (query params: `q`, `cuisine`, `meal`, `dietaryTags`, `allergies`, `excludeIngredients`, `maxCalories`, `minProtein`, `maxTime`)
- `GET /recipes/:id` - Get recipe detail
- `POST /recipes/generate` - AI-generate a recipe
- `POST /recipes/:id/substitute` - AI ingredient substitution
- `GET /recipes/:id/portions/:servings` - Adjust portion sizes

### Meal Plans
- `POST /meal-plans` - Generate a meal plan (daily or weekly)
- `GET /meal-plans` - List user's meal plans
- `GET /meal-plans/preferences` - Get meal plan preferences
- `PUT /meal-plans/preferences` - Update preferences
- `GET /meal-plans/versions` - Version history for a date range
- `GET /meal-plans/:id` - Get a specific plan
- `POST /meal-plans/:id/restore` - Restore a plan version
- `POST /meal-plans/:id/meals` - Add a manual meal
- `POST /meal-plans/meals/swap` - Swap two meals
- `PATCH /meal-plans/meals/:mealId` - Update meal (reorder, change type/date)
- `POST /meal-plans/meals/:mealId/regenerate` - Regenerate a single meal
- `DELETE /meal-plans/meals/:mealId` - Remove a meal

### Nutrition
- `POST /nutrition/analyze` - Analyze nutrition via function calling
- `GET /nutrition/daily/:date` - Daily intake analysis with AI feedback
- `GET /nutrition/weekly/:startDate` - Weekly analysis with trend data
- `GET /nutrition/monthly/:startDate` - Monthly analysis with trend data
- `POST /nutrition/log` - Log a food entry
- `GET /nutrition/logs` - Get logs for a date range

### Shopping Lists
- `GET /shopping-lists` - List all shopping lists
- `GET /shopping-lists/:id` - Get a specific list
- `POST /shopping-lists/from-meal-plan` - Generate from a meal plan
- `POST /shopping-lists/from-meals` - Generate from specific meals
- `DELETE /shopping-lists/:id` - Delete a list
- `PATCH /shopping-lists/items/:itemId/quantity` - Update item quantity
- `PATCH /shopping-lists/items/:itemId/toggle` - Toggle item checked
- `DELETE /shopping-lists/items/:itemId` - Remove an item
