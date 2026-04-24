# MADE-T Interactive Tool

The in-browser demo at <https://twakjira.github.io/MADE-T-HSS/> runs the
10-member Feature-Tokenizer Transformer ensemble entirely client-side via
`onnxruntime-web`. It has two tabs.

## Predict Strength

A single-point predictor. Enter the 9 design inputs and the tool returns:

- *V*<sub>u</sub> — mean predicted shear strength (kN).
- σ<sub>ale</sub> — aleatoric standard deviation, from the per-sample
  log-variance head.
- σ<sub>epi</sub> — epistemic standard deviation, from the spread of the 10
  ensemble means.
- σ<sub>tot</sub> — total predictive standard deviation,
  √(σ<sub>ale</sub>² + σ<sub>epi</sub>²).
- 90 % prediction interval [*V*<sub>u</sub> − *q*·σ<sub>tot</sub>,
  *V*<sub>u</sub> + *q*·σ<sub>tot</sub>], where *q* is the split-conformal
  quantile computed on a held-out calibration set.

Inputs outside the 87-specimen database envelope are flagged inline.

## Design Explorer

A what-if tool for exploring the response surface. Freeze 7 of the 9 design
variables and sweep the remaining 2 over a user-chosen grid.

| Control             | Behaviour                                                                           |
|---------------------|-------------------------------------------------------------------------------------|
| 9 fixed-input boxes | Pre-filled with database means. Swept variables are greyed out.                     |
| X-axis dropdown     | Sweep variable on the x-axis (default *f*<sub>yt</sub>).                            |
| Y-axis dropdown     | Sweep variable on the y-axis (default ρ<sub>st</sub>).                              |
| X/Y min, max, steps | Default to the database min/max and 20 steps.                                       |
| Generate            | Runs the full grid through the ensemble.                                            |
| Reset               | Reverts all inputs, dropdowns, and ranges to defaults.                              |
| Download CSV        | Exports the most recent grid.                                                       |

Outputs: two side-by-side Plotly contour plots — predicted *V*<sub>u</sub>
(Viridis) and epistemic uncertainty σ<sub>epi</sub> (Oranges) — with contour
labels, colorbar, and per-cell hover tooltips. A one-line summary prints the
*V*<sub>u</sub> range, mean and max σ<sub>epi</sub>, and max σ<sub>epi</sub>
as a percentage of the grid's mean *V*<sub>u</sub>.

CSV export columns: `x_var, y_var, V_u_pred_kN, sigma_ale_kN, sigma_epi_kN`.

## Computation

For every (*x*<sub>i</sub>, *y*<sub>j</sub>) grid point:

1. Copy the 9 fixed inputs and overwrite the two swept entries.
2. Compute the 6 mechanics-informed features (confinement index plus the
   Sezen–Moehle, ACI 318-19, Priestley, Berry–Eberhard, and Haselton
   estimators).
3. Standardise the 15-dim feature vector with the same
   (scaler_mean, scaler_scale) used during training.
4. Run the vector through all 10 ONNX members; aggregate the means and
   per-member log-variances into μ, σ<sub>epi</sub>, σ<sub>ale</sub>.
5. De-standardise back to kN with the stored (*y*<sub>μ</sub>, *y*<sub>σ</sub>).

A 20 × 20 grid is 4 000 ONNX session runs; a typical laptop completes it in
20–40 s. Grid size is capped at 80 × 80.

## Inputs reference

| Symbol                                        | Meaning                              | Unit | DB range     |
|-----------------------------------------------|--------------------------------------|------|--------------|
| *b*                                           | column width                         | mm   | 150 – 610    |
| *h*                                           | column depth                         | mm   | 200 – 610    |
| *f*′<sub>c</sub>                              | concrete compressive strength        | MPa  | 24.7 – 125.0 |
| *f*<sub>yl</sub>                              | longitudinal steel yield strength    | MPa  | 393 – 924    |
| *f*<sub>yt</sub>                              | transverse steel yield strength      | MPa  | 328 – 1569   |
| ρ<sub>sl</sub>                                | longitudinal reinforcement ratio     | %    | 0.83 – 4.70  |
| ρ<sub>st</sub>                                | transverse reinforcement ratio       | %    | 0.19 – 3.67  |
| *a*/*d*                                       | shear span to effective depth ratio  | —    | 1.65 – 7.48  |
| ALR = *P* / (*A*<sub>g</sub>*f*′<sub>c</sub>) | axial load ratio                     | —    | 0.05 – 0.629 |
