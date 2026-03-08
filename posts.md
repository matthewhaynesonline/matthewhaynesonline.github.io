---
layout: default
title: "Posts"
---

<ul class="list-unstyled posts-list mt-5">
  {% for post in site.posts %}
    <li>
      {% include post_teaser.html %}
    </li>
  {% endfor %}
</ul>
