---
layout: blog
title: "Tokens All the Way Down"
excerpt_separator: <!--more-->
banner_img: "/assets/images/tool-lie/tool-lie-banner.png"
yt_id: "S5AirutgJi8"
gh_url: "https://github.com/matthewhaynesonline/tool-lie"
---

To become agents, LLMs call tools, right? Not quite.

<!--more-->

It's an honest mistake, thinking that _tool calling_ involves _tool calling_. So, let's get to the bottom of it.

{% include yt_embed.html %}

---

## Turtles All The Way Down

If you've used a chat app lately, you're probably thinking "hey, this guy lost whatever marbles he had left...". ChatGPT, Claude, Gemini, they can all browse the web, summarizes your email, check your code - they _do things_. Heck, if you're lucky, [they'll even nuke your filesystem for a small fee](https://www.tomshardware.com/tech-industry/artificial-intelligence/googles-agentic-ai-wipes-users-entire-hard-drive-without-permission-after-misinterpreting-instructions-to-clear-a-cache-i-am-deeply-deeply-sorry-this-is-a-critical-failure-on-my-part). And all of this is true, but like any good developer (debatable), I have a penchant for pedantry.

You see, (large) language models operate on language (set aside multi modal models for the moment because the following points will still stand). Fundamentally, language in, language out; it's tokens all the way down. However, as chat apps and other ecosystems become more sophisticated, it increasingly obscures that tokens in, tokens out reality that underpins it all.

## I Hate String Parsing

In classical computing, I'll do whatever I can to avoid [string parsing](<https://en.wikipedia.org/wiki/String_(computer_science)#String_processing_algorithms>). Especially for control flow, business logic - pretty much anything. It's messy, brittle and difficult to account for all the possible edge cases. However, with our new fangled, increasingly more powerful ~~string~~ token generators, well, it would appear string parsing is "back on the menu".

Here's how the tool calling magic trick works: the model generates some sort of ~~string~~ data (usually JSON) that conforms to a schema (pinky promise) and then _something else_ (the harness) takes that ~~string~~ generated output and attempts to execute it. You might be thinking this sounds an awful lot like an [eval](https://en.wikipedia.org/wiki/Eval), and this too is true, but real systems (hopefully) operate on a saner setup.

For example:

```py
import json

def execute_tool(output: str | dict) -> None:
    function_data = json.loads(output) if isinstance(output, str) else output
    function_name = function_data.get("name")

    if function_to_call := globals().get(function_name):
        if arguments := function_data.get("arguments"):
            print("Calling function:", function_name)
            print("Arguments:", arguments)

            result = function_to_call(**arguments)
            # ...
```

And here's what that looks like with a "popup" tool:

<div class="mb-4" id="tool-call-demo-dialog" data-svelte-component="ToolDemoDialog"></div>

```py
import os

def display_dialog(title: str, body: str) -> None:
    sys_call = f"""
osascript -e 'Tell application "System Events" to display dialog "{body}" with title "{title}"'
"""
    os.system(sys_call)
```

Not too shabby, eh? Ask the chat for a popup and get a popup.

_Be sure to check out the repo for real working demos that don't rely on studio magic._

## Popping the Hood

So the harness executes the tool, but how does the model know what tools exist? _Leaky abstraction incoming._

```py
from transformers import AutoProcessor, AutoModelForCausalLM
# ...
processor = AutoProcessor.from_pretrained(MODEL_ID)
# ...
tools = [
    {
        "type": "function",
        "function": {
            "name": "display_dialog",
            "description": "Displays a system dialog with the given title and body.",
            "arguments": {
                # ...
            }
        }
    }
]
# ...
text = processor.apply_chat_template(messages, tools=tools)
```

`apply_chat_template` with a `tools=` argument looks like a legit API but all it's doing is building a string: a system prompt that describes the available tools in plain text and instructs the model how to respond. You _could_ even write it by hand:

```python
system_prompt = f"""You are an expert in composing functions.
If you decide to invoke any of the function(s), you MUST put it in the JSON format of
{{"name": "func_name", "arguments": {{"params_name1": "params_value1"}}}}

Here is a list of functions in JSON format that you can invoke.
{functions_definitions_string}
"""
```

That's it. The "tool schema" is just a JSON string in a system prompt. The model reads it like any other instruction and its response is just a string back: a function name and some arguments. Glorified string parsing, baby.

## the tool is a lie.

Now let's see if we can add **999 billion** subs to my [YouTube channel](https://www.youtube.com/@matthewhaynesonline). The model knows about the tool (it's in the schema), so this should work, right?

<div class="mb-4" id="tool-call-demo-add-sub" data-svelte-component="ToolDemoAddSub"></div>

The model did its part: it generated a perfectly valid `add_subs` call with the right args and the harness tried to execute it. And _(drumroll please)_... no, I don't suddenly have 100x the world's population in subscribers.

In case it wasn't obvious, the `add_subs` tool [doesn't exist](/assets/images/tool-lie/what.png). But that's the thing to keep in mind about tool calling: from the model's perspective, tool calling finishes at generation. Whether the tool exists, whether it ran, whether it succeeded or set something on fire (lol), the model doesn't know any of that _unless_ you feed the result back into the model's context. That, ladies and gentleman, is the fire power behind the trillion dollar _agentic loop_.

## Fin.

So for the moment, AI tool calling is just generating instructions (probably in the right format), for something else to run (it probably won't crash). Maybe this post will age like milk if [computers do become neural](https://arxiv.org/abs/2604.06425), but for now we're stuck with string parsing promises, YOLOs and loops.

Okay, that's all Folks!

{% include blog_links.html %}
