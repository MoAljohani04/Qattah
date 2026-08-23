/**
 * QATTAH — Analytics Page
 * Uses Chart.js (loaded via CDN in index.html)
 */

Pages.analytics = async function() {
  showLoading();
  try {
    const data = await Api.analytics.get();

    setContent(`
      <div class="page-content fade-in">
        <div class="page-title-bar">
          <div><h2>Analytics</h2><p>${data.year} overview</p></div>
          <div style="font-size:1.25rem;font-weight:900;color:var(--primary)">${fmtCurrency(data.year_total)}</div>
        </div>

        <div class="analytics-wrap">

          <!-- Monthly chart -->
          <div class="chart-card">
            <div class="chart-card-title">📊 Monthly Spending</div>
            <div class="chart-container" style="height:180px">
              <canvas id="monthly-chart"></canvas>
            </div>
          </div>

          <!-- Category breakdown -->
          <div class="chart-card">
            <div class="chart-card-title">🏷️ By Category</div>
            <canvas id="donut-chart" style="max-height:200px;margin:0 auto;display:block"></canvas>
          </div>

          <!-- Category bars -->
          <div class="chart-card">
            <div class="chart-card-title">📈 Spending Breakdown</div>
            <div class="cat-bars" id="cat-bars">
              ${renderCategoryBars(data.by_category, data.year_total)}
            </div>
          </div>

          <!-- Top bills -->
          ${data.top_bills.length ? `
          <div class="chart-card">
            <div class="chart-card-title">💸 Top Expenses</div>
            <div class="bills-list" style="padding:0">
              ${data.top_bills.map(b => `
                <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--divider)">
                  <span style="font-size:1.25rem">${b.icon||'📦'}</span>
                  <div style="flex:1">
                    <div style="font-size:.875rem;font-weight:600">${b.title}</div>
                    <div style="font-size:.75rem;color:var(--text-muted)">${fmtDate(b.bill_date)}</div>
                  </div>
                  <div style="font-weight:800;color:var(--text)">${fmtCurrency(b.amount)}</div>
                </div>`).join('')}
            </div>
          </div>` : ''}

        </div>
      </div>
    `);

    // Draw charts after DOM is ready
    requestAnimationFrame(() => drawCharts(data));

  } catch(e) {
    setContent(`<div class="empty-state"><div class="empty-emoji">📊</div><h3>No data yet</h3><p>Add bills to see your analytics</p></div>`);
  }
};

function renderCategoryBars(categories, total) {
  if (!categories?.length) return '<p style="color:var(--text-muted);font-size:.875rem">No data yet</p>';
  return categories.map(c => {
    const pct = total > 0 ? ((c.total / total) * 100).toFixed(1) : 0;
    return `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span class="cat-bar-name">${c.icon||''} ${State.lang==='ar'?c.name_ar:c.name_en}</span>
          <span class="cat-bar-amt">${fmtCurrency(c.total)} <span style="color:var(--text-light);font-weight:400">(${pct}%)</span></span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${c.color||'var(--primary)'}"></div>
        </div>
      </div>`;
  }).join('');
}

function drawCharts(data) {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.font.family = "inherit";
  Chart.defaults.color       = getComputedStyle(document.documentElement)
                                  .getPropertyValue('--text-muted').trim();

  // ── Monthly bar chart ─────────────────────────────────────
  const monthlyCtx = document.getElementById('monthly-chart');
  if (monthlyCtx && data.monthly?.length) {
    new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: data.monthly.map(m => {
          const d = new Date(m.month + '-01');
          return d.toLocaleDateString('en-US', { month:'short' });
        }),
        datasets: [{
          label: 'Spent',
          data: data.monthly.map(m => parseFloat(m.total)),
          backgroundColor: 'rgba(16,185,129,.8)',
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: {
            grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false },
            ticks: { callback: v => `SAR ${(v/1000).toFixed(0)}k` }
          }
        }
      }
    });
  }

  // ── Donut chart ───────────────────────────────────────────
  const donutCtx = document.getElementById('donut-chart');
  if (donutCtx && data.by_category?.length) {
    new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: data.by_category.map(c => (State.lang==='ar'?c.name_ar:c.name_en)),
        datasets: [{
          data:            data.by_category.map(c => parseFloat(c.total)),
          backgroundColor: data.by_category.map(c => c.color || '#10B981'),
          borderWidth: 2,
          borderColor: 'var(--bg-card)',
        }]
      },
      options: {
        responsive: true, cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' }
          }
        }
      }
    });
  }
}
