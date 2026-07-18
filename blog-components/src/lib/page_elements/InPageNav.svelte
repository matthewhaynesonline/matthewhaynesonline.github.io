<script lang="ts">
  import BackToTop from "./BackToTop.svelte";

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
      <div class="in-page-nav-title">{title}</div>
    {/if}

    <ul class="in-page-nav-list">
      {#each headings as { id, text, level }}
        <li class="nav-item level-{level}">
          <a href="#{id}" class="nav-link" class:active={activeId === id}>
            {text}
          </a>
        </li>
      {/each}
    </ul>

    <BackToTop scrollToTopCallback={reset} />
  </nav>

  <div class="mobile-toc d-block d-md-none">
    <details bind:this={detailsElement}>
      <summary>
        <span class="in-page-nav-title mobile-nav-title">{title}</span>
        <span class="mobile-nav-icon">▾</span>
      </summary>

      <div class="mobile-nav-dropdown">
        <ul class="in-page-nav-list">
          {#each headings as { id, text, level }}
            <li class="nav-item level-{level}">
              <a
                href="#{id}"
                class="nav-link"
                class:active={activeId === id}
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
{/if}

<style>
  .in-page-nav-title {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-faint, #9b958c);
    margin-bottom: 16px;
  }

  .in-page-nav-wrapper {
    opacity: 0.6;
    transition: opacity 300ms ease-out;
  }

  .in-page-nav-wrapper:hover {
    opacity: 1;
  }

  .in-page-nav-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .nav-item.level-3 {
    padding-left: 1rem;
  }
  .nav-item.level-4 {
    padding-left: 2rem;
  }

  .nav-link {
    display: block;
    font-family: var(--font-mono, monospace);
    font-size: 14px;
    line-height: 1.45;
    padding: 8px 0 8px 12px;
    border-left: 2px solid transparent;
    color: var(--text-ui, #57544c);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .nav-link:hover {
    color: var(--accent, #c4362b);
  }

  .nav-link.active {
    color: var(--accent, #c4362b);
    border-left-color: var(--accent, #c4362b);
  }

  /* --- Mobile: tap-to-open disclosure --- */
  .mobile-toc {
    border: 1px solid var(--border-hairline, #ddd6c8);
    border-radius: 9px;
    padding: 14px 16px;
  }

  summary {
    list-style: none;
    outline: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .mobile-nav-title {
    color: var(--text-ui, #57544c);
    margin-bottom: 0;
  }

  .mobile-nav-icon {
    display: inline-block;
    color: var(--text-faint, #9b958c);
    font-size: 13px;
    transition: transform 0.2s ease-in-out;
  }

  details[open] .mobile-nav-icon {
    transform: rotate(180deg);
  }

  .mobile-nav-dropdown {
    text-align: left;
    margin-top: 0.75rem;
    max-height: 60vh;
    overflow-y: auto;
  }
</style>
