// Nutrition Tracker view component
import { showToast } from './utils.js';

export class NutritionTrackerView {
  constructor(container, api) {
    this.container = container;
    this.api = api;
    this.mode = 'daily'; // daily | weekly | monthly
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.dailyData = null;
    this.weeklyData = null;
    this.monthlyData = null;
    this.logs = [];
  }

  async load() {
    this.container.innerHTML = '<div class="loading-spinner">Loading nutrition data...</div>';
    try {
      if (this.mode === 'daily') {
        const [daily, logs] = await Promise.all([
          this.api.getDailyNutrition(this.selectedDate).catch(() => null),
          this.api.getNutritionLogs(this.selectedDate, this.selectedDate).catch(() => []),
        ]);
        this.dailyData = daily;
        this.logs = Array.isArray(logs) ? logs : (logs?.data || []);
      } else if (this.mode === 'weekly') {
        this.weeklyData = await this.api.getWeeklyNutrition(this.selectedDate).catch(() => null);
      } else {
        this.monthlyData = await this.api.getMonthlyNutrition(this.selectedDate).catch(() => null);
      }
      this.render();
    } catch {
      this.container.innerHTML = '<div class="error-state">Failed to load nutrition data.</div>';
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="nutrition-tracker">
        <div class="section-header">
          <h2>Nutrition Tracker</h2>
          <button class="btn-primary" id="nt-log-btn">Log Food</button>
        </div>

        <div class="nt-tab-bar">
          <button class="tab-btn ${this.mode === 'daily' ? 'active' : ''}" data-mode="daily">Daily</button>
          <button class="tab-btn ${this.mode === 'weekly' ? 'active' : ''}" data-mode="weekly">Weekly</button>
          <button class="tab-btn ${this.mode === 'monthly' ? 'active' : ''}" data-mode="monthly">Monthly</button>
          <input type="date" id="nt-date" value="${this.selectedDate}">
        </div>

        <div class="nt-content">
          ${this.mode === 'daily' ? this.renderDaily() : this.mode === 'weekly' ? this.renderWeekly() : this.renderMonthly()}
        </div>
      </div>
    `;
    this.attachListeners();
  }

  renderDaily() {
    const d = this.dailyData;
    if (!d) {
      return '<div class="empty-state"><p>No nutrition data for this day.</p></div>';
    }

    const totals = d.totals || d;
    const targets = d.targets || {};

    return `
      <div class="nt-daily">
        <div class="nt-summary-cards">
          ${this.renderMacroCard('Calories', totals.calories, targets.calories, 'kcal', 'cal')}
          ${this.renderMacroCard('Protein', totals.protein, targets.protein, 'g', 'prot')}
          ${this.renderMacroCard('Carbs', totals.carbs, targets.carbs, 'g', 'carb')}
          ${this.renderMacroCard('Fats', totals.fats, targets.fats, 'g', 'fat')}
        </div>

        ${this.renderMacroPieChart(totals)}

        ${d.analysis ? `<div class="nt-ai-analysis"><h3>AI Analysis</h3><p>${this.escapeHtml(d.analysis)}</p></div>` : ''}

        <div class="nt-logs">
          <h3>Food Log</h3>
          ${this.logs.length ? `
            <table class="nt-log-table">
              <thead>
                <tr><th>Food</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fats</th><th>Time</th></tr>
              </thead>
              <tbody>
                ${this.logs.map(log => `
                  <tr>
                    <td>${this.escapeHtml(log.description || log.recipe?.title || '—')}</td>
                    <td>${Math.round(log.calories || 0)}</td>
                    <td>${Math.round(log.protein || 0)}g</td>
                    <td>${Math.round(log.carbs || 0)}g</td>
                    <td>${Math.round(log.fats || 0)}g</td>
                    <td>${log.date ? new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p>No entries logged today.</p>'}
        </div>
      </div>
    `;
  }

  renderMacroCard(label, value, target, unit, cls) {
    const val = Math.round(value || 0);
    const tgt = target ? Math.round(target) : null;
    const pct = tgt ? Math.min(Math.round((val / tgt) * 100), 100) : 0;
    const barColor = !tgt ? 'var(--color-muted)' : pct > 100 ? 'var(--color-danger)' : pct > 80 ? 'var(--color-success)' : 'var(--color-primary)';

    return `
      <div class="macro-card macro-card--${cls}">
        <div class="macro-card__label">${label}</div>
        <div class="macro-card__value">${val}<span class="macro-card__unit">${unit}</span></div>
        ${tgt ? `
          <div class="macro-card__bar"><div class="macro-card__fill" style="width:${pct}%;background:${barColor}"></div></div>
          <div class="macro-card__target">${val} / ${tgt} ${unit} (${pct}%)</div>
        ` : ''}
      </div>
    `;
  }

  renderMacroPieChart(totals) {
    const protein = Math.round(totals.protein || 0);
    const carbs = Math.round(totals.carbs || 0);
    const fats = Math.round(totals.fats || 0);
    const total = protein + carbs + fats;
    if (total === 0) return '';

    const pPct = Math.round((protein / total) * 100);
    const cPct = Math.round((carbs / total) * 100);
    const fPct = 100 - pPct - cPct;

    // CSS conic gradient pie chart
    const protEnd = pPct;
    const carbEnd = protEnd + cPct;

    return `
      <div class="nt-pie-section">
        <h3>Macro Breakdown</h3>
        <div class="nt-pie-container">
          <div class="nt-pie" style="background: conic-gradient(
            var(--color-protein, #4dabf7) 0% ${protEnd}%,
            var(--color-carbs, #69db7c) ${protEnd}% ${carbEnd}%,
            var(--color-fat, #ffa94d) ${carbEnd}% 100%
          )"></div>
          <div class="nt-pie-legend">
            <span class="legend-item"><span class="legend-dot" style="background:var(--color-protein,#4dabf7)"></span>Protein ${pPct}% (${protein}g)</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--color-carbs,#69db7c)"></span>Carbs ${cPct}% (${carbs}g)</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--color-fat,#ffa94d)"></span>Fats ${fPct}% (${fats}g)</span>
          </div>
        </div>
      </div>
    `;
  }

  renderWeekly() {
    const w = this.weeklyData;
    if (!w) {
      return '<div class="empty-state"><p>No nutrition data for this week.</p></div>';
    }

    const days = w.days || w.dailyBreakdown || [];
    const avg = w.weeklyAvg || w.averages || {};
    const calorieTarget = w.calorieTarget;

    return `
      <div class="nt-weekly">
        <div class="nt-summary-cards">
          ${this.renderMacroCard('Avg Calories', avg.calories, calorieTarget, 'kcal', 'cal')}
          ${this.renderMacroCard('Avg Protein', avg.protein, avg.targetProtein, 'g', 'prot')}
          ${this.renderMacroCard('Avg Carbs', avg.carbs, avg.targetCarbs, 'g', 'carb')}
          ${this.renderMacroCard('Avg Fats', avg.fats, avg.targetFats, 'g', 'fat')}
        </div>

        ${days.length ? `
          <div class="nt-trend-section">
            <h3>Daily Caloric Deficit / Surplus</h3>
            ${this.renderTrendChart(days, calorieTarget, 'weekly')}
          </div>
        ` : ''}

        ${w.analysis ? `<div class="nt-ai-analysis"><h3>Weekly AI Analysis</h3><p>${this.escapeHtml(w.analysis)}</p></div>` : ''}
      </div>
    `;
  }

  renderMonthly() {
    const m = this.monthlyData;
    if (!m) {
      return '<div class="empty-state"><p>No nutrition data for this month.</p></div>';
    }

    const days = m.days || [];
    const avg = m.monthlyAvg || {};
    const calorieTarget = m.calorieTarget;

    return `
      <div class="nt-monthly">
        <div class="nt-summary-cards">
          ${this.renderMacroCard('Avg Calories', avg.calories, calorieTarget, 'kcal', 'cal')}
          ${this.renderMacroCard('Avg Protein', avg.protein, null, 'g', 'prot')}
          ${this.renderMacroCard('Avg Carbs', avg.carbs, null, 'g', 'carb')}
          ${this.renderMacroCard('Avg Fats', avg.fats, null, 'g', 'fat')}
        </div>

        ${days.length ? `
          <div class="nt-trend-section">
            <h3>30-Day Caloric Deficit / Surplus</h3>
            ${this.renderTrendChart(days, calorieTarget, 'monthly')}
          </div>
        ` : '<div class="empty-state"><p>No entries logged for this period.</p></div>'}

        ${m.analysis ? `<div class="nt-ai-analysis"><h3>Monthly AI Analysis</h3><p>${this.escapeHtml(m.analysis)}</p></div>` : ''}
      </div>
    `;
  }

  /**
   * Renders an SVG trend line chart showing daily caloric deficit/surplus.
   * Balance > 0 = surplus (red), balance < 0 = deficit (blue).
   */
  renderTrendChart(days, calorieTarget, period) {
    if (!days.length) return '<p style="padding:1rem;color:var(--text-secondary)">No data for this period.</p>';

    const target = calorieTarget || 2000;
    // Prefer pre-computed balance from backend; fall back to computing here
    const balances = days.map(d =>
      typeof d.balance === 'number'
        ? d.balance
        : Math.round((d.totals?.calories ?? d.calories ?? 0) - target)
    );

    const W = 560, H = 200;
    const PL = 58, PR = 20, PT = 20, PB = 35;
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;

    const maxAbs = Math.max(...balances.map(b => Math.abs(b)), 300);
    const yZero = PT + chartH / 2;

    const n = days.length;
    const xOf = i => PL + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);
    const yOf = b => yZero - (b / maxAbs) * (chartH / 2 - 6);

    const coords = days.map((_, i) => [xOf(i), yOf(balances[i])]);
    const linePoints = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const polyPoints = `${xOf(0).toFixed(1)},${yZero.toFixed(1)} ${linePoints} ${xOf(n-1).toFixed(1)},${yZero.toFixed(1)}`;

    // Y-axis ticks
    const uid = period; // reuse period as unique enough id (only one chart rendered at a time)
    const yTicks = [maxAbs, maxAbs / 2, 0, -(maxAbs / 2), -maxAbs];
    const yAxisSvg = yTicks.map(v => {
      const y = yOf(v).toFixed(1);
      const lbl = v === 0 ? '±0' : (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
      return [
        `<text x="${PL - 5}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="var(--text-secondary,#868e96)">${lbl}</text>`,
        `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="var(--border-color,#dee2e6)" stroke-width="0.5" opacity="0.6"/>`,
      ].join('');
    }).join('');

    // X-axis labels (sample to avoid crowding)
    const step = n > 20 ? 5 : n > 10 ? 2 : 1;
    const xAxisSvg = days
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % step === 0 || i === n - 1)
      .map(({ d, i }) => {
        const x = xOf(i).toFixed(1);
        const dt = new Date(d.date + 'T12:00:00');
        const lbl = n > 10
          ? dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : dt.toLocaleDateString(undefined, { weekday: 'short' });
        return `<text x="${x}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--text-secondary,#868e96)">${lbl}</text>`;
      }).join('');

    // Data point circles
    const dotsSvg = coords.map(([cx, cy], i) => {
      const b = balances[i];
      const color = b >= 0 ? '#f03e3e' : '#339af0';
      const sign = b >= 0 ? '+' : '';
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"><title>${days[i].date}: ${sign}${b} kcal (${b >= 0 ? 'surplus' : 'deficit'})</title></circle>`;
    }).join('');

    return `
      <div class="nt-trend-chart">
        <div class="trend-legend">
          <span class="legend-item"><span class="legend-dot" style="background:#f03e3e"></span>Surplus</span>
          <span class="legend-item"><span class="legend-dot" style="background:#339af0"></span>Deficit</span>
          <span class="trend-target-label">Target: ${target} kcal/day</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="clip-above-${uid}"><rect x="${PL}" y="${PT}" width="${chartW}" height="${(yZero - PT).toFixed(1)}"/></clipPath>
            <clipPath id="clip-below-${uid}"><rect x="${PL}" y="${yZero.toFixed(1)}" width="${chartW}" height="${(H - PB - yZero).toFixed(1)}"/></clipPath>
          </defs>
          ${yAxisSvg}
          <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${H - PB}" stroke="var(--border-color,#dee2e6)" stroke-width="1"/>
          <line x1="${PL}" y1="${H - PB}" x2="${W - PR}" y2="${H - PB}" stroke="var(--border-color,#dee2e6)" stroke-width="1"/>
          <polygon points="${polyPoints}" fill="#f03e3e" fill-opacity="0.13" clip-path="url(#clip-above-${uid})"/>
          <polygon points="${polyPoints}" fill="#339af0" fill-opacity="0.13" clip-path="url(#clip-below-${uid})"/>
          <line x1="${PL}" y1="${yZero.toFixed(1)}" x2="${W - PR}" y2="${yZero.toFixed(1)}" stroke="var(--text-secondary,#868e96)" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.75"/>
          <polyline points="${linePoints}" fill="none" stroke="var(--color-primary,#339af0)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
          ${dotsSvg}
          ${xAxisSvg}
        </svg>
      </div>
    `;
  }

  attachListeners() {
    // Tab switching
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode;
        this.load();
      });
    });

    // Date change
    this.container.querySelector('#nt-date')?.addEventListener('change', (e) => {
      this.selectedDate = e.target.value;
      this.load();
    });

    // Log food
    this.container.querySelector('#nt-log-btn')?.addEventListener('click', () => this.showLogDialog());
  }

  showLogDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h3>Log Food</h3><button class="btn-close" id="close-log-modal">&times;</button></div>
        <div class="modal-body">
          <form id="log-food-form">
            <label>Description<input type="text" name="description" required placeholder="e.g. Chicken breast with rice"></label>
            <label>Meal Type
              <select name="mealType">
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </label>
            <div class="form-row">
              <label>Calories (kcal)<input type="number" name="calories" placeholder="Required" required min="0"></label>
              <label>Protein (g)<input type="number" name="protein" placeholder="0" min="0"></label>
              <label>Carbs (g)<input type="number" name="carbs" placeholder="0" min="0"></label>
              <label>Fats (g)<input type="number" name="fats" placeholder="0" min="0"></label>
            </div>
            <div class="form-row">
              <label>Date<input type="date" name="date" value="${this.selectedDate}"></label>
              <label>Time<input type="time" name="time" value="${new Date().toTimeString().slice(0, 5)}"></label>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="log-cancel">Cancel</button>
          <button class="btn-primary" id="log-submit">Log</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('show'), 10);

    dialog.querySelector('#close-log-modal')?.addEventListener('click', () => dialog.remove());
    dialog.querySelector('#log-cancel')?.addEventListener('click', () => dialog.remove());
    dialog.querySelector('#log-submit')?.addEventListener('click', async () => {
      const fd = new FormData(dialog.querySelector('#log-food-form'));
      const calories = Number(fd.get('calories'));
      if (!fd.get('date') || !calories) {
        showToast('Date and calories are required', 'error');
        return;
      }
      dialog.remove();
      try {
        const dateVal = fd.get('date');
        const timeVal = fd.get('time');
        const dateTime = dateVal && timeVal ? `${dateVal}T${timeVal}:00` : dateVal;
        await this.api.logNutrition({
          description: fd.get('description'),
          mealType: fd.get('mealType'),
          date: dateTime,
          calories,
          protein: fd.get('protein') ? Number(fd.get('protein')) : 0,
          carbs: fd.get('carbs') ? Number(fd.get('carbs')) : 0,
          fats: fd.get('fats') ? Number(fd.get('fats')) : 0,
        });
        showToast('Food logged!', 'success');
        await this.load();
      } catch {
        showToast('Failed to log food', 'error');
      }
    });
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
}
