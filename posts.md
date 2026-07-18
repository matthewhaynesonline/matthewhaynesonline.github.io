---
layout: default
title: "Posts"
dek: "Short and sweet. Most come with a video and runnable code."
---

<ul class="index-list mt-4">
  {% for post in site.posts %}
    <li>
      {% include post_teaser.html %}
    </li>
  {% endfor %}
</ul>
