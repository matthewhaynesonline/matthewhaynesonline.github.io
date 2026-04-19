<script lang="ts">
  const WIDTH = 500;
  const HEIGHT = 300;

  const X_CENTER = WIDTH / 2;
  const Y_CENTER = HEIGHT / 2;

  const X_SCALE = 30;
  const Y_SCALE = 55;

  const PATH_UNIT = 3.5;

  const SAMPLE_POINTS = [-2.8, -1.4, 0.6, 1.9, 3.1];

  let enabled = $state(false);
  let autoCycle = $state(true);

  $effect(() => {
    const interval = setInterval(() => {
      if (!autoCycle) return;

      enabled = !enabled;
    }, 5000);

    return () => clearInterval(interval);
  });

  function linearPath(): string {
    const [x1, y1] = toSVG(-PATH_UNIT, -PATH_UNIT);
    const [x2, y2] = toSVG(PATH_UNIT, PATH_UNIT);

    return `M${x1},${y1} L${x2},${y2}`;
  }

  function buildPath(fn: Function): string {
    const pts: string[] = [];

    for (let i = -400; i <= 400; i++) {
      const x = (i / 400) * (WIDTH / 2 / X_SCALE) * PATH_UNIT;
      const y = fn(x);
      const [sx, sy] = toSVG(x, y);
      const prefix = i === -400 ? "M" : "L";
      const path = `${prefix}${sx.toFixed(2)},${sy.toFixed(2)}`;

      pts.push(path);
    }

    return pts.join(" ");
  }

  function tanh(x: number): number {
    return Math.tanh(x);
  }

  function toSVG(x: number, y: number): number[] {
    return [X_CENTER + x * X_SCALE, Y_CENTER - y * Y_SCALE];
  }
</script>

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">tanh(x)</h5>

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
      <!-- Grid lines -->
      {#each [-4, -2, 2, 4] as tick}
        <line
          x1={toSVG(tick, 0)[0]}
          y1="20"
          x2={toSVG(tick, 0)[0]}
          y2={HEIGHT - 20}
          class="grid-line"
        />

        <line
          x1="20"
          y1={toSVG(0, (tick / PATH_UNIT) * 1)[1]}
          x2={WIDTH - 20}
          y2={toSVG(0, (tick / PATH_UNIT) * 1)[1]}
          class="grid-line"
        />
      {/each}

      <!-- Axes -->
      <line x1="20" y1={Y_CENTER} x2={WIDTH - 20} y2={Y_CENTER} class="axis" />
      <line x1={X_CENTER} y1="20" x2={X_CENTER} y2={HEIGHT - 20} class="axis" />

      <!-- Axis labels -->
      <text x={WIDTH - 18} y={Y_CENTER - 8} class="axis-label">x</text>
      <text x={X_CENTER + 8} y="28" class="axis-label">y</text>

      <!-- Bound lines at +-1 -->
      {#if enabled}
        <line
          x1="20"
          y1={toSVG(0, 1)[1]}
          x2={WIDTH - 20}
          y2={toSVG(0, 1)[1]}
          class="bound-line"
        />

        <line
          x1="20"
          y1={toSVG(0, -1)[1]}
          x2={WIDTH - 20}
          y2={toSVG(0, -1)[1]}
          class="bound-line"
        />

        <!-- <text x="28" y={toSVG(0, 1)[1] - 6} class="bound-label">+1</text>
        <text x="28" y={toSVG(0, -1)[1] + 16} class="bound-label">-1</text> -->
      {/if}

      <!-- Linear reference (off state) -->
      <path d={linearPath()} class="linear-path" class:faded={enabled} />

      <!-- tanh curve (on state) -->
      <path d={buildPath(tanh)} class="tanh-path" class:visible={enabled} />

      {#each SAMPLE_POINTS as x}
        {@const rawY = x * 2}
        {@const tanhY = tanh(x)}
        {@const [sx, syRaw] = toSVG(x, rawY / PATH_UNIT)}
        {@const [, syTanh] = toSVG(x, tanhY)}
        <circle
          cx={sx}
          cy={enabled ? syTanh : syRaw}
          r="5"
          class="sample-dot"
          class:transformed={enabled}
          style="transition-delay: {SAMPLE_POINTS.indexOf(x) * 40}ms"
        />
      {/each}
    </svg>
  </div>
</div>

<style>
  .grid-line {
    stroke: var(--bs-tertiary-color);
    stroke-width: 1;
  }

  .axis {
    stroke: var(--bs-body-color);
    stroke-width: 1.5;
  }

  .axis-label {
    fill: var(--bs-body-color);
    font-size: 11px;
    font-family: monospace;
  }

  .bound-line {
    stroke: var(--color-positive);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.5;
  }

  .bound-label {
    fill: var(--color-positive);
    font-size: 10px;
    font-family: monospace;
    opacity: 0.7;
  }

  .linear-path {
    fill: none;
    stroke: var(--bs-tertiary-color);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
    transition: opacity 0.4s;
  }

  .linear-path.faded {
    opacity: 0.2;
  }

  .tanh-path {
    fill: none;
    stroke: var(--color-positive);
    stroke-width: 2.5;
    opacity: 0;
    transition: opacity 0.4s;
  }

  .tanh-path.visible {
    opacity: 1;
  }

  .sample-dot {
    fill: var(--color-negative);

    transition: all 300ms ease-out;
  }

  .sample-dot.transformed {
    fill: var(--color-positive);
  }
</style>
