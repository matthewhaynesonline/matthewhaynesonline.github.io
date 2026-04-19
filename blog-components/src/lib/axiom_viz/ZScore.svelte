<script lang="ts">
  const PRIMARY_HEX = "#dc3545";
  const INFO_HEX = "#0dcaf0";

  const COLOR_A = PRIMARY_HEX;
  const COLOR_B = INFO_HEX;

  const WIDTH = 500;
  const HEIGHT = 200;
  const PAD = 40;
  const TRACK_WIDTH = WIDTH - PAD * 2;

  const RAW_POINTS = [
    { x: -0.1, group: "A", id: 0 },
    { x: -0.05, group: "A", id: 1 },
    { x: -0.02, group: "A", id: 1 },
    { x: 0.01, group: "A", id: 2 },
    { x: 0.06, group: "A", id: 2 },
    { x: 0.15, group: "A", id: 3 },
    //
    { x: -0.45, group: "B", id: 4 },
    { x: -0.3, group: "B", id: 5 },
    { x: -0.2, group: "B", id: 5 },
    { x: 0.05, group: "B", id: 6 },
    { x: 0.2, group: "B", id: 7 },
    { x: 0.25, group: "B", id: 7 },
    { x: 0.4, group: "B", id: 8 },
  ];

  const RAW_MIN = -0.5;
  const RAW_MAX = 0.5;
  const Z_MIN = -2.2;
  const Z_MAX = 2.2;

  function groupStats(group: string) {
    const pts = RAW_POINTS.filter((p) => p.group === group);
    const mean = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const std = Math.sqrt(
      pts.reduce((s, p) => s + (p.x - mean) ** 2, 0) / pts.length,
    );
    return { mean, std };
  }

  const STATS_A = groupStats("A");
  const STATS_B = groupStats("B");

  function zScore(x: number, group: string): number {
    const { mean, std } = group === "A" ? STATS_A : STATS_B;
    return (x - mean) / std;
  }

  const Z_POINTS = RAW_POINTS.map((p) => ({ ...p, z: zScore(p.x, p.group) }));

  let enabled = $state(false);
  let autoCycle = $state(true);

  $effect(() => {
    const interval = setInterval(() => {
      if (!autoCycle) return;
      enabled = !enabled;
    }, 5000);

    return () => clearInterval(interval);
  });

  function toX(val: number, min: number, max: number): number {
    return PAD + ((val - min) / (max - min)) * TRACK_WIDTH;
  }

  function ptColor(group: string): string {
    return group === "A" ? COLOR_A : COLOR_B;
  }
</script>

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">z-score normalization</h5>

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
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} xmlns="http://www.w3.org/2000/svg">
      <!-- Track -->
      <line
        x1={PAD}
        y1={HEIGHT / 2}
        x2={WIDTH - PAD}
        y2={HEIGHT / 2}
        class="track"
      />

      <!-- End ticks -->
      <line
        x1={PAD}
        y1={HEIGHT / 2 - 10}
        x2={PAD}
        y2={HEIGHT / 2 + 10}
        class="tick"
      />
      <line
        x1={WIDTH - PAD}
        y1={HEIGHT / 2 - 10}
        x2={WIDTH - PAD}
        y2={HEIGHT / 2 + 10}
        class="tick"
      />

      <!-- Axis markers -->
      {#if enabled}
        <!-- Shared zero line -->
        {@const zx = toX(0, Z_MIN, Z_MAX)}
        <line
          x1={zx}
          y1={HEIGHT / 2 - 14}
          x2={zx}
          y2={HEIGHT / 2 + 14}
          class="zero-tick"
        />
        <text x={zx} y={HEIGHT / 2 + 28} class="mid-label" text-anchor="middle"
          >μ=0</text
        >

        <!-- σ markers -->
        {#each [-1, 1] as s}
          {@const sx = toX(s, Z_MIN, Z_MAX)}
          <line
            x1={sx}
            y1={HEIGHT / 2 - 8}
            x2={sx}
            y2={HEIGHT / 2 + 8}
            class="sigma-tick"
          />
          <text
            x={sx}
            y={HEIGHT / 2 + 28}
            class="mid-label"
            text-anchor="middle"
          >
            {s > 0 ? "+" : ""}σ
          </text>
        {/each}
      {:else}
        <!-- Per-group mean ticks in raw space -->
        {@const mxA = toX(STATS_A.mean, RAW_MIN, RAW_MAX)}
        <line
          x1={mxA}
          y1={HEIGHT / 2 - 14}
          x2={mxA}
          y2={HEIGHT / 2 + 14}
          class="zero-tick"
          style="stroke: {COLOR_A}"
        />

        {@const mxB = toX(STATS_B.mean, RAW_MIN, RAW_MAX)}
        <line
          x1={mxB}
          y1={HEIGHT / 2 - 14}
          x2={mxB}
          y2={HEIGHT / 2 + 14}
          class="zero-tick"
          style="stroke: {COLOR_B}"
        />
      {/if}

      <!-- Points -->
      {#each RAW_POINTS as pt, i}
        {@const rawX = toX(pt.x, RAW_MIN, RAW_MAX)}
        {@const normX = toX(Z_POINTS[i].z, Z_MIN, Z_MAX)}
        {@const cx = enabled ? normX : rawX}
        {@const yOff = pt.group === "A" ? -48 : 48}

        <circle
          {cx}
          cy={HEIGHT / 2 + yOff}
          r="6"
          fill={ptColor(pt.group)}
          class="dot"
          style="transition-delay: {i * 35}ms"
        />
      {/each}

      <!-- Group labels -->
      <text
        x={PAD - 4}
        y={HEIGHT / 2 - 14}
        class="group-label"
        text-anchor="end"
        fill={COLOR_A}>A</text
      >
      <text
        x={PAD - 4}
        y={HEIGHT / 2 + 22}
        class="group-label"
        text-anchor="end"
        fill={COLOR_B}>B</text
      >
    </svg>
  </div>
</div>

<style>
  .track {
    stroke: var(--bs-tertiary-color);
    stroke-width: 2;
  }

  .tick {
    stroke: var(--bs-secondary-color);
    stroke-width: 1.5;
  }

  .zero-tick {
    stroke: var(--bs-body-color);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .sigma-tick {
    stroke: var(--bs-secondary-color);
    stroke-width: 1;
  }

  .mid-label {
    fill: var(--bs-body-color);
    font-size: 10px;
    font-family: monospace;
  }

  .group-label {
    font-size: 12px;
    font-family: monospace;
  }

  .dot {
    transition: all 300ms ease-out;
  }
</style>
