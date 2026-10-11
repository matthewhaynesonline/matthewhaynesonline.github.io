<script lang="ts">
  import { arrowNav } from "./arrowNav";
  /**
   * Tournament sampling — quality preserved, yet detectable (the aggregate).
   *
   * Runs the single-match tournament many times and steps the trial count up.
   * Two things happen at once, and that pairing is the whole point:
   *
   *   - The emitted-token frequencies converge on the model's TRUE
   *     probabilities. Because a fresh g-score is drawn per position, averaging
   *     over positions returns the marginal distribution untouched — no δ, no
   *     distortion.
   *   - The mean g-score of the emitted tokens sits ABOVE the 0.5 null, because
   *     within each position the higher-g draw tends to win. That excess is the
   *     signal, and its z-score grows with the number of tokens.
   *
   * Plain sampling (no tournament) matches the distribution too, but its
   * emitted tokens carry uniform g-scores, so its mean-g stays at 0.5 and no
   * detector fires. Same detector maths as the green-list z-test; only the
   * statistic changes (mean-g vs green-count).
   */

  type Trial = { wmTok: number; wmG: number; baseTok: number; baseG: number };

  const TOKENS = ["cat", "dog", "bird", "fish"];
  const PROBS = [0.5, 0.3, 0.15, 0.05];
  // 350 is the default: it lands the watermark's odds just past one in a
  // trillion (z ≈ 7.2), matching the voiceover; the control walks it up.
  const STEPS = [100, 350, 1000, 5000, 10000];
  const DEFAULT_STEP = STEPS.indexOf(350);
  const MAX_N = 10000;

  function mulberry32(seed: number): () => number {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawIndex(rng: () => number): number {
    let x = rng();
    for (let i = 0; i < PROBS.length; i++) {
      x -= PROBS[i];
      if (x < 0) return i;
    }

    return PROBS.length - 1;
  }

  // One fixed run, precomputed. Each trial is an independent position: fresh
  // per-token g-scores, two entrants drawn for the tournament, one for the
  // plain-sampling baseline. Stepping N just reads a longer prefix.
  const trials: Trial[] = (() => {
    const rng = mulberry32(0xc0ffee);
    const out: Trial[] = [];
    for (let i = 0; i < MAX_N; i++) {
      const g = PROBS.map(() => rng());
      const a = drawIndex(rng);
      const b = drawIndex(rng);
      const wmTok = g[a] >= g[b] ? a : b;
      const baseTok = drawIndex(rng);
      out.push({ wmTok, wmG: g[wmTok], baseTok, baseG: g[baseTok] });
    }

    return out;
  })();

  function erfc(x: number): number {
    const z = Math.abs(x);
    const t = 1 / (1 + z / 2);
    const r =
      t *
      Math.exp(
        -z * z - 1.26551223 +
          t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
            t * (0.27886807 + t * (-1.1352039 + t * (1.48851587 +
              t * (-0.82215223 + t * 0.17087277)))))))),
      );

    return x >= 0 ? r : 2 - r;
  }

  type Side = {
    freq: number[];
    meanG: number;
    z: number;
    p: number;
  };

  function aggregate(n: number): { wm: Side; base: Side } {
    const wmCounts = [0, 0, 0, 0];
    const baseCounts = [0, 0, 0, 0];
    let wmG = 0;
    let baseG = 0;
    for (let i = 0; i < n; i++) {
      const trial = trials[i];
      wmCounts[trial.wmTok]++;
      baseCounts[trial.baseTok]++;
      wmG += trial.wmG;
      baseG += trial.baseG;
    }

    const side = (counts: number[], sumG: number): Side => {
      const meanG = sumG / n;
      const z = (meanG - 0.5) / Math.sqrt(1 / 12 / n);

      return { freq: counts.map((c) => c / n), meanG, z, p: 0.5 * erfc(z / Math.SQRT2) };
    };

    return { wm: side(wmCounts, wmG), base: side(baseCounts, baseG) };
  }

  let stepIdx = $state(DEFAULT_STEP);

  const stepPrev = (): void => {
    stepIdx = Math.max(0, stepIdx - 1);
  };
  const stepNext = (): void => {
    stepIdx = Math.min(STEPS.length - 1, stepIdx + 1);
  };

  const n = $derived(STEPS[stepIdx]);
  const agg = $derived(aggregate(n));

  const sides = $derived([
    { key: "wm", title: "Watermarked (tournament)", side: agg.wm },
    { key: "base", title: "No watermark (plain sampling)", side: agg.base },
  ]);

  const flagged = (z: number): boolean => z >= 4;
  const pct = (v: number): string => (v * 100).toFixed(0) + "%";

  // Legible "1 in a trillion" scaling for the hero; 10^k once it outruns words.
  function friendlyOdds(z: number, p: number): string {
    if (z < 2) return "≈ even odds";

    const oneIn = p > 0 ? 1 / p : Infinity;
    if (!isFinite(oneIn) || oneIn >= 1e18) {
      return `1 in 10^${Math.round(Math.log10(Math.max(oneIn, 1e18)))}`;
    }

    const units: [number, string][] = [
      [1e15, "quadrillion"],
      [1e12, "trillion"],
      [1e9, "billion"],
      [1e6, "million"],
      [1e3, "thousand"],
    ];
    for (const [value, name] of units) {
      if (oneIn >= value) {
        const scaled = oneIn / value;

        return `1 in ${scaled < 10 ? scaled.toFixed(1) : Math.round(scaled)} ${name}`;
      }
    }

    return `1 in ${Math.round(oneIn).toLocaleString()}`;
  }
</script>

<div class="card wm-card" use:arrowNav={{ prev: stepPrev, next: stepNext }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">preserved, yet detectable</h5>
    <div class="d-flex align-items-center wm-controls">
      <button class="btn btn-sm btn-light rounded" disabled={stepIdx === 0} onclick={() => stepIdx--} aria-label="Fewer trials">◀</button>
      <button class="btn btn-sm btn-light rounded" disabled={stepIdx === STEPS.length - 1} onclick={() => stepIdx++} aria-label="More trials">▶</button>
    </div>
  </div>

  <div class="card-body">
    <div class="wm-nrow d-flex align-items-baseline flex-wrap">
      <span class="wm-nlabel">positions run</span>
      {#each STEPS as s, i}
        <button class="wm-npill" class:active={i === stepIdx} onclick={() => (stepIdx = i)}>{s.toLocaleString()}</button>
      {/each}
    </div>


    {#each sides as col}
      <div class="wm-side-block">
        <div class="wm-side-head d-flex justify-content-between align-items-baseline">
          <span class="wm-side-title">{col.title}</span>
          <span class="wm-verdict" class:flagged={flagged(col.side.z)}>
            {flagged(col.side.z) ? "watermark detected" : "no watermark"}
          </span>
        </div>

        <!-- emitted frequency vs true probability -->
        <div class="wm-metric-label font-monospace">emitted share <span class="wm-metric-note">(bar) vs true probability (dashed)</span></div>
        <div class="wm-freqs">
          {#each TOKENS as tok, i}
            <div class="wm-freq-row">
              <span class="wm-freq-word">{tok}</span>
              <div class="wm-freq-track">
                <div class="wm-freq-fill" style={`width:${col.side.freq[i] * 100}%`}></div>
                <div class="wm-freq-ref" style={`left:${PROBS[i] * 100}%`} title="true probability"></div>
              </div>
              <span class="wm-freq-nums font-monospace">
                {pct(col.side.freq[i])} <span class="wm-freq-true">/ {pct(PROBS[i])}</span>
              </span>
            </div>
          {/each}
        </div>

        <!-- mean secret-score test (the tournament statistic) -->
        <div class="wm-metric-label font-monospace">mean secret score <span class="wm-metric-note">baseline 0.5</span></div>
        <div class="wm-gtest">
          <div class="wm-gtest-track">
            <div class="wm-gtest-fill" style={`width:${col.side.meanG * 100}%`}></div>
            <div class="wm-gtest-null" style="left:50%" title="unwatermarked null = 0.5"></div>
          </div>
          <div class="wm-gtest-line font-monospace">
            <span class="wm-gtest-mean">mean g = {col.side.meanG.toFixed(3)}</span>
            <span class="wm-sep">·</span>
            <span>z = {col.side.z.toFixed(1)}</span>
            <span class="wm-sep">·</span>
            <span class="wm-odds" class:hot={flagged(col.side.z)}>{friendlyOdds(col.side.z, col.side.p)}</span>
          </div>
        </div>
      </div>
    {/each}

  </div>
</div>

<style>
  .wm-card {
    background: var(--surface-raised, var(--bs-tertiary-bg));
    border: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .wm-controls {
    gap: 0.4rem;
  }

  .wm-nrow {
    gap: 0.4rem;
    margin-bottom: 1.4rem;
  }

  .wm-nlabel {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.78rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-right: 0.5rem;
  }

  .wm-npill {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    padding: 0.15em 0.6em;
    border-radius: 999px;
    border: 1px solid var(--border-control, var(--bs-border-color));
    background: transparent;
    color: var(--text-ui, var(--bs-body-color));
    transition: all 200ms ease;
  }

  .wm-npill.active {
    background: var(--text-strong, var(--bs-body-color));
    color: var(--surface, var(--bs-body-bg));
    border-color: var(--text-strong, var(--bs-body-color));
  }





  .wm-metric-label {
    font-size: 0.74rem;
    color: var(--text-body, var(--bs-body-color));
    margin-bottom: 0.35rem;
  }

  .wm-metric-note {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .wm-side-block {
    padding: 1rem 0;
    border-top: 1px solid var(--sep-faint, var(--bs-border-color));
  }

  .wm-side-title {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.12rem;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-verdict {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.2em 0.55em;
    border-radius: 999px;
    color: var(--text-muted, var(--bs-secondary-color));
    border: 1px solid var(--border-control, var(--bs-border-color));
  }

  .wm-verdict.flagged {
    color: #fff;
    background: var(--accent, #c4362b);
    border-color: var(--accent, #c4362b);
  }

  /* frequency rows */
  .wm-freqs {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0.85rem 0 1rem;
  }

  .wm-freq-row {
    display: grid;
    grid-template-columns: 3rem 1fr 6.5rem;
    align-items: center;
    gap: 0.6rem;
  }

  .wm-freq-word {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1rem;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-freq-track {
    position: relative;
    height: 12px;
    background: var(--bs-secondary-bg-subtle, #e6e6e6);
    border-radius: 999px;
    overflow: visible;
  }

  .wm-freq-fill {
    height: 100%;
    background: var(--wm-green, #1a9c6b);
    border-radius: 999px;
    transition: width 400ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* dashed tick at the true probability — the target the bar lands on */
  .wm-freq-ref {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 0;
    border-left: 2px dashed var(--text-strong, #333);
    opacity: 0.7;
  }

  .wm-freq-nums {
    font-size: 0.76rem;
    color: var(--text-body, var(--bs-body-color));
    text-align: right;
  }

  .wm-freq-true {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  /* mean-g test */
  .wm-gtest {
    margin-top: 0.5rem;
  }

  .wm-gtest-track {
    position: relative;
    height: 12px;
    background: var(--bs-secondary-bg-subtle, #e6e6e6);
    border-radius: 999px;
    overflow: visible;
  }

  .wm-gtest-fill {
    height: 100%;
    background: var(--accent, #c4362b);
    border-radius: 999px;
    transition: width 400ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .wm-gtest-null {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 0;
    border-left: 2px dashed var(--text-strong, #333);
    opacity: 0.7;
  }

  .wm-gtest-line {
    font-size: 0.78rem;
    color: var(--text-body, var(--bs-body-color));
    margin-top: 0.4rem;
  }

  .wm-gtest-mean {
    color: var(--accent, #c4362b);
    font-weight: 600;
  }

  .wm-sep {
    color: var(--text-faint, var(--bs-secondary-color));
    margin: 0 0.4rem;
  }

  .wm-odds.hot {
    color: var(--accent, #c4362b);
    font-weight: 700;
  }


  :global([data-bs-theme="dark"]) .wm-card {
    --wm-green: #3ec78d;
  }
</style>
