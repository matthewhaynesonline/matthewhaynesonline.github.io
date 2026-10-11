<script lang="ts">
  /**
   * Zero-width watermark reveal.
   *
   * The "invisible characters" guess: weave a run of zero-width codepoints
   * between the words of an otherwise-plain sentence. `revealed` toggles the
   * rendered-as-nothing text for an x-ray view that surfaces each hidden
   * character as a labelled chip.
   *
   * Codepoints are stored as numbers, never the literal glyphs — the glyphs
   * render to nothing, so a raw one pasted into source would be an invisible
   * landmine. That invisibility is exactly the trap this widget exposes.
   */

  type ZChar = { code: number; label: string; name: string };

  const ZWSP: ZChar = { code: 0x200b, label: "ZWSP", name: "Zero-Width Space" };
  const ZWNJ: ZChar = { code: 0x200c, label: "ZWNJ", name: "Zero-Width Non-Joiner" };
  const ZWJ: ZChar = { code: 0x200d, label: "ZWJ", name: "Zero-Width Joiner" };
  const WJ: ZChar = { code: 0x2060, label: "WJ", name: "Word Joiner" };

  const sentence = "Totally ordinary text, nothing hidden here.";

  // One hidden run per inter-word gap. A real scheme would encode a payload
  // (vendor id, a bit pattern); the exact bytes don't matter here — the point
  // is that every gap is silently carrying characters.
  const hiddenRuns: ZChar[][] = [
    [ZWSP, ZWNJ],
    [ZWJ],
    [ZWSP, ZWSP, WJ],
    [ZWNJ, ZWJ],
    [WJ],
    [ZWSP],
  ];

  const words = sentence.split(" ");

  function runFor(gapIndex: number): ZChar[] {
    return hiddenRuns[gapIndex % hiddenRuns.length];
  }

  // The real watermarked string, hidden glyphs and all. Rendered verbatim in
  // the clean view so a reader who selects and copies it carries the payload.
  const watermarkedText = words
    .map((word, i) =>
      i < words.length - 1
        ? word + runFor(i).map((c) => String.fromCodePoint(c.code)).join("") + " "
        : word,
    )
    .join("");

  type FlatItem = { text: string } | { chip: ZChar };

  // Flat token stream for the x-ray view: word, its trailing hidden run, a
  // space, next word, ... Rendered on one line below so Svelte injects no
  // stray whitespace between the chips and the words they're woven into.
  const flat: FlatItem[] = [];
  words.forEach((word, i) => {
    flat.push({ text: word });
    if (i < words.length - 1) {
      runFor(i).forEach((c) => flat.push({ chip: c }));
      flat.push({ text: " " });
    }
  });

  const hiddenCount = words
    .slice(0, -1)
    .reduce((sum, _, i) => sum + runFor(i).length, 0);

  // Distinct hidden-char types actually present, for the reveal legend.
  const legend: ZChar[] = [ZWSP, ZWNJ, ZWJ, WJ].filter((c) =>
    hiddenRuns.some((run) => run.some((r) => r.code === c.code)),
  );

  function codeLabel(code: number): string {
    return "U+" + code.toString(16).toUpperCase().padStart(4, "0");
  }

  let revealed = $state(false);
</script>

<div class="card wm-card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">invisible characters</h5>

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
        <p class="wm-sample mb-0">{#each flat as item}{#if "chip" in item}<span class="wm-chip" title={item.chip.name}>{item.chip.label}</span>{:else}<span class="wm-text">{item.text}</span>{/if}{/each}</p>
      {:else}
        <p class="wm-sample mb-0"><span class="wm-text">{watermarkedText}</span></p>
      {/if}
    </div>


    {#if revealed}
      <div class="wm-legend mt-3">
        {#each legend as ch}
          <span class="wm-legend-item">
            <span class="wm-chip">{ch.label}</span>
            <span class="wm-legend-name">{ch.name}</span>
            <span class="wm-legend-code">{codeLabel(ch.code)}</span>
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
    font-size: 1.35rem;
    line-height: 2.1;
    color: var(--text-strong, var(--bs-body-color));
    word-break: break-word;
  }

  .wm-chip {
    display: inline-block;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.66rem;
    font-weight: 600;
    line-height: 1;
    padding: 0.22em 0.42em;
    margin: 0 0.14em;
    border-radius: 4px;
    color: var(--accent-ink, #fff);
    background: var(--accent, #c4362b);
    vertical-align: 0.15em;
    animation: wm-pop 220ms ease-out both;
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

  .wm-legend-name {
    color: var(--text-body, var(--bs-body-color));
  }

  .wm-legend-code {
    color: var(--text-faint, var(--bs-secondary-color));
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
</style>
