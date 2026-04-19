---
layout: home
title: "Hello"
---

<div class="container main-container">
  <div class="row align-items-center h-100">
    <div class="col mt-max">
      <h1 class="font-max">
        Matthew Haynes
      </h1>
      
      <h4 class="text-body-tertiary text-end mt-3">
        Code &amp; Content
      </h4>

      <div class="mt-max border-bottom pb-5">
      <h4 class="mb-3">Featured</h4>
      {% for post in site.essays limit:1 %}

            <div class="mb-3">

  <h3 class="post-title h5">
    <a href="{{ post.url }}">{{ post.title | strip_html }}</a>
  </h3>
  <h6 class="post-date text-body-tertiary">
    <small> {{ post.date | date: "%b %d, %Y" }} </small>
  </h6>
  {{ post.excerpt | strip_html }}
</div>

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
