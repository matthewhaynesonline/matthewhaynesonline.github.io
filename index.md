---
layout: home
title: "Hello"
---

<div class="container main-container">
  <div class="row align-items-center h-100">
    <div class="col pt-max">
      <h1 class="word-mark word-mark-font">
        Matthew Haynes
      </h1>
      
      <h4 class="text-body-tertiary text-end mt-3">
        Code &amp; Content
      </h4>

      <div class="pt-max border-bottom pb-5">
      <h4 class="mb-3">Featured</h4>
      {% for post in site.essays limit:1 %}
          {% include post_teaser.html %}
        {% endfor %}
        <a href="/essays">More essays</a>
        </div>


      <ul class="list-unstyled mt-5 posts-lists">
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
