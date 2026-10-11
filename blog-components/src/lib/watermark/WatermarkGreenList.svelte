<script lang="ts">
  import { arrowNav } from "./arrowNav";
  /**
   * Green-list watermarking — the core generation mechanism, stepped.
   *
   * Walks a scripted sentence one word at a time through the five stages a
   * green-list scheme runs before each token is finalised:
   *
   *   Choices -> Hash -> Split -> Boost -> Pick
   *
   * The previous word is hashed to a seed; the seed deterministically splits
   * the *entire* vocabulary into green/red halves; every green option gets a
   * small boost; the model then leans green on the close calls. A running
   * tally shows green landing well above the 50% a coin flip would give — the
   * hook into the detection component.
   *
   * The pick at each position is computed (argmax of the boosted scores), not
   * authored, so the highlighted winner can never disagree with the bars.
   */

  type Candidate = { word: string; base: number; green: boolean };

  const PROMPT = "The";

  // A small, fixed nudge added to every green option's score. Deliberately
  // gentle: it only ever changes the outcome of a genuine toss-up.
  const BOOST = 0.1;

  // Each position offers three plausible continuations with near-equal base
  // scores. Green flags + BOOST are tuned so argmax spells a fluent sentence
  // ("The market closed sharply today") while one word still lands red — the
  // watermark tips close calls, it does not force every token.
  const script: Candidate[][] = [
    [
      { word: "market", base: 0.34, green: true },
      { word: "weather", base: 0.36, green: false },
      { word: "system", base: 0.3, green: true },
    ],
    [
      { word: "closed", base: 0.33, green: true },
      { word: "opened", base: 0.35, green: false },
      { word: "rallied", base: 0.32, green: true },
    ],
    [
      { word: "sharply", base: 0.4, green: false },
      { word: "higher", base: 0.34, green: false },
      { word: "early", base: 0.26, green: true },
    ],
    [
      { word: "today", base: 0.35, green: true },
      { word: "amid", base: 0.31, green: true },
      { word: "again", base: 0.34, green: false },
    ],
  ];

  const Stage = { Choices: 0, Hash: 1, Split: 2, Boost: 3, Pick: 4 } as const;
  type StageVal = (typeof Stage)[keyof typeof Stage];
  const LAST_STAGE = Stage.Pick;

  const stageLabels = ["Choices", "Hash", "Split", "Boost", "Pick"];
  const stageBlurbs = [
    "The model's next-word options.",
    "Hash the previous word into a seed. Same word in, same number out.",
    "That seed splits the whole vocabulary - half green, half red. A fresh split every word.",
    "Nudge every green option up a touch, right before the pick.",
    "The model leans green on the toss-ups.",
  ];

  const GRID_N = 144; // stand-in for a vocabulary of tens of thousands

  const boosted = (c: Candidate): number => c.base + (c.green ? BOOST : 0);

  // Winner is the top boosted score. Reduce keeps the first on ties; the
  // scripted numbers avoid ties so the pick is unambiguous.
  const winnerOf = (cands: Candidate[]): Candidate =>
    cands.reduce((best, c) => (boosted(c) > boosted(best) ? c : best));

  const picks = script.map(winnerOf);

  // FNV-1a: turns a word into a stable 32-bit number, same word in, same
  // number out — the "hash" beat, shown to the reader verbatim.
  function hashWord(word: string): number {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) {
      h ^= word.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }

  // Seeded PRNG (mulberry32) so a given seed always paints the same grid —
  // the deterministic split the scheme relies on.
  function mulberry32(seed: number): () => number {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let wordIndex = $state(0);
  let stage = $state<StageVal>(Stage.Choices);

  const maxWord = script.length - 1;

  // The already-written word that seeds this position: the prompt for the
  // first token, otherwise the previous pick.
  const prevWord = $derived(wordIndex === 0 ? PROMPT : picks[wordIndex - 1].word);
  const seed = $derived(hashWord(prevWord));
  const candidates = $derived(script[wordIndex]);
  const winner = $derived(picks[wordIndex]);

  // Whole-vocabulary green/red split for the current seed. Recomputes only
  // when the seed word changes, so stepping within a word is stable.
  const gridGreen = $derived.by(() => {
    const rng = mulberry32(seed);

    return Array.from({ length: GRID_N }, () => rng() < 0.5);
  });

  const showColors = $derived(stage >= Stage.Split);
  const showBoost = $derived(stage >= Stage.Boost);
  const showPick = $derived(stage >= Stage.Pick);

  // A word counts toward the tally once its Pick stage is reached.
  const committed = $derived(wordIndex + (stage >= Stage.Pick ? 1 : 0));
  const greenCount = $derived(
    picks.slice(0, committed).filter((p) => p.green).length,
  );
  const redCount = $derived(committed - greenCount);
  const written = $derived(picks.slice(0, committed).map((p) => p.word));
  const done = $derived(committed === script.length);

  const atStart = $derived(wordIndex === 0 && stage === Stage.Choices);
  const atEnd = $derived(wordIndex === maxWord && stage === Stage.Pick);

  // Bar length: scale scores against a fixed ceiling so a boosted green option
  // visibly overtakes a slightly-more-likely red one.
  const SCALE = 0.5;
  const barPct = (c: Candidate): number =>
    Math.min(100, ((showBoost ? boosted(c) : c.base) / SCALE) * 100);

  function next(): void {
    if (stage < LAST_STAGE) stage++;
    else if (wordIndex < maxWord) {
      wordIndex++;
      stage = Stage.Choices;
    }
  }

  function prev(): void {
    if (stage > Stage.Choices) stage--;
    else if (wordIndex > 0) {
      wordIndex--;
      stage = Stage.Pick;
    }
  }

  function reset(): void {
    wordIndex = 0;
    stage = Stage.Choices;
  }
</script>

<div class="card wm-card" use:arrowNav={{ prev, next }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">green-list watermarking</h5>

    <div class="d-flex align-items-center wm-controls">
      <span class="wm-wordcount">word {wordIndex + 1} / {script.length}</span>

      <button
        class="btn btn-sm btn-light rounded"
        disabled={atStart}
        onclick={prev}
        aria-label="Previous step">◀</button
      >

      <button
        class="btn btn-sm btn-light rounded"
        disabled={atEnd}
        onclick={next}
        aria-label="Next step">▶</button
      >

      <button class="btn btn-sm btn-outline-secondary" onclick={reset}>↺</button>
    </div>
  </div>

  <div class="card-body">
    <!-- Growing text + running tally -->
    <div class="wm-sentence-row d-flex justify-content-between align-items-start">
      <p class="wm-sentence mb-0">
        <span class="wm-prompt">{PROMPT}</span>{#each written as w, i}<span class="wm-written" class:green={picks[i].green} class:red={!picks[i].green}>{" " + w}</span>{/each}{#if !done}<span class="wm-caret">▍</span>{/if}
      </p>

      <div class="wm-tally">
        <span class="wm-tally-pill green">{greenCount} green</span>
        <span class="wm-tally-pill red">{redCount} red</span>
      </div>
    </div>

    <!-- Stage track -->
    <div class="wm-track d-flex align-items-center font-monospace mt-4">
      {#each stageLabels as label, i}
        <div class="wm-pip d-flex flex-column align-items-center" class:active={i === stage} class:pdone={i < stage} title={label}>
          <div class="wm-pip-dot rounded-circle"></div>
          <span class="wm-pip-label">{label}</span>
        </div>
        {#if i < stageLabels.length - 1}<div class="wm-pip-line" class:pdone={i < stage}></div>{/if}
      {/each}
    </div>

    <p class="wm-blurb mt-2">{stageBlurbs[stage]}</p>

    <!-- Hash readout -->
    <div class="wm-hash font-monospace mt-3" class:dim={stage < Stage.Hash}>
      hash(<span class="wm-hash-word">“{prevWord}”</span>) →
      <span class="wm-hash-num">{stage >= Stage.Hash ? seed : "…"}</span>
      <span class="wm-hash-note">seeds the split</span>
    </div>


    <div class="row g-4 mt-1">
      <!-- Whole vocabulary flooding green/red -->
      <div class="col-12 col-md-5">
        <div class="wm-grid" class:lit={showColors}>
          {#each gridGreen as isGreen}<span class="wm-cell" class:green={showColors && isGreen} class:red={showColors && !isGreen}></span>{/each}
        </div>
        <p class="wm-grid-cap mt-2">
          The <strong>entire vocabulary</strong>. <span class="wm-gr-key">Solid = green list · hatched = red list.</span>
        </p>
      </div>

      <!-- Candidate options with boosted scores -->
      <div class="col-12 col-md-7">
        <div class="wm-cands">
          {#each candidates as c}
            {@const isWin = showPick && c === winner}
            <div class="wm-cand" class:winner={isWin}>
              <div class="wm-cand-head d-flex justify-content-between">
                <span class="wm-cand-word" class:green={showColors && c.green} class:red={showColors && !c.green}>
                  {#if showColors}<span class="wm-gr" class:green={c.green} class:red={!c.green}>{c.green ? "G" : "R"}</span>{/if}{c.word}{#if isWin}<span class="wm-check"> ✓</span>{/if}
                </span>
                {#if showBoost && c.green}<span class="wm-boost-tag">+{BOOST.toFixed(2)}</span>{/if}
              </div>

              <div class="wm-bar-track">
                <div class="wm-bar" class:green={showColors && c.green} class:red={showColors && !c.green} class:neutral={!showColors} style={`width:${barPct(c)}%`}></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    {#if done}
      <div class="wm-done mt-4">
        <strong>{greenCount} of {committed}</strong> words landed green. A person
        who's never heard of these lists hits green about half the time. This text
        hits it far more - and across hundreds of words, that gap stops looking like
        luck.
      </div>
    {/if}
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

  .wm-wordcount {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-right: 0.25rem;
  }

  .wm-sentence {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.5rem;
    line-height: 1.5;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-prompt {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .wm-written.green {
    color: var(--wm-green, #1a9c6b);
  }

  .wm-written.red {
    color: var(--accent, #c4362b);
  }

  .wm-caret {
    color: var(--text-faint, var(--bs-secondary-color));
    animation: wm-blink 1s step-end infinite;
  }

  .wm-tally {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .wm-tally-pill {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.2em 0.5em;
    border-radius: 999px;
    color: #fff;
  }

  .wm-tally-pill.green {
    background: var(--wm-green, #1a9c6b);
  }

  .wm-tally-pill.red {
    background: var(--accent, #c4362b);
  }

  /* --- stage track --- */
  .wm-track {
    gap: 0;
  }

  .wm-pip-dot {
    width: 11px;
    height: 11px;
    background: var(--bs-secondary-bg, #ccc);
    transition: all 250ms ease;
  }

  .wm-pip.active .wm-pip-dot {
    background: var(--accent, #c4362b);
    transform: scale(1.35);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #c4362b) 22%, transparent);
  }

  .wm-pip.pdone .wm-pip-dot {
    background: var(--accent, #c4362b);
    opacity: 0.55;
  }

  .wm-pip-label {
    font-size: 0.72rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-top: 0.25rem;
  }

  .wm-pip.active .wm-pip-label {
    color: var(--text-strong, var(--bs-body-color));
    font-weight: 700;
  }

  .wm-pip-line {
    flex: 1;
    height: 2.5px;
    min-width: 12px;
    margin-bottom: 1.15rem;
    background: var(--bs-secondary-bg-subtle, #ddd);
    transition: background 250ms ease;
  }

  .wm-pip-line.pdone {
    background: color-mix(in srgb, var(--accent, #c4362b) 40%, transparent);
  }

  .wm-blurb {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.95rem;
    color: var(--text-muted, var(--bs-secondary-color));
    min-height: 2.4em;
  }

  /* --- hash readout --- */
  .wm-hash {
    font-size: 0.85rem;
    color: var(--text-body, var(--bs-body-color));
    transition: opacity 250ms ease;
  }

  .wm-hash.dim {
    opacity: 0.4;
  }

  .wm-hash-word {
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-hash-num {
    color: var(--accent, #c4362b);
    font-weight: 600;
  }

  .wm-hash-note {
    color: var(--text-faint, var(--bs-secondary-color));
    margin-left: 0.35rem;
  }


  /* --- vocabulary grid --- */
  .wm-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 3px;
  }

  .wm-cell {
    aspect-ratio: 1;
    border-radius: 2px;
    background: var(--bs-secondary-bg, #d8d8d8);
    transition:
      background 300ms ease,
      transform 300ms ease;
  }

  .wm-cell.green {
    background: var(--wm-green, #1a9c6b);
  }

  /* red = accent PLUS a diagonal hatch, so it reads without color too */
  .wm-cell.red {
    background-color: var(--accent, #c4362b);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.5) 0,
      rgba(255, 255, 255, 0.5) 1px,
      transparent 1px,
      transparent 3px
    );
  }

  .wm-grid-cap {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.85rem;
    color: var(--text-muted, var(--bs-secondary-color));
  }

  .wm-gr-key {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  /* small G/R letter badge — a non-color cue on each candidate */
  .wm-gr {
    display: inline-block;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 1;
    width: 1.1em;
    height: 1.1em;
    text-align: center;
    padding-top: 0.18em;
    border-radius: 3px;
    margin-right: 0.4rem;
    vertical-align: 0.14em;
    color: #fff;
  }

  .wm-gr.green {
    background: var(--wm-green, #1a9c6b);
  }

  .wm-gr.red {
    background: var(--accent, #c4362b);
  }

  /* --- candidates --- */
  .wm-cands {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .wm-cand {
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    border: 1px solid transparent;
    transition: all 250ms ease;
  }

  .wm-cand.winner {
    border-color: var(--border-control, var(--bs-border-color));
    background: color-mix(in srgb, var(--wm-green, #1a9c6b) 8%, transparent);
  }

  .wm-cand-word {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.15rem;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-cand-word.green {
    color: var(--wm-green, #1a9c6b);
  }

  .wm-cand-word.red {
    color: var(--accent, #c4362b);
  }

  .wm-check {
    font-weight: 700;
  }

  .wm-boost-tag {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--wm-green, #1a9c6b);
    background: color-mix(in srgb, var(--wm-green, #1a9c6b) 15%, transparent);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    align-self: center;
    animation: wm-pop 220ms ease-out both;
  }

  .wm-bar-track {
    margin-top: 0.3rem;
    height: 10px;
    background: var(--bs-secondary-bg-subtle, #e6e6e6);
    border-radius: 999px;
    overflow: hidden;
  }

  .wm-bar {
    height: 100%;
    border-radius: 999px;
    background: var(--text-faint, #9b958c);
    transition: width 350ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .wm-bar.green {
    background: var(--wm-green, #1a9c6b);
  }

  .wm-bar.red {
    background: var(--accent, #c4362b);
  }

  .wm-done {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.98rem;
    line-height: 1.6;
    color: var(--text-body, var(--bs-body-color));
    padding: 0.9rem 1.1rem;
    border-left: 3px solid var(--wm-green, #1a9c6b);
    background: color-mix(in srgb, var(--wm-green, #1a9c6b) 7%, transparent);
    border-radius: 0 6px 6px 0;
  }

  @keyframes wm-blink {
    50% {
      opacity: 0;
    }
  }

  @keyframes wm-pop {
    from {
      opacity: 0;
      transform: translateY(-2px) scale(0.9);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* Green reads muddy against the dark editorial surface; brighten it. */
  :global([data-bs-theme="dark"]) .wm-card {
    --wm-green: #3ec78d;
  }
</style>
