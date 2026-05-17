<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="d-flex justify-content-end pt-3">
  <div class="message-bubble bg-body-secondary px-4 py-3 rounded-4 shadow-sm">
    <p class="mb-0">
      {@render children()}
    </p>
  </div>
</div>

<style>
  .message-bubble {
    max-width: 75%;
  }
</style>
