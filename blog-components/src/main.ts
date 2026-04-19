import { mount } from "svelte";
import "./app.css";

import InPageNav from "./InPageNav.svelte";
import Search from "./Search.svelte";
import ThemeToggle from "./ThemeToggle.svelte";
import BackToTop from "./lib/BackToTop.svelte";

import AxiomGoodEvilAvg from "./lib/axiom_viz/GoodEvilAvg.svelte";
import AxiomAxisProjection from "./lib/axiom_viz/AxisProjection.svelte";
import AxiomTanh from "./lib/axiom_viz/Tanh.svelte";
import AxiomZScore from "./lib/axiom_viz/ZScore.svelte";
import AxiomSentimentConsensus from "./lib/axiom_viz/app/scatter/SentimentConsensus.svelte";
import AxiomHeatmap from "./lib/axiom_viz/app/Heatmap.svelte";
import AxiomValueSystems from "./lib/axiom_viz/app/ValueSystems.svelte";

const components = {
  InPageNav,
  Search,
  ThemeToggle,
  BackToTop,
  AxiomGoodEvilAvg,
  AxiomAxisProjection,
  AxiomTanh,
  AxiomZScore,
  AxiomSentimentConsensus,
  AxiomHeatmap,
  AxiomValueSystems,
};

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
