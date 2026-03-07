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

      <a href="/posts">More posts</a>
    </div>

  </div>
</div>
