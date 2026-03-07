<script lang="ts">
  import BackToTop from "./lib/BackToTop.svelte";

  interface Heading {
    id: string;
    text: string | null;
    level: string;
  }

  let {
    contentSelector = "#main-content",
    headingsToTarget = "h2",
    title = "On this page",
  } = $props();

  let headings = $state<Heading[]>([]);
  let activeId = $state("");
  let detailsElement: HTMLDetailsElement | null = $state(null);

  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -60% 0px",
    threshold: 1.0,
  };

  const inPageNavListClasses =
    "in-page-nav-list list-unstyled border-start border-2 border-secondary mb-0";

  const navLinkClasses = "nav-link px-3 py-2 text-truncate d-block";

  $effect(() => {
    const contentContainer = document.querySelector(contentSelector);

    if (!contentContainer) return;

    const headingNodes = Array.from(
      contentContainer.querySelectorAll(headingsToTarget),
    );

    if (headingNodes.length === 0) return;

    const parsedHeadings: Heading[] = [];

    headingNodes.forEach((heading, index) => {
      if (!heading.id) {
        const slug = generateSlug(heading.textContent || "");
        heading.id = `${slug}-${index}`;
      }

      parsedHeadings.push({
        id: heading.id,
        text: heading.textContent,
        level: heading.tagName.charAt(1),
      });
    });

    headings = parsedHeadings;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeId = entry.target.id;
        }
      });
    }, observerOptions);

    headingNodes.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  });

  function reset(): void {
    activeId = "";
    closeDetailsElement();
  }

  function handleMobileLinkClick(): void {
    closeDetailsElement();
  }

  function closeDetailsElement(): void {
    if (detailsElement) {
      detailsElement.removeAttribute("open");
    }
  }

  function generateSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }
</script>

{#if headings.length > 0}
  <nav class="in-page-nav-wrapper d-none d-md-block" aria-label={title}>
    {#if title}
      <h6 class="in-page-nav-title">{title}</h6>
    {/if}

    <ul class={inPageNavListClasses}>
      {#each headings as { id, text, level }}
        <li class="nav-item level-{level}">
          <a
            href="#{id}"
            class="{navLinkClasses} {activeId === id
              ? 'active text-primary fw-bold border-start border-2 border-primary'
              : 'text-light-emphasis'}"
          >
            {text}
          </a>
        </li>
      {/each}
    </ul>

    <BackToTop scrollToTopCallback={reset} />
  </nav>

  <div class="card d-block d-md-none">
    <div class="card-body p-1">
      <details bind:this={detailsElement}>
        <summary
          class="btn bg-transparent border-0 w-100 d-flex justify-content-between align-items-center"
        >
          <span class="mobile-nav-title">{title}</span>
          <span class="mobile-nav-icon">▼</span>
        </summary>

        <div class="mobile-nav-dropdown text-start mt-2">
          <ul class={inPageNavListClasses}>
            {#each headings as { id, text, level }}
              <li class="nav-item level-{level}">
                <a
                  href="#{id}"
                  class="{navLinkClasses} {activeId === id
                    ? 'text-primary fw-bold'
                    : ''}"
                  onclick={handleMobileLinkClick}
                >
                  {text}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      </details>
    </div>
  </div>
{/if}

<style>
  .in-page-nav-title {
    font-size: 1rem;
  }

  .in-page-nav-wrapper {
    font-size: 0.9rem;
  }

  .nav-item.level-3 {
    padding-left: 1rem;
  }
  .nav-item.level-4 {
    padding-left: 2rem;
  }

  .nav-link {
    margin-left: -2px;
    border-left: 2px solid transparent;
  }

  .nav-link:hover {
    color: var(--bs-primary) !important;
  }

  .back-to-top {
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .back-to-top:hover {
    text-decoration: underline;
  }

  .mobile-nav-dropdown {
    padding: 0.5rem 1rem;
    max-height: 60vh;
    overflow-y: auto;
  }

  summary {
    list-style: none;
    outline: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .mobile-nav-icon {
    display: inline-block;
    transition: transform 0.2s ease-in-out;
  }

  details[open] .mobile-nav-icon {
    transform: rotate(180deg);
  }
</style>
