.PHONY: dev vite jekyll

all: dev

dev:
	$(MAKE) -j2 vite jekyll

vite:
	cd blog-components && npm install && npx vite build --watch

jekyll:
	bundle exec jekyll serve