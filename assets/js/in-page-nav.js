document.addEventListener("DOMContentLoaded", () => {
  const navContainer = document.getElementById("in-page-nav");
  const contentContainer = document.getElementById("main-content");
  const headingsToTarget = "h2";

  const navListClass = "in-page-nav-list";
  const navItemClass = "nav-item";
  const navLinkClass = "nav-link";
  const activeClass = "active";

  if (!navContainer || !contentContainer) return;

  const headings = contentContainer.querySelectorAll(headingsToTarget);
  if (headings.length === 0) return;

  const navList = document.createElement("ul");
  navList.className = navListClass;

  const navLinks = [];

  headings.forEach((heading, index) => {
    // Generate an ID if the heading is missing one
    if (!heading.id) {
      const slug = heading.textContent
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      heading.id = `${slug}-${index}`;
    }

    const listItem = document.createElement("li");
    const level = heading.tagName.charAt(1);
    listItem.className = `${navItemClass} level-${level}`;

    const anchor = document.createElement("a");
    anchor.href = `#${heading.id}`;
    anchor.textContent = heading.textContent;
    anchor.className = navLinkClass;

    listItem.appendChild(anchor);
    navList.appendChild(listItem);
    navLinks.push(anchor);
  });

  navContainer.appendChild(navList);

  // Highlight active link on scroll via IntersectionObserver
  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -60% 0px", // Triggers in the top 40% of the viewport
    threshold: 1.0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => link.classList.remove(activeClass));

        const activeLink = document.querySelector(
          `.${navLinkClass}[href="#${entry.target.id}"]`,
        );

        if (activeLink) {
          activeLink.classList.add(activeClass);
        }
      }
    });
  }, observerOptions);

  headings.forEach((heading) => observer.observe(heading));
});
