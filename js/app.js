(function () {
  "use strict";

  const FIELDS = [
    { key: "b",      label: "<i>b</i>",                                                     plain: "b",      unit: "mm",  min: 150, max: 610,  step: 1,    def: 400 },
    { key: "h",      label: "<i>h</i>",                                                     plain: "h",      unit: "mm",  min: 200, max: 610,  step: 1,    def: 410 },
    { key: "fc",     label: "<i>f</i>&#x2032;<sub>c</sub>",                                 plain: "f′c",    unit: "MPa", min: 20,  max: 130,  step: 0.1,  def: 58  },
    { key: "fyl",    label: "<i>f</i><sub>yl</sub>",                                        plain: "fyl",    unit: "MPa", min: 390, max: 930,  step: 1,    def: 535 },
    { key: "fyt",    label: "<i>f</i><sub>yt</sub>",                                        plain: "fyt",    unit: "MPa", min: 320, max: 1570, step: 1,    def: 795 },
    { key: "rho_sl", label: "&rho;<sub>sl</sub>",                                           plain: "ρₛₗ",  unit: "%",   min: 0.5, max: 5.0,  step: 0.01, def: 2.5 },
    { key: "rho_st", label: "&rho;<sub>st</sub>",                                           plain: "ρₛₜ",  unit: "%",   min: 0.1, max: 4.0,  step: 0.01, def: 1.2 },
    { key: "a_d",    label: "<i>a</i>/<i>d</i>",                                            plain: "a/d",    unit: "",    min: 1.5, max: 8.0,  step: 0.01, def: 4.0 },
    { key: "ALR",    label: "<i>P</i>/(<i>A</i><sub>g</sub><i>f</i>&#x2032;<sub>c</sub>)",  plain: "ALR",    unit: "",    min: 0.0, max: 0.65, step: 0.01, def: 0.24 },
  ];
  const RANGE_KEY = { a_d: "a_over_d" };

  function $(id) { return document.getElementById(id); }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 2 : d); }

  function buildForm() {
    const form = $("predictor-form");
    form.innerHTML = "";
    for (const f of FIELDS) {
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.dataset.key = f.key;
      wrap.innerHTML =
        '<label class="field-label" for="f-' + f.key + '">' +
          '<span>' + f.label + '</span>' +
          '<span class="field-unit">' + (f.unit || "&mdash;") + '</span>' +
        '</label>' +
        '<input class="field-input" id="f-' + f.key + '" type="number" ' +
          'min="' + f.min + '" max="' + f.max + '" step="' + f.step +
          '" value="' + f.def + '" />';
      form.appendChild(wrap);
      wrap.querySelector("input").addEventListener("input", flagExtrapolation);
    }
  }

  function readInputs() {
    const inp = {};
    for (const f of FIELDS) inp[f.key] = parseFloat($("f-" + f.key).value);
    return inp;
  }

  function flagExtrapolation() {
    const ranges = window.MADET && window.MADET.ranges();
    if (!ranges) return;
    const offenders = [];
    for (const f of FIELDS) {
      const wrap = document.querySelector('.field[data-key="' + f.key + '"]');
      const v = parseFloat($("f-" + f.key).value);
      const rk = RANGE_KEY[f.key] || f.key;
      const r = ranges[rk];
      if (!r) { wrap.classList.remove("warn"); continue; }
      const out = isFinite(v) && (v < r[0] || v > r[1]);
      wrap.classList.toggle("warn", out);
      if (out) offenders.push(
        f.plain + " = " + fmt(v) + " (database " + fmt(r[0]) + " to " + fmt(r[1]) + ")"
      );
    }
    const box = $("warning-box");
    if (offenders.length === 0) {
      box.classList.add("hidden");
      box.textContent = "";
    } else {
      box.classList.remove("hidden");
      box.textContent = "Extrapolation: " + offenders.length +
        " input(s) outside the 87-specimen database envelope. " +
        "Predictions in this region rely on the prior; epistemic uncertainty grows. " +
        "Offending: " + offenders.join("; ") + ".";
    }
  }

  function resetInputs() {
    for (const f of FIELDS) $("f-" + f.key).value = f.def;
    flagExtrapolation();
    $("results").classList.add("hidden");
  }

  async function onPredict() {
    const btn = $("btn-predict");
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = "Predicting...";
    try {
      const out = await window.MADET.predict(readInputs());
      $("r-vu").textContent      = fmt(out.y_pred,       1);
      $("r-pi-lo").textContent   = fmt(out.pi90_lo,      1);
      $("r-pi-hi").textContent   = fmt(out.pi90_hi,      1);
      $("r-sig-ale").textContent = fmt(out.sigma_ale_kN, 1);
      $("r-sig-epi").textContent = fmt(out.sigma_epi_kN, 1);
      $("r-sig-tot").textContent = fmt(out.sigma_tot_kN, 1);
      $("results").classList.remove("hidden");
      $("results").classList.add("fadein");
    } catch (e) {
      console.error("Prediction failed:", e);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  function bindCopyBibtex() {
    const btn = $("copy-bibtex");
    if (!btn) return;
    btn.addEventListener("click", async function () {
      const code = $("bibtex-code").textContent;
      try {
        await navigator.clipboard.writeText(code);
        btn.classList.add("copied");
        const old = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () { btn.classList.remove("copied"); btn.textContent = old; }, 1500);
      } catch (_) {}
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    buildForm();
    bindCopyBibtex();
    $("btn-reset").addEventListener("click", resetInputs);
    $("btn-predict").addEventListener("click", onPredict);

    try {
      await window.MADET.load();
      $("btn-predict").disabled = false;
      flagExtrapolation();
    } catch (e) {
      console.error("Model load failed:", e);
    }
  });
}());
