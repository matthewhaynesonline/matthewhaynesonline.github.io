<script lang="ts">
  /**
   * Blockchain, high level: step through adding blocks to a chain.
   *
   * Each block's hash covers its own contents plus the previous block's hash,
   * so every block points back at the one before it. The newest link (this
   * block's `prev` = the last block's `hash`) is highlighted as blocks arrive.
   *
   * All slots are laid out up front (empty ones as faint placeholders) so the
   * card never changes size while stepping — no jumps on a recording.
   */
  import { arrowNav } from "../watermark/arrowNav";

  type Block = { index: number; data: string; prev: string; hash: string };

  const GENESIS_PREV = "00000000";

  const DATA = [
    "genesis",
    "Alice → Bob · 5",
    "Bob → Carol · 2",
    "Carol → Dave · 1",
    "Dave → Alice · 3",
    "Erin → Bob · 4",
  ];

  // cyrb53-style 53-bit hash, shown as 8 hex chars — a stand-in for SHA-256
  // that's stable, fast, and changes completely with any input change.
  function hash(input: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const full = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");

    return full.slice(0, 8);
  }

  // Build the whole chain once; stepping only reveals more of it.
  const chain: Block[] = DATA.reduce<Block[]>((blocks, data, index) => {
    const prev = index === 0 ? GENESIS_PREV : blocks[index - 1].hash;
    blocks.push({ index, data, prev, hash: hash(`${index}|${prev}|${data}`) });

    return blocks;
  }, []);

  let count = $state(1); // blocks currently on the chain (genesis always present)

  function next(): void {
    count = Math.min(chain.length, count + 1);
  }

  function prev(): void {
    count = Math.max(1, count - 1);
  }

  function reset(): void {
    count = 1;
  }
</script>

<div class="card wm-card" use:arrowNav={{ prev, next }}>
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0 font-monospace">blockchain</h5>

    <div class="d-flex align-items-center bc-controls">
      <span class="bc-count font-monospace">blocks {count} / {chain.length}</span>
      <button class="btn btn-sm btn-light rounded" disabled={count <= 1} onclick={prev} aria-label="Remove block">◀</button>
      <button class="btn btn-sm btn-light rounded" disabled={count >= chain.length} onclick={next} aria-label="Add block">▶</button>
      <button class="btn btn-sm btn-outline-secondary" onclick={reset} aria-label="Reset">↺</button>
    </div>
  </div>

  <div class="card-body">
    <div class="bc-chain">
      {#each chain as block, i}
        {@const added = i < count}
        {@const newest = i === count - 1 && i > 0}
        {@const linkedFrom = i === count - 2}
        <div class="bc-slot" class:added class:next={i === count}>
          {#if added}
            <div class="bc-block" class:newest>
              <div class="bc-head font-monospace">
                <span class="bc-index">#{block.index}</span>
                {#if i === 0}<span class="bc-tag">genesis</span>{/if}
              </div>
              <div class="bc-data">{block.data}</div>
              <div class="bc-field font-monospace" class:link={newest}>
                <span class="bc-label">prev</span>
                <span class="bc-val">{block.prev}</span>
              </div>
              <div class="bc-field font-monospace" class:link={linkedFrom}>
                <span class="bc-label">hash</span>
                <span class="bc-val">{block.hash}</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .wm-card {
    background: var(--surface-raised, var(--bs-tertiary-bg));
    border: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .bc-controls {
    gap: 0.4rem;
  }

  .bc-count {
    font-size: 0.8rem;
    color: var(--text-muted, var(--bs-secondary-color));
    margin-right: 0.25rem;
  }

  .bc-chain {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem 2rem;
  }

  .bc-slot {
    position: relative;
    min-height: 9.5rem;
    border-radius: 10px;
  }

  /* the slot the next block will land in */
  .bc-slot.next {
    border: 1.5px dashed var(--border-control, var(--bs-border-color));
  }

  /* back-pointer between neighbours in a row */
  .bc-slot.added:not(:nth-child(3n + 1))::before {
    content: "←";
    position: absolute;
    left: -1.55rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.1rem;
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .bc-block {
    height: 100%;
    padding: 0.75rem 0.85rem;
    border-radius: 10px;
    border: 1px solid var(--border-hairline, var(--bs-border-color));
    background: var(--surface, var(--bs-body-bg));
    animation: bc-pop 260ms ease-out both;
  }

  .bc-block.newest {
    border-color: var(--accent, #c4362b);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #c4362b) 18%, transparent);
  }

  .bc-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 0.78rem;
    color: var(--text-muted, var(--bs-secondary-color));
  }

  .bc-index {
    font-weight: 700;
    color: var(--text-strong, var(--bs-body-color));
  }

  .bc-tag {
    font-size: 0.68rem;
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .bc-data {
    font-family: var(--font-body, Georgia, serif);
    font-size: 1.1rem;
    color: var(--text-strong, var(--bs-body-color));
    margin: 0.35rem 0 0.6rem;
  }

  .bc-field {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    padding: 0.15rem 0.35rem;
    margin: 0 -0.35rem;
    border-radius: 4px;
    transition: background 250ms ease;
  }

  .bc-label {
    color: var(--text-faint, var(--bs-secondary-color));
  }

  .bc-val {
    color: var(--text-body, var(--bs-body-color));
  }

  /* the matching pair: newest.prev === previous.hash */
  .bc-field.link {
    background: color-mix(in srgb, var(--accent, #c4362b) 14%, transparent);
  }

  .bc-field.link .bc-val {
    color: var(--accent, #c4362b);
    font-weight: 700;
  }

  @keyframes bc-pop {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
