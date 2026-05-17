<script lang="ts">
  import { HeadlessTypewriter } from "./typewriter.svelte";
  import { sleep } from "./utils";

  import Modal from "../ui/Modal.svelte";
  import ToolDemoBase from "./ToolDemoBase.svelte";

  const typewriter = new HeadlessTypewriter();

  async function typeMessage() {
    await typewriter
      .typeString("Open a dialog with title ")
      .pauseFor(500)
      .typeString('"what up" ')
      .pauseFor(500)
      .typeString('and body "hi buddy".')
      .pauseFor(500)
      .start();
  }

  let showModal = $state(false);

  const userMessage = `Open a dialog with title "what up" and body "hi buddy".`;

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
      "name": "display_dialog",
      "description": "Displays a system dialog with the given title and body.",
      "parameters": {
        "type": "object",
        "required": [
          "title",
          "body"
        ],
        "properties": {
          "title": {
            "type": "string"
          },
          "body": {
            "type": "string"
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
        "name": "display_dialog",
        "arguments": {
          "body": "hi buddy",
          "title": "what up"
        }
      }
    }
  ]
}`;

  const toolCallData = `function_data = json.loads(response)

function_name = function_data.get("name")
  "display_dialog"

function_to_call = globals().get("display_dialog")
  <function display_dialog>

arguments = function_data.get("arguments")
  {"body": "hi buddy", "title": "what up"}

Calling function: display_dialog
  arguments: {"body": "hi buddy", "title": "what up"}`;

  async function runTool() {
    showModal = true;
    await sleep(4000);
    showModal = false;
  }
</script>

<Modal show={showModal} title="what up" onclose={() => (showModal = false)}>
  hi buddy
</Modal>

<ToolDemoBase
  {typewriter}
  typeMessageCallback={typeMessage}
  {userMessage}
  {userMessageData}
  {assistantToolCallMessageData}
  {toolCallData}
  toolName={"show_dialog"}
  runToolCallback={runTool}
/>
