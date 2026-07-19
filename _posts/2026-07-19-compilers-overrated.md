---
layout: blog
title: "Compilers are Overrated"
excerpt_separator: <!--more-->
banner_img: "/assets/images/crap/crap-banner.png"
yt_id: "55IBMzFQNYU"
gh_url: "https://github.com/matthewhaynesonline/crap-public"
---

/s

<!--more-->

This started the way most bad things do: Microsoft Teams.

<div class="chat-log ps-5" markdown="1">

**Matt**

> [`Musk also made a bold prediction in the video: by the end of 2026, AI might not even write code anymore — it could generate binaries directly.`](https://finance.yahoo.com/sectors/technology/articles/elon-musk-coding-top-job-163850758.html)

**Jon**

> "Generate binaries directly" sounds like a Musk thing to say.

**Matt**

> _Probabilistic memory access._

**Jon**

> I do agree that you could technically do that.

**Matt**

> _technically._
>
> Oh man, maybe that would be a fun shitpost. See if you can actually get a model to output a binary.
>
> I'll get the boys in R&D on it.

**Jon**

> Well, you could definitely get an agent to poop them out. At least a silly example of one.

**Matt**

> No, no. Straight up. No agent loops, no compilers.
>
> How hard could it be????
>
> Patent pending, jk.

**Jon**

> One of the most fun things to do with LLMs is ask them to emit deranged stuff.
>
> I'm sure you could have it emit a binary.
>
> I feel like there's a video here.

</div>

"I feel like there's a video here." How prescient : )

{% include yt_embed.html %}

---

## What the CRAP?

Allow me to introduce [CRAP](https://huggingface.co/collections/matthewhaynesonline/crap), the **C**ompiler **R**eplacement for **A**ssembling **P**rograms, a State of the Art Binary Programming Model™. It started as a joke and, well, it's still a joke but it's a _working_ joke. Annddd it works better than I would have thought. I couldn't find any other similar models after searching on Hugging Face for all of 30 seconds, so that means it's #1 _in the world_:

<img class="img-fluid rounded" src='{{"/assets/images/crap/hf-crap-num-1.png"  | relative_url }}'  alt="Number one, baby!">

CRAP is a Fine Tune of Gemma 4 E2B by yours truly. It will, given a prompt, directly generate a working Linux [binary](https://en.wikipedia.org/wiki/Executable) without any intermediary steps - no tool calls, no agents, no compiler, no nothing. Ok, _technically_, it emits the [hexadecimal representation](https://en.wikipedia.org/wiki/Hexadecimal) of the raw binary for the requested program, but converting that hex into an executable is a direct mapping of hex characters to [binary](https://en.wikipedia.org/wiki/Binary_code). The model produces every byte of the program; the conversion just changes the encoding. That hex _is the program_, as we'll cover later.

## How hard can it be?

I'm not sure if this is impressive on its face, I think so, but regardless getting to this point had some interesting challenges. Chief among those: Large Language Models are probabilistic. You know what's not probabilistic? Binary code execution. And I've come to appreciate, more than ever, the pedantry of the Operating System (and I thought I was bad). Apparently, flipping a few bits around really does matter and heaven forbid if you try to run a statically linked binary on macOS. This is all to say that getting a program's binary code _probably right_ is not the same as _definitely right_, and if you want the privilege of the OS running your program, you need to get it _definitely right_. Sorry, no partial credit from the kernel.

Step one was to brush up on what binary looked like (as if I could code in binary in the first place) and then try progressively more unhinged ways of generating it.

## Elf on a shelf

There are two binary formats we'll be covering today: [Executable and Linkable Format](https://en.wikipedia.org/wiki/Executable_and_Linkable_Format) on Linux (specifically for x86) and [Mach-O](https://en.wikipedia.org/wiki/Mach-O) on macOS (specifically for Arm). With binary being just a sequence of 1s and 0s, these formats specify how these bits are interpreted. For example, the first X bits might be the format headers (what is this? Elf, Mach-O, etc.), the next Y bits, the program headers (how to load it), then data, etc. And because you only have 1s or 0s to work with and because the behavior is determined by the length / offsets of these 1s and 0s, _you have to get it **right**_.

The good news is that much of the formats are comprised of fixed boilerplate and thus easier to _memorize_. But the interesting bits (ha) of the program - your data - is variable and memorization isn't going to cut it. **Keep this distinction in mind for later**, it's going to matter when we ask the model to learn this stuff.

There's another wrinkle in this plan: Tim Apple. For background, I use MacBooks, so naturally I wanted to target macOS binaries since I could test / validate those binaries natively. Cool. A minimal Linux `hello_world` ELF binary is ~190 bytes; the leanest macOS Mach-O I could get for the same program was **~34KB** (Apple's 16KB segment alignment sets a theoretical floor near ~16,484 bytes, but the mandatory dynamic linker and signing blow well past it). Because of "security" or whatever (/unjerk AMFI, et al. is lovely), Apple insists you do things like using their dynamic linker, sign the binary, etc. Which is great, I guess, for people downloading things from the internet, but less great if you're trying to hallucinate system calls.

Point being: binary formats are OS and hardware specific, have fixed boiler plate but also variable parts and - it bears repeating: you have to get it perfect; one bad bit (ha!) and the OS will kill it.

## Bit by bit

In order for the machine to learn, first we need ML: Matt Learn... ing. And both of us needed a reference. I wanted to take a known program and generate the binaries of it for the various platforms so I could inspect and analyze it. [`hello_world`](https://en.wikipedia.org/wiki/Hello,_world) is nigh.

My first choice was [Rust](https://rust-lang.org/), because, duh, "I craved the strength and certainty of borrow checker" (pretty sure that's the quote).

```rs
fn main() {
    println!("hello world");
}
```

One `hello_world.rs` later and I had ~400KB of binary on my hands. Now, I'm no expert, but 400KB seemed like _alot_ to just print some characters to stdout. So much for zero cost abstractions, eh? What Rust is doing is linking things like the Rust std lib (formatters), panic handling, etc., into the binary. Which is handy, and when we measure storage in the terabytes, sweating over a few hundred kilobytes is silly (editor go ahead and insert a `node_modules` meme), but when we want to boil down binary programming to the bare essence, well, we don't really care about panics or generics.

## Worse is better

> They always come crawling back.
>
> \- [Dennis Ritchie](https://en.wikipedia.org/wiki/Dennis_Ritchie), the C guy, probably.

Now no longer craving the certainty of the borrow checker, I reached for the granddaddy: [C](<https://en.wikipedia.org/wiki/C_(programming_language)>).

```c
#include <stdio.h>

int main()
{
  printf("hello world\n");
  return 0;
}
```

One `hello_world.c` later, built on my Mac (so what you're looking at below is a Mach-O binary, not the soon to be discussed bespoke Linux ELF binary) I now had about 33KB of binary on my hands. Now, I don't know if you've looked at 33KB of binary as hex, but it's still _alot_.

```
00000000: cffa edfe 0c00 0001 0000 0000 0200 0000  ................
00000010: 1100 0000 2004 0000 8500 2000 0000 0000  .... ..... .....
00000020: 1900 0000 4800 0000 5f5f 5041 4745 5a45  ....H...__PAGEZE
00000030: 524f 0000 0000 0000 0000 0000 0000 0000  RO..............
00000040: 0000 0000 0100 0000 0000 0000 0000 0000  ................
00000050: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000060: 0000 0000 0000 0000 1900 0000 8801 0000  ................
00000070: 5f5f 5445 5854 0000 0000 0000 0000 0000  __TEXT..........

# this goes on for two. thousand. more. lines.
```

And my context window for hex is roughly 8 characters, not 80,000, so this wasn't going to fly either.

[It was time to get cereal](https://en.wikipedia.org/wiki/Time_to_Get_Cereal). To keep shedding the bytes, I'd have to breakout the [assembly](https://en.wikipedia.org/wiki/Assembly_language) (I did warn you this was going to get progressively more unhinged). See, before the luxury of high level languages (yes even C is a high level language as it's hardware independent), there was this thing called assembly. Whereas C makes it easier to write code that conceptually matches machine code, Assembly is just machine code "[with extra steps](https://en.wikipedia.org/wiki/The_Ricks_Must_Be_Crazy#Plot:~:text=This%20leads%20Morty%20to%20question%20Rick%27s%20ethics%2C%20calling%20it%20%22slavery%20with%20extra%20steps%22%2E)". It's hardware specific and doesn't hide anything from you. Sure shot at a pristine binary, right?

Here's what I was thinking: if I write the assembly myself (well, with a little help from my friends), I could forgo all the ceremony the compiler injects. As a sanity check, I first compiled the C code to assembly to see what the compiler produced. The resulting assembly looked pretty dang lean to me. One `hello_world.s` later, I now had about 33KB of binary on my hands (I guess compilers have gotten pretty good in the last 50 years after all).

Next, it was time to strip out the kruft and use raw [syscalls](https://en.wikipedia.org/wiki/System_call) to talk to the kernel directly instead of going through libraries.

`reference/aarch64-apple-darwin/hello_by_hand.S`

```asm
    .global _start             ; Make the '_start' symbol public so the OS linker knows where to start execution
  .align 2                   ; Align the next instruction to a 4-byte (2^2) memory boundary (standard for ARM64 instructions)

_start:                      ; Label marking the exact memory address where execution begins
  ; --- SYSTEM CALL: sys_write (Print to screen) ---
  mov	x0, #1                 ; Argument 1: File descriptor for Standard Output (stdout = 1)
  adr	x1, str                ; Argument 2: Calculate the relative address of 'str' and load it into x1
  mov	x2, #12                ; Argument 3: The exact length of our string in bytes (12 characters)
  mov	x16, #4                ; Syscall Number: Load 4 (the macOS kernel number for sys_write) into register x16
  svc	#0x80                  ; Supervisor Call: Pause execution and trap to the kernel to perform the system call

  ; --- SYSTEM CALL: sys_exit (Terminate program cleanly) ---
  mov	x0, #0                 ; Argument 1: Exit status code (0 = success, no errors)
  mov	x16, #1                ; Syscall Number: Load 1 (the macOS kernel number for sys_exit) into register x16
  svc	#0x80                  ; Supervisor Call: Trap to the kernel to instantly kill the process

str:                         ; Label marking the memory location of our text
  .ascii "hello world\n"     ; The string itself as raw bytes. Note: No null terminator is needed because we gave the kernel the exact length.
```

`reference/x86_64-linux/hello_by_hand.s`

```asm
  .intel_syntax noprefix     # Use Intel syntax instead of AT&T syntax for much better readability
  .global _start             # The standard entry point for Linux ELF binaries

  .text                      # Switch to the executable code section
_start:                      # Label marking the precise entry point
  # --- SYSTEM CALL: sys_write (Print to screen) ---
  mov rax, 1                 # Syscall Number: 1 (sys_write in Linux x86_64)
  mov rdi, 1                 # Argument 1: File descriptor for Standard Output (stdout = 1)
  lea rsi, [rip + str]       # Argument 2: Load the address of our string into rsi (using instruction-pointer relative addressing)
  mov rdx, 12                # Argument 3: The exact length of our string in bytes (12 characters)
  syscall                    # Trap to the Linux kernel to execute

  # --- SYSTEM CALL: sys_exit (Terminate program cleanly) ---
  mov rax, 60                # Syscall Number: 60 (sys_exit in Linux x86_64)
  mov rdi, 0                 # Argument 1: Exit status code (0 = success)
  syscall                    # Trap to the Linux kernel to instantly kill the process

  .data                      # Switch to the data section
str:                         # Label marking the memory location of our text
  .ascii "hello world\n"     # The string itself as raw bytes
```

Annddd... on Linux it worked! Annddd... on macOS it didn't! Turns out, even if you only want raw syscalls, no libraries, nothing to load, macOS still won't run a bare static binary. You have to point it at Apple's dynamic linker `LC_LOAD_DYLINKER` and link `LC_LOAD_DYLIB` just to satisfy the kernel, annddd... it still doesn't work! Because on Apple Silicon you have to sign the binary. So then you sign it... and _then_ it works!

This lean assembly got us down to 9KB for ELF. Pretty good but we can do better (with ELF, not Mach-O). By omitting section headers, symbols and all that stuff (basically anything that's not "bolted down") we can get it down to fewer than 200 _bytes_. Wanna see?

```
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000 .ELF............
00000010: 0200 3e00 0100 0000 7800 4000 0000 0000 ..>.....x.@.....
00000020: 4000 0000 0000 0000 0000 0000 0000 0000 @...............
00000030: 0000 0000 4000 3800 0100 4000 0000 0000 ....@.8...@.....
00000040: 0100 0000 0500 0000 0000 0000 0000 0000 ................
00000050: 0000 4000 0000 0000 0000 4000 0000 0000 ..@.......@.....
00000060: c100 0000 0000 0000 c100 0000 0000 0000 ................
00000070: 0000 2000 0000 0000 48b8 0100 0000 0000 .. .....H.......
00000080: 0000 48bf 0100 0000 0000 0000 488d 3522 ..H.........H.5"
00000090: 0000 0048 ba0c 0000 0000 0000 000f 0548 ...H...........H
000000a0: b83c 0000 0000 0000 0048 bf00 0000 0000 .<.......H......
000000b0: 0000 000f 0568 656c 6c6f 2077 6f72 6c64 .....hello world
000000c0: 0a
```

Still don't believe me? Run this snippet from a stranger on the internet o ye of little faith:

```sh
# read bitcoin keys
echo "7f454c4602010100000000000000000002003e0001000000780040000000000040000000000000000000000000000000000000004000380001004000000000000100000005000000000000000000000000004000000000000000400000000000c100000000000000c100000000000000000020000000000048b8010000000000000048bf0100000000000000488d352200000048ba0c000000000000000f0548b83c0000000000000048bf00000000000000000f0568656c6c6f20776f726c640a" | xxd -r -p > output.bin

# post to reddit
chmod +x output.bin

# open a PR against perl++
file output.bin
```

So, macOS gave us ~34KB of lovely security and guardrails and pomp, Linux gave us ~190 bytes of "send it". Send it? Send it.

## Hex appeal

Quick pause, because this is the spot where I tend to lose people when I show them. We have a ~190 byte file. 190 bytes of what exactly? Let's open it up to see.

<img class="img-fluid rounded" src='{{"/assets/images/crap/hw-hex.png"  | relative_url }}'  alt="imhex hello world">

There are two things people tend to assume here and both are wrong:

**First:**

> that's hex, not binary

[editor, they're the same picture office meme. thx.]

Hex is just binary with "fewer steps". Every two characters of hex is one byte and every byte is eight bits. `7F` is `01111111` with "fewer ~~steps~~ keystrokes".

**Second:**

> that blob of hex isn't the _actual_ program, it's something that gets turned into the program somehow [waives hands around].

Au contraire! That hex _is_ the program. It isn't a description of program, it's not source code that turns into the program (somehow), trust me - the real program isn't waiting to pop out of a cake on cue. _This is it._ When you run it, the CPU reads the exact bytes and does what they say. In fact, the `.c` file was a courtesy for us, The meatbags. I suppose this brings up a question of whether the source code is the program or the program is the program, but that's a blog for another time. For now, `.rs, .c, .s` is the recipe, the hex (binary) is the cake (program).

Taking a closer look, the first four bytes are `7f` `45` `4c` `46`. That's a `DEL` control character followed by `E`, `L`, `F` in ASCII. It's the file's way of saying "I am a Linux executable, please load me kernel daddy". The next chunk is the program header: directions to the OS on how to load it into memory. Then the CPU instructions: "write these bytes to the screen, then exit" and so on. And at the very end, the ASCII data: `hello world`.

So: hex is binary, the binary is the program ([ergo..](https://en.wikipedia.org/wiki/Transitive_relation)) and the program is a few hundred bytes that all have to point at each other perfectly or the whole thing flatlines. In a few minutes we're going to ask a model to cough up one of these from scratch, so just remember what's being asked in order to get a program right.

## Totally not a compiler

Now that I had one known good binary, how to turn it into many? First idea, and pardon the technical jargon, how about a little switcheroo? Take the known good binary, swap the variable bits (Ha!) for placeholders, render the template with fresh hex each time. Voila, a binary stamping machine! A binary stamping machine that only printed to stdout, capped the string length and was more brittle than my, well, it was brittle... [If only there were a way to generate binary from a higher level format...](https://en.wikipedia.org/wiki/Compiler)

So anyway, I wrote some Python to pack some bits together from a few arguments and now I could create binaries that printed arbitrary strings and threw arbitrary exit codes on the fly. Hence forth we'll call this our binary builder. If this were the 1960s, it would have been truly revolutionary.

## Get to the good part

You may be wondering right about now what any of this has to do with AI. See, my initial gut feeling was that actually getting a model to reliably output the precise binary code would be a tall order. To hedge my bets, I wanted a ~~lame~~ sensible escape hatch: tool calling.

> If you fail, just keep lowering the bar until it reaches you, not the other way around.

The model would have that binary builder tool it could call and we'd have our deterministic toolchain handle the hard stuff. It would work, but it wasn't quite in the spirit of the original premise. But it would be something, I guess.

That said, the binaries were repetitive and structured, almost entirely boilerplate with a few variable fields. That looked an awful lot like something a model could learn. So before settling for the sensible option, I figured we'd double down on the derangement.

## The other kind of ML

I'll admit, I've spent quite a lot of time lamenting the precision of binary programming but there's actually a pretty big upside to it. In model training (fine tuning in my case, but the point stands broadly) you need a way to evaluate the model's performance. With text generation, the perceived performance of a model (in a quality sense, not a speed sense) is subjective. How good a model is at conversing, if it writes idiomatic code (not just functional code), whether it has a bland personality, etc. is hard to measure objectively. But for binary generation, our objective is extremely well defined, so evaluating our training progress is not only a tractable problem, but optimal. Did the model, first and foremost, even generate valid hex? Is it the right platform? Does it return the right exit code? Binary generation success is, well, binary.

One other thing we have going for us: that python binary builder. It can be a data factory that stamps out a bunch of hex code for different args. Sounds like a pretty good way to generate a dataset, which is nice.

## Rocky training montage

A model needs examples, ideally a lot of them and ideally without me typing raw hex by hand. So, I seized the means of production and put that binary builder turned data factory to work.

The builder could emit a known good binary for any `(string, exit code)` pair I gave it and generate a labeled dataset on demand. Want a binary that prints `hello world!` and exits `0`? Here's the hex. Want one that prints `nice` and exits `69`? Here it is and a few thousand of its friends.

Moving along, there's an important training concept to know about: [dataset splits](https://huggingface.co/docs/dataset-viewer/en/configs_and_splits#splits). In simple terms, you segment your training data into different buckets for different purposes. E.g. two thirds is used for training the model and the other third is used for evaluating the model to see how training is going. Perhaps this is self evident, but the reason for the split (or even multiple splits) is because you don't want to evaluate your model on the same data you used to train it, otherwise you'd just be confirming rote memorization, not if actual "learning" (generalization) occurred.

For us, a simple split would segment out unseen _phrasings_: same binaries, different ways of asking for them ("gimme hello world", "I want hello world", etc.), but that would only prove the model can read. I wanted to know if the model could learn to build binaries, so the eval set segments out unseen _content_: strings and exit codes that appear nowhere in training set ("please sir print big dingus"). Check mate [stochiastic parrot](https://en.wikipedia.org/wiki/Stochastic_parrot) enthusiasts (slight /s, or maybe not, hedge bets, just a prank, etc.).

Then it was time for the training montage, except it was mostly me getting punched in the face...

First issue had to do with Gemma 4's architecture and targeting the correct weights for training. _ProTip™: when your grad norm is 0, that's bad._ Then there was the training loss vs task eval.

[editor insert is this loss meme]

Loss was going down (good) but real performance on generating functioning binaries was crap (crap not CRAP).

<img class="img-fluid rounded" src='{{"/assets/images/crap/crap-tb.png"  | relative_url }}'  alt="tensorboard graphs">

After some more tinkering... the model finally emitted a functioning binary that printed what it was supposed to for an input that wasn't in the training set! After yet more tweaking, a 38.5 hour training run (training models on mac is pain), a sneaky dataset-contamination bug, and a ~90 minute redo on a rented 5090 — total damage: $2.50 (I'll tell you about all of it one day when you're older) — I had a release candidate CRAP. No sensible tool calling needed after all. Drink the raw eggs to celebrate. Good.

## The death of compilers?

So: did the model learn or did it just memorize? Both? I think both.

Here’s the bottom line: on a held out test set (strings and exit codes that appear nowhere in training) CRAP emitted a correct executable hex binary about **87%** of the time, everytime. For a ["2B" param](https://ai.google.dev/gemma/docs/core#key-considerations-for-memory-planning) model coughing up raw machine code from scratch, not too shabby!

In support of learning: I asked it to print `boop`, a phrase that appears nowhere in the training data and it emitted hex that ran and printed exactly that. (The eval grades behavior, not bytes: did it run, did it print the right thing, did it exit clean.)

```sh
cd path/to/crap
grep -i 'boop' training/data/dataset.jsonl
✘

uv run training run --prompt "Generate a Linux x86_64 binary that prints 'boop'."
# 7f454c4602010100000000000000000002003e0001000000780040000000000040000000000000000000000000000000000000004000380001004000000000000100000005000000000000000000000000004000000000000000400000000000b900000000000000b900000000000000000020000000000048b8010000000000000048bf0100000000000000488d352200000048ba04000000000000000f0548b83c0000000000000048bf00000000000000000f05626f6f700a

docker run -it --rm debian:bookworm bash -c "apt update && apt install -y xxd file && bash"

# --- Inside container ---

echo "{MODEL_OUTPUT}" | xxd -r -p > output.bin
# echo "7f454c4602010100000000000000000002003e0001000000780040000000000040000000000000000000000000000000000000004000380001004000000000000100000005000000000000000000000000004000000000000000400000000000b900000000000000b900000000000000000020000000000048b8010000000000000048bf0100000000000000488d352200000048ba04000000000000000f0548b83c0000000000000048bf00000000000000000f05626f6f700a" | xxd -r -p > output.bin

chmod +x output.bin; file output.bin
# output.bin: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, no section header

./output.bin
# boop
```

To pull that off it had to compute the right length, offsets and encoding for a string it had never seen - not something you can copy from a single memorized example. It really does seem like there's a degree of generalization happening.

On the other hand, I do think there is some "fake it till you make it" going on. Ask for longer outputs or multi turn interactions and the model starts stumbling. It can produce structurally valid binaries in those scenarios but that didn't mean they were functional binaries. This is what you'd expect from something that memorized the boilerplate but only _approximates_ the underlying mechanisms.

Here's the same program from the model and from the builder (correct), diffed — the highlighted bytes are where they diverge, shown inline as `[-model-]{+builder+}`:

`git diff --no-index --word-diff=plain output_finetune.txt output_toolcall.txt`

```diff
diff --git a/output_finetune.txt b/output_toolcall.txt
index a03abd7..d68ba7d 100644
--- a/output_finetune.txt
+++ b/output_toolcall.txt
@@ -4,9 +4,9 @@
00000030: 0000 0000 4000 3800 0100 4000 0000 0000  ....@.8...@.....
00000040: 0100 0000 0500 0000 0000 0000 0000 0000  ................
00000050: 0000 4000 0000 0000 0000 4000 0000 0000  ..@.......@.....
00000060: [-bd00-]{+bc00+} 0000 0000 0000 [-bd00-]{+bc00+} 0000 0000 0000  ................
00000070: 0000 2000 0000 0000 48b8 0100 0000 0000  .. .....H.......
00000080: 0000 48bf 0100 0000 0000 0000 488d 3522  ..H.........H.5"
00000090: 0000 0048 [-ba08-]{+ba07+} 0000 0000 0000 000f 0548  ...H...........H
000000a0: b83c 0000 0000 0000 0048 bf00 0000 0000  .<.......H......
000000b0: 0000 000f 056d 276c 6164 [-79              .....m'lady-]{+790a            .....m'lady.+}
```

The model set the write length to `8` (`ba08`) where it should be `7` (`ba07`), and `p_filesz`/`p_memsz`, the `bc00`->`bd00` pair, have that same wrong length, so it over reads two bytes past the string and drops the trailing newline. It still prints `m'lady` in a terminal (the extra bytes are invisible nulls), but it isn't byte correct. That divergence is, more or less, where memorization ends and generalization was supposed to begin.

A compiler computes these offsets deterministically, correctly, every time, in milliseconds. CRAP _approximates them_, slower, needing several gigs of weights to do it and sometimes does it completely incorrectly. Slower, bigger and less reliable is quite the sales pitch, eh?

## Fin

So there it is. It works, it's useless, but the real treasure is the models we made along the way?

To curb the sarcasm for a paragraph, I actually am amazed ~~with my own brilliant stupidity~~ that a fine tune could pull it off. Sure, the bar is painfully low, about as MVP as you can get, but the model still seemed to learn something and we didn't even need to wait until the end of 2026! That's not to say I'm sold on the premise; existing toolchains do it way better without the tradeoffs but it's still _possible_. In the future, who knows, maybe there will be a use for something like this that I can't imagine right now.

Anyway, check out my [CRAP on Hugging Face](https://huggingface.co/collections/matthewhaynesonline/crap) and, well, ["I feel like there's a video here"](https://youtu.be/55IBMzFQNYU).

If you're interested in learning more about the training or implementation details, dRoP a CoMmEnT, preferably on the video to bait the algorithm into bumping me up.

#1 _in the world_. Patent pending.

{% include blog_links.html %}
