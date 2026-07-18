---
layout: default
title: "Essays"
dek: "Longer form. Thought provoking... maybe?"
---

<ul class="index-list mt-4">
  {% for post in site.essays %}
    <li>
      {% include post_teaser.html show_thumb=true %}
    </li>
  {% endfor %}
</ul>
