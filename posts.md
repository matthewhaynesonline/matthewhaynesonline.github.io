---
layout: default
title: "Posts"
---

<ul class="list-unstyled posts-lists">
  {% for post in site.posts %}
    <li class="mb-4">
      <h3 class="post-title h5">
        <a href="{{ post.url }}">{{ post.title }}</a>
      </h3>
      <h6 class="post-date text-body-tertiary">
        <small>
          {{ post.date | date: "%b %d, %Y" }}
        </small>
      </h6>
      {{ post.excerpt }}
    </li>
  {% endfor %}
</ul>
