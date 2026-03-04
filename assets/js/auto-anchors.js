document
  .querySelectorAll("h2[id], h3[id], h4[id], h5[id], h6[id]")
  .forEach(function (heading) {
    // Skip if heading already contains a link
    if (heading.querySelector("a")) return;

    const link = document.createElement("a");
    link.href = "#" + heading.id;
    link.className = "anchor-link";

    // Move existing content into the anchor
    while (heading.firstChild) {
      link.appendChild(heading.firstChild);
    }

    heading.appendChild(link);
  });
