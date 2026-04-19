<script lang="ts">
  const SUCCESS_HEX = "#2dd4c9";
  const DANGER_HEX = "#f87185";
  const NEUTRAL_HEX = "#9ca3af";

  const TRACK_X = 48;
  const TRACK_W = 440;
  const TRACK_MID = TRACK_X + TRACK_W / 2;

  const TERMS = [
    { id: "puppy", label: "puppy", goodSim: 0.8, evilSim: 0.2 },
    { id: "neutral", label: "neutral", goodSim: 0.51, evilSim: 0.49 },
    { id: "fascist", label: "fascist", goodSim: 0.01, evilSim: 0.99 },
  ];

  let activeId = $state(TERMS[0].id);
  let autoCycle = $state(true);

  const activeTerm = $derived(TERMS.find((t) => t.id === activeId)!);

  const score = $derived(activeTerm.goodSim - activeTerm.evilSim);

  $effect(() => {
    const interval = setInterval(() => {
      if (!autoCycle) return;
      nextTerm();
    }, 5000);
    return () => clearInterval(interval);
  });

  function nextTerm() {
    const currentIndex = TERMS.findIndex((t) => t.id === activeId);
    activeId = TERMS[(currentIndex + 1) % TERMS.length].id;
  }

  function barWidth(sim: number): number {
    return sim * TRACK_W;
  }

  function scoreBarX(): number {
    return score >= 0 ? TRACK_MID : TRACK_MID + (score / 2) * TRACK_W;
  }

  function scoreBarW(): number {
    return (Math.abs(score) / 2) * TRACK_W;
  }
  function scoreColor(s: number): string {
    if (s > 0.075) return SUCCESS_HEX;
    if (s < -0.075) return DANGER_HEX;
    return NEUTRAL_HEX;
  }
</script>

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">naive good / evil scoring</h5>

    <div>
      {#each TERMS as term}
        <button
          class="btn btn-sm rounded py-1 px-2 me-2"
          class:btn-secondary={activeId === term.id}
          class:btn-outline-secondary={activeId !== term.id}
          onclick={() => {
            activeId = term.id;
            autoCycle = false;
          }}
        >
          {term.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="card-body">
    <svg viewBox="0 0 680 270" xmlns="http://www.w3.org/2000/svg">
      <!-- Row labels -->
      <text x="100" y="45" class="row-label" text-anchor="end">
        sim("good")
      </text>

      <text x="100" y="113" class="row-label" text-anchor="end">
        sim("evil")
      </text>

      <text x="57" y="182" class="row-label" text-anchor="end">score</text>

      <!-- Track backgrounds -->
      <rect
        x={TRACK_X}
        y="56"
        width={TRACK_W}
        height="32"
        rx="6"
        class="track"
      />

      <rect
        x={TRACK_X}
        y="124"
        width={TRACK_W}
        height="32"
        rx="6"
        class="track"
      />

      <rect
        x={TRACK_X}
        y="192"
        width={TRACK_W}
        height="32"
        rx="6"
        class="track"
      />

      <!-- Good bar -->
      <rect
        x={TRACK_X}
        y="56"
        width={barWidth(activeTerm.goodSim)}
        height="32"
        rx="6"
        fill={SUCCESS_HEX}
        opacity="0.8"
        class="bar"
      />

      <text
        x={TRACK_X + barWidth(activeTerm.goodSim) - 8}
        y="72"
        class="bar-label"
        text-anchor="end"
      >
        {activeTerm.goodSim.toFixed(2)}
      </text>

      <!-- Evil bar -->
      <rect
        x={TRACK_X}
        y="124"
        width={barWidth(activeTerm.evilSim)}
        height="32"
        rx="6"
        fill={DANGER_HEX}
        opacity="0.8"
        class="bar"
      />

      <text
        x={TRACK_X + barWidth(activeTerm.evilSim) - 8}
        y="140"
        class="bar-label"
        text-anchor="end"
      >
        {activeTerm.evilSim.toFixed(2)}
      </text>

      <!-- Score bar -->
      <line
        x1={TRACK_MID}
        y1="192"
        x2={TRACK_MID}
        y2="224"
        class="center-tick"
      />

      <rect
        x={scoreBarX()}
        y="192"
        width={scoreBarW()}
        height="32"
        rx="0"
        fill={scoreColor(score)}
        opacity="0.85"
        class="bar"
      />
      <!-- re-stroke track on top to get clean rounded corners -->
      <rect
        x={TRACK_X}
        y="192"
        width={TRACK_W}
        height="32"
        rx="6"
        class="track-overlay"
      />

      <text
        x={score >= 0 ? scoreBarX() + scoreBarW() - 8 : scoreBarX() + 8}
        y="208"
        class="bar-label"
        text-anchor={score >= 0 ? "end" : "start"}
      >
        {score >= 0 ? "+" : ""}{score.toFixed(2)}
      </text>

      <!-- Score axis labels -->
      <text x={TRACK_X + 4} y="244" class="axis-label danger">-1 evil</text>
      <text x={TRACK_MID} y="244" class="axis-label muted" text-anchor="middle">
        0
      </text>
      <text
        x={TRACK_X + TRACK_W - 4}
        y="244"
        class="axis-label success"
        text-anchor="end">+1 good</text
      >

      <!-- Formula callout -->
      <path d="M510 72 L522 72 L522 140 L510 140" class="bracket" />
      <line x1="522" y1="106" x2="548" y2="106" class="bracket" />
      <text x="560" y="105" class="formula">good - evil</text>
    </svg>
  </div>
</div>

<style>
  .row-label {
    font-size: 12px;
    font-family: monospace;
    fill: var(--bs-secondary-color);
    dominant-baseline: central;
  }

  .track {
    fill: var(--bs-tertiary-bg);
    stroke: var(--bs-border-color);
    stroke-width: 0.5;
  }

  .track-overlay {
    fill: none;
    stroke: var(--bs-border-color);
    stroke-width: 0.5;
  }

  .bar {
    transition:
      width 0.4s ease,
      x 0.4s ease,
      fill 0.4s ease;
  }

  .bar-label {
    font-size: 11px;
    font-family: monospace;
    font-weight: 600;
    fill: var(--bs-body-color);
    dominant-baseline: central;
    pointer-events: none;
  }

  .center-tick {
    stroke: var(--bs-border-color);
    stroke-width: 1;
  }

  .axis-label {
    font-size: 11px;
    font-family: monospace;
  }

  .axis-label.danger {
    fill: var(--color-negative);
  }
  .axis-label.success {
    fill: var(--color-positive);
  }
  .axis-label.muted {
    fill: var(--bs-secondary-color);
  }

  .bracket {
    fill: none;
    stroke: var(--bs-border-color);
    stroke-width: 1;
  }

  .formula {
    font-size: 11px;
    font-family: monospace;
    fill: var(--bs-secondary-color);
    dominant-baseline: central;
  }
</style>
