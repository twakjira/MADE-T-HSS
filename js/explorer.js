(function () {
  "use strict";

  const FIELDS = [
    { key: "b",      label: "<i>b</i>",                                                    plain: "b",       unit: "mm",  axisHtml: "<i>b</i>",                                     axisLabel: "<i>b</i> (mm)",                                          step: 1,    min: 150, max: 610,  def: 397.04 },
    { key: "h",      label: "<i>h</i>",                                                    plain: "h",       unit: "mm",  axisHtml: "<i>h</i>",                                     axisLabel: "<i>h</i> (mm)",                                          step: 1,    min: 200, max: 610,  def: 420.27 },
    { key: "fc",     label: "<i>f</i>&#x2032;<sub>c</sub>",                                plain: "f′c",     unit: "MPa", axisHtml: "<i>f</i>′<sub>c</sub>",                        axisLabel: "<i>f</i>′<sub>c</sub> (MPa)",                            step: 0.1,  min: 20,  max: 130,  def: 52.03 },
    { key: "fyl",    label: "<i>f</i><sub>yl</sub>",                                       plain: "fyl",     unit: "MPa", axisHtml: "<i>f</i><sub>yl</sub>",                        axisLabel: "<i>f</i><sub>yl</sub> (MPa)",                            step: 1,    min: 390, max: 930,  def: 526.72 },
    { key: "fyt",    label: "<i>f</i><sub>yt</sub>",                                       plain: "fyt",     unit: "MPa", axisHtml: "<i>f</i><sub>yt</sub>",                        axisLabel: "<i>f</i><sub>yt</sub> (MPa)",                            step: 1,    min: 320, max: 1570, def: 637.96 },
    { key: "rho_sl", label: "&rho;<sub>sl</sub>",                                          plain: "ρₛₗ",   unit: "%",   axisHtml: "ρ<sub>sl</sub>",                               axisLabel: "ρ<sub>sl</sub> (%)",                                     step: 0.01, min: 0.5, max: 5.0,  def: 2.30 },
    { key: "rho_st", label: "&rho;<sub>st</sub>",                                          plain: "ρₛₜ",   unit: "%",   axisHtml: "ρ<sub>st</sub>",                               axisLabel: "ρ<sub>st</sub> (%)",                                     step: 0.01, min: 0.1, max: 4.0,  def: 1.26 },
    { key: "a_d",    label: "<i>a</i>/<i>d</i>",                                           plain: "a/d",     unit: "",    axisHtml: "<i>a</i>/<i>d</i>",                            axisLabel: "<i>a</i>/<i>d</i>",                                      step: 0.01, min: 1.5, max: 8.0,  def: 4.32 },
    { key: "ALR",    label: "<i>P</i>/(<i>A</i><sub>g</sub><i>f</i>&#x2032;<sub>c</sub>)", plain: "ALR",     unit: "",    axisHtml: "<i>P</i>/(<i>A</i><sub>g</sub><i>f</i>′<sub>c</sub>)", axisLabel: "ALR = <i>P</i>/(<i>A</i><sub>g</sub><i>f</i>′<sub>c</sub>)", step: 0.01, min: 0.0, max: 0.65, def: 0.23 },
  ];
  const RANGE_KEY = { a_d: "a_over_d" };
  const DEFAULT_X = "fyt";
  const DEFAULT_Y = "rho_st";

  function $(id) { return document.getElementById(id); }
  function fieldByKey(k) { return FIELDS.find(function (f) { return f.key === k; }); }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 2 : d); }
  function linspace(a, b, n) {
    if (n < 2) return [a];
    const out = new Array(n);
    const dx = (b - a) / (n - 1);
    for (let i = 0; i < n; i++) out[i] = a + i * dx;
    return out;
  }
  function dbRange(key) {
    const r = window.MADET && window.MADET.ranges();
    if (!r) return null;
    const rk = RANGE_KEY[key] || key;
    return r[rk] || null;
  }

  let lastGrid = null;

  function buildForm() {
    const form = $("explorer-form");
    form.innerHTML = "";
    for (const f of FIELDS) {
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.dataset.key = f.key;
      wrap.innerHTML =
        '<label class="field-label" for="ex-' + f.key + '">' +
          '<span>' + f.label + '</span>' +
          '<span class="field-unit">' + (f.unit || "&mdash;") + '</span>' +
        '</label>' +
        '<input class="field-input" id="ex-' + f.key + '" type="number" ' +
          'min="' + f.min + '" max="' + f.max + '" step="' + f.step +
          '" value="' + f.def + '" />';
      form.appendChild(wrap);
    }
  }

  function buildDropdowns() {
    const xSel = $("ex-x-var");
    const ySel = $("ex-y-var");
    xSel.innerHTML = "";
    ySel.innerHTML = "";
    for (const f of FIELDS) {
      const o1 = document.createElement("option");
      o1.value = f.key; o1.innerHTML = f.plain;
      xSel.appendChild(o1);
      const o2 = o1.cloneNode(true);
      ySel.appendChild(o2);
    }
    xSel.value = DEFAULT_X;
    ySel.value = DEFAULT_Y;
  }

  function fillSweepRange(axis) {
    const varSel = $("ex-" + axis + "-var");
    const key = varSel.value;
    const r = dbRange(key);
    const f = fieldByKey(key);
    const lo = r ? r[0] : f.min;
    const hi = r ? r[1] : f.max;
    $("ex-" + axis + "-min").value = fmt(lo, f.step < 1 ? 2 : 1);
    $("ex-" + axis + "-max").value = fmt(hi, f.step < 1 ? 2 : 1);
  }

  function refreshLocks() {
    const xKey = $("ex-x-var").value;
    const yKey = $("ex-y-var").value;
    for (const f of FIELDS) {
      const wrap = document.querySelector('#explorer-form .field[data-key="' + f.key + '"]');
      const locked = (f.key === xKey || f.key === yKey);
      wrap.classList.toggle("locked", locked);
      $("ex-" + f.key).disabled = locked;
    }
    validateSelection();
  }

  function validateSelection() {
    const box = $("ex-warning-box");
    const xKey = $("ex-x-var").value;
    const yKey = $("ex-y-var").value;
    if (xKey === yKey) {
      box.classList.remove("hidden");
      box.textContent = "X and Y axes are the same variable. Pick two distinct parameters to sweep.";
      $("ex-btn-generate").disabled = true;
      return false;
    }
    box.classList.add("hidden");
    box.textContent = "";
    $("ex-btn-generate").disabled = false;
    return true;
  }

  function readFixed() {
    const inp = {};
    for (const f of FIELDS) inp[f.key] = parseFloat($("ex-" + f.key).value);
    return inp;
  }

  function resetExplorer() {
    for (const f of FIELDS) $("ex-" + f.key).value = f.def;
    $("ex-x-var").value = DEFAULT_X;
    $("ex-y-var").value = DEFAULT_Y;
    $("ex-x-steps").value = 20;
    $("ex-y-steps").value = 20;
    fillSweepRange("x");
    fillSweepRange("y");
    refreshLocks();
    $("ex-results").classList.add("hidden");
    $("ex-progress").classList.add("hidden");
    $("ex-btn-csv").disabled = true;
    lastGrid = null;
  }

  function setProgress(done, total) {
    const pct = total > 0 ? (100 * done / total) : 0;
    $("ex-progress-bar").style.width = pct.toFixed(1) + "%";
    $("ex-progress-text").textContent =
      "Computing " + done + " / " + total + " grid points…";
  }

  async function generate() {
    if (!validateSelection()) return;

    const xKey = $("ex-x-var").value;
    const yKey = $("ex-y-var").value;
    const xF = fieldByKey(xKey);
    const yF = fieldByKey(yKey);

    const xMin = parseFloat($("ex-x-min").value);
    const xMax = parseFloat($("ex-x-max").value);
    const yMin = parseFloat($("ex-y-min").value);
    const yMax = parseFloat($("ex-y-max").value);
    const xN   = Math.max(2, Math.min(80, parseInt($("ex-x-steps").value, 10) || 20));
    const yN   = Math.max(2, Math.min(80, parseInt($("ex-y-steps").value, 10) || 20));

    if (!isFinite(xMin) || !isFinite(xMax) || !isFinite(yMin) || !isFinite(yMax) ||
        xMin >= xMax || yMin >= yMax) {
      const box = $("ex-warning-box");
      box.classList.remove("hidden");
      box.textContent = "Invalid sweep range: ensure min < max for both axes.";
      return;
    }

    const xs = linspace(xMin, xMax, xN);
    const ys = linspace(yMin, yMax, yN);
    const total = xN * yN;

    const fixed = readFixed();
    const genBtn = $("ex-btn-generate");
    const resetBtn = $("ex-btn-reset");
    const csvBtn = $("ex-btn-csv");
    genBtn.disabled = true; resetBtn.disabled = true; csvBtn.disabled = true;
    const origLabel = genBtn.textContent;
    genBtn.textContent = "Computing…";

    $("ex-progress").classList.remove("hidden");
    setProgress(0, total);

    const Zvu  = new Array(yN);
    const Zsig = new Array(yN);
    const Zale = new Array(yN);
    for (let j = 0; j < yN; j++) {
      Zvu[j]  = new Array(xN);
      Zsig[j] = new Array(xN);
      Zale[j] = new Array(xN);
    }

    let done = 0;
    try {
      for (let j = 0; j < yN; j++) {
        for (let i = 0; i < xN; i++) {
          const inp = Object.assign({}, fixed);
          inp[xKey] = xs[i];
          inp[yKey] = ys[j];
          const out = await window.MADET.predict(inp);
          Zvu[j][i]  = out.y_pred;
          Zsig[j][i] = out.sigma_epi_kN;
          Zale[j][i] = out.sigma_ale_kN;
          done++;
          if ((done & 7) === 0 || done === total) {
            setProgress(done, total);
            await new Promise(function (r) { requestAnimationFrame(r); });
          }
        }
      }
    } catch (e) {
      console.error("Sweep failed:", e);
      const box = $("ex-warning-box");
      box.classList.remove("hidden");
      box.textContent = "Sweep failed: " + (e.message || e);
      genBtn.disabled = false; resetBtn.disabled = false;
      genBtn.textContent = origLabel;
      return;
    }

    lastGrid = {
      xKey: xKey, yKey: yKey,
      xLabel: xF.axisLabel, yLabel: yF.axisLabel,
      xHtml:  xF.axisHtml,  yHtml:  yF.axisHtml,
      xPlain: xF.plain,     yPlain: yF.plain,
      xs: xs, ys: ys,
      Zvu: Zvu, Zsig: Zsig, Zale: Zale,
    };

    $("ex-results").classList.remove("hidden");
    $("ex-results").classList.add("fadein");
    $("ex-progress").classList.add("hidden");

    writeSummary(lastGrid);
    plotSurfaces(lastGrid);
    requestAnimationFrame(function () {
      Plotly.Plots.resize($("ex-plot-vu"));
      Plotly.Plots.resize($("ex-plot-sig"));
    });

    genBtn.disabled = false; resetBtn.disabled = false; csvBtn.disabled = false;
    genBtn.textContent = origLabel;
  }

  function plotSurfaces(g) {
    const commonLayout = {
      autosize: true,
      margin: { l: 70, r: 90, t: 50, b: 60 },
      font: { family: "Noto Sans, sans-serif", size: 12, color: "#1f2937" },
      paper_bgcolor: "#ffffff",
      plot_bgcolor:  "#ffffff",
      xaxis: { title: { text: g.xLabel }, zeroline: false, showgrid: true, gridcolor: "#eef2f7", automargin: true },
      yaxis: { title: { text: g.yLabel }, zeroline: false, showgrid: true, gridcolor: "#eef2f7", automargin: true },
    };
    const config = { responsive: true, displaylogo: false };

    const vuTrace = {
      x: g.xs, y: g.ys, z: g.Zvu,
      type: "contour",
      colorscale: "Viridis",
      contours: { coloring: "heatmap", showlabels: true, labelfont: { size: 10, color: "#ffffff" } },
      line: { width: 0.6, color: "rgba(255,255,255,0.55)" },
      colorbar: { title: { text: "<i>V</i><sub>u</sub> (kN)", side: "right" }, thickness: 14, len: 0.82 },
      hovertemplate:
        g.xHtml + " = %{x:.3g}<br>" +
        g.yHtml + " = %{y:.3g}<br>" +
        "<i>V</i><sub>u</sub> = %{z:.1f} kN<extra></extra>",
    };
    Plotly.react("ex-plot-vu", [vuTrace],
      Object.assign({}, commonLayout, { title: { text: "Predicted <i>V</i><sub>u</sub> (kN)" } }),
      config);

    const sigTrace = {
      x: g.xs, y: g.ys, z: g.Zsig,
      type: "contour",
      colorscale: "Oranges",
      contours: { coloring: "heatmap", showlabels: true, labelfont: { size: 10, color: "#4b2e00" } },
      line: { width: 0.6, color: "rgba(120,60,0,0.5)" },
      colorbar: { title: { text: "σ<sub>epi</sub> (kN)", side: "right" }, thickness: 14, len: 0.82 },
      hovertemplate:
        g.xHtml + " = %{x:.3g}<br>" +
        g.yHtml + " = %{y:.3g}<br>" +
        "σ<sub>epi</sub> = %{z:.2f} kN<extra></extra>",
    };
    Plotly.react("ex-plot-sig", [sigTrace],
      Object.assign({}, commonLayout, { title: { text: "Epistemic uncertainty σ<sub>epi</sub> (kN)" } }),
      config);
  }

  function writeSummary(g) {
    let vuMin = Infinity, vuMax = -Infinity;
    let sigSum = 0, sigMax = -Infinity, n = 0;
    for (let j = 0; j < g.ys.length; j++) {
      for (let i = 0; i < g.xs.length; i++) {
        const v = g.Zvu[j][i]; const s = g.Zsig[j][i];
        if (v < vuMin) vuMin = v;
        if (v > vuMax) vuMax = v;
        if (s > sigMax) sigMax = s;
        sigSum += s; n++;
      }
    }
    const sigMean = sigSum / Math.max(n, 1);
    const vuMeanGrid = (function () {
      let t = 0;
      for (let j = 0; j < g.ys.length; j++)
        for (let i = 0; i < g.xs.length; i++) t += g.Zvu[j][i];
      return t / Math.max(n, 1);
    }());
    const pct = (sigMax / Math.max(vuMeanGrid, 1e-6)) * 100;
    $("ex-summary").innerHTML =
      "V<sub>u</sub> range: " + fmt(vuMin, 1) + " to " + fmt(vuMax, 1) + " kN &nbsp;|&nbsp; " +
      "Mean σ<sub>epi</sub>: " + fmt(sigMean, 2) + " kN &nbsp;|&nbsp; " +
      "Max σ<sub>epi</sub>: " + fmt(sigMax, 2) + " kN (" + fmt(pct, 1) + "% of mean V<sub>u</sub>)";
  }

  function downloadCsv() {
    if (!lastGrid) return;
    const g = lastGrid;
    const rows = [[g.xPlain, g.yPlain, "V_u_pred_kN", "sigma_ale_kN", "sigma_epi_kN"]];
    for (let j = 0; j < g.ys.length; j++) {
      for (let i = 0; i < g.xs.length; i++) {
        rows.push([
          g.xs[i].toFixed(6),
          g.ys[j].toFixed(6),
          g.Zvu[j][i].toFixed(4),
          g.Zale[j][i].toFixed(4),
          g.Zsig[j][i].toFixed(4),
        ]);
      }
    }
    const csv = rows.map(function (r) { return r.join(","); }).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "made-t_explorer_" + g.xKey + "_vs_" + g.yKey + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function wireTabs() {
    const buttons = document.querySelectorAll(".tab-button");
    const panes = document.querySelectorAll(".tab-pane");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = btn.dataset.tab;
        buttons.forEach(function (b) {
          const on = b === btn;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        panes.forEach(function (p) {
          p.classList.toggle("active", p.id === "tab-" + target);
        });
        if (target === "explorer" && lastGrid) {
          requestAnimationFrame(function () {
            if (window.Plotly) {
              Plotly.Plots.resize($("ex-plot-vu"));
              Plotly.Plots.resize($("ex-plot-sig"));
            }
          });
        }
      });
    });
  }

  function handleAxisChange(axis) {
    fillSweepRange(axis);
    refreshLocks();
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireTabs();
    buildForm();
    buildDropdowns();
    fillSweepRange("x");
    fillSweepRange("y");
    refreshLocks();

    $("ex-x-var").addEventListener("change", function () { handleAxisChange("x"); });
    $("ex-y-var").addEventListener("change", function () { handleAxisChange("y"); });
    $("ex-btn-reset").addEventListener("click", resetExplorer);
    $("ex-btn-generate").addEventListener("click", generate);
    $("ex-btn-csv").addEventListener("click", downloadCsv);

    const enableWhenReady = setInterval(function () {
      const predictReady = $("btn-predict") && !$("btn-predict").disabled;
      if (predictReady) {
        $("ex-btn-generate").disabled = false;
        clearInterval(enableWhenReady);
      }
    }, 250);

    window.addEventListener("resize", function () {
      if (lastGrid && window.Plotly) {
        Plotly.Plots.resize($("ex-plot-vu"));
        Plotly.Plots.resize($("ex-plot-sig"));
      }
    });
  });
}());
