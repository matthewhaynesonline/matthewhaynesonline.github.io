<script lang="ts">
  import { arrowNav } from "./arrowNav";
  import {
    PROMPT,
    writePassage,
    meanGTest,
    isFlagged,
    keyedHash,
    HASH_RANGE,
    type Writer,
  } from "./synthidPassage";
  /**
   * SynthID detection — tournament sampling run backwards.
   *
   * Generation scored every candidate and kept the highest. The detector never
   * sees the candidates or the model: it walks the finished text, re-derives
   * each word's g-score from the secret key and the word before it, and asks
   * whether the words that were kept average suspiciously high:
   *
   *     z = (meanG - 0.5) / sqrt((1/12) / n)
   *
   * The same passage module feeds SynthIDPassage, so the watermarked text here
   * is exactly what that component wrote, and every score matches. The human
   * text is the author's own words for the same sentences, scored with the
   * same key; it lands on the 0.5 baseline.
   *
   * No odds readout on purpose: 32 words only reaches about 1 in a million,
   * which would contradict the voiceover's "less than one in a trillion".
   * That beat belongs to SynthIDQuality at 1,000+ positions.
   */

  const PLAY_MS = 450;

  let writer = $state<Writer>("watermarked");
  let scoredCount = $state(0);
  let playing = $state(false);

  const words = $derived(writePassage(writer));
  const scored = $derived(words.slice(0, scoredCount));
  const test = $derived(meanGTest(scored.map((w) => w.g)));
  const flagged = $derived(isFlagged(test.z));
  const current = $derived(scoredCount > 0 ? words[scoredCount - 1]! : null);
  const done = $derived(scoredCount === words.length);
  const hash = $derived(current ? keyedHash(current.context, current.word) : null);

  const blurb = $derived.by(() => {
    if (!current) return "The detector has the text and the secret key. No model, no prompt.";
    if (!done) return "Re-derive each word's secret score from the key and the word before it, then keep a running average.";
    if (flagged) return "The winners keep winning: these words average far above 0.5. Writing without the key doesn't do that by chance.";

    return "A random mix of high and low scores, averaging about 0.5. No watermark.";
  });

  function setWriter(w: Writer): void {
    writer = w;
    playing = false;
    scoredCount = 0;
  }
  function stepNext(): void {
    playing = false;
    scoredCount = Math.min(words.length, scoredCount + 1);
  }
  function stepPrev(): void {
    playing = false;
    scoredCount = Math.max(0, scoredCount - 1);
  }
  function reset(): void {
    playing = false;
    scoredCount = 0;
  }
  function togglePlay(): void {
    if (done) scoredCount = 0; // replay from the top
    playing = !playing;
  }

  $effect(() => {
    if (!playing) return;

    const id = setInterval(() => {
      if (scoredCount >= words.length) playing = false;
      else scoredCount++;
    }, PLAY_MS);

    return () => clearInterval(id);
  });

  const gPct = (g: number): number => Math.round(g * 100);
</script>

<div class="card wm-card" use:arrowNav={{ prev: stepPrev, next: stepNext }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">is it watermarked? · synthid test</h5>

    <div class="d-flex align-items-center wm-controls">
      <span class="wm-wordcount">word {scoredCount} / {words.length}</span>
      <button class="btn btn-sm btn-light rounded" disabled={scoredCount === 0} onclick={stepPrev} aria-label="Previous word">◀</button>
      <button class="btn btn-sm btn-light rounded" disabled={done} onclick={stepNext} aria-label="Next word">▶</button>
      <button class="btn btn-sm btn-outline-secondary" onclick={togglePlay}>{playing ? "⏸" : done ? "↻" : "▶ play"}</button>
      <button class="btn btn-sm btn-outline-secondary" onclick={reset} aria-label="Reset">↺</button>
    </div>
  </div>

  <div class="card-body">
    <div class="wm-toolbar d-flex flex-wrap align-items-center">
      <div class="wm-seg">
        <button class="wm-seg-btn" class:on={writer === "watermarked"} onclick={() => setWriter("watermarked")}>watermarked text</button>
        <button class="wm-seg-btn" class:on={writer === "human"} onclick={() => setWriter("human")}>human text</button>
      </div>
      <span class="wm-verdict ms-auto" class:flagged={done && flagged} class:hidden={!done}>
        {flagged ? "watermarked" : "looks human"}
      </span>
    </div>

    <!-- the text under test: scored words carry their g; the current word and its key word are marked -->
    <p class="wm-passage mt-3 mb-0">
      <span class="wm-prompt" class:keyword={scoredCount === 1}>{PROMPT}</span>{#each words as w, i}{" "}<span
          class="wm-word"
          class:scored={i < scoredCount}
          class:current={i === scoredCount - 1}
          class:keyword={i === scoredCount - 2}
          style={`--tint:${Math.round(w.g * 45)}%;--gw:${gPct(w.g)}%`}
        >{w.word}</span>{w.after}{/each}
    </p>

    <!-- the recipe for the current word: the same three inputs the writer used -->
    <div class="wm-recipe mt-3" class:dim={!current}>
      <div class="wm-recipe-half">
        <div class="wm-ing">
          <span class="wm-ing-val font-monospace">****</span>
          <span class="wm-ing-cap">secret key</span>
        </div>
        <span class="wm-op">+</span>
        <div class="wm-ing wm-ing-word">
          <span class="wm-ing-val">“{current?.context ?? "…"}”</span>
          <span class="wm-ing-cap">word before</span>
        </div>
        <span class="wm-op">+</span>
        <div class="wm-ing wm-ing-word">
          <span class="wm-ing-val">“{current?.word.toLowerCase() ?? "…"}”</span>
          <span class="wm-ing-cap">this word</span>
        </div>
      </div>
      <div class="wm-recipe-half">
        <span class="wm-op">→ mix →</span>
        <div class="wm-ing wm-ing-hash">
          <span class="wm-ing-val font-monospace">{hash !== null ? hash.toLocaleString("en-US") : "…"}</span>
          <span class="wm-ing-cap">a big number</span>
        </div>
        <span class="wm-op" title={`÷ ${HASH_RANGE.toLocaleString("en-US")}, the largest possible number`}>÷ max →</span>
        <div class="wm-ing wm-ing-g">
          <span class="wm-ing-val font-monospace">{current ? current.g.toFixed(2) : "…"}</span>
          <span class="wm-ing-cap">secret score</span>
        </div>
      </div>
    </div>
    <p class="wm-recipe-note mb-0">
      Same inputs, same number, so checking needs only the key and the text.
    </p>

    <!-- one column per word; dashed line = the 0.5 an unkeyed writer averages -->
    <div class="wm-cols mt-3" aria-hidden="true">
      <div class="wm-cols-null"></div>
      {#each words as w, i}
        <div class="wm-col" class:pending={i >= scoredCount} class:current={i === scoredCount - 1}>
          <div class="wm-col-fill" style={`height:${gPct(w.g)}%`}></div>
        </div>
      {/each}
    </div>
    <div class="wm-cols-cap font-monospace">
      <span>secret score per word</span>
      <span>dashed = 0.5</span>
    </div>

    <!-- running statistic -->
    <div class="wm-mean mt-3">
      <div class="wm-mean-track">
        <div class="wm-mean-fill" style={`width:${scoredCount ? test.meanG * 100 : 0}%`}></div>
        <div class="wm-mean-ref" style="left:50%"></div>
      </div>
      <div class="wm-stat-line font-monospace">
        <span class="wm-mean-num">mean secret score = {scoredCount ? test.meanG.toFixed(2) : "–"}</span>
        <span class="wm-sep">·</span>
        <span>ordinary text ≈ 0.50</span>
      </div>
    </div>

    <p class="wm-blurb mt-3 mb-0">{blurb}</p>
  </div>
</div>

<style>
  .wm-card {
    background: var(--surface-raised, var(--bs-tertiary-bg));
    border: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .wm-controls {
    gap: 0.4rem;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .wm-wordcount {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-right: 0.25rem;
  }

  .hidden {
    visibility: hidden;
  }

  /* --- toolbar --- */
  .wm-toolbar {
    gap: 0.5rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.78rem;
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
    padding: 0.15rem 0.6rem;
    font: inherit;
    cursor: pointer;
  }

  .wm-seg-btn.on {
    background: var(--text-strong, var(--bs-body-color));
    color: var(--surface, var(--bs-body-bg));
  }

  .wm-verdict {
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

  /* --- passage --- */
  .wm-passage {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.3rem;
    line-height: 1.9;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-prompt {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .wm-word {
    position: relative;
    border-radius: 3px;
    padding: 0 0.08em;
    transition: background 250ms ease;
  }

  .wm-word.scored {
    background: color-mix(in srgb, var(--accent, #c4362b) var(--tint), transparent);
  }

  /* underline length = g, so the score reads without color */
  .wm-word::after {
    content: "";
    position: absolute;
    left: 0.08em;
    bottom: 0.05em;
    height: 2.5px;
    width: 0;
    background: var(--accent, #c4362b);
    border-radius: 999px;
    transition: width 300ms ease;
  }

  .wm-word.scored::after {
    width: calc(var(--gw) - 0.16em);
  }

  .wm-word.current {
    outline: 1.5px solid var(--text-strong, var(--bs-body-color));
    outline-offset: 1px;
  }

  /* the word that keys the current score */
  .keyword {
    text-decoration: underline dashed var(--text-muted, var(--bs-secondary-color));
    text-underline-offset: 0.3em;
  }

  /* --- recipe --- */
  .wm-recipe {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.4rem;
    transition: opacity 250ms ease;
  }

  .wm-recipe-half {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
  }

  .wm-recipe.dim {
    opacity: 0.4;
  }

  .wm-ing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
  }

  .wm-ing-val {
    border: 1px solid var(--border-hairline, var(--bs-border-color));
    border-radius: 6px;
    background: var(--surface, var(--bs-body-bg));
    padding: 0.2rem 0.5rem;
    font-size: 0.85rem;
    color: var(--text-strong, var(--bs-body-color));
    text-align: center;
    white-space: nowrap;
  }

  /* fixed widths so changing words and numbers don't shift the row */
  .wm-ing-word .wm-ing-val {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1rem;
    padding: 0.05rem 0.5rem;
    min-width: 7.5rem;
  }

  .wm-ing-hash .wm-ing-val {
    min-width: 9.5rem;
  }

  .wm-ing-g .wm-ing-val {
    color: var(--accent, #c4362b);
    font-weight: 700;
    border-color: var(--accent, #c4362b);
  }

  .wm-ing-cap {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.66rem;
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .wm-op {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.78rem;
    color: var(--text-muted, var(--bs-secondary-color));
    padding-top: 0.3rem;
    white-space: nowrap;
  }

  .wm-recipe-note {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.85rem;
    font-style: italic;
    color: var(--text-faint, var(--bs-secondary-color));
    margin-top: 0.4rem;
  }

  /* --- per-word columns --- */
  .wm-cols {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 72px;
    border-bottom: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .wm-cols-null {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 50%;
    border-top: 1.5px dashed var(--text-muted, var(--bs-secondary-color));
    z-index: 1;
  }

  .wm-col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
  }

  .wm-col-fill {
    width: 100%;
    background: color-mix(in srgb, var(--accent, #c4362b) 70%, transparent);
    border-radius: 2px 2px 0 0;
    transition: opacity 250ms ease;
  }

  .wm-col.current .wm-col-fill {
    background: var(--accent, #c4362b);
  }

  .wm-col.pending .wm-col-fill {
    visibility: hidden;
  }

  .wm-cols-cap {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--text-faint, var(--bs-secondary-color));
    margin-top: 0.25rem;
  }

  /* --- mean g --- */
  .wm-mean-track {
    position: relative;
    height: 12px;
    background: var(--bs-secondary-bg-subtle, #e6e6e6);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 0.35rem;
  }

  .wm-mean-fill {
    height: 100%;
    background: var(--accent, #c4362b);
    transition: width 350ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .wm-mean-ref {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: var(--surface-raised, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-strong, #000) 45%, transparent);
  }

  .wm-stat-line {
    font-size: 0.82rem;
    color: var(--text-body, var(--bs-body-color));
  }

  .wm-mean-num {
    color: var(--accent, #c4362b);
    font-weight: 600;
  }

  .wm-sep {
    color: var(--text-faint, var(--bs-secondary-color));
    margin: 0 0.4rem;
  }

  .wm-blurb {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.95rem;
    color: var(--text-muted, var(--bs-secondary-color));
    min-height: 3em;
  }
</style>
