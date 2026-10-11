<script lang="ts">
  import { arrowNav } from "./arrowNav";
  /**
   * SynthID-Text Tournament sampling — the core generation mechanism, stepped.
   *
   * The sibling of the green-list scheme, walked one position at a time:
   *
   *   Distribution -> Draw -> Score -> Tournament -> Emit
   *
   * The model's true distribution is never edited. Instead each tournament slot
   * is filled by rolling the model's own dice (probability = lottery tickets,
   * no top-k cutoff), every candidate is stamped with a keyed g-score, and a
   * single-elimination bracket emits the highest-g survivor. A long-shot can
   * beat the favourite by drawing a higher score — that tilt is the watermark,
   * and because the entrants were all plausible to begin with, quality is
   * preserved without a δ to mistune.
   *
   * g-scores are a real keyed pseudorandom function of (key, context, token),
   * so a detector re-derives them from the key alone — never the model. The key
   * is fixed and secret; what varies per position is the context, so "new
   * position" reshuffles the scores exactly as a fresh preceding n-gram would.
   */

  type Tok = { word: string; p: number };
  type Ent = { word: string; p: number; g: number };
  type Entropy = "high" | "low";

  // The secret key. Chosen so that at context 0 the g-scores reproduce the
  // worked example (cat 0.30, bird 0.70) with bird as the overall high — in a
  // real system it is a fixed secret, never surfaced.
  const KEY = "key-22006";

  const DISTRIBUTIONS: Record<Entropy, Tok[]> = {
    high: [
      { word: "cat", p: 0.5 },
      { word: "dog", p: 0.3 },
      { word: "bird", p: 0.15 },
      { word: "fish", p: 0.05 },
    ],
    // Near-deterministic step ("Barack" -> "Obama"): no real freedom to mark.
    low: [
      { word: "Obama", p: 0.99 },
      { word: "era", p: 0.006 },
      { word: "years", p: 0.003 },
      { word: "White", p: 0.001 },
    ],
  };

  const CONTEXT_WORD: Record<Entropy, string> = { high: "The", low: "Barack" };

  // Deterministic first draw per (entropy, entrants) so the opening view always
  // matches the prose; "redraw" switches to a live weighted lottery. The high/4
  // script keeps a duplicate "cat" to show that a likely token simply gets more
  // tickets, not a guaranteed win.
  const SCRIPTED: Record<Entropy, Record<number, string[]>> = {
    high: { 2: ["cat", "bird"], 4: ["cat", "cat", "bird", "dog"] },
    low: { 2: ["Obama", "Obama"], 4: ["Obama", "Obama", "Obama", "Obama"] },
  };

  const Stage = { Distribution: 0, Draw: 1, Score: 2, Tournament: 3, Emit: 4 } as const;
  type StageVal = (typeof Stage)[keyof typeof Stage];
  const LAST_STAGE = Stage.Emit;
  const stageLabels = ["Distribution", "Draw", "Score", "Tournament", "Emit"];

  // Keyed pseudorandom g-score in [0, 1): FNV-1a over key|context|token with a
  // mulberry32 finaliser for a clean spread.
  function gScore(context: number, word: string): number {
    const s = `${KEY}|${context}|${word}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;

    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  }

  function mulberry32(seed: number): () => number {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fill each slot by sampling once from the true distribution — the lottery,
  // with no shortlist. A token shows up in proportion to its probability.
  function drawEntrants(seed: number, dist: Tok[], count: number): string[] {
    const rng = mulberry32(seed);
    const out: string[] = [];
    for (let s = 0; s < count; s++) {
      let x = rng();
      let idx = dist.length - 1;
      for (let j = 0; j < dist.length; j++) {
        x -= dist[j].p;
        if (x < 0) {
          idx = j;
          break;
        }
      }
      out.push(dist[idx].word);
    }

    return out;
  }

  // Higher g-score wins; exact ties (e.g. a token drawn against itself) fall to
  // the more probable one, then to the first slot.
  function better(a: Ent, b: Ent): Ent {
    if (b.g > a.g) return b;
    if (a.g > b.g) return a;

    return b.p > a.p ? b : a;
  }

  // Single-elimination levels: [entrants, round-1 winners, ..., [champion]].
  function bracket(ents: Ent[]): Ent[][] {
    const levels: Ent[][] = [ents];
    let cur = ents;
    while (cur.length > 1) {
      const next: Ent[] = [];
      for (let i = 0; i < cur.length; i += 2) next.push(better(cur[i], cur[i + 1]));
      levels.push(next);
      cur = next;
    }

    return levels;
  }

  let entropy = $state<Entropy>("high");
  let numEntrants = $state(2);
  let context = $state(0); // "position": bumping it re-keys the g-scores
  let redraws = $state(0); // 0 == scripted opening draw
  let stage = $state<StageVal>(Stage.Distribution);

  const dist = $derived(DISTRIBUTIONS[entropy]);
  const pMap = $derived(new Map(dist.map((d) => [d.word, d.p])));

  const drawnWords = $derived(
    redraws === 0
      ? SCRIPTED[entropy][numEntrants]
      : drawEntrants(
          redraws * 1009 + context * 31 + (entropy === "high" ? 0 : 1),
          dist,
          numEntrants,
        ),
  );

  const ents = $derived<Ent[]>(
    drawnWords.map((w) => ({ word: w, p: pMap.get(w) ?? 0, g: gScore(context, w) })),
  );
  const levels = $derived(bracket(ents));
  const champion = $derived(levels[levels.length - 1][0]);

  // An entrant is "winning" if it reaches the next round (matched by object
  // identity, so a token drawn into two slots is tracked per slot) or it's the
  // champion in the final column.
  function isWinning(ent: Ent, levelIndex: number): boolean {
    if (levelIndex === levels.length - 1) return true;

    return levels[levelIndex + 1].includes(ent);
  }
  const topTok = $derived(dist[0]);
  const isUpset = $derived(entropy === "high" && champion.word !== topTok.word);

  // How many entrant slots each drawn word filled — the "tickets" readout.
  const drawCounts = $derived.by(() => {
    const m = new Map<string, number>();
    for (const w of drawnWords) m.set(w, (m.get(w) ?? 0) + 1);

    return m;
  });

  const emitBlurb = $derived(
    entropy === "low"
      ? "Every slot drew the same token, so the g-score has nothing to decide - it's emitted regardless. No signal, and no quality cost."
      : isUpset
        ? `"${champion.word}" wins on its g-score. A ${(champion.p * 100).toFixed(0)}% choice beats the ${(topTok.p * 100).toFixed(0)}%. That tilt, among already probable tokens, is the watermark.`
        : `"${champion.word}" is emitted. Run this across a position's true dice and, averaged over many positions, each token's frequency still tracks its probability - the mark hides in the g-scores, not the counts.`,
  );

  const stageBlurbs = $derived([
    "The model's real next-token distribution.",
    "Fill each slot using the model's own probabilities. No top-k, no cutoff.",
    "Mark every candidate with a keyed g-score in [0,1] using a pseudorandom function of the secret key and the preceding context.",
    "The higher g-score advances each round. Winner takes a high score across the whole bracket.",
    emitBlurb,
  ]);

  const showG = $derived(stage >= Stage.Score);
  const showWinners = $derived(stage >= Stage.Tournament);
  const showEmit = $derived(stage >= Stage.Emit);

  const atStart = $derived(stage === Stage.Distribution);
  const atEnd = $derived(stage === Stage.Emit);

  function reconfigure(toStage: StageVal): void {
    stage = toStage;
  }

  function next(): void {
    if (stage < LAST_STAGE) stage++;
  }
  function prev(): void {
    if (stage > Stage.Distribution) stage--;
  }
  function setEntropy(e: Entropy): void {
    entropy = e;
    redraws = 0;
    context = 0;
    reconfigure(Stage.Distribution);
  }
  function setEntrants(n: number): void {
    numEntrants = n;
    redraws = 0;
    reconfigure(Stage.Draw);
  }
  function redraw(): void {
    redraws++;
    reconfigure(Stage.Draw);
  }
  function newPosition(): void {
    context++;
    redraws = Math.max(redraws, 1); // leave the scripted opening behind
    reconfigure(Stage.Draw);
  }

  // g-meter fill and winner classes reused across the bracket.
  const gPct = (g: number): number => Math.round(g * 100);
</script>

<div class="card wm-card" use:arrowNav={{ prev, next }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">tournament sampling</h5>

    <div class="d-flex align-items-center wm-controls">
      <button class="btn btn-sm btn-light rounded" disabled={atStart} onclick={prev} aria-label="Previous step">◀</button>
      <button class="btn btn-sm btn-light rounded" disabled={atEnd} onclick={next} aria-label="Next step">▶</button>
    </div>
  </div>

  <div class="card-body">
    <!-- config toolbar -->
    <div class="wm-toolbar d-flex flex-wrap align-items-center">
      <div class="wm-seg">
        <button class="wm-seg-btn" class:on={entropy === "high"} onclick={() => setEntropy("high")}>high entropy</button>
        <button class="wm-seg-btn" class:on={entropy === "low"} onclick={() => setEntropy("low")}>low entropy</button>
      </div>
      <div class="wm-seg">
        <button class="wm-seg-btn" class:on={numEntrants === 2} onclick={() => setEntrants(2)}>2 slots</button>
        <button class="wm-seg-btn" class:on={numEntrants === 4} onclick={() => setEntrants(4)}>4 slots</button>
      </div>
      <button class="wm-ghost" onclick={redraw} title="Re-run the lottery at this position">↻ redraw</button>
      <button class="wm-ghost" onclick={newPosition} title="New context - re-keys every g-score">⏭ new position</button>
      <span class="wm-ctx font-monospace">seed: “{CONTEXT_WORD[entropy]}” · ctx {context}</span>
    </div>

    <p class="wm-note">
      Simplified: each position is seeded by the single previous word. Real
      SynthID keys the g-scores on the last few tokens (an n-gram) plus the
      secret key.
    </p>

    <!-- true distribution -->
    <div class="wm-dist mt-3">
      {#each dist as t}
        {@const count = drawCounts.get(t.word) ?? 0}
        <div class="wm-dist-row" class:drawn={stage >= Stage.Draw && count > 0}>
          <span class="wm-dist-word">{t.word}</span>
          <div class="wm-dist-track"><div class="wm-dist-fill" style={`width:${t.p * 100}%`}></div></div>
          <span class="wm-dist-p font-monospace">{(t.p * 100).toFixed(0)}%</span>
          <span class="wm-dist-tickets font-monospace">{#if stage >= Stage.Draw && count > 0}{count === 1 ? "1 slot" : count + " slots"}{/if}</span>
        </div>
      {/each}
    </div>

    <!-- stage track -->
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

    <!-- bracket -->
    {#if stage >= Stage.Draw}
      <div class="wm-bracket mt-2">
        {#each levels as level, li}
          <div class="wm-level" class:champ-level={li === levels.length - 1} class:pending={li > 0 && !showWinners}>
            {#each level as ent}
              {@const isChamp = li === levels.length - 1}
              {@const winning = isWinning(ent, li)}
              <div class="wm-ent" class:win={showWinners && winning} class:dimmed={showWinners && !winning} class:champ={showEmit && isChamp}>
                <span class="wm-ent-word">{ent.word}</span>
                <span class="wm-ent-p font-monospace">{(ent.p * 100).toFixed(0)}%</span>
                <div class="wm-ent-g" class:show={showG}>
                  <div class="wm-g-track"><div class="wm-g-fill" style={`width:${gPct(ent.g)}%`}></div></div>
                  <span class="wm-g-num font-monospace">g={ent.g.toFixed(2)}</span>
                </div>
              </div>
            {/each}
          </div>
          {#if li < levels.length - 1}<div class="wm-arrow" class:pending={!showWinners} aria-hidden="true">▸</div>{/if}
        {/each}
      </div>
    {/if}

    <!-- emitted token -->
    {#if showEmit}
      <div class="wm-emit mt-3">
        <span class="wm-emit-label font-monospace">emit →</span>
        <span class="wm-emit-word">{champion.word}</span>
        {#if isUpset}<span class="wm-emit-badge">upset</span>{/if}
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

  .wm-ghost {
    background: transparent;
    border: 1px solid var(--border-control, var(--bs-border-color));
    border-radius: 999px;
    color: var(--text-ui, var(--bs-body-color));
    padding: 0.15rem 0.6rem;
    font: inherit;
    cursor: pointer;
  }

  .wm-ghost:hover {
    border-color: var(--text-strong, var(--bs-body-color));
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-ctx {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .wm-note {
    font-family: var(--font-body, Georgia, serif);
    font-size: 0.82rem;
    font-style: italic;
    color: var(--text-faint, var(--bs-secondary-color));
    margin: 0.65rem 0 0;
  }

  /* --- distribution --- */
  .wm-dist {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .wm-dist-row {
    display: grid;
    grid-template-columns: 3.2rem 1fr 2.6rem 3.4rem;
    align-items: center;
    gap: 0.6rem;
    opacity: 0.55;
    transition: opacity 250ms ease;
  }

  .wm-dist-row.drawn {
    opacity: 1;
  }

  .wm-dist-word {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.05rem;
    color: var(--text-strong, var(--bs-body-color));
  }

  .wm-dist-track {
    height: 9px;
    background: var(--bs-secondary-bg-subtle, #e6e6e6);
    border-radius: 999px;
    overflow: hidden;
  }

  .wm-dist-fill {
    height: 100%;
    background: var(--text-faint, #9b958c);
    border-radius: 999px;
  }

  .wm-dist-p {
    font-size: 0.78rem;
    color: var(--text-muted, var(--bs-secondary-color));
    text-align: right;
  }

  .wm-dist-tickets {
    font-size: 0.72rem;
    color: var(--accent, #c4362b);
  }

  /* --- stage track --- */
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
    font-size: 0.7rem;
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
    margin-bottom: 1.1rem;
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
    min-height: 3em;
  }

  /* --- bracket --- */
  .wm-bracket {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    overflow-x: auto;
    padding: 0.4rem 0;
  }

  /* Later rounds keep their space but stay hidden until the Tournament stage,
     so the winner isn't given away early and nothing shifts when it appears. */
  .wm-level.pending,
  .wm-arrow.pending {
    visibility: hidden;
  }

  .wm-level {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 0.6rem;
    min-width: 8.5rem;
  }

  .wm-ent {
    border: 1px solid var(--border-hairline, var(--bs-border-color));
    border-radius: 8px;
    padding: 0.4rem 0.55rem;
    background: var(--surface, var(--bs-body-bg));
    transition: all 250ms ease;
  }

  .wm-ent.dimmed {
    opacity: 0.4;
  }

  .wm-ent.win {
    border-color: color-mix(in srgb, var(--accent, #c4362b) 55%, transparent);
  }

  .wm-ent.champ {
    border-color: var(--accent, #c4362b);
    background: color-mix(in srgb, var(--accent, #c4362b) 10%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #c4362b) 20%, transparent);
  }

  .wm-ent-word {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.1rem;
    color: var(--text-strong, var(--bs-body-color));
    margin-right: 0.4rem;
  }

  .wm-ent-p {
    font-size: 0.72rem;
    color: var(--text-muted, var(--bs-secondary-color));
  }

  .wm-ent-g {
    margin-top: 0.35rem;
    opacity: 0;
    transition: opacity 250ms ease;
  }

  .wm-ent-g.show {
    opacity: 1;
  }

  .wm-g-track {
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

  .wm-arrow {
    color: var(--text-faint, var(--bs-secondary-color));
    font-size: 1.1rem;
    flex: 0 0 auto;
  }

  /* --- emit --- */
  .wm-emit {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .wm-emit-label {
    font-size: 0.78rem;
    color: var(--text-muted, var(--bs-secondary-color));
  }

  .wm-emit-word {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--accent, #c4362b);
  }

  .wm-emit-badge {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #fff;
    background: var(--accent, #c4362b);
    padding: 0.15em 0.5em;
    border-radius: 999px;
  }
</style>
