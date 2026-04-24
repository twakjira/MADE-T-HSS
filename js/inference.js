(function (global) {
  "use strict";

  const MODEL_DIR = "model/";
  const N_MEMBERS_DEFAULT = 10;

  let scaler = null;
  let sessions = [];

  function clip(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function safeSqrt(x)     { return Math.sqrt(Math.max(x, 1e-3)); }

  function vuSezenMoehle(b, h, fc, fyt, rho_st_pct, ALR) {
    const d = 0.8 * h;
    const Ag = b * h;
    const rho = rho_st_pct / 100.0;
    const P = ALR * Ag * fc;
    const sq = safeSqrt(fc);
    const Vc = 0.5 * sq * b * d * Math.sqrt(1.0 + P / (0.5 * sq * Ag + 1e-6));
    const Vs = rho * fyt * b * d;
    return (Vc + Vs) * 1e-3;
  }

  function vuACI318(b, h, fc, fyt, rho_st_pct, ALR) {
    const d = 0.8 * h;
    const rho = rho_st_pct / 100.0;
    const lam_n = 1.0 + ALR;
    const fyt_eff = Math.min(fyt, 690.0);
    const Vc = 0.17 * safeSqrt(fc) * b * d * lam_n;
    const Vs = rho * fyt_eff * b * d;
    return (Vc + Vs) * 1e-3;
  }

  function vuPriestley(b, h, fc, fyt, rho_sl_pct, rho_st_pct, a_d, ALR) {
    const d = 0.8 * h;
    const Ag = b * h;
    const rho_sl = rho_sl_pct / 100.0;
    const rho_st = rho_st_pct / 100.0;
    const alpha = clip(3.0 - a_d, 1.0, 1.5);
    const beta  = clip(0.5 + 20.0 * rho_sl, 0.5, 1.0);
    const Vc = alpha * beta * 0.29 * safeSqrt(fc) * 0.8 * Ag;
    const Vs = rho_st * fyt * b * d;
    const Vp = 0.1 * ALR * Ag * fc;
    return (Vc + Vs + Vp) * 1e-3;
  }

  function duBerryEberhard(rho_st_pct, ALR, a_d) {
    const rho_eff = rho_st_pct / 100.0;
    const db_over_D = 1.0 / 20.0;
    const theta = 3.25 * (1.0 + 150.0 * rho_eff * db_over_D)
                       * (1.0 - ALR) * (1.0 - a_d / 10.0);
    return clip(theta, 0.3, 10.0);
  }

  function duHaselton(rho_st_pct, fc, ALR) {
    const rho_sh = Math.max(rho_st_pct / 100.0, 1e-3);
    const theta = 0.12 * 1.55 * Math.pow(0.16, ALR)
                       * Math.pow(0.02 + 40.0 * rho_sh, 0.43)
                       * Math.pow(0.54, 0.01 * fc) * 100.0;
    return clip(theta, 0.3, 10.0);
  }

  function buildFeatureVector(inp) {
    const { b, h, fc, fyl, fyt, rho_sl, rho_st, a_d, ALR } = inp;
    const conf_index   = rho_st * fyt / fc;
    const Vu_sezen     = vuSezenMoehle(b, h, fc, fyt, rho_st, ALR);
    const Vu_aci       = vuACI318(b, h, fc, fyt, rho_st, ALR);
    const Vu_priestley = vuPriestley(b, h, fc, fyt, rho_sl, rho_st, a_d, ALR);
    const du_be        = duBerryEberhard(rho_st, ALR, a_d);
    const du_haselton  = duHaselton(rho_st, fc, ALR);
    return [b, h, fc, fyl, fyt, rho_sl, rho_st, a_d, ALR,
            conf_index, Vu_sezen, Vu_aci, Vu_priestley, du_be, du_haselton];
  }

  async function load(opts) {
    opts = opts || {};
    const nMembers = opts.nMembers || N_MEMBERS_DEFAULT;

    const scalerResp = await fetch(MODEL_DIR + "scaler.json");
    if (!scalerResp.ok) throw new Error("scaler.json not found");
    scaler = await scalerResp.json();

    if (typeof ort === "undefined") {
      throw new Error("onnxruntime-web is not loaded");
    }

    const tasks = [];
    for (let k = 0; k < nMembers; k++) {
      tasks.push(ort.InferenceSession.create(
        MODEL_DIR + "member_" + k + ".onnx",
        { executionProviders: ["wasm"] }
      ));
    }
    sessions = await Promise.all(tasks);
    return { nMembers: sessions.length };
  }

  async function predict(inp) {
    if (!scaler || sessions.length === 0) {
      throw new Error("MADET not loaded");
    }
    const x_raw = buildFeatureVector(inp);
    const x_std = new Float32Array(x_raw.length);
    for (let i = 0; i < x_raw.length; i++) {
      x_std[i] = (x_raw[i] - scaler.scaler_mean[i]) / scaler.scaler_scale[i];
    }
    const tensor = new ort.Tensor("float32", x_std, [1, x_raw.length]);

    const mus = [];
    const variances = [];
    for (const sess of sessions) {
      const out = await sess.run({ x: tensor });
      const mu = out.mu.data[0];
      let logvar = out.logvar.data[0];
      if (logvar < -6.0) logvar = -6.0;
      if (logvar >  4.0) logvar =  4.0;
      mus.push(mu);
      variances.push(Math.exp(logvar));
    }

    const muMean = mean(mus);
    const sigEpiStd = std(mus, muMean);
    const sigAleStd = Math.sqrt(mean(variances));
    const sigTotStd = Math.sqrt(sigEpiStd * sigEpiStd + sigAleStd * sigAleStd);

    const y_sd = scaler.y_sd, y_mu = scaler.y_mu;
    const y_pred = muMean * y_sd + y_mu;
    const sigEpi = sigEpiStd * y_sd;
    const sigAle = sigAleStd * y_sd;
    const sigTot = sigTotStd * y_sd;
    const q = scaler.q_hat_norm;

    return {
      y_pred:        y_pred,
      sigma_ale_kN:  sigAle,
      sigma_epi_kN:  sigEpi,
      sigma_tot_kN:  sigTot,
      pi90_lo:       y_pred - q * sigTot,
      pi90_hi:       y_pred + q * sigTot,
      q_hat_norm:    q,
      n_members:     sessions.length,
    };
  }

  function mean(arr) {
    let s = 0;
    for (const v of arr) s += v;
    return s / arr.length;
  }
  function std(arr, m) {
    let s = 0;
    for (const v of arr) { const d = v - m; s += d * d; }
    return Math.sqrt(s / arr.length);
  }

  function ranges() { return scaler ? scaler.feature_ranges : null; }

  global.MADET = { load, predict, ranges };
}(typeof window !== "undefined" ? window : globalThis));
