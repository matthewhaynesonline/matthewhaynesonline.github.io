<script lang="ts">
  import { onMount } from "svelte";
  import Fuse from "fuse.js";

  interface SearchItem {
    title: string;
    url: string;
    date: string;
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

<button
  class="search-trigger scale-80 btn btn-outline-secondary d-flex justify-content-between align-items-center bg-body text-muted w-100"
  onclick={openModal}
  aria-label="Open search"
>
  <span><i class="bi bi-search me-2"></i>Search...</span>
  <kbd class="bg-body-secondary border text-body text-decoration-none">⌘K</kbd>
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
      <div class="modal-content shadow-lg border-0 overflow-hidden">
        <div class="modal-header p-3 border-bottom d-flex align-items-center">
          <i class="bi bi-search text-primary fs-5 me-3"></i>

          <input
            use:autoFocus
            type="search"
            class="form-control form-control-lg border-0 shadow-none px-0"
            bind:value={query}
            placeholder={isLoading ? "Loading index..." : "Search..."}
            disabled={isLoading}
          />

          <button
            type="button"
            class="btn-close modal-close-button"
            aria-label="Close"
            onclick={closeModal}
          ></button>
        </div>

        {#if hasQuery}
          <div class="modal-body p-0">
            <div class="list-group list-group-flush">
              {#each results as { item } (item.url)}
                <a
                  href={item.url}
                  class="list-group-item list-group-item-action p-3"
                  onclick={closeModal}
                >
                  <div
                    class="d-flex w-100 justify-content-between align-items-center"
                  >
                    <h6 class="mb-1 text-primary fw-bold">{item.title}</h6>
                    <small class="text-body-secondary">{item.date}</small>
                  </div>

                  {#if item.excerpt}
                    <p class="mb-0 small text-body-secondary text-truncate">
                      {item.excerpt}
                    </p>
                  {/if}
                </a>
              {:else}
                <div class="p-5 text-center text-muted">
                  <i class="bi bi-search fs-1 d-block mb-3 opacity-25"></i>
                  No results found for "<strong>{query}</strong>"
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div
          class="modal-footer bg-body-tertiary border-top-0 py-2 d-flex justify-content-start small text-muted"
        >
          <span><kbd class="me-1">esc</kbd> to close</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .search-trigger {
    min-width: 180px;
    max-width: 300px;
    transform-origin: left center;
  }

  /* Strip out the heavy default blue glow from the modal input */
  .modal-header input:focus {
    box-shadow: none;
    outline: none;
  }

  /* Prevent modal X and search input X from appearing right next to each other */
  .modal-close-button {
    position: relative;
    bottom: 20px;
  }
</style>
