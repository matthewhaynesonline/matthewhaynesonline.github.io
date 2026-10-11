<script lang="ts">
  import { arrowNav } from "./arrowNav";
  /**
   * Green-list detection — why "three-quarters green" stops being luck.
   *
   * This is the GREEN-LIST statistic (Kirchenbauer et al.): a keyed hash splits
   * the vocabulary green/red by fraction γ = 0.5, so the detector just counts
   * how often the observed tokens landed green. Two deterministic streams — a
   * human writer (green ≈ γ, a coin flip) and watermarked text (green ≈ 0.75) —
   * are scored with the green-count z-test:
   *
   *     z = (green - γT) / sqrt(T · γ · (1 - γ))
   *
   * The raw percentage barely moves with length; what explodes is how
   * *impossible* the tilt is under a fair coin. The default length (200 words)
   * lands the odds just past "one in a trillion", matching the voiceover; the
   * length control walks it up and down from there. Detection here is a GREEN
   * SHARE against a 50% baseline — distinct from the tournament components,
   * which score a mean secret score against a 0.5 baseline.
   */

  const GAMMA = 0.5; // green fraction of the vocabulary
  const HUMAN_P = 0.5;
  const MARK_P = 0.75;
  const MAX_N = 500;

  const TICK_CAP = 100; // draw at most this many green/red squares, then count

  // Word counts to step through. 200 is the default: with these seeds the mark
  // sits at exactly 75% there, giving z ≈ 7.1 and odds just under one in a
  // trillion — the number the voiceover quotes.
  const STEPS = [25, 50, 100, 200, 350, 500];
  const DEFAULT_STEP = STEPS.indexOf(200);

  function mulberry32(seed: number): () => number {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeSequence(p: number, seed: number): boolean[] {
    const rng = mulberry32(seed);

    return Array.from({ length: MAX_N }, () => rng() < p);
  }

  // Seeds chosen so the realized shares sit on their targets — 50% and 75% at
  // the 200-word default — so a freeze-frame never contradicts the labels.
  const humanSeq = makeSequence(HUMAN_P, 13);
  const markSeq = makeSequence(MARK_P, 1);

  // Abramowitz & Stegun 7.1.26 complementary error function — turns z into p.
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

  type Stat = { green: number; frac: number; z: number; p: number; flagged: boolean };

  function statsFor(seq: boolean[], n: number): Stat {
    const green = seq.slice(0, n).filter(Boolean).length;
    const z = (green - GAMMA * n) / Math.sqrt(n * GAMMA * (1 - GAMMA));
    const p = 0.5 * erfc(z / Math.SQRT2); // one-sided: tilted toward green

    return { green, frac: green / n, z, p, flagged: z >= 4 };
  }

  // Legible "1 in a trillion" scaling for the hero; falls back to 10^k when the
  // odds outrun ordinary words.
  function friendlyOdds(p: number, z: number): string {
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

  let stepIdx = $state(DEFAULT_STEP);

  const stepPrev = (): void => {
    stepIdx = Math.max(0, stepIdx - 1);
  };
  const stepNext = (): void => {
    stepIdx = Math.min(STEPS.length - 1, stepIdx + 1);
  };

  const n = $derived(STEPS[stepIdx]);
  const human = $derived(statsFor(humanSeq, n));
  const mark = $derived(statsFor(markSeq, n));

  const tracks = $derived([
    { key: "human", title: "Human writer", subtitle: "green share ≈ 50% (a coin flip)", seq: humanSeq, stat: human },
    { key: "mark", title: "Watermarked text", subtitle: "green share nudged to ~75% (target)", seq: markSeq, stat: mark },
  ]);

  const pct = (f: number): string => (f * 100).toFixed(0) + "%";
</script>

<div class="card wm-card" use:arrowNav={{ prev: stepPrev, next: stepNext }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">is it watermarked? · green-list test</h5>

    <div class="d-flex align-items-center wm-controls">
      <button class="btn btn-sm btn-light rounded" disabled={stepIdx === 0} onclick={() => stepIdx--} aria-label="Fewer words">◀</button>
      <button class="btn btn-sm btn-light rounded" disabled={stepIdx === STEPS.length - 1} onclick={() => stepIdx++} aria-label="More words">▶</button>
    </div>
  </div>

  <div class="card-body">
    <div class="wm-nrow d-flex align-items-baseline flex-wrap">
      <span class="wm-nlabel">words analysed</span>
      {#each STEPS as s, i}
        <button class="wm-npill" class:active={i === stepIdx} onclick={() => (stepIdx = i)}>{s}</button>
      {/each}
    </div>


    {#each tracks as track}
      <div class="wm-track-block">
        <div class="wm-track-head d-flex justify-content-between align-items-baseline">
          <div>
            <span class="wm-track-title">{track.title}</span>
            <span class="wm-track-sub">{track.subtitle}</span>
          </div>
          <span class="wm-verdict" class:flagged={track.stat.flagged}>
            {track.stat.flagged ? "watermarked" : "looks human"}
          </span>
        </div>

        <!-- green/red ticks: color PLUS a hatch on red so it survives grayscale -->
        <div class="wm-ticks">
          {#each track.seq.slice(0, Math.min(n, TICK_CAP)) as isGreen}<span class="wm-tick" class:green={isGreen} class:red={!isGreen} title={isGreen ? "green" : "red"}></span>{/each}{#if n > TICK_CAP}<span class="wm-tick-more">+{n - TICK_CAP} more</span>{/if}
        </div>

        <!-- green share bar with the 50% baseline marked -->
        <div class="wm-fracbar">
          <div class="wm-frac-fill" style={`width:${track.stat.frac * 100}%`}></div>
          <div class="wm-frac-ref" style="left:50%"></div>
        </div>
        <div class="wm-baseline-row font-monospace">
          <span>green share</span>
          <span class="wm-baseline-note">baseline 50% ↑</span>
        </div>

        <div class="wm-stat-line font-monospace">
          <span class="wm-stat-green">{track.stat.green} / {n} green ({pct(track.stat.frac)})</span>
          <span class="wm-stat-sep">·</span>
          <span>z = {track.stat.z.toFixed(1)}</span>
          <span class="wm-stat-sep">·</span>
          <span class="wm-stat-odds" class:hot={track.stat.flagged}>{friendlyOdds(track.stat.p, track.stat.z)}</span>
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
    margin-bottom: 1.25rem;
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





  .wm-track-block {
    padding: 1rem 0;
    border-top: 1px solid var(--sep-faint, var(--bs-border-color));
  }

  .wm-track-title {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.15rem;
    color: var(--text-strong, var(--bs-body-color));
    margin-right: 0.5rem;
  }

  .wm-track-sub {
    font-size: 0.85rem;
    color: var(--text-muted, var(--bs-secondary-color));
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

  .wm-ticks {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: 0.75rem 0;
    align-items: center;
  }

  .wm-tick {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  .wm-tick.green {
    background: var(--wm-green, #1a9c6b);
  }

  /* red = accent fill PLUS a diagonal hatch, so green vs red reads without color */
  .wm-tick.red {
    background-color: var(--accent, #c4362b);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.55) 0,
      rgba(255, 255, 255, 0.55) 1px,
      transparent 1px,
      transparent 3px
    );
  }

  .wm-tick-more {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.72rem;
    color: var(--text-faint, var(--bs-secondary-color));
    margin-left: 0.3rem;
  }

  .wm-fracbar {
    position: relative;
    height: 12px;
    background-color: var(--accent, #c4362b);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.4) 0,
      rgba(255, 255, 255, 0.4) 1px,
      transparent 1px,
      transparent 4px
    );
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 0.35rem;
  }

  .wm-frac-fill {
    height: 100%;
    background: var(--wm-green, #1a9c6b);
    transition: width 350ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .wm-frac-ref {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: var(--surface-raised, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-strong, #000) 45%, transparent);
  }

  .wm-baseline-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--text-faint, var(--bs-secondary-color));
    margin-bottom: 0.5rem;
  }

  .wm-baseline-note {
    /* sits under the 50% marker */
    margin-left: auto;
    transform: translateX(-48%);
  }

  .wm-stat-line {
    font-size: 0.82rem;
    color: var(--text-body, var(--bs-body-color));
  }

  .wm-stat-green {
    color: var(--wm-green, #1a9c6b);
    font-weight: 600;
  }

  .wm-stat-sep {
    color: var(--text-faint, var(--bs-secondary-color));
    margin: 0 0.4rem;
  }

  .wm-stat-odds.hot {
    color: var(--accent, #c4362b);
    font-weight: 700;
  }


  /* Green reads muddy against the dark editorial surface; brighten it. */
  :global([data-bs-theme="dark"]) .wm-card {
    --wm-green: #3ec78d;
  }
</style>
