import { mount } from "svelte";
import "./app.css";

import InPageNav from "./lib/page_elements/InPageNav.svelte";
import Search from "./lib/page_elements/Search.svelte";
import ThemeToggle from "./lib/page_elements/ThemeToggle.svelte";
import BackToTop from "./lib/page_elements/BackToTop.svelte";

import AxiomGoodEvilAvg from "./lib/axiom_viz/GoodEvilAvg.svelte";
import AxiomAxisProjection from "./lib/axiom_viz/AxisProjection.svelte";
import AxiomTanh from "./lib/axiom_viz/Tanh.svelte";
import AxiomZScore from "./lib/axiom_viz/ZScore.svelte";
import AxiomSentimentConsensus from "./lib/axiom_viz/app/scatter/SentimentConsensus.svelte";
import AxiomHeatmap from "./lib/axiom_viz/app/Heatmap.svelte";
import AxiomValueSystems from "./lib/axiom_viz/app/ValueSystems.svelte";

import ToolDemoAddSub from "./lib/tool_lie/ToolDemoAddSub.svelte";
import ToolDemoDialog from "./lib/tool_lie/ToolDemoDialog.svelte";

import WatermarkZeroWidth from "./lib/watermark/ZeroWidthReveal.svelte";
import WatermarkHomoglyph from "./lib/watermark/HomoglyphReveal.svelte";
import WatermarkGreenList from "./lib/watermark/WatermarkGreenList.svelte";
import WatermarkDetection from "./lib/watermark/WatermarkDetection.svelte";
import SynthIDTournament from "./lib/watermark/SynthIDTournament.svelte";
import GreenVsTournament from "./lib/watermark/GreenVsTournament.svelte";
import SynthIDQuality from "./lib/watermark/SynthIDQuality.svelte";
import SynthIDPassage from "./lib/watermark/SynthIDPassage.svelte";
import SynthIDDetection from "./lib/watermark/SynthIDDetection.svelte";
import PangramMirrorMining from "./lib/watermark/PangramMirrorMining.svelte";

import Blockchain from "./lib/blockchain/Blockchain.svelte";

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
  ToolDemoAddSub,
  ToolDemoDialog,
  WatermarkZeroWidth,
  WatermarkHomoglyph,
  WatermarkGreenList,
  WatermarkDetection,
  SynthIDTournament,
  GreenVsTournament,
  SynthIDQuality,
  SynthIDPassage,
  SynthIDDetection,
  PangramMirrorMining,
  Blockchain,
};

// Publish the registered names so the /record/ recording stage can build its
// component picker from this single source of truth instead of a hand-kept copy.
(window as unknown as { __SVELTE_COMPONENTS__?: string[] }).__SVELTE_COMPONENTS__ =
  Object.keys(components);

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
