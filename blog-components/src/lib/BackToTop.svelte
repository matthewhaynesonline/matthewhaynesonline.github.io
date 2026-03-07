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

<a
  class="back-to-top text-light-emphasis mt-3 d-block"
  href="#top"
  onclick={scrollToTop}
>
  ↑ Back to top
</a>

<style>
  .back-to-top {
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .back-to-top:hover {
    text-decoration: underline;
  }
</style>
