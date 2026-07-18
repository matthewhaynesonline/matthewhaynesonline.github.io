---
layout: home
title: "Hello"
---

<div class="page-frame">
  <!-- Hero -->
  <section class="hero">
    <h1 class="hero-name t-signature">Matthew Haynes</h1>

    <div class="hero-tagline">Code &amp; Content</div>

    <div class="hero-actions">
      <a class="pill-btn pill-btn--primary pill-btn--plain" href="https://www.youtube.com/@matthewhaynesonline">YouTube ↗</a>
      <a class="pill-btn pill-btn--plain" href="https://github.com/matthewhaynesonline">GitHub ↗</a>
      <a class="pill-btn pill-btn--plain" href="https://huggingface.co/matthewhaynesonline">Hugging Face ↗</a>
    </div>
  </section>

  <!-- Featured essay -->
  <section class="home-section">
    <div class="section-head mb-4">
      <div class="section-label t-kicker">Featured essay</div>
      <a class="section-more" href="/essays">All essays →</a>
    </div>

    {% for post in site.essays limit:1 %}
    {% assign words = post.content | strip_html | number_of_words %}
    {% assign read_time = words | divided_by: 200 %}
    {% if read_time < 1 %}{% assign read_time = 1 %}{% endif %}
    <div class="featured-grid">
      <div>
        <div class="t-meta mb-3">
          <span>{{ post.date | date: "%b %d, %Y" }}</span>
          <span class="meta-sep">/</span>
          <span>{{ read_time }} min read</span>
        </div>

        <a class="featured-title" href="{{ post.url }}">{{ post.title }}</a>

        <div class="featured-dek">{{ post.excerpt }}</div>
      </div>

      {% if post.banner_img %}
      <a class="featured-banner" href="{{ post.url }}" aria-hidden="true" tabindex="-1">
        <img src="{{ post.banner_img }}" alt="" />
      </a>
      {% endif %}
    </div>
    {% endfor %}
  </section>

  <!-- Latest posts -->
  <section class="home-section">
    <div class="section-head">
      <div class="section-label t-kicker">Latest posts</div>
      <a class="section-more" href="/posts">All posts →</a>
    </div>

    <ul class="index-list">
      {% for post in site.posts limit:3 %}
      <li>
        {% include post_teaser.html %}
      </li>
      {% endfor %}
    </ul>
  </section>
</div>
