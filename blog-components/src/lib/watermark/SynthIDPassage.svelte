<script lang="ts">
  import { arrowNav } from "./arrowNav";
  import { PROMPT, writePassage, meanGTest, type WrittenWord } from "./synthidPassage";
  /**
   * SynthID watermarking — a whole passage, written one word at a time.
   *
   * The SynthID counterpart to the green-list walkthrough. At each position the
   * candidates are stamped with a keyed g-score, the highest one is written,
   * and the next position is keyed on the word just written. Each written word
   * keeps its g-score as a tint plus an underline bar (the non-color cue), and
   * a running mean-g sits against the 0.5 an unwatermarked writer averages.
   *
   * Choice positions take two steps (Score, then Write) so the winner isn't
   * shown before the scores; one-option positions are the low-entropy case and
   * are written in a single step. Everything is computed from the shared
   * passage module, so the detection component re-derives the same numbers.
   */

  type Phase = "score" | "write";
  type Step = { position: number; phase: Phase };

  const words: WrittenWord[] = writePassage("watermarked");

  // Flat step list: choice positions score first, then write.
  const steps: Step[] = words.flatMap((w, position): Step[] =>
    w.candidates.length > 1
      ? [
          { position, phase: "score" },
          { position, phase: "write" },
        ]
      : [{ position, phase: "write" }],
  );

  const MAX_CANDIDATES = Math.max(...words.map((w) => w.candidates.length));
  const PLAY_MS = 650;

  let stepIdx = $state(-1); // -1 == nothing written yet
  let playing = $state(false);
  let showScores = $state(true);

  const step = $derived<Step | null>(stepIdx >= 0 ? steps[stepIdx]! : null);
  const current = $derived(step ? words[step.position]! : null);
  const picked = $derived(step?.phase === "write");
  const writtenCount = $derived(step ? step.position + (picked ? 1 : 0) : 0);
  const written = $derived(words.slice(0, writtenCount));
  const test = $derived(meanGTest(written.map((w) => w.g)));
  const done = $derived(writtenCount === words.length);

  // Reserve every candidate row so the panel never changes height on camera.
  const rows = $derived(
    Array.from({ length: MAX_CANDIDATES }, (_, i) => current?.candidates[i] ?? null),
  );

  const blurb = $derived.by(() => {
    if (done)
      return `Mean secret score of ${test.meanG.toFixed(2)} across ${words.length} words. It reads like ordinary prose, but text written without the key averages 0.50.`;
    if (!current) return "The model is about to write. Every position gets scored with the secret key.";
    if (current.candidates.length === 1)
      return `Only one sensible word here, so "${current.word}" is written regardless. No choice, no signal.`;
    if (!picked) return "Score each candidate with the secret key and the word just written.";

    return `"${current.word}" has the highest secret score, so it's written. A fresh set of scores comes with the next word.`;
  });

  function next(): void {
    if (stepIdx < steps.length - 1) stepIdx++;
  }
  function prev(): void {
    if (stepIdx > -1) stepIdx--;
  }
  function stepNext(): void {
    playing = false;
    next();
  }
  function stepPrev(): void {
    playing = false;
    prev();
  }
  function reset(): void {
    playing = false;
    stepIdx = -1;
  }
  function togglePlay(): void {
    if (done) stepIdx = -1; // replay from the top
    playing = !playing;
  }

  $effect(() => {
    if (!playing) return;

    const id = setInterval(() => {
      if (stepIdx >= steps.length - 1) playing = false;
      else stepIdx++;
    }, PLAY_MS);

    return () => clearInterval(id);
  });

  const gPct = (g: number): number => Math.round(g * 100);
</script>

<div class="card wm-card" use:arrowNav={{ prev: stepPrev, next: stepNext }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">synthid watermarking</h5>

    <div class="d-flex align-items-center wm-controls">
      <span class="wm-wordcount">word {step ? step.position + 1 : 0} / {words.length}</span>
      <button class="btn btn-sm btn-light rounded" disabled={stepIdx === -1} onclick={stepPrev} aria-label="Previous step">◀</button>
      <button class="btn btn-sm btn-light rounded" disabled={done} onclick={stepNext} aria-label="Next step">▶</button>
      <button class="btn btn-sm btn-outline-secondary" onclick={togglePlay}>{playing ? "⏸" : done ? "↻" : "▶ play"}</button>
      <button class="btn btn-sm btn-outline-secondary" onclick={reset} aria-label="Reset">↺</button>
    </div>
  </div>

  <div class="card-body">
    <div class="wm-toolbar d-flex flex-wrap align-items-center">
      <div class="wm-seg">
        <button class="wm-seg-btn" class:on={!showScores} onclick={() => (showScores = false)}>as read</button>
        <button class="wm-seg-btn" class:on={showScores} onclick={() => (showScores = true)}>secret scores</button>
      </div>
    </div>

    <!-- the passage: tint and underline length both track g -->
    <p class="wm-passage mt-3 mb-0" class:scored={showScores}>
      <span class="wm-prompt">{PROMPT}</span>{#each written as w, i}{" "}<span class="wm-word" class:latest={i === writtenCount - 1 && !done} style={`--tint:${Math.round(w.g * 45)}%;--gw:${gPct(w.g)}%`} title={`g = ${w.g.toFixed(2)}`}>{w.word}</span>{w.after}{/each}{#if !done}<span class="wm-caret">▍</span>{/if}
    </p>

    <!-- this position's candidates -->
    <div class="wm-pos mt-3">
      <div class="wm-ctx font-monospace" class:hidden={!current}>
        g(key, “{current?.context ?? ""}” → candidate)
      </div>
      <div class="wm-cands">
        {#each rows as c}
          {@const isWin = picked && c !== null && c.word === current?.word}
          <div class="wm-cand" class:hidden={c === null} class:win={isWin} class:dimmed={picked && !isWin}>
            <span class="wm-cand-word">{c?.word ?? "·"}{#if isWin}<span class="wm-check"> ✓</span>{/if}</span>
            <div class="wm-g-track"><div class="wm-g-fill" style={`width:${c ? gPct(c.g) : 0}%`}></div></div>
            <span class="wm-g-num font-monospace">g={c ? c.g.toFixed(2) : "0.00"}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- running mean g against the unwatermarked 0.5 -->
    <div class="wm-mean mt-3">
      <div class="wm-mean-track">
        <div class="wm-mean-fill" style={`width:${written.length ? test.meanG * 100 : 0}%`}></div>
        <div class="wm-mean-ref" style="left:50%" title="unwatermarked text averages 0.5"></div>
      </div>
      <div class="wm-mean-line font-monospace">
        <span class="wm-mean-num">mean secret score = {written.length ? test.meanG.toFixed(2) : "–"}</span>
        <span class="wm-sep">·</span>
        <span>{written.length} words</span>
        <span class="wm-mean-note">white tick = 0.50, ordinary text</span>
      </div>
    </div>

    <p class="wm-blurb mt-2 mb-0">{blurb}</p>

    <p class="wm-note">
      Simplified: each position is keyed on the single previous word, and the
      highest secret score wins outright. Real SynthID keys on the last few tokens and
      runs a tournament over draws from the model's probabilities.
    </p>
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

  /* --- passage --- */
  .wm-passage {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.35rem;
    line-height: 1.9;
    color: var(--text-strong, var(--bs-body-color));
    /* room for every word, so the card doesn't grow as the text fills in */
    min-height: 5.7em;
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

  .wm-passage.scored .wm-word {
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

  .wm-passage.scored .wm-word::after {
    width: calc(var(--gw) - 0.16em);
  }

  .wm-word.latest {
    outline: 1.5px solid var(--text-strong, var(--bs-body-color));
    outline-offset: 1px;
  }

  .wm-caret {
    color: var(--text-faint, var(--bs-secondary-color));
    animation: wm-blink 1s step-end infinite;
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

  .wm-mean-line {
    display: flex;
    align-items: baseline;
    font-size: 0.82rem;
    color: var(--text-body, var(--bs-body-color));
  }

  .wm-mean-num {
    color: var(--accent, #c4362b);
    font-weight: 600;
  }

  .wm-mean-note {
    margin-left: auto;
    font-size: 0.72rem;
    color: var(--text-faint, var(--bs-secondary-color));
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

  /* --- candidates --- */
  .wm-ctx {
    font-size: 0.8rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-bottom: 0.5rem;
  }

  .wm-cands {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.6rem;
  }

  .hidden {
    visibility: hidden;
  }

  .wm-cand {
    border: 1px solid var(--border-hairline, var(--bs-border-color));
    border-radius: 8px;
    padding: 0.4rem 0.55rem;
    background: var(--surface, var(--bs-body-bg));
    transition: all 250ms ease;
  }

  .wm-cand.win {
    border-color: var(--accent, #c4362b);
    background: color-mix(in srgb, var(--accent, #c4362b) 10%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #c4362b) 20%, transparent);
  }

  .wm-cand.dimmed {
    opacity: 0.4;
  }

  .wm-cand-word {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.1rem;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-check {
    font-weight: 700;
    color: var(--accent, #c4362b);
  }

  .wm-g-track {
    margin-top: 0.3rem;
    height: 6px;
    background: var(--bs-secondary-bg-subtle, #e6e6e6);
    border-radius: 999px;
    overflow: hidden;
  }

  .wm-g-fill {
    height: 100%;
    background: var(--accent, #c4362b);
    border-radius: 999px;
    transition: width 350ms ease;
  }

  .wm-g-num {
    font-size: 0.72rem;
    color: var(--text-body, var(--bs-body-color));
  }

  .wm-note {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.82rem;
    font-style: italic;
    color: var(--text-faint, var(--bs-secondary-color));
    margin: 1rem 0 0;
  }


  @keyframes wm-blink {
    50% {
      opacity: 0;
    }
  }
</style>
