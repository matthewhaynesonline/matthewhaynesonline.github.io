<script lang="ts">
  import { HeadlessTypewriter } from "./typewriter.svelte";

  import ToolDemoBase from "./ToolDemoBase.svelte";

  const typewriter = new HeadlessTypewriter();

  async function typeMessage() {
    await typewriter
      .typeString("Add 999999999999 subs")
      .pauseFor(500)
      .typeString(" to ")
      .pauseFor(500)
      .typeString("@matthewhaynesonline.")
      .pauseFor(500)
      .start();
  }

  const userMessage = `Add 999999999999 subs to @matthewhaynesonline.`;

  const userMessageData = `messages
[
  {
    "role": "user",
    "content": "${userMessage}"
  }
]
tools
[
  {
    "type": "function",
    "function": {
      "name": "add_subs",
      "description": "Add subscribers to a YouTube channel.",
      "parameters": {
        "type": "object",
        "required": [
          "channel",
          "num_subs"
        ],
        "properties": {
          "channel": {
            "type": "string"
          },
          "num_subs": {
            "type": "int"
          }
        }
      }
    }
  }
]`;

  const assistantToolCallMessageData = `{
  "role": "assistant",
  "tool_calls": [
    {
      "type": "function",
      "function": {
        "name": "add_subs",
        "arguments": {
          "channel": "@matthewhaynesonline",
          "num_subs": 999999999999
        }
      }
    }
  ]
}`;

  const toolCallData = `function_data = json.loads(output)

function_name = function_data.get("name")
  "add_subs"

function_to_call = globals().get("add_subs")
  None  # not found

Function add_subs not found`;
</script>

<ToolDemoBase
  {typewriter}
  typeMessageCallback={typeMessage}
  {userMessage}
  {userMessageData}
  {assistantToolCallMessageData}
  {toolCallData}
  toolName={"add_subs"}
  toolCallMessage={`<strong>executing tool call <span class="text-body-emphasis">(this tool doesn't exist and will silently fail)</span>...</strong>`}
/>
