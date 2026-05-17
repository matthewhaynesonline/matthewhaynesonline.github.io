<script lang="ts">
  import { onMount } from "svelte";

  type ThemePref = "light" | "dark" | "auto";
  type ResolvedTheme = "light" | "dark";

  const defaultThemeConfig = {
    storageKey: "theme-preference",
    mediaQuery: "(prefers-color-scheme: dark)",
    resolveTheme: (p: ThemePref): ResolvedTheme =>
      p === "dark" ? "dark" : "light",
    applyTheme: () => {},
  };

  const themeConfig =
    // @ts-ignore
    typeof window !== "undefined" && window.__THEME_CONFIG__
      ? // @ts-ignore
        window.__THEME_CONFIG__
      : defaultThemeConfig;

  const validThemes: ThemePref[] = ["light", "dark", "auto"];

  let preference = $state<ThemePref>("auto");
  let resolvedTheme = $state<ResolvedTheme>("light");

  let preferenceIndex = $derived(validThemes.indexOf(preference));
  let nextIndex = $derived((preferenceIndex + 1) % validThemes.length);

  let buttonIcon = $derived.by(() => {
    if (preference === "auto") return "bi-circle-half";
    if (preference === "light") return "bi-sun-fill";
    return "bi-moon-fill";
  });

  onMount(() => {
    const savedPref = localStorage.getItem(
      themeConfig.storageKey,
    ) as ThemePref | null;

    if (savedPref && validThemes.includes(savedPref)) {
      preference = savedPref;
    }
  });

  // React to user preference changes
  $effect(() => {
    resolvedTheme = themeConfig.resolveTheme(preference);
    themeConfig.applyTheme(resolvedTheme);
    localStorage.setItem(themeConfig.storageKey, preference);
  });

  // Listen for OS theme changes
  $effect(() => {
    const mediaQuery = window.matchMedia(themeConfig.mediaQuery);

    const onOsThemeChange = () => {
      // Only react to OS changes if the user is in 'auto' mode
      if (preference === "auto") {
        resolvedTheme = themeConfig.resolveTheme("auto");
        themeConfig.applyTheme(resolvedTheme);
      }
    };

    mediaQuery.addEventListener("change", onOsThemeChange);

    return () => mediaQuery.removeEventListener("change", onOsThemeChange);
  });

  function cyclePreference() {
    preference = validThemes[nextIndex];
  }
</script>

<button
  class="btn scale-80 rounded-circle p-2 lh-1 {resolvedTheme === 'dark'
    ? 'btn-light'
    : 'btn-dark'}"
  onclick={cyclePreference}
  aria-label="Theme preference: {preference}"
  title="Theme: {preference}"
>
  <i class="bi {buttonIcon} fs-4"></i>
</button>
