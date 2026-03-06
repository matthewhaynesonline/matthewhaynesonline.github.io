import { mount } from "svelte";
import "./app.css";
import Hi from "./Hi.svelte";

const components = { Hi };

document.addEventListener("DOMContentLoaded", (): void => {
  const componentTargetElements = document.querySelectorAll(
    "[data-svelte-component]",
  );

  componentTargetElements.forEach((element: HTMLElement): void => {
    const componentName = element.dataset.svelteComponent || "";

    const Component = components[componentName];

    if (Component) {
      const props = {};

      for (const [key, value] of Object.entries(element.dataset)) {
        if (key !== "svelteComponent") {
          try {
            // Parse arrays, numbers, or booleans
            props[key] = JSON.parse(value);
          } catch (e) {
            // Fallback for standard strings
            props[key] = value;
          }
        }
      }

      mount(Component, {
        target: element,
        props: props,
      });
    }
  });
});
