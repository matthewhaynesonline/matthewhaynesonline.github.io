---
layout: default
title: "Essays"
---

<ul class="list-unstyled posts-list mt-5">
  {% for post in site.essays %}
    <li>
      {% include post_teaser.html %}
    </li>
  {% endfor %}
</ul>
