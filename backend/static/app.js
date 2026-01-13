// ================= Unified API Client =================
// Provides structured wrappers for backend endpoints for new Figma UI integration.
const API = (() => {
  async function get(url) {
    const r = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); } catch (e) { throw new Error(`Bad JSON from ${url}: ${t.slice(0,200)}`); }
    if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body || {}) });
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); } catch (e) { throw new Error(`Bad JSON from ${url}: ${t.slice(0,200)}`); }
    if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }
  return {
    // Basic predictor (momentum derived)
    getPredictBasic: (ticker) => get(`/api/v1/predict?ticker=${encodeURIComponent(ticker)}`),
    // Research predictor (walk-forward XGB)
    getPredictResearch: (ticker, start = '2015-01-01', horizon = '1d') => get(`/api/research/predict?ticker=${encodeURIComponent(ticker)}&start=${encodeURIComponent(start)}&horizon=${encodeURIComponent(horizon)}`),
    // Model backtest
    runModelBacktest: (payload) => post('/api/model/backtest', payload),
    // Hyperparameter sweep / experiment
    runExperiment: (payload) => post('/api/experiment/run', payload),
    // Standard walk-forward run + diagnostics
    runResearch: (payload) => post('/api/run', payload),
    // Factors preview + PCA
    getFactors: (payload) => post('/api/factors', payload),
    // Risk metrics
    getRisk: (payload) => post('/api/risk', payload),
    // Signal decay
    getDecay: (payload) => post('/api/decay', payload),
    // Quantiles
    getQuantiles: (payload) => post('/api/quantiles', payload),
    // Portfolio backtest (raw engine)
    runPortfolio: (payload) => post('/api/portfolio/backtest', payload),
    // Report (aggregated portfolio analytics)
    getReport: (payload) => post('/api/report', payload),
    // Fama-French exposure
    getFFExposure: (payload) => post('/api/ff_exposure', payload),
    // Sentiment
    analyzeSentiment: (ticker) => get(`/analyze?ticker=${encodeURIComponent(ticker)}`),
    // Simple backtest
    runSimpleBacktest: (ticker, period='2y') => get(`/api/backtest/?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}`)
  };
})();
window.API = API;

// ---- Sentiment page ----
const sentimentForm = document.getElementById("sentiment-form");
if (sentimentForm) {
  sentimentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const elOut = document.getElementById("sentiment-output");
    showInlineLoading(elOut);
    const ticker = document.getElementById("sentiment-ticker").value.trim() || "TSLA";
    try {
      const j = await API.analyzeSentiment(ticker);
      elOut.textContent = JSON.stringify(j, null, 2);
    } catch (err) {
      showInlineError(elOut, err.message || String(err));
    }
  });
}

// ---- Predictor page ----
const predictForm = document.getElementById("predict-form");
if (predictForm) {
  predictForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ticker = document.getElementById("predict-ticker").value.trim() || "TSLA";
    const source = document.getElementById("predict-source").value;
    const horizon = document.getElementById("predict-horizon").value;
    document.getElementById("predict-hz-label").textContent = horizon;
    const card = document.getElementById("predict-card");
    const nameEl = document.getElementById("predict-name");
    const dateEl = document.getElementById("predict-date");
    const probEl = document.getElementById("predict-prob");
    const featsEl = document.getElementById("predict-feats");
    card.classList.add("d-none");
    showInlineLoading(probEl);
    try {
      const j = source === 'research'
        ? await API.getPredictResearch(ticker, '2015-01-01', horizon)
        : await API.getPredictBasic(ticker);
      nameEl.textContent = j.ticker || ticker;
      dateEl.textContent = j.as_of || '—';
      const p = (j.prob_up != null) ? j.prob_up : (j.prob_up_1d || j.prob_up_5d || j.prob_up_20d);
      probEl.textContent = (p != null) ? (p * 100).toFixed(2) + "%" : "—";
      featsEl.textContent = JSON.stringify(j.features || {}, null, 2);
      card.classList.remove("d-none");
    } catch (err) {
      showInlineError(probEl, err.message || String(err));
      card.classList.remove("d-none");
    }
  });
}

// ---- Backtest page ----
const backtestForm = document.getElementById("backtest-form");
let chart;
if (backtestForm) {
  backtestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ticker = document.getElementById("backtest-ticker").value.trim() || "TSLA";
    const period = document.getElementById("backtest-period").value;
    const box = document.getElementById("backtest-results");
    const cagr = document.getElementById("m-cagr");
    const sharpe = document.getElementById("m-sharpe");
    const dd = document.getElementById("m-dd");
    box.classList.add("d-none");
    const url = `/api/backtest/?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}`; // legacy endpoint
    let resp, text;
    try {
      resp = await fetch(url);
      text = await resp.text();
    } catch (err) {
      console.error("[BT] Network/Fetch error:", err);
      alert(`Request failed: ${err}`);
      return;
    }
    if (!resp.ok) {
      console.error("[BT] Non-OK response:", text.slice(0, 300));
      alert(`Error ${resp.status}: ${text.slice(0, 180)}`);
      return;
    }
    let j;
    try { j = JSON.parse(text); } catch (err) {
      console.error("[BT] JSON parse error. Raw:", text.slice(0, 300));
      alert("Server did not return JSON.");
      return;
    }
    if (j.error) {
      console.error("[BT] API error:", j.error);
      alert(j.error);
      return;
    }
    cagr.textContent   = (j.metrics.CAGR * 100).toFixed(2) + "%";
    sharpe.textContent = j.metrics.Sharpe.toFixed(2);
    dd.textContent     = (j.metrics.MaxDD * 100).toFixed(2) + "%";
    const labels  = j.series.dates;
    const equity  = j.series.equity;
    const buyhold = j.series.buy_hold;
    const ctx = document.getElementById("equity-chart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Strategy",   data: equity,  borderWidth: 2, fill: false },
          { label: "Buy & Hold", data: buyhold, borderWidth: 2, fill: false }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: { y: { beginAtZero: false } }
      }
    });
    box.classList.remove("d-none");
  });
}

// ===================== Shared UI Helpers =====================
function showGlobalLoading() {
  const el = document.getElementById('global-spinner');
  if (el) el.style.display = 'flex';
}
function hideGlobalLoading() {
  const el = document.getElementById('global-spinner');
  if (el) el.style.display = 'none';
}
function toast(msg, type='info', timeout=4000) {
  const cont = document.getElementById('toast-container');
  if (!cont) return;
  const id = 't' + Date.now();
  const div = document.createElement('div');
  div.className = `toast align-items-center text-bg-${type} border-0 show mb-2`;
  div.setAttribute('role','alert');
  div.id = id;
  div.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  cont.appendChild(div);
  setTimeout(()=>{ if(div.parentNode) div.parentNode.removeChild(div); }, timeout);
}
function showInlineLoading(el) {
  if (!el) return; el.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading…';
}
function showInlineError(el, msg) {
  if (!el) return; el.innerHTML = `<span class="text-danger">${msg}</span>`;
}
function showChartLoading(id){
  const el=document.getElementById(id); if(el){ el.innerHTML='<div class="d-flex justify-content-center align-items-center w-100 h-100"><div class="spinner-border text-secondary"></div></div>'; }
}

// ===================== Research (Portfolio Module) =====================
(function() {
  const PF_COLORS = [
    "#6EA8FE", "#75B798", "#F7C948", "#E98B8B", "#B197FC",
    "#4DD0E1", "#FFB86B", "#94D2BD", "#F28482", "#A6A4E6"
  ];
  const PF_BG = "#0F172A";
  const PF_GRID = "rgba(148,163,184,0.12)";
  const PF_TEXT = "#E2E8F0";

  const pfLayout = (title = "", height = 320) => ({
    title: { text: title, font: { color: PF_TEXT, size: 14 } },
    paper_bgcolor: PF_BG,
    plot_bgcolor: PF_BG,
    height,
    margin: { l: 50, r: 20, t: 40, b: 40 },
    xaxis: { gridcolor: PF_GRID, tickfont: { color: PF_TEXT } },
    yaxis: { gridcolor: PF_GRID, tickfont: { color: PF_TEXT } },
    showlegend: true,
    legend: { font: { color: PF_TEXT } }
  });

  function fmt(v) {
    if (v == null || Number.isNaN(v)) return "—";
    if (Math.abs(v) < 1) return (v * 100).toFixed(2) + "%";
    return Number(v).toFixed(2);
  }

  function fmtPct(v) {
    if (v == null || Number.isNaN(v)) return "—";
    return (Number(v) * 100).toFixed(2) + "%";
  }
  
  function fmtNum(v, digits = 2) {
    if (v == null || Number.isNaN(v)) return "—";
    return Number(v).toFixed(digits);
  }

  async function postJSON(url, body) {
    console.log("[POST] URL:", url);
    console.log("[POST] Body:", body);
    try {
      const fetchWithTimeout = (url, options, timeout = 180000) => {
        console.log("[FETCH] Starting fetch to:", url);
        return Promise.race([
          fetch(url, options),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout - server took longer than 3 minutes')), timeout)
          )
        ]);
      };

      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        mode: "same-origin",
        cache: "no-cache"
      });
      const text = await res.text();
      console.log("[POST] Response text (first 500 chars):", text.slice(0, 500));
      if (!res.ok) {
        console.error(`[POST] ${url} -> ${res.status}`, text.slice(0, 500));
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      try { 
        const cleanedText = text.replace(/:\s*NaN/g, ': null');
        return JSON.parse(cleanedText); 
      } catch (e) {
        console.error(`[POST] JSON parse fail for ${url}. Raw:`, text.slice(0, 500));
        throw new Error("Server did not return JSON.");
      }
    } catch (err) {
      console.error("[POST] fetch error:", err);
      throw err;
    }
  }

  const PF = {
    initialized: false,

    init() {
      console.log("[PF] init() called");
      const btn = document.getElementById("pf-run");
      
      if (!btn) {
        console.log("[PF] pf-run button not found");
        return;
      }

      if (this.initialized) {
        console.log("[PF] Already initialized");
        return;
      }

      console.log("[PF] Binding click handler");
      btn.addEventListener("click", () => {
        console.log("[PF] Run button clicked!");
        PF.run();
      });
      
      this.initialized = true;
      console.log("[PF] Initialization complete");
    },

    async run() {
      console.log("[PF] run() started");

      const btn = document.getElementById("pf-run");
      const originalText = btn.textContent;
      btn.textContent = "Loading…";
      btn.disabled = true;

      document.getElementById("pf-metrics").innerHTML =
        '<div class="text-muted">Loading report…</div>';

      try {
        const tickers = (document.getElementById("pf-tickers").value || "")
          .split(",").map(s => s.trim()).filter(Boolean);
        const start     = document.getElementById("pf-start").value || "2015-01-01";
        const signal    = document.getElementById("pf-signal").value || "prob_up_1d";
        const allocator = document.getElementById("pf-allocator").value || "equal_weight";
        const rebalance = document.getElementById("pf-rebalance").value || "weekly";
        const cost_bps  = Number(document.getElementById("pf-cost").value || 5);

        const body = { tickers, start, signal, allocator, rebalance, cost_bps, benchmark: "SPY" };
        const R = await API.getReport(body);
        console.log("[PF] /api/report payload:", R);

        // ---------- Metrics card ----------
        const M  = (R.performance && R.performance.summary) || {};
        const ab = M.alpha_beta || {};
        document.getElementById("pf-metrics").innerHTML = `
          <ul class="list-unstyled mb-0">
            <li><strong>CAGR:</strong> ${fmtPct(M.cagr)}</li>
            <li><strong>Sharpe:</strong> ${fmtNum(M.sharpe)}</li>
            <li><strong>Sortino:</strong> ${fmtNum(M.sortino)}</li>
            <li><strong>Info Ratio:</strong> ${fmtNum(M.information_ratio)}</li>
            <li><strong>Alpha (ann):</strong> ${fmtPct(ab.alpha)}</li>
            <li><strong>Beta:</strong> ${fmtNum(ab.beta)}</li>
            <li><strong>MaxDD:</strong> ${fmtPct(M.max_drawdown)}</li>
          </ul>
        `;

        // ---------- Equity vs Benchmark ----------
        const eq = (R.performance && R.performance.equity) || [];
        if (eq.length) {
          const x  = eq.map(d => d.date);
          const ys = eq.map(d => d.equity);
          const yb = eq.map(d => d.bench_equity);
          Plotly.newPlot("pf-equity", [
            { x, y: ys, mode: "lines", name: "Strategy", line: { width: 2, color: PF_COLORS[0] } },
            { x, y: yb, mode: "lines", name: R.config?.benchmark || "Benchmark", line: { width: 2, color: PF_COLORS[3], dash: "dot" } }
          ], pfLayout("", 360), { displayModeBar: false });
        } else {
          Plotly.purge("pf-equity");
          document.getElementById("pf-equity").innerHTML =
            "<div class='text-muted small'>No equity series returned.</div>";
        }

        // ---------- Rolling Sharpe / Vol / Drawdown ----------
        const rs  = (R.rolling && R.rolling.sharpe)   || [];
        const rv  = (R.rolling && R.rolling.vol)      || [];
        const rdd = (R.rolling && R.rolling.drawdown) || [];
        const toTrace = (arr, name) => ({
          x: arr.map(d => d.date),
          y: arr.map(d => d.value),
          mode: "lines", name
        });

        if (rs.length) {
          Plotly.newPlot("pf-roll-sharpe", [toTrace(rs, "Rolling Sharpe (63d)")],
            { ...pfLayout("", 280) }, { displayModeBar: false });
        } else { Plotly.purge("pf-roll-sharpe"); }

        if (rv.length) {
          Plotly.newPlot("pf-roll-vol", [toTrace(rv, "Rolling Vol (ann., 63d)")],
            { ...pfLayout("", 280), yaxis: { tickformat: ".1%", gridcolor: "rgba(148,163,184,0.12)", tickfont: { color: PF_TEXT } } },
            { displayModeBar: false });
        } else { Plotly.purge("pf-roll-vol"); }

        if (rdd.length) {
          Plotly.newPlot("pf-roll-dd", [toTrace(rdd, "Drawdown")],
            { ...pfLayout("", 280), yaxis: { tickformat: ".1%", rangemode: "tozero" } },
            { displayModeBar: false });
        } else { Plotly.purge("pf-roll-dd"); }

        // ---------- Attribution ----------
        PF.renderAttribBar(R);
        PF.renderAttribStack(R);

        // ---------- Weights heatmap ----------
        const weights = R.weights || null;
        if (weights && Object.keys(weights).length) {
          const dates = Object.keys(weights).sort();
          const tickersAll = [...new Set(Object.values(weights).flatMap(o => Object.keys(o)))];
          const z = dates.map(d => tickersAll.map(t => (weights[d]?.[t] ?? 0)));
          Plotly.newPlot("pf-weights", [{
            z, x: tickersAll, y: dates, type: "heatmap", colorscale: "Blues", showscale: true,
            hovertemplate: '%{y}<br>%{x}: %{z:.1%}<extra></extra>'
          }], pfLayout("", 420), { displayModeBar: false });
        } else {
          Plotly.purge("pf-weights");
          document.getElementById("pf-weights").innerHTML =
            "<div class='text-muted small'>No weights returned in report.</div>";
        }

        // ---------- FF exposures (FIXED) + Optional Analytics ----------
        const ff = (R.exposures && R.exposures.factors) || null;
        const showDecay = document.getElementById('pf-show-decay')?.checked;
        const showQuant = document.getElementById('pf-show-quant')?.checked;
        const showFactors = document.getElementById('pf-show-factors')?.checked;
        const showRisk = document.getElementById('pf-show-risk')?.checked;
        const extrasWrap = document.getElementById('pf-extras');
        if (extrasWrap) extrasWrap.style.display = (showDecay || showQuant) ? 'flex' : 'none';

        // Infer horizon from signal name
        let inferredHorizon = '1d';
        if (/prob_up_(\d+d)/.test(signal)) inferredHorizon = signal.match(/prob_up_(\d+d)/)[1];
        const primaryTicker = tickers[0];

        // Decay chart
        if (showDecay && primaryTicker){
          showChartLoading('pf-ic');
          try {
            const decayResp = await API.getDecay({ ticker: primaryTicker, start, horizon: inferredHorizon, horizons: [1,3,5,10,20] });
            PF.renderDecay(decayResp);
          } catch(e){ toast('Decay error: '+(e.message||e),'warning'); Plotly.purge('pf-ic'); }
        } else { Plotly.purge('pf-ic'); }

        // Quantiles chart
        if (showQuant && primaryTicker){
          showChartLoading('pf-qs');
          try {
            const quantResp = await API.getQuantiles({ ticker: primaryTicker, start, horizon: inferredHorizon, ret_horizon_days: 1, n_quantiles: 5 });
            PF.renderQuantiles(quantResp);
          } catch(e){ toast('Quantiles error: '+(e.message||e),'warning'); Plotly.purge('pf-qs'); }
        } else { Plotly.purge('pf-qs'); }

        // Factors preview
        if (showFactors && primaryTicker){
          const fBox = document.getElementById('pf-factors'); showInlineLoading(fBox);
          try {
            const wantPCA = document.getElementById('pf-show-pca')?.checked;
            const fResp = await API.getFactors({ ticker: primaryTicker, start, rows: 120, diagnostics: !!wantPCA });
            const cols = fResp.columns || [];
            const preview = fResp.factors_preview || {};
            const days = Object.keys(preview).sort();
            let html='<table class="table table-sm"><thead><tr><th>Date</th>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr></thead><tbody>';
            days.forEach(d=>{ html+='<tr><td>'+d+'</td>'+cols.map(c=>'<td>'+formatCell(preview[d][c])+'</td>').join('')+'</tr>'; });
            html+='</tbody></table>'; fBox.innerHTML=html;
            const pcaBox=document.getElementById('pf-pca');
            if (wantPCA && fResp.pca){
              const pc=fResp.pca || {}; const ev=pc.explained_variance || []; const comps=pc.components || [];
              let phtml='<div class="text-muted">PCA Explained Variance</div><ul class="mb-1">'+ev.map((v,i)=>`<li>PC${i+1}: ${(v*100).toFixed(2)}%</li>`).join('')+'</ul>';
              if (pc.top_loadings){
                phtml+='<div class="text-muted">Top Loadings</div><ul class="mb-0">'+pc.top_loadings.map(l=>`<li>${l.feature}: ${l.loading.toFixed(3)}</li>`).join('')+'</ul>';
              }
              pcaBox.innerHTML=phtml;
            } else if(pcaBox){ pcaBox.innerHTML=''; }
          } catch(e){ showInlineError(document.getElementById('pf-factors'), e.message||String(e)); }
        } else if(document.getElementById('pf-factors')) { document.getElementById('pf-factors').innerHTML='<div class="text-muted small">Toggle Load to fetch factors.</div>'; }

        // Single ticker risk
        if (showRisk && primaryTicker){
          showInlineLoading(document.getElementById('pf-risk-metrics'));
          showChartLoading('pf-risk-roll-sharpe');
          showChartLoading('pf-risk-roll-vol');
          try {
            const rResp = await API.getRisk({ ticker: primaryTicker, start, horizon: inferredHorizon, window:63 });
            const metrics = rResp.metrics || {};
            const rolling = rResp.rolling || {};
            document.getElementById('pf-risk-metrics').innerHTML=`<ul class="list-unstyled mb-0">
              <li><strong>Sharpe:</strong> ${fmtNum(metrics.Sharpe)}</li>
              <li><strong>Sortino:</strong> ${fmtNum(metrics.Sortino)}</li>
              <li><strong>IR:</strong> ${fmtNum(metrics.Information_Ratio)}</li>
              <li><strong>Alpha (ann):</strong> ${fmtPct(metrics.Alpha_annual)}</li>
              <li><strong>Beta:</strong> ${fmtNum(metrics.Beta)}</li>
              <li><strong>CAGR:</strong> ${fmtPct(metrics.CAGR)}</li>
              <li><strong>MaxDD:</strong> ${fmtPct(metrics.Max_Drawdown)}</li>
            </ul>`;
            const rsObj = rolling.rolling_sharpe || {}; const rsDates=Object.keys(rsObj); const rsVals=rsDates.map(d=>rsObj[d]);
            if (rsDates.length) Plotly.newPlot('pf-risk-roll-sharpe',[{x:rsDates,y:rsVals,mode:'lines',name:'Sharpe'}], pfLayout('',160), {displayModeBar:false});
            else document.getElementById('pf-risk-roll-sharpe').innerHTML='<div class="text-muted small">No rolling sharpe.</div>';
            const rvObj = rolling.rolling_vol || {}; const rvDates=Object.keys(rvObj); const rvVals=rvDates.map(d=>rvObj[d]);
            if (rvDates.length) Plotly.newPlot('pf-risk-roll-vol',[{x:rvDates,y:rvVals,mode:'lines',name:'Vol'}], pfLayout('',160), {displayModeBar:false});
            else document.getElementById('pf-risk-roll-vol').innerHTML='<div class="text-muted small">No rolling vol.</div>';
          } catch(e){ showInlineError(document.getElementById('pf-risk-metrics'), e.message||String(e)); }
        } else if(document.getElementById('pf-risk-metrics')) { document.getElementById('pf-risk-metrics').innerHTML='<div class="text-muted small">Toggle Load to fetch risk metrics.</div>'; }
        const wrapFF = document.getElementById("pf-ff");
        
        console.log("[PF] FF data received:", ff);
        
        if (ff && ff.betas && typeof ff.betas === "object" && Object.keys(ff.betas).length > 0) {
          const labels = Object.keys(ff.betas);
          const betas  = labels.map(k => ff.betas[k]);
          const tstats = ff.tstats || {};
          const tlabels = labels.map(k => {
            const t = tstats[k];
            return (t != null && Number.isFinite(t)) ? `t=${Number(t).toFixed(2)}` : "";
          });
          
          console.log("[PF] Plotting FF - labels:", labels, "betas:", betas);
          
          Plotly.newPlot("pf-ff", [{
            x: labels,
            y: betas,
            type: "bar",
            marker: { color: PF_COLORS[0] },
            text: tlabels,
            textposition: "outside",
            hovertemplate: '%{x}: %{y:.3f}<br>%{text}<extra></extra>'
          }], {
            title: { text: "Fama-French Factor Exposures", font: { color: PF_TEXT, size: 14 } },
            paper_bgcolor: PF_BG,
            plot_bgcolor: PF_BG,
            height: 320,
            margin: { l: 50, r: 20, t: 40, b: 40 },
            xaxis: { gridcolor: PF_GRID, tickfont: { color: PF_TEXT } },
            yaxis: { gridcolor: PF_GRID, tickfont: { color: PF_TEXT }, title: "Beta" },
          }, { displayModeBar: false });
        } else {
          console.log("[PF] No FF exposures or empty betas");
          wrapFF.innerHTML = "<div class='text-muted small'>No factor exposures available (may be insufficient date overlap)</div>";
        }

        console.log("[PF] run() completed successfully");
      } catch (err) {
        console.error("[PF] run() error:", err);
        toast(err.message || String(err), 'danger');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    },

    renderAttribBar(R) {
      try {
        const last6 = (R.attribution && R.attribution.last_6m) || [];
        if (!last6.length) {
          document.getElementById("pf-attr").innerHTML =
            "<div class='text-muted small'>No attribution available.</div>";
          return;
        }
        const labels = last6.map(x => x.ticker);
        const vals   = last6.map(x => x.contribution);

        Plotly.newPlot("pf-attr", [
          { x: labels, y: vals, type: "bar", name: "Σ w·r (6m)", marker: { color: PF_COLORS[1] } }
        ], pfLayout("", 300), { displayModeBar: false });
      } catch (e) {
        console.warn("[PF] renderAttribBar error:", e);
      }
    },

    renderAttribStack(R) {
      try {
        const per = (R.attribution && R.attribution.per_period) || [];
        if (!per.length) {
          Plotly.purge("pf-attr-pct");
          document.getElementById("pf-attr-pct").innerHTML =
            "<div class='text-muted small'>No per-period attribution available.</div>";
          return;
        }
        const dates = per.map(r => r.date);
        const cols  = Object.keys(per[0]).filter(k => k !== "date");
        const traces = cols.map((c, i) => ({
          x: dates,
          y: per.map(r => r[c] ?? 0),
          type: "scatter",
          mode: "lines",
          stackgroup: "one",
          name: c,
          line: { color: PF_COLORS[i % PF_COLORS.length] }
        }));
        Plotly.newPlot("pf-attr-pct", traces, {
          ...pfLayout("", 300),
          showlegend: true
        }, { displayModeBar: false });
      } catch (e) {
        console.warn("[PF] renderAttribStack error:", e);
      }
    },

    renderDecay(decay) {
      const icP = decay.ic_pearson || {};
      const icS = decay.ic_spearman || {};
      const horizons = decay.horizons || Object.keys(icP);
      const hLabels = horizons.map(h => String(h));
      const pVals = horizons.map(h => icP[h] ?? null);
      const sVals = horizons.map(h => icS[h] ?? null);
      const traces = [
        { x: hLabels, y: pVals, mode: 'lines+markers', name: 'IC Pearson' },
        { x: hLabels, y: sVals, mode: 'lines+markers', name: 'IC Spearman' }
      ];
      Plotly.newPlot('pf-ic', traces, pfLayout('', 300), { displayModeBar: false });
    },

    renderQuantiles(q) {
      const curve = q.long_short || q.long_short_equity_curve || {};
      const dates = Object.keys(curve).sort();
      const values = dates.map(d => curve[d]);
      if (!dates.length) {
        Plotly.purge('pf-qs');
        document.getElementById('pf-qs').innerHTML = '<div class="text-muted small">No long-short curve.</div>';
        return;
      }
      Plotly.newPlot('pf-qs', [ { x: dates, y: values, mode: 'lines', name: 'Q5−Q1', line: { width:2 } } ], pfLayout('', 300), { displayModeBar:false });
    }
  };

  window.PF = PF;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      console.log("[PF] DOMContentLoaded fired");
      PF.init();
    });
  } else {
    console.log("[PF] DOM already loaded, initializing immediately");
    PF.init();
  }
})();

// ===================== Experiment Page =====================
(function(){
  const form = document.getElementById('exp-form');
  if(!form) return; // not on experiment page

  const runBtn = document.getElementById('exp-run');
  const equityDiv = document.getElementById('exp-equity');
  const bestPre = document.getElementById('exp-best');
  const tableBody = document.querySelector('#exp-table tbody');
  const filterInput = document.getElementById('exp-filter');

  async function runSweep(){
    const ticker = document.getElementById('exp-ticker').value.trim() || 'AAPL';
    const start = document.getElementById('exp-start').value || '2015-01-01';
    const horizon = document.getElementById('exp-horizon').value || '1d';
    const train_window = parseInt(document.getElementById('exp-train').value||'750',10);
    const test_window = parseInt(document.getElementById('exp-test').value||'63',10);
    const persist = document.getElementById('exp-persist').checked;
    let param_grid = {};
    try { param_grid = JSON.parse(document.getElementById('exp-grid').value || '{}'); }
    catch(e){ toast('Param grid JSON invalid','danger'); return; }

    runBtn.disabled = true; runBtn.textContent='Running…'; showGlobalLoading();
    tableBody.innerHTML=''; bestPre.textContent=''; equityDiv.innerHTML='<div class="text-muted">Loading…</div>';
    try {
      const resp = await API.runExperiment({ ticker, start, horizon, train_window, test_window, param_grid, persist });
      // Best params
      bestPre.textContent = JSON.stringify(resp.best_params || {}, null, 2);
      // Equity curve
      const eqDict = resp.equity_curve || {}; const dates = Object.keys(eqDict).sort(); const vals = dates.map(d=>eqDict[d]);
      if(dates.length){ Plotly.newPlot('exp-equity',[{x:dates,y:vals,mode:'lines',name:'Equity',line:{width:2}}], {title:'',height:320,margin:{l:50,r:20,t:10,b:40}} , {displayModeBar:false}); }
      else { equityDiv.innerHTML='<div class="text-muted small">No equity curve.</div>'; }
      // Summary table
      const summary = resp.summary || []; renderTable(summary);
      toast('Experiment completed','success');
    } catch(e){ toast('Experiment failed: '+(e.message||e),'danger'); }
    finally { hideGlobalLoading(); runBtn.disabled=false; runBtn.textContent='Run'; }
  }

  function renderTable(rows){
    tableBody.innerHTML='';
    rows.forEach(r=>{
      const tr=document.createElement('tr');
      const paramsCell=document.createElement('td'); paramsCell.className='small'; paramsCell.textContent=JSON.stringify(r.params);
      const shCell=document.createElement('td'); shCell.textContent=Number.isFinite(r.sharpe)?r.sharpe.toFixed(2):'—';
      const irCell=document.createElement('td'); irCell.textContent=Number.isFinite(r.ir)?r.ir.toFixed(2):'—';
      tr.appendChild(paramsCell); tr.appendChild(shCell); tr.appendChild(irCell); tableBody.appendChild(tr);
    });
  }

  filterInput.addEventListener('input',()=>{
    const q=filterInput.value.trim().toLowerCase();
    Array.from(tableBody.querySelectorAll('tr')).forEach(tr=>{
      const txt=tr.firstChild.textContent.toLowerCase();
      tr.style.display = (!q || txt.includes(q)) ? '' : 'none';
    });
  });

  runBtn.addEventListener('click', runSweep);
})();

// ===== Utilities =====
function formatCell(v){ if(v==null) return '—'; const n=Number(v); if(!Number.isFinite(n)) return String(v); return n.toFixed(4); }

// ===== Form Persistence =====
(function persistForms(){
  const PFX='qs_';
  function save(id){ const el=document.getElementById(id); if(!el) return; localStorage.setItem(PFX+id, el.value); }
  function load(id){ const el=document.getElementById(id); const val=localStorage.getItem(PFX+id); if(el && val!=null) el.value=val; }
  const ids=[
    'predict-ticker','predict-source','predict-horizon',
    'pf-tickers','pf-start','pf-signal','pf-allocator','pf-rebalance','pf-cost',
    'exp-ticker','exp-start','exp-horizon','exp-train','exp-test','exp-grid'
  ];
  ids.forEach(load);
  ids.forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('change', ()=>save(id)); el.addEventListener('blur', ()=>save(id)); } });
})();

// ===== Save/Load/Clear Configurations =====
(function configProfiles(){
  const PFX='qs_';
  const KEY='qs_profiles';
  function gather(){
    return {
      predictor:{ ticker:val('predict-ticker'), source:val('predict-source'), horizon:val('predict-horizon') },
      portfolio:{ tickers:val('pf-tickers'), start:val('pf-start'), signal:val('pf-signal'), allocator:val('pf-allocator'), rebalance:val('pf-rebalance'), cost:val('pf-cost') },
      experiment:{ ticker:val('exp-ticker'), start:val('exp-start'), horizon:val('exp-horizon'), train:val('exp-train'), test:val('exp-test'), grid:val('exp-grid') }
    };
  }
  function apply(obj){ if(!obj) return;
    set('predict-ticker', obj.predictor?.ticker);
    set('predict-source', obj.predictor?.source);
    set('predict-horizon', obj.predictor?.horizon);
    set('pf-tickers', obj.portfolio?.tickers);
    set('pf-start', obj.portfolio?.start);
    set('pf-signal', obj.portfolio?.signal);
    set('pf-allocator', obj.portfolio?.allocator);
    set('pf-rebalance', obj.portfolio?.rebalance);
    set('pf-cost', obj.portfolio?.cost);
    set('exp-ticker', obj.experiment?.ticker);
    set('exp-start', obj.experiment?.start);
    set('exp-horizon', obj.experiment?.horizon);
    set('exp-train', obj.experiment?.train);
    set('exp-test', obj.experiment?.test);
    set('exp-grid', obj.experiment?.grid);
  }
  function val(id){ const el=document.getElementById(id); return el?el.value:''; }
  function set(id,v){ const el=document.getElementById(id); if(el && v!=null){ el.value=v; el.dispatchEvent(new Event('change')); } }
  function loadProfiles(){ try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch(_){ return {}; } }
  function saveProfiles(p){ localStorage.setItem(KEY, JSON.stringify(p)); }
  function promptName(){ return prompt('Profile name:'); }
  function chooseProfile(names){ return prompt('Enter profile name to load:\n'+names.join('\n')); }

  const saveEl=document.getElementById('nav-save-config');
  const loadEl=document.getElementById('nav-load-config');
  const clearEl=document.getElementById('nav-clear-configs');
  if(saveEl){ saveEl.addEventListener('click',()=>{
    const name=promptName(); if(!name) return; const profiles=loadProfiles(); profiles[name]=gather(); saveProfiles(profiles); toast('Saved profile '+name,'success');
  }); }
  if(loadEl){ loadEl.addEventListener('click',()=>{
    const profiles=loadProfiles(); const names=Object.keys(profiles); if(!names.length){ toast('No profiles saved','warning'); return; }
    const pick=chooseProfile(names); if(!pick || !profiles[pick]) return; apply(profiles[pick]); toast('Loaded profile '+pick,'info');
  }); }
  if(clearEl){ clearEl.addEventListener('click',()=>{
    if(!confirm('Clear all saved form values & profiles?')) return;
    Object.keys(localStorage).filter(k=>k.startsWith(PFX)).forEach(k=>localStorage.removeItem(k));
    localStorage.removeItem(KEY);
    toast('Cleared persisted forms','danger');
  }); }
})();

// ===== Debounce Portfolio Run =====
(function debouncePortfolio(){
  const btn=document.getElementById('pf-run'); if(!btn) return;
  let timeout=null; const origHandler=btn.onclick; // We attached via PF.init using addEventListener.
  btn.removeEventListener('click', PF.run); // remove previous direct binding if any
  btn.addEventListener('click', ()=>{
    if(timeout){ clearTimeout(timeout); }
    timeout=setTimeout(()=>{ PF.run(); }, 500); // 500ms debounce
  });
})();