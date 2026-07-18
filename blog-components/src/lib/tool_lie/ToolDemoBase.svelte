<script lang="ts">
  import { onDestroy } from "svelte";

  import { HeadlessTypewriter } from "./typewriter.svelte";
  import { sleep } from "./utils";

  import AssistantMessage from "./chat/AssistantMessage.svelte";
  import UserMessage from "./chat/UserMessage.svelte";

  let {
    typewriter,
    typeMessageCallback,
    userMessage,
    userMessageData,
    assistantToolCallMessageData,
    toolCallData,
    toolName,
    runToolCallback = () => {},
    toolCallMessage = "<strong>executing tool call...</strong>",
    finishedMessage = "ran successfully. Let me know if you need anything else!",
  }: {
    typewriter: HeadlessTypewriter;
    typeMessageCallback: CallableFunction;
    userMessage: string;
    userMessageData: string;
    assistantToolCallMessageData: string;
    toolCallData: string;
    toolName: string;
    runToolCallback?: CallableFunction;
    toolCallMessage?: string;
    finishedMessage?: string;
  } = $props();

  const stepLabels = [
    "Start",
    "Typing",
    "Waiting",
    "Response",
    "Dispatch",
    "Parsing",
    "Execute",
    "Done",
  ];

  const Step = {
    Start: 0,
    TypeMessage: 1,
    ResponseLoading: 2,
    ResponseLoaded: 3,
    ToolCallStart: 4,
    ToolCallRunning: 5,
    ExecuteTool: 6,
    Finished: 7,
  } as const;

  type StepType = (typeof Step)[keyof typeof Step];

  const maxStep = Math.max(...Object.values(Step));

  let currentStep = $state<StepType>(Step.Start);
  let isRunning = $state(false);

  const executeToolMessage = `execute_tool(response["tool_calls"][0]["function"])`;
  const defaultSleep = 2500;

  async function run() {
    reset();
    isRunning = true;
    currentStep = Step.TypeMessage;
    await typeMessageCallback();

    currentStep = Step.ResponseLoading;
    await sleep(defaultSleep);

    currentStep = Step.ResponseLoaded;
    await sleep(defaultSleep);

    currentStep = Step.ToolCallStart;
    await sleep(defaultSleep);

    currentStep = Step.ToolCallRunning;
    await sleep(defaultSleep);

    currentStep = Step.ExecuteTool;
    runToolCallback();
    await sleep(defaultSleep);

    currentStep = Step.Finished;
    isRunning = false;
  }

  function reset() {
    typewriter.reset();
    currentStep = Step.Start;
  }

  onDestroy(() => {
    typewriter.stop();
  });
</script>

{#snippet codePanel(label: string, content: string)}
  <details>
    <summary class="mb-1">show payload</summary>
    <div class="card rounded font-monospace my-2" data-bs-theme="dark">
      <div class="card-header">
        {label}
      </div>

      <div class="card-body">
        <pre><code>{content}</code></pre>
      </div>
    </div>
  </details>
{/snippet}

{#snippet userMessageSnippet()}
  <UserMessage>{userMessage}</UserMessage>
  <!-- {#if currentStep < maxStep} -->
  <div class="mt-3">
    {@render codePanel("Request Payload", userMessageData)}
  </div>
  <!-- {/if} -->
{/snippet}

<div class="card chat-card shadow">
  <div class="card-header">
    <div class="d-flex justify-content-between">
      <div class="fw-bold">Chat</div>

      <div class="chat-header-controls d-flex align-items-center">
        {#if currentStep >= maxStep}
          <button
            class="btn btn-sm bt-outline-light border-none"
            onclick={reset}>↺ Reset</button
          >
        {/if}

        <button
          class="btn btn-sm btn-light rounded"
          disabled={currentStep < 1 || isRunning}
          onclick={() => {
            if (currentStep > 0) currentStep--;
          }}
          aria-label="Previous step"
        >
          ◀
        </button>

        <button
          class="btn btn-sm btn-light rounded"
          disabled={currentStep >= maxStep || isRunning}
          onclick={() => {
            if (currentStep < maxStep) currentStep++;
          }}
          aria-label="Next step"
        >
          ▶
        </button>
      </div>
    </div>
  </div>

  <div class="card-body p-4">
    <div
      class="step-track d-flex align-items-center overflow-x-scroll font-monospace pt-2 pb-4"
    >
      {#each stepLabels as label, i}
        <div
          class="step-pip d-flex align-items-center flex-column"
          class:active={i === currentStep}
          class:done={i < currentStep}
          title={label}
        >
          <div class="pip-dot rounded-circle"></div>
          <span class="pip-label text-secondary-emphasis">
            {label}
          </span>
        </div>

        {#if i < stepLabels.length - 1}
          <div class="pip-line" class:done={i < currentStep}></div>
        {/if}
      {/each}
    </div>

    {#if currentStep < Step.ResponseLoading}
      <div class="input-group">
        <div
          class="form-control border-secondary-subtle d-flex align-items-center text-truncate"
          aria-label="Message Input"
          aria-describedby="btn-send"
        >
          {#if currentStep === Step.Start}
            <span class="text-body-tertiary fst-italic">
              Hit ▶ to begin the demo...
            </span>
          {:else}
            {typewriter.text}<span class="cursor">|</span>
          {/if}
        </div>

        <button
          class="btn btn-primary px-4"
          disabled={currentStep > Step.Start}
          onclick={run}
          aria-label="Send"
        >
          ▶
        </button>
      </div>
    {:else}
      {@render userMessageSnippet()}

      <AssistantMessage isLoading={currentStep < maxStep}>
        {#if currentStep < maxStep}
          {#if currentStep >= Step.ResponseLoaded}
            {@render codePanel(
              "Response Payload",
              assistantToolCallMessageData,
            )}
          {/if}

          {#if currentStep >= Step.ToolCallStart}
            <div class="card rounded font-monospace mt-2" data-bs-theme="dark">
              <div class="card-header">
                <span
                  class="badge border border-warning text-warning text-uppercase"
                >
                  Harness
                </span>
                <span class="text-secondary-emphasis">behind the scenes</span>
              </div>

              <div class="card-body">
                <div>
                  <span class="text-primary-emphasis">calling</span>
                  <code class="text-warning">{executeToolMessage}</code>
                </div>

                {#if currentStep >= Step.ToolCallRunning}
                  <details class="border-start mt-3 ps-3">
                    <summary class="mb-1">show payload</summary>
                    <pre><code>{toolCallData}</code></pre>
                  </details>
                {/if}

                {#if currentStep === Step.ExecuteTool}
                  <div class="alert alert-secondary mt-3 p-2">
                    {@html toolCallMessage}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {:else}
          <div class="d-flex align-items-center text-body">
            <!-- <span class="finished-icon text-success fw-bold">✓</span> -->
            <span>
              <code class="badge bg-body-tertiary text-body mx-1">
                {toolName}
              </code>
              {finishedMessage}
            </span>
          </div>
        {/if}
      </AssistantMessage>
    {/if}
  </div>
</div>

<style>
  /* Warm raised surface from the editorial tokens; flips with the theme */
  .chat-card {
    background: var(--surface-raised, var(--bs-tertiary-bg));
    border: 1px solid var(--border-hairline, var(--bs-border-color));
  }

  .chat-header-controls {
    gap: 6px;
  }

  .pip-dot {
    width: 10px;
    height: 10px;

    background: var(--bs-secondary-bg);

    transition: all 250ms ease;
  }

  .step-pip.active .pip-dot {
    background: var(--bs-primary);
    transform: scale(1.35);
    box-shadow: 0 0 0 3px rgba(196, 54, 43, 0.2);
  }

  .step-pip.done .pip-dot {
    background: var(--bs-primary-text-emphasis);
    /* background: var(--bs-primary-bg); */
    /* background: #93c5fd; */
  }

  .pip-label {
    font-size: 0.9rem;
  }

  .step-pip.active .pip-label {
    font-weight: 700;
  }

  .pip-line {
    flex: 1;
    height: 2.5px;
    min-width: 8px;
    margin-bottom: 22px;
    background: var(--bs-secondary-bg-subtle);

    transition: all 250ms ease;
  }

  .pip-line.done {
    background: var(--bs-primary-bg-subtle);
  }

  .cursor {
    font-weight: bold;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
</style>
