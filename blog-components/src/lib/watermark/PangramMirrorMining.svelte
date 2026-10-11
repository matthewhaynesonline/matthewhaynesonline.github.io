<script lang="ts">
  import { arrowNav } from "./arrowNav";
  /**
   * Pangram-style post-hoc detection — how a trained classifier is built.
   *
   * Deliberately NOT a perplexity/"surprise" visual: this reads a passage as
   * one pooled stylistic fingerprint and returns a confidence, so it never
   * flags a text merely for being predictable. Two beats the script calls out:
   *
   *   A) Synthetic mirror pairs — a human document beside a model-written twin
   *      on the same topic, length, and register, so the only variable left to
   *      learn is authorship.
   *   B) Hard-negative mining — run across a huge pool of human documents, take
   *      the ones the detector wrongly flags as AI (false positives), train on
   *      those mistakes, and repeat. The false-positive rate falls each round.
   *
   * All figures are illustrative; see Pangram's method writeup for the real
   * approach: https://www.pangram.com/research/how-it-works
   */

  type Pair = { topic: string; human: string; ai: string };
  type Panel = "pairs" | "mining";

  // Illustrative mirror pairs — same topic/length/tone on each side.
  const PAIRS: Pair[] = [
    {
      topic: "A morning tide pool",
      human:
        "The tide had pulled back and left the rocks steaming. I crouched by a pool and watched a crab think about whether I was worth hiding from.",
      ai: "As the tide receded, it exposed the glistening rocks. I knelt beside a small pool and observed a crab carefully considering whether to conceal itself.",
    },
    {
      topic: "Fixing a flat tire",
      human:
        "The wrench slipped twice before the nut gave. My hands were black, the rain started, and of course that was when the last bolt decided to fight me.",
      ai: "The wrench slipped a couple of times before the nut loosened. My hands were covered in grease, rain began to fall, and naturally the final bolt proved stubborn.",
    },
  ];

  // Illustrative false-positive rate per mining round (%).
  const FP_RATES = [5.0, 1.2, 0.4, 0.1, 0.03];
  const CORPUS_CELLS = 150;
  const CORPORA: { label: string; size: number }[] = [
    { label: "10k docs", size: 10_000 },
    { label: "1M docs", size: 1_000_000 },
  ];

  function mulberry32(seed: number): () => number {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fixed scatter of which cells are "hard" — flagged sets are prefixes of this
  // order, so each round's false positives are a subset of the last: the same
  // stubborn cases getting resolved.
  const cellOrder: number[] = (() => {
    const order = Array.from({ length: CORPUS_CELLS }, (_, i) => i);
    const rng = mulberry32(0x50f7);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
  })();

  let panel = $state<Panel>("pairs");
  let round = $state(0); // 0-indexed into FP_RATES
  let corpusIdx = $state(0);
  let playing = $state(false);

  // ←/→ walk pairs panel → mining rounds (and back); a manual step pauses play.
  function stepNext(): void {
    playing = false;
    if (panel === "pairs") panel = "mining";
    else round = Math.min(FP_RATES.length - 1, round + 1);
  }

  function stepPrev(): void {
    playing = false;
    if (panel === "mining" && round > 0) round -= 1;
    else panel = "pairs";
  }

  const rate = $derived(FP_RATES[round]);
  const corpus = $derived(CORPORA[corpusIdx]);
  const flaggedCount = $derived(Math.round((rate / 100) * CORPUS_CELLS));
  const flagged = $derived(new Set(cellOrder.slice(0, flaggedCount)));
  const fpAbsolute = $derived(Math.round((rate / 100) * corpus.size));
  const lastRound = $derived(round === FP_RATES.length - 1);

  // Sparkline geometry (log-scaled y so a 5% → 0.03% fall stays legible).
  const SPARK_W = 240;
  const SPARK_H = 64;
  const LOG_HI = Math.log10(FP_RATES[0]);
  const LOG_LO = Math.log10(FP_RATES[FP_RATES.length - 1]);
  const sparkX = (i: number): number => (i / (FP_RATES.length - 1)) * SPARK_W;
  const sparkY = (r: number): number => {
    const t = (Math.log10(r) - LOG_LO) / (LOG_HI - LOG_LO);

    return SPARK_H - t * (SPARK_H - 6) - 3;
  };
  const sparkPoints = $derived(
    FP_RATES.map((r, i) => `${sparkX(i).toFixed(1)},${sparkY(r).toFixed(1)}`).join(" "),
  );

  // Auto-advance the mining rounds when playing.
  $effect(() => {
    if (!playing) return;

    const id = setInterval(() => {
      if (round >= FP_RATES.length - 1) {
        playing = false;
      } else {
        round += 1;
      }
    }, 1300);

    return () => clearInterval(id);
  });

  function togglePlay(): void {
    if (lastRound) round = 0; // replay from the top
    playing = !playing;
  }
</script>

<div class="card wm-card" use:arrowNav={{ prev: stepPrev, next: stepNext }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">post-hoc detection · Pangram-style</h5>
    <div class="wm-seg">
      <button class="wm-seg-btn" class:on={panel === "pairs"} onclick={() => (panel = "pairs")}>mirror pairs</button>
      <button class="wm-seg-btn" class:on={panel === "mining"} onclick={() => (panel = "mining")}>hard-negative mining</button>
    </div>
  </div>

  <div class="card-body">
    <!-- PANEL A: synthetic mirror pairs -->
    {#if panel === "pairs"}
      <p class="wm-lead">
        Train on <strong>mirror pairs</strong>: a human document and a model
        twin on the same topic, length, and tone. The only variable is
        <em>who</em> wrote it, so the classifier learns authorship, not subject.
      </p>

      {#each PAIRS as pair}
        <div class="wm-pair">
          <div class="wm-pair-topic font-monospace">{pair.topic}</div>
          <div class="wm-pair-cols">
            <div class="wm-doc wm-doc-human">
              <span class="wm-doc-tag" title="written by a human">H · human</span>
              <p class="wm-doc-text">{pair.human}</p>
            </div>
            <div class="wm-doc wm-doc-ai">
              <span class="wm-doc-tag" title="written by a model">AI · model twin</span>
              <p class="wm-doc-text">{pair.ai}</p>
            </div>
          </div>
        </div>
      {/each}

    <!-- PANEL B: hard-negative mining -->
    {:else}
      <p class="wm-lead">
        Run the detector across a huge pool of <strong>human</strong> documents.
        Whatever it wrongly flags as AI (a false positive) is fed back as
        training data. Repeat - the false-positive rate falls each round.
      </p>

      <div class="wm-mine-top">
        <!-- hero rate -->
        <div class="wm-hero">
          <div class="wm-hero-rate">{rate.toFixed(rate < 1 ? 2 : 1)}%</div>
          <div class="wm-hero-sub">
            false-positive rate · round {round + 1} of {FP_RATES.length}<br />
            ≈ {fpAbsolute.toLocaleString()} of {corpus.label} wrongly flagged
          </div>
        </div>

        <!-- sparkline -->
        <svg class="wm-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} role="img" aria-label="false-positive rate falling across rounds">
          <polyline points={sparkPoints} class="wm-spark-line" />
          {#each FP_RATES as r, i}
            <circle cx={sparkX(i)} cy={sparkY(r)} r={i === round ? 5 : 3} class="wm-spark-dot" class:cur={i === round} />
          {/each}
        </svg>
      </div>

      <!-- corpus of human docs; flagged = false positives (accent + ✗ + hatch) -->
      <div class="wm-corpus" role="img" aria-label={`${flaggedCount} of ${CORPUS_CELLS} sampled human documents wrongly flagged as AI`}>
        {#each Array(CORPUS_CELLS) as _, i}<span class="wm-doc-cell" class:fp={flagged.has(i)}>{#if flagged.has(i)}✗{/if}</span>{/each}
      </div>
      <div class="wm-corpus-key font-monospace">
        <span class="wm-key-item"><span class="wm-key-swatch human"></span> human, correct</span>
        <span class="wm-key-item"><span class="wm-key-swatch fp">✗</span> false positive (flagged as AI)</span>
      </div>

      <!-- controls -->
      <div class="wm-mine-controls d-flex flex-wrap align-items-center">
        <button class="btn btn-sm btn-light rounded" disabled={round === 0} onclick={() => (round = Math.max(0, round - 1))} aria-label="Previous round">◀</button>
        <button class="btn btn-sm btn-light rounded" disabled={lastRound} onclick={() => (round = Math.min(FP_RATES.length - 1, round + 1))} aria-label="Next round">▶</button>
        <button class="btn btn-sm btn-outline-secondary" onclick={togglePlay}>{playing ? "⏸ pause" : lastRound ? "↻ replay" : "▶ play rounds"}</button>
        <span class="wm-corpus-toggle">
          {#each CORPORA as c, i}<button class="wm-mini" class:on={i === corpusIdx} onclick={() => (corpusIdx = i)}>{c.label}</button>{/each}
        </span>
      </div>
    {/if}

    <!-- persistent framing -->
    <p class="wm-frame">
      Pangram returns a confidence, reading the whole passage as one pooled
      stylistic fingerprint.
    </p>
    <p class="wm-cite font-monospace">
      Figures illustrative · approach: <a href="https://www.pangram.com/research/how-it-works" target="_blank" rel="noopener">pangram.com/research/how-it-works</a>
    </p>
  </div>
</div>

<style>
  .wm-card {
    background: var(--surface-raised, var(--bs-tertiary-bg));
    border: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .wm-seg {
    display: inline-flex;
    border: 1px solid var(--border-control, var(--bs-border-color));
    border-radius: 999px;
    overflow: hidden;
  }

  .wm-seg-btn {
    background: transparent;
    border: none;
    color: var(--text-ui, var(--bs-body-color));
    padding: 0.2rem 0.7rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.76rem;
    cursor: pointer;
  }

  .wm-seg-btn.on {
    background: var(--text-strong, var(--bs-body-color));
    color: var(--surface, var(--bs-body-bg));
  }

  .wm-lead {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.98rem;
    line-height: 1.55;
    color: var(--text-body, var(--bs-body-color));
    margin-bottom: 1.25rem;
  }

  /* --- mirror pairs --- */
  .wm-pair {
    margin-bottom: 1.1rem;
  }

  .wm-pair-topic {
    font-size: 0.75rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-bottom: 0.35rem;
  }

  .wm-pair-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .wm-doc {
    border: 1px solid var(--border-hairline, var(--bs-border-color));
    border-radius: 8px;
    padding: 0.7rem 0.8rem;
    background: var(--surface, var(--bs-body-bg));
  }



  .wm-doc-tag {
    display: inline-block;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    margin-bottom: 0.4rem;
  }

  .wm-doc-human .wm-doc-tag {
    color: var(--wm-green, #1a9c6b);
  }

  .wm-doc-ai .wm-doc-tag {
    color: var(--accent, #c4362b);
  }

  .wm-doc-text {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.92rem;
    line-height: 1.5;
    color: var(--text-body, var(--bs-body-color));
    margin: 0;
  }

  /* --- mining --- */
  .wm-mine-top {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .wm-hero {
    min-width: 12rem;
  }

  .wm-hero-rate {
    font-family: var(--font-body, Georgia, serif);
    font-weight: 700;
    font-size: clamp(2.4rem, 7vw, 3.6rem);
    line-height: 1;
    color: var(--accent, #c4362b);
  }

  .wm-hero-sub {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.76rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-top: 0.35rem;
    line-height: 1.5;
  }

  .wm-spark {
    width: 240px;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .wm-spark-line {
    fill: none;
    stroke: var(--text-faint, #9b958c);
    stroke-width: 2;
  }

  .wm-spark-dot {
    fill: var(--text-faint, #9b958c);
  }

  .wm-spark-dot.cur {
    fill: var(--accent, #c4362b);
  }

  .wm-corpus {
    display: grid;
    grid-template-columns: repeat(25, 1fr);
    gap: 3px;
    margin-bottom: 0.6rem;
  }

  .wm-doc-cell {
    aspect-ratio: 1;
    border-radius: 2px;
    background: var(--wm-green, #1a9c6b);
    opacity: 0.55;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.55rem;
    color: #fff;
    font-weight: 700;
    transition: all 250ms ease;
  }

  /* false positive: accent + hatch + ✗ so it reads without color */
  .wm-doc-cell.fp {
    opacity: 1;
    background-color: var(--accent, #c4362b);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.55) 0,
      rgba(255, 255, 255, 0.55) 1px,
      transparent 1px,
      transparent 3px
    );
  }

  .wm-corpus-key {
    display: flex;
    gap: 1.1rem;
    font-size: 0.72rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-bottom: 1rem;
  }

  .wm-key-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .wm-key-swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    color: #fff;
  }

  .wm-key-swatch.human {
    background: var(--wm-green, #1a9c6b);
    opacity: 0.55;
  }

  .wm-key-swatch.fp {
    background-color: var(--accent, #c4362b);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.55) 0,
      rgba(255, 255, 255, 0.55) 1px,
      transparent 1px,
      transparent 3px
    );
  }

  .wm-mine-controls {
    gap: 0.4rem;
  }

  .wm-corpus-toggle {
    margin-left: auto;
    display: inline-flex;
    gap: 0.3rem;
  }

  .wm-mini {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.74rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--border-control, var(--bs-border-color));
    background: transparent;
    color: var(--text-ui, var(--bs-body-color));
    cursor: pointer;
  }

  .wm-mini.on {
    background: var(--text-strong, var(--bs-body-color));
    color: var(--surface, var(--bs-body-bg));
    border-color: var(--text-strong, var(--bs-body-color));
  }

  /* --- framing / citation --- */
  .wm-frame {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.9rem;
    line-height: 1.55;
    color: var(--text-muted, var(--bs-secondary-color));
    margin: 1.25rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid var(--sep-faint, var(--bs-border-color));
  }

  .wm-cite {
    font-size: 0.72rem;
    color: var(--text-faint, var(--bs-secondary-color));
    margin: 0.5rem 0 0;
  }

  .wm-cite a {
    color: var(--accent, #c4362b);
  }

  :global([data-bs-theme="dark"]) .wm-card {
    --wm-green: #3ec78d;
  }
</style>
