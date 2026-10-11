<script lang="ts">
  /**
   * Green boosting vs Tournament sampling — the "in plain terms" contrast.
   *
   * Same seed, two lenses on the same candidates:
   *   - Green boosting COLORS tokens: split the whole vocabulary in two, add δ
   *     to one half's logits, let the nudge tip the sample. Only ever flips a
   *     close call.
   *   - SynthID NUMBERS tokens: stamp each with a keyed g-score in [0,1], then
   *     among the model's own candidates keep the highest. A long-shot can win
   *     outright on its number.
   *
   * This mirrors the one-line framing in the prose; the probability-as-lottery
   * nuance lives in the stepped tournament component, not here.
   */

  type Cand = { word: string; base: number };

  const CANDIDATES: Cand[] = [
    { word: "cat", base: 0.5 },
    { word: "dog", base: 0.3 },
    { word: "bird", base: 0.15 },
    { word: "fish", base: 0.05 },
  ];

  // Fixed boost added to every green candidate's score. Small on purpose — it
  // only changes an outcome when two options were already close.
  const DELTA = 0.15;
  const VOCAB_CELLS = 24;

  // Default chosen so the two sides visibly disagree: green keeps the 50%
  // favourite, numbers crowns the 5% long-shot. Reseeding explores others.
  const INITIAL_SEED = 5;

  function hashUnit(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;

    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  }

  const isGreen = (seed: number, token: string): boolean =>
    hashUnit(`green|${seed}|${token}`) < 0.5;
  const gScore = (seed: number, token: string): number =>
    hashUnit(`g|${seed}|${token}`);

  const argmax = <T,>(items: T[], score: (item: T) => number): T =>
    items.reduce((best, item) => (score(item) > score(best) ? item : best));

  let seed = $state(INITIAL_SEED);

  // Green side: score = base (+δ if green); winner is the argmax.
  const greenScore = (c: Cand): number => c.base + (isGreen(seed, c.word) ? DELTA : 0);
  const greenWinner = $derived(argmax(CANDIDATES, greenScore));

  // Numbers side: winner is simply the highest g among the candidates.
  const numbersWinner = $derived(argmax(CANDIDATES, (c) => gScore(seed, c.word)));

  const vocab = $derived(
    Array.from({ length: VOCAB_CELLS }, (_, i) => isGreen(seed, `vocab|${i}`)),
  );

  // Bar scale so a boosted green bar visibly overtakes a close red one.
  const SCALE = 0.7;
  const pctOf = (v: number): number => Math.min(100, (v / SCALE) * 100);
</script>

<div class="card wm-card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">colors vs numbers</h5>
    <button class="btn btn-sm btn-outline-secondary" onclick={() => seed++}>↻ reseed</button>
  </div>

  <div class="card-body">
    <p class="wm-intro">
      Same seed, same candidates.
    </p>

    <div class="row g-4">
      <!-- GREEN BOOSTING -->
      <div class="col-12 col-lg-6">
        <div class="wm-side">
          <div class="wm-side-head">
            <span class="wm-side-title">Green boosting</span>
            <span class="wm-side-tag">colors → boost one pile</span>
          </div>

          <div class="wm-vocab" title="the whole vocabulary, split in two by the seed">
            {#each vocab as green}<span class="wm-vcell" class:green={green} class:red={!green}></span>{/each}
          </div>

          <div class="wm-cands">
            {#each CANDIDATES as c}
              {@const green = isGreen(seed, c.word)}
              {@const win = c === greenWinner}
              <div class="wm-row" class:win={win}>
                <span class="wm-gr" class:green={green} class:red={!green}>{green ? "G" : "R"}</span>
                <span class="wm-word">{c.word}{#if win}<span class="wm-check"> ✓</span>{/if}</span>
                <div class="wm-bar-track">
                  <div class="wm-bar base" style={`width:${pctOf(c.base)}%`}></div>
                  {#if green}<div class="wm-bar boost" style={`left:${pctOf(c.base)}%;width:${pctOf(DELTA)}%`}></div>{/if}
                </div>
                {#if green}<span class="wm-delta font-monospace">+{DELTA.toFixed(2)}</span>{:else}<span class="wm-delta"></span>{/if}
              </div>
            {/each}
          </div>

          <p class="wm-take">
            Split the whole vocabulary green/red, add δ to green, let it nudge
            the sample. It only tips genuine close calls - here the
            <strong>{greenWinner.word}</strong> favourite is untouched.
          </p>
        </div>
      </div>

      <!-- TOURNAMENT -->
      <div class="col-12 col-lg-6">
        <div class="wm-side">
          <div class="wm-side-head">
            <span class="wm-side-title">Tournament (SynthID)</span>
            <span class="wm-side-tag">numbers → highest of the draws</span>
          </div>

          <div class="wm-vocab wm-vocab-num" title="every token gets its own 0–1 score">
            {#each vocab as _, i}<span class="wm-vnum">{gScore(seed, `vocab|${i}`).toFixed(1)}</span>{/each}
          </div>

          <p class="wm-draw-note">
            The four below aren't the whole vocab - they're the model's own
            candidates, drawn <em>weighted by probability</em> (shown at right).
          </p>

          <div class="wm-cands">
            {#each CANDIDATES as c}
              {@const g = gScore(seed, c.word)}
              {@const win = c === numbersWinner}
              <div class="wm-row" class:win={win}>
                <span class="wm-gnum font-monospace">{g.toFixed(2)}</span>
                <span class="wm-word">{c.word}{#if win}<span class="wm-check"> ✓</span>{/if}</span>
                <div class="wm-bar-track">
                  <div class="wm-bar gbar" style={`width:${g * 100}%`}></div>
                </div>
                <span class="wm-delta font-monospace wm-base-note">{(c.base * 100).toFixed(0)}%</span>
              </div>
            {/each}
          </div>

          <p class="wm-take">
            Mark every token 0–1, then keep the highest score
            <strong>among the model's own drawn candidates</strong>. <strong>{numbersWinner.word}</strong>
            wins on its score{#if numbersWinner.base < 0.2}, a {(numbersWinner.base * 100).toFixed(0)}% long-shot{/if}. Because entrants arrive
            probability-weighted, the long-run distribution is preserved.
          </p>
        </div>
      </div>
    </div>

    <p class="wm-summary">
      Green boosting bends the odds of a whole half of the dictionary; tournament
      sampling leaves the odds alone and instead prefers high-scoring tokens
      among the ones the model already offered.
    </p>
  </div>
</div>

<style>
  .wm-card {
    background: var(--surface-raised, var(--bs-tertiary-bg));
    border: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .wm-intro,
  .wm-summary {
    font-family: var(--font-body, Georgia, serif);
    color: var(--text-body, var(--bs-body-color));
  }

  .wm-intro {
    font-size: 0.98rem;
    margin-bottom: 1.25rem;
  }

  .wm-summary {
    font-size: 0.92rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin: 1.25rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid var(--sep-faint, var(--bs-border-color));
  }

  .wm-side {
    height: 100%;
    padding: 1rem 1.1rem;
    border: 1px solid var(--border-hairline, var(--bs-border-color));
    border-radius: 10px;
    background: var(--surface, var(--bs-body-bg));
  }

  .wm-side-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.75rem;
  }

  .wm-side-title {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.15rem;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-side-tag {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.72rem;
    color: var(--text-muted, var(--bs-secondary-color));
  }

  /* vocabulary strips */
  .wm-vocab {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-bottom: 0.9rem;
  }

  .wm-vcell {
    width: 13px;
    height: 13px;
    border-radius: 2px;
  }

  .wm-vcell.green {
    background: var(--wm-green, #1a9c6b);
  }

  /* red = accent PLUS a diagonal hatch, so it reads in grayscale too */
  .wm-vcell.red {
    background-color: var(--accent, #c4362b);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.5) 0,
      rgba(255, 255, 255, 0.5) 1px,
      transparent 1px,
      transparent 3px
    );
  }

  .wm-vocab-num {
    gap: 4px 8px;
  }

  .wm-draw-note {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.8rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin: 0 0 0.75rem;
  }

  .wm-vnum {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.6rem;
    color: var(--text-faint, var(--bs-secondary-color));
    line-height: 13px;
  }

  /* candidate rows */
  .wm-cands {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .wm-row {
    display: grid;
    grid-template-columns: 2.6rem 4rem 1fr 2.6rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0.15rem 0.35rem;
    border-radius: 6px;
    transition: background 200ms ease;
  }

  .wm-row.win {
    background: color-mix(in srgb, var(--accent, #c4362b) 9%, transparent);
  }

  /* G/R letter badge — a non-color cue for list membership */
  .wm-gr {
    justify-self: center;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.66rem;
    font-weight: 700;
    line-height: 1;
    width: 1.35em;
    height: 1.35em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: #fff;
  }

  .wm-gr.green {
    background: var(--wm-green, #1a9c6b);
  }

  .wm-gr.red {
    background: var(--accent, #c4362b);
  }

  .wm-gnum {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent, #c4362b);
    text-align: center;
  }

  .wm-word {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.05rem;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-check {
    color: var(--accent, #c4362b);
    font-weight: 700;
  }

  .wm-bar-track {
    position: relative;
    height: 10px;
    background: var(--bs-secondary-bg-subtle, #e6e6e6);
    border-radius: 999px;
    overflow: hidden;
  }

  .wm-bar {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 999px;
  }

  .wm-bar.base {
    left: 0;
    background: var(--text-faint, #9b958c);
  }

  .wm-bar.boost {
    background: var(--wm-green, #1a9c6b);
  }

  .wm-bar.gbar {
    left: 0;
    background: var(--accent, #c4362b);
  }

  .wm-delta {
    font-size: 0.68rem;
    color: var(--wm-green, #1a9c6b);
    text-align: right;
  }

  .wm-base-note {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .wm-take {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--text-muted, var(--bs-secondary-color));
    margin: 0.9rem 0 0;
  }

  :global([data-bs-theme="dark"]) .wm-card {
    --wm-green: #3ec78d;
  }
</style>
