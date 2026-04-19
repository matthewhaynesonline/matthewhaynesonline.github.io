<script lang="ts">
  const SUCCESS_HEX = "#2dd4c9";
  const DANGER_HEX = "#f87185";
  const NEUTRAL_HEX = "#9ca3af";

  // Axis: evil(-) <---> good(+)
  const AXIS_START = { x: 80, y: 260 };
  const AXIS_END = { x: 420, y: 90 };

  const TERMS = [
    {
      id: "puppy",
      label: "PUPPY",
      ex: 320,
      ey: 80,
      score: 0.82,
      color: SUCCESS_HEX,
    },

    {
      id: "neutral",
      label: "NEUTRAL",
      ex: 250,
      ey: 190,
      score: 0.02,
      color: NEUTRAL_HEX,
    },

    {
      id: "fascist",
      label: "FASCIST",
      ex: 130,
      ey: 260,
      score: -0.81,
      color: DANGER_HEX,
    },
  ];

  // Axis unit vector
  const D_X = AXIS_END.x - AXIS_START.x;
  const D_Y = AXIS_END.y - AXIS_START.y;

  const AXIS_LEN = Math.sqrt(D_X * D_X + D_Y * D_Y);

  const U_X = D_X / AXIS_LEN;
  const U_Y = D_Y / AXIS_LEN;

  let enabled = $state(false);
  let autoCycle = $state(true);

  $effect(() => {
    const interval = setInterval(() => {
      if (!autoCycle) return;

      enabled = !enabled;
    }, 5000);

    return () => clearInterval(interval);
  });

  function getProjection(term: object): object {
    // Project term embedding onto axis
    const wx = term.ex - AXIS_START.x;
    const wy = term.ey - AXIS_START.y;
    const dot = wx * U_X + wy * U_Y;

    return {
      px: AXIS_START.x + dot * U_X,
      py: AXIS_START.y + dot * U_Y,
      scalar: dot / AXIS_END,
    };
  }

  function scoreColor(score: number): string {
    if (score > 0.3) return SUCCESS_HEX;
    if (score < -0.3) return DANGER_HEX;
    return NEUTRAL_HEX;
  }
</script>

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">semantic axis projection</h5>

    <button
      class="btn btn-sm"
      class:btn-secondary={enabled}
      class:btn-outline-secondary={!enabled}
      onclick={() => {
        enabled = !enabled;
        autoCycle = false;
      }}
    >
      {enabled ? "on" : "off"}
    </button>
  </div>

  <div class="card-body">
    <svg viewBox="0 0 500 330" xmlns="http://www.w3.org/2000/svg">
      <!-- Grid -->
      {#each [0, 1, 2, 3, 4, 5, 6] as i}
        <line x1={i * 84} y1="0" x2={i * 84} y2="330" class="grid" />
        <line x1="0" y1={i * 55} x2="500" y2={i * 55} class="grid" />
      {/each}

      <!-- Projection drop lines (shown when active) -->
      {#if enabled}
        {#each TERMS as term}
          {@const proj = getProjection(term)}
          <line
            x1={term.ex}
            y1={term.ey}
            x2={proj.px}
            y2={proj.py}
            class="drop-line"
          />
        {/each}
      {/if}

      <!-- Axis -->
      <!-- Arrow end -->
      <defs>
        <marker
          id="arrowhead-good"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={SUCCESS_HEX} />
        </marker>

        <marker
          id="arrowhead-evil"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="3"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={DANGER_HEX} />
        </marker>
      </defs>

      <line
        x1={AXIS_START.x}
        y1={AXIS_START.y}
        x2={AXIS_END.x}
        y2={AXIS_END.y}
        class="axis-line"
        marker-end="url(#arrowhead-good)"
        marker-start="url(#arrowhead-evil)"
      />

      <!-- Axis pole labels -->
      <text
        x={AXIS_START.x - 8}
        y={AXIS_START.y + 18}
        class="pole-label evil"
        text-anchor="middle">EVIL</text
      >

      <text
        x={AXIS_END.x + 8}
        y={AXIS_END.y - 12}
        class="pole-label good"
        text-anchor="middle">GOOD</text
      >

      <!-- Projection dots on axis -->
      {#if enabled}
        {#each TERMS as term}
          {@const proj = getProjection(term)}
          <circle
            cx={proj.px}
            cy={proj.py}
            r="5"
            fill={scoreColor(term.score)}
            class="proj-dot"
          />
        {/each}
      {/if}

      <!-- term embedding dots -->
      {#each TERMS as term}
        <g>
          <circle
            cx={term.ex}
            cy={term.ey}
            r={7}
            fill={term.color}
            class="term-dot"
            opacity={enabled ? 0.5 : 1}
          />

          <text
            x={term.ex + 12}
            y={term.ey + 4}
            class="term-label"
            fill={term.color}
            opacity={enabled ? 0.5 : 1}>{term.label}</text
          >
        </g>
      {/each}
    </svg>
  </div>
</div>

<style>
  .grid {
    stroke: var(--bs-tertiary-color);
    stroke-width: 1;
    opacity: 0.15;
  }

  .axis-line {
    stroke: var(--bs-body-color);
    stroke-width: 2;
  }

  .pole-label {
    font-size: 11px;
    font-family: monospace;
    font-weight: 600;
    letter-spacing: 0.1em;
  }

  .pole-label.evil {
    fill: var(--color-negative);
  }

  .pole-label.good {
    fill: var(--color-positive);
  }

  .drop-line {
    stroke: var(--bs-secondary-color);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0;
    animation: fadeIn 0.3s forwards;
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }

  .term-dot {
    transition:
      r 0.15s,
      opacity 0.3s;
  }

  .term-label {
    font-size: 11px;
    font-family: monospace;
    font-weight: 600;
    letter-spacing: 0.08em;
    transition: opacity 0.3s;
    pointer-events: none;
  }

  .proj-dot {
    opacity: 0;
    animation: fadeIn 0.3s forwards;
    transition: opacity 0.3s;
  }
</style>
