<script lang="ts">
  /**
   * Homoglyph (confusable) substitution reveal.
   *
   * The steganography guess: swap a few Latin letters for glyphs from another
   * script that render identically — Latin "c" (U+0063) for Cyrillic "с"
   * (U+0441). `revealed` highlights which characters are impostors and names
   * the codepoint standing in.
   *
   * Confusable targets are stored as codepoints, not literal glyphs, so the
   * source can't be misread and every swap is auditable at a glance — the same
   * problem that makes these attacks work makes them hostile to read in code.
   */

  type Confusable = { code: number; script: string };

  // Latin letter -> an identical-looking glyph from another script.
  // The trailing comment shows the glyph for the human; code drives the logic.
  const CONFUSABLES: Record<string, Confusable> = {
    a: { code: 0x0430, script: "Cyrillic" }, // а
    c: { code: 0x0441, script: "Cyrillic" }, // с
    e: { code: 0x0435, script: "Cyrillic" }, // е
    o: { code: 0x043e, script: "Cyrillic" }, // о
    p: { code: 0x0440, script: "Cyrillic" }, // р
  };

  const sentence = "This copy carries a secret.";

  // Character offsets into `sentence` that get swapped for their confusable.
  // A sparse scatter reads more like a real watermark than swapping every
  // eligible letter: 5=c, 6=o (copy) · 11=a (carries) · 22=c, 24=e (secret).
  const swapAt = new Set([5, 6, 11, 22, 24]);

  type Token = {
    shown: string; // glyph actually rendered (a confusable when swapped)
    latin: string; // the Latin letter it impersonates
    swapped: boolean;
    actualCode: number;
    script: string;
  };

  function codeLabel(code: number): string {
    return "U+" + code.toString(16).toUpperCase().padStart(4, "0");
  }

  // Build the token stream. A position is swapped only if it's marked AND the
  // letter has a confusable — an unmapped mark degrades to plain text rather
  // than silently rendering the wrong glyph.
  const tokens: Token[] = [...sentence].map((ch, i) => {
    const sub = CONFUSABLES[ch.toLowerCase()];

    if (swapAt.has(i) && sub) {
      return {
        shown: String.fromCodePoint(sub.code),
        latin: ch,
        swapped: true,
        actualCode: sub.code,
        script: sub.script,
      };
    }

    return {
      shown: ch,
      latin: ch,
      swapped: false,
      actualCode: ch.codePointAt(0) ?? 0,
      script: "Latin",
    };
  });

  const watermarkedText = tokens.map((t) => t.shown).join("");
  const swaps = tokens.filter((t) => t.swapped);

  let revealed = $state(false);
</script>

<div class="card wm-card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">homoglyph substitution</h5>

    <button
      class="btn btn-sm"
      class:btn-secondary={revealed}
      class:btn-outline-secondary={!revealed}
      onclick={() => (revealed = !revealed)}
    >
      {revealed ? "hide" : "reveal"}
    </button>
  </div>

  <div class="card-body">
    <div class="wm-stage">
      {#if revealed}
        <p class="wm-sample mb-0">{#each tokens as t}{#if t.swapped}<span class="wm-glyph swapped" title={`${t.script} ${codeLabel(t.actualCode)} impersonating Latin "${t.latin}" ${codeLabel(t.latin.codePointAt(0) ?? 0)}`}>{t.shown}</span>{:else}<span class="wm-glyph">{t.shown}</span>{/if}{/each}</p>
      {:else}
        <p class="wm-sample mb-0"><span class="wm-text">{watermarkedText}</span></p>
      {/if}
    </div>


    {#if revealed}
      <div class="wm-legend mt-3">
        {#each swaps as t}
          <span class="wm-legend-item">
            <span class="wm-glyph swapped wm-legend-glyph">{t.shown}</span>
            <span class="wm-legend-code">{t.script} {codeLabel(t.actualCode)}</span>
            <span class="wm-legend-name">looks like “{t.latin}” {codeLabel(t.latin.codePointAt(0) ?? 0)} Latin</span>
          </span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .wm-card {
    background: var(--surface-raised, var(--bs-tertiary-bg));
    border: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .wm-stage {
    min-height: 3.5rem;
  }

  .wm-sample {
    font-family: var(--font-body, Georgia, "Times New Roman", serif);
    font-size: 1.55rem;
    line-height: 2;
    color: var(--text-strong, var(--bs-body-color));
    word-break: break-word;
  }

  .wm-glyph {
    padding: 0 0.02em;
  }

  .wm-glyph.swapped {
    color: var(--accent, #c4362b);
    background: color-mix(in srgb, var(--accent, #c4362b) 16%, transparent);
    border-bottom: 2px solid var(--accent, #c4362b);
    border-radius: 3px;
    animation: wm-flash 260ms ease-out both;
  }



  .wm-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--sep-faint, var(--bs-border-color));
  }

  .wm-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    color: var(--text-muted, var(--bs-secondary-color));
  }

  .wm-legend-glyph {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.05rem;
    line-height: 1;
  }

  .wm-legend-code {
    color: var(--text-body, var(--bs-body-color));
  }

  .wm-legend-name {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  @keyframes wm-flash {
    from {
      background: var(--accent, #c4362b);
      color: var(--accent-ink, #fff);
    }
    to {
      background: color-mix(in srgb, var(--accent, #c4362b) 16%, transparent);
    }
  }
</style>
