<script lang="ts">
  import type { Snippet } from "svelte";

  let { children, isLoading }: { children: Snippet; isLoading: boolean } =
    $props();
</script>

<div class="pt-3">
  <div class="d-flex align-items-center">
    <div
      class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center message-icon"
    >
      ✦
    </div>

    {#if isLoading}
      <div class="d-flex align-items-center text-secondary-emphasis">
        <span class="mx-2 fst-italic">Model inference</span>

        <span class="spinner-grow spinner-grow-sm text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </span>
      </div>
    {/if}
  </div>

  <div class="mt-3 ms-4">
    {@render children()}
  </div>
</div>

<style>
  .message-icon {
    width: 32px;
    height: 32px;
  }
</style>
