/**
 * Bind ←/→ to a component's prev/next step.
 *
 * Keys go to one component at a time: the last one hovered or focused, or the
 * first mounted if none has been touched — so a blog page with several
 * steppers doesn't advance them all at once. Keys typed into form fields (the
 * recording toolbar's selects, a search box) and modifier combos are ignored.
 */

import type { Action } from "svelte/action";

export type ArrowHandlers = { prev: () => void; next: () => void };

const mounted: HTMLElement[] = [];
let active: HTMLElement | null = null;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
  );
}

export const arrowNav: Action<HTMLElement, ArrowHandlers> = (node, initial) => {
  let handlers = initial;
  mounted.push(node);

  const activate = (): void => {
    active = node;
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;

    const owner = active && mounted.includes(active) ? active : mounted[0];
    if (owner !== node) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlers.prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handlers.next();
    }
  };

  node.addEventListener("pointerenter", activate);
  node.addEventListener("focusin", activate);
  window.addEventListener("keydown", onKey);

  return {
    update(next: ArrowHandlers) {
      handlers = next;
    },
    destroy() {
      mounted.splice(mounted.indexOf(node), 1);
      if (active === node) active = null;
      node.removeEventListener("pointerenter", activate);
      node.removeEventListener("focusin", activate);
      window.removeEventListener("keydown", onKey);
    },
  };
};
