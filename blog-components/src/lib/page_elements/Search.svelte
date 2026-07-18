<script lang="ts">
  import { onMount } from "svelte";
  import Fuse from "fuse.js";

  interface SearchItem {
    title: string;
    url: string;
    date: string;
    kind?: string;
    tags?: string[];
    excerpt?: string;
  }

  let { jsonUrl = "/search.json" } = $props();

  const fuseOptions = {
    isCaseSensitive: false,
    includeScore: true,
    shouldSort: true,
    minMatchCharLength: 2,
    threshold: 0.4,
    distance: 200,
    keys: [
      { name: "title", weight: 0.6 },
      { name: "excerpt", weight: 0.3 },
      { name: "date", weight: 0.1 },
    ],
  };

  let query = $state("");
  let fuse = $state<Fuse<SearchItem> | null>(null);
  let isLoading = $state(true);
  let showModal = $state(false);
  let results = $derived(fuse && query.trim() !== "" ? fuse.search(query) : []);

  let hasQuery = $derived(query.trim() !== "");

  onMount(async () => {
    try {
      const response = await fetch(jsonUrl);
      const data: SearchItem[] = await response.json();

      fuse = new Fuse(data, fuseOptions);
    } catch (error) {
      console.error("Error loading search index:", error);
    } finally {
      isLoading = false;
    }
  });

  // Handle Cmd+K / Ctrl+K and Escape
  function handleGlobalKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      openModal();
    }

    if (e.key === "Escape" && showModal) {
      closeModal();
    }
  }

  function openModal(): void {
    showModal = true;
  }

  function closeModal(): void {
    showModal = false;
    query = "";
  }

  function autoFocus(node: HTMLInputElement): void {
    node.focus();
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<button class="search-trigger" onclick={openModal} aria-label="Open search">
  <span class="search-trigger-full">
    Search
    <kbd>⌘K</kbd>
  </span>
  <span class="search-trigger-glyph" aria-hidden="true">⌕</span>
</button>

{#if showModal}
  <div class="modal-backdrop fade show"></div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    onclick={closeModal}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-dialog modal-dialog-scrollable modal-lg mt-5"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-content search-modal">
        <div class="search-modal-input">
          <span class="search-modal-glyph" aria-hidden="true">⌕</span>

          <input
            use:autoFocus
            type="search"
            bind:value={query}
            placeholder={isLoading ? "Loading index..." : "Search..."}
            disabled={isLoading}
          />

          <button
            type="button"
            class="search-modal-esc"
            aria-label="Close"
            onclick={closeModal}
          >
            esc
          </button>
        </div>

        {#if hasQuery}
          <div class="modal-body search-modal-results">
            {#each results as { item } (item.url)}
              <a href={item.url} class="search-result" onclick={closeModal}>
                <span
                  class="search-result-kind"
                  class:search-result-kind--accent={item.kind === "Essay"}
                >
                  {item.kind || "Post"}
                </span>

                <span class="search-result-main">
                  <span class="search-result-title">{item.title}</span>
                  <span class="search-result-meta">{item.date}</span>
                </span>

                <span class="search-result-enter" aria-hidden="true">↵</span>
              </a>
            {:else}
              <div class="search-no-results">
                No results for “<strong>{query}</strong>”
              </div>
            {/each}
          </div>
        {/if}

        <div class="search-modal-footer">
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>

          {#if hasQuery}
            <span class="search-modal-count">
              {results.length}
              {results.length === 1 ? "result" : "results"}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* --- Trigger --- */
  .search-trigger {
    display: inline-flex;
    align-items: center;
    /* Frosted surface chip (same treatment as the essay-hero meta chips)
       so the trigger stays legible over the smoky masthead / banner art. */
    background: color-mix(in srgb, var(--surface, #f4f1ea) 62%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    letter-spacing: 0.06em;
    color: var(--text-ui, #57544c);
    border: 1px solid var(--border-control, #cfc8ba);
    border-radius: 7px;
    padding: 6px 10px;
    cursor: pointer;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .search-trigger:hover {
    color: var(--text-strong, inherit);
    border-color: var(--text-strong, currentColor);
  }

  .search-trigger-full {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .search-trigger kbd {
    background: transparent;
    border: 1px solid var(--border-control, #cfc8ba);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 10px;
    font-family: inherit;
    color: inherit;
  }

  .search-trigger-glyph {
    display: none;
    font-size: 16px;
    line-height: 1;
  }

  @media (max-width: 575px) {
    .search-trigger {
      border: 0;
      padding: 4px 6px;
      color: var(--text-ui, #57544c);
    }

    .search-trigger-full {
      display: none;
    }

    .search-trigger-glyph {
      display: inline;
    }
  }

  /* --- Modal --- */
  .search-modal {
    background: var(--surface, #f4f1ea);
    border: 0;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: var(--shadow-pop, 0 30px 70px -20px rgba(0, 0, 0, 0.55));
  }

  .search-modal-input {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-hairline, #ddd6c8);
  }

  .search-modal-glyph {
    font-size: 19px;
    color: var(--text-faint, #9b958c);
  }

  .search-modal-input input {
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    font-family: var(--font-body, serif);
    font-size: 22px;
    color: var(--text-strong, inherit);
    caret-color: var(--accent, #c4362b);
  }

  .search-modal-input input::placeholder {
    color: var(--text-faint, #9b958c);
  }

  .search-modal-esc {
    background: transparent;
    cursor: pointer;
    font-family: var(--font-mono, monospace);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint, #9b958c);
    border: 1px solid var(--border-control, #cfc8ba);
    border-radius: 5px;
    padding: 4px 8px;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .search-modal-esc:hover {
    color: var(--text-strong, inherit);
    border-color: var(--text-strong, currentColor);
  }

  /* --- Results --- */
  .search-modal-results {
    padding: 14px 12px 8px;
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border-radius: 9px;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .search-result:hover {
    background: var(--surface-raised, #efe9dd);
  }

  .search-result-kind {
    font-family: var(--font-mono, monospace);
    font-size: 9.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted, #76716a);
    border: 1px solid var(--border-control, #cfc8ba);
    border-radius: 4px;
    padding: 3px 7px;
    white-space: nowrap;
  }

  .search-result-kind--accent {
    color: var(--accent, #c4362b);
    border-color: var(--accent, #c4362b);
  }

  .search-result-main {
    flex: 1;
    min-width: 0;
  }

  .search-result-title {
    display: block;
    font-family: var(--font-body, serif);
    font-size: 18px;
    color: var(--text-strong, inherit);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-result:hover .search-result-title {
    color: var(--accent, #c4362b);
  }

  .search-result-meta {
    display: block;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--text-faint, #9b958c);
    margin-top: 3px;
  }

  .search-result-enter {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: var(--text-faint, #9b958c);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .search-result:hover .search-result-enter {
    opacity: 1;
  }

  .search-no-results {
    padding: 40px 20px;
    text-align: center;
    font-style: italic;
    color: var(--text-muted, #76716a);
  }

  /* --- Footer hints --- */
  .search-modal-footer {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 12px 20px;
    border-top: 1px solid var(--border-hairline, #ddd6c8);
    font-family: var(--font-mono, monospace);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted, #76716a);
  }

  .search-modal-footer kbd {
    background: transparent;
    color: var(--text-strong, inherit);
    font-family: inherit;
    font-size: inherit;
    padding: 0;
  }

  .search-modal-count {
    margin-left: auto;
    color: var(--text-faint, #9b958c);
  }
</style>
