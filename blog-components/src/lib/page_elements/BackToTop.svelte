<script lang="ts">
  let { scrollToTopCallback = null } = $props();

  const scrollTopOptions: ScrollToOptions = {
    top: 0,
    behavior: "smooth",
  };

  function scrollToTop(event: Event): void {
    event.preventDefault();
    window.scrollTo(scrollTopOptions);

    if (typeof scrollToTopCallback === "function") {
      scrollToTopCallback();
    }
  }
</script>

<a class="back-to-top" href="#top" onclick={scrollToTop}> ↑ Back to top </a>

<style>
  .back-to-top {
    display: block;
    margin-top: 1rem;
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-decoration: none;
    color: var(--text-muted, #76716a);
    transition: color 0.15s ease;
  }

  .back-to-top:hover {
    color: var(--accent, #c4362b);
  }
</style>
