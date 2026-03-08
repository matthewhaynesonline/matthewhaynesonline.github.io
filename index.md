---
layout: home
title: "Hello"
---

<div class="container main-container">
  <div class="row align-items-center h-100">
    <div class="col mt-max">
      <h1 class="heading">
        Matthew Haynes
      </h1>
      
      <h4 class="sub-heading text-body-tertiary text-end mt-3">
        Code &amp; Content
      </h4>

      <ul class="list-unstyled mt-max posts-lists">
        {% for post in site.posts limit:3 %}
          <li>
            {% include post_teaser.html %}
          </li>
        {% endfor %}
      </ul>

      <a href="/posts">More posts</a>
    </div>

  </div>
</div>
