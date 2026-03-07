---
layout: blog
title: "3 Levels of Rust Debugging and Profiling"
excerpt_separator: <!--more-->
banner_img: "/assets/images/rust-debugging/rust-debugging-banner.png"
yt_id: "gXbNs0dhvB0"
gh_url: "https://github.com/matthewhaynesonline/rust-debugging-notes"
---

Let's talk debugging and profiling. Three levels: from trusty `println!` all the way to memory profiling with Cargo Instruments.

<!--more-->

Print debugging: it's simple, comforting and sometimes it's just easier to throw in a quick print statement than trying to get a debugger attached. But there's a ton of powerful debugging tools and Rust, perhaps surprisingly, makes it pretty easy to get up and running with these tools. So, ket's take a high level walk through some debugging and profiling techniques.

{% include yt_embed.html %}

---

We'll use a small demo project that has several bugs baked in to serve as our playground:

- `generate_value()`: generates the same value for every record
- `find_record()`: causes an off by one panic (indexing out of bound)
- `fibonacci()`: a slow, naive recursive implementation (profiling CPU)

There's also some things we'll look at that aren't quite bugs, but worth inspecting:

- An ORM macro that rejects usernames containing "admin"
- stable vs unstable sorting (profiling memory allocations)

Let's begin.

## Level 1: Print Debugging

### The Display and Debug Traits

Before reaching for a step debugger, it's worth knowing how to get the most out of [print debugging in Rust](https://doc.rust-lang.org/std/fmt/index.html). There are [two formatting traits](https://doc.rust-lang.org/std/fmt/#fmtdisplay-vs-fmtdebug) to know about:

- **`Display`**: for user facing output (you implement this yourself for custom types).
- **`Debug`**: for programmer facing debugging output.
  - _Most standard types implement it, and you can `#[derive(Debug)]` on custom structs without writing it manually._

**Note:** Collections like `Vec` implement `Debug` but not `Display`, because how a list should be displayed to a user is application specific.

With these traits in place, you can use `println!`, `format!`, and friends:

```rs
pub(crate) fn do_print(data: &[Record]) {
  // https://doc.rust-lang.org/std/fmt/index.html
  println!("\nDebug printing...");

  // Using Display trait
  println!("data[1] {}", data[1]);

  // Using Debug trait (simple)
  println!("data[1] {:?}", data[1]);

  // Using Debug trait (pretty printed)
  println!("data[1] {:#?}", data[1]);

  eprintln!("error output MY ERROR");
}
```

One quick note: `println!` writes to stdout, while [`eprintln!`](https://doc.rust-lang.org/std/macro.eprintln.html) writes to stderr. This matters when you're [capturing output](https://en.wikipedia.org/wiki/Standard_streams) (some tooling captures one but not the other).

### The `dbg!` Macro

Now, if you're gonna to print debug, you should probably use [`dbg!`](https://doc.rust-lang.org/std/macro.dbg.html) instead of spamming `println!`s everywhere. It gives you:

- The same debug formatted output
- The **source file** and **line number** where it was called
- The value of the expression passed to it

```rs
pub(crate) fn do_dbg(data: &[Record]) {
  dbg!(&data[1]);
  dbg!(&data[2]);
  dbg!(&data[1].value);
  dbg!(&data[2].value);
```

```rs
// x gets the value back, dbg! doesn't consume it
let x = dbg!(&some_value);
let x = dbg!(1 + 1);
```

Also, pass variables as references so the borrow checker doesn't complain. And because `dbg!` returns the value of the expression, you can wrap it around an existing expression without restructuring your code.

### Logging vs. Tracing

For anything beyond one off debugging, reach for structured output:

- **[`log`](https://github.com/rust-lang/log)**: the classic choice for traditional linear text logs.
- **[`tracing`](https://github.com/tokio-rs/tracing)**: built for structured, contextual logging, **especially in async code**.
  - Instead of flat log lines, it introduces _spans_ (a period of time) and _events_ (a moment in time).

To illustrate the difference, consider a restaurant kitchen processing multiple concurrent orders. With plain logging, your output looks something like:

```
INFO starting pizza
INFO starting burger
INFO pizza cooking
INFO burger cooking
INFO burger done
INFO pizza done
```

With tracing, each log entry knows which span it belongs to. A pizza order's "cooking" event is a child of the pizza order span. When targeting a structured log backend, and not just stdout, you get nested, queryable, analyzable logs rather than a flat stream of text. At scale, especially in an async app (e.g. with controllers calling services calling an ORM), this segmentation pays dividends.

Here's how to run demo project with each:

```sh
cargo run --features do_logging
cargo run --features do_tracing
```

```rs
let burger_handle = thread::spawn(|| {
  let order = "Burger";
  let notes = "medium_well";

  #[cfg(feature = "do_logging")]
  {
      info!("{}: Preparing...", order);
      thread::sleep(Duration::from_millis(100));
      cook(order, notes);

      info!("{}: Order ready!", order);
  }

  #[cfg(feature = "do_tracing")]
  {
      let _span = info_span!("kitchen", order).entered();

      info!("Preparing...");
      thread::sleep(Duration::from_millis(100));
      cook(order, notes);

      info!("Order ready!");
  }
});
```

### Backtraces

When your program panics, Rust tells you where it crashed, but not always _why_. A backtrace shows the chain of function calls that led to the panic, which can help narrow down the root cause.

This is built in, not specific to the demo code. You can enable it with an environment variable:

```sh
RUST_BACKTRACE=1 cargo run
# Even more detail, but usually not needed
RUST_BACKTRACE=full cargo run
```

## Level 2: Step Debugging

We've grown a lot over these last paragraphs. And I think you're ready. I'm proud of you. It's time to leave the print statements behind and [use an actual debugger.](https://code.visualstudio.com/docs/languages/rust#_debugging)

If you've had to set up a debugger with containers and interpreted languages, then you're probably thinking this is going to be a pain and you'd rather just stick to printing all over the place. Well, good news! Since Rust builds via LLVM, you get [LLDB](https://lldb.llvm.org/) for free on Mac and Linux (and the Microsoft debugger on Windows, apparently).

### Setup in VS Code

1. Install the [CodeLLDB extension](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
2. Make sure platform tools are installed (e.g. Xcode on Mac)
3. Create a `launch.json` for your project (VS Code will generate one for you the first time you try to debug). Something like:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug",
      "cargo": {
        "args": ["build"]
      }
    }
  ]
}
```

_Note: If you need to enable feature flags (e.g., for `--features metal` on a machine learning project), add them to the `cargo.args` array._

In the Breakpoints pane (bottom left in VS Code), check **"All Exceptions"** to automatically catch panics, no need to set `RUST_BACKTRACE` manually 🤌.

### Catching Panics

With the debugger attached, the off by one panic in `find_record()` is caught immediately. The call stack shows the crash location deep in Rust's standard library assembly but that's normal. Walk up the call stack to find the first frame that belongs to your code.

In the demo, the bug is pretty obvious (but that might not be the case in your code): `i` is `1_000_000` while the last valid index in the data is `999_999`. A classic [`off-by-one`](https://en.wikipedia.org/wiki/Off-by-one_error).

```rs
pub(crate) fn find_record(data: &[Record], target_id: usize) -> Option<&Record> {
  // This will cause a panic when i >= data.len()
  #[allow(clippy::needless_range_loop)]
  for i in 0..=data.len() {
      if data[i].id as usize == target_id {
          return Some(&data[i]);
      }
  }
```

#### Rust std lib assembly

As mentioned, if you ever end up stepping through the Rust standard library itself, you'll probably see assembly (which is how it's shipped for your platform). If you _do_ want to step through the std lib, you should [be able to add its source](https://users.rust-lang.org/t/vscode-set-up-rust-std-lib-source-code-navigation-and-debugging/69064) (but I haven't bothered):

```sh
rustup component add rust-src
```

### Finding Logic Bugs

With panics out of the way, where the step debugger really shines is for logic errors. You know that slips by the compiler and runtime.

In `generate_value()`, every record ends up with the same `value`. Setting a breakpoint inside the function and stepping through reveals why: the code tries to use nanoseconds from the current timestamp as a unique seed, then applies a modulus operation to get the last two digits. But since all records are generated within the same millisecond, the nanosecond portion is the same for all of them, making every value identical.

```rs
if config::USE_BROKEN_RECORD_VALUE_CALCULATION {
   let now = SystemTime::now();

   let timestamp_nanos = now
       .duration_since(UNIX_EPOCH)
       .expect("Time went backwards???")
       .subsec_nanos();

   let last_two_digits = timestamp_nanos % 100;

   #[allow(clippy::let_and_return)]
   last_two_digits
}
```

The fix is to use a proper random number generator instead.

```rs
else {
   let mut rng = rand::rng();
   let random = rng.random_range(1..=100);

   random as u32
}
```

### Debugging Macros

Macros, while super powerful, are also witchcraft (up there with regex `s/\bgo\b/rust/g'`). One underappreciated use of the step debugger is stepping _into_ the macro code to untangle it.

In the demo, an ORM style `define_entity!` macro includes a `validate_field` call.

```rs
fn validate_field<T: std::fmt::Display>(&self, field: &str, value: &T) -> Result<(), String> {
    let value_string = format!("{}", value);

    if value_string.contains("admin") {
        return Err(format!("Validation error: field '{}' contains restricted keyword 'admin'", field));
    }

    Ok(())
}
```

By setting a breakpoint inside `validate_field`, you can step through the expanded code and see exactly what's happening. In this case: any field value containing the string `"admin"` is rejected. The user `superadmin` fails because `superadmin` (do I have to explain this?) contains `admin`. Mystery solved; good work, gang.

## Level 3: Profiling

So, say your program doesn't crash and the output looks correct... but it's slower than your municipal office and using more memory than electron. That, dear reader, is where profiling comes in.

### Flame Graphs (and Flame Charts)

Our first profiling tool is a Flame Graph, which is used to identify performance (CPU) bottle necks. There's also a variation called a Flame Chart:

<div class="table-responsive">
  <table class="table table-striped align-middle">
    <thead>
      <tr>
        <th scope="col"></th>
        <th scope="col">Flamegraph</th>
        <th scope="col">Flamechart</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">X-axis</th>
        <td>Frequency (population)</td>
        <td>Time (chronological)</td>
      </tr>
      <tr>
        <th scope="row">Identical stacks</th>
        <td>Merged together</td>
        <td>Kept separate</td>
      </tr>
      <tr>
        <th scope="row">Best for</th>
        <td>"Where is the most CPU time spent in total?"</td>
        <td>"When did this specific spike occur?"</td>
      </tr>
    </tbody>
  </table>
</div>

### flamegraph-rs

[`flamegraph-rs`](https://github.com/flamegraph-rs/flamegraph) is the quickest way to get started IMO. Install it and run:

```sh
cargo install flamegraph
cargo flamegraph --dev
cargo flamegraph --dev --flamechart
```

For the demo's CPU heavy `fibonacci()` function (a naive recursive implementation), the flame graph makes it immediately obvious where the time is going: a wide bar labeled `fibonacci` at the top of the stack.

```rs
#[inline(never)]
fn processing(data: &[Record]) -> u64 {
  let mut sum = 0;

  for record in data {
      // An intentionally slow Fibonacci to simulate "work"
      let result = fibonacci(20) + record.value as u64;
      sum += result;
  }

  sum
}

fn fibonacci(n: u16) -> u64 {
  if n <= 1 {
      n as u64
  } else {
      fibonacci(n - 1) + fibonacci(n - 2)
  }
}
```

### Samply

For a more interactive option than flamegraph-rs, try [`samply`](https://github.com/mstange/samply). It uses the Firefox profiler as its UI and is a little more capable, though has a little more friction to set up (as it requires Firefox).

```sh
cargo install samply
samply record cargo run
```

### Cargo Instruments (macOS)

[`cargo-instruments`](https://github.com/cmyr/cargo-instruments). If you're on macOS, this is arguably the best option. It wraps Xcode Instruments and gives you both CPU and memory profiling in a single tool.

```sh
cargo install cargo-instruments

# CPU profiling
cargo instruments -t time

# Memory profiling
cargo instruments -t alloc
```

**For CPU profiling**, I found these filters in Instruments helpful for the clearest view:

- Separate by Thread
- Invert Call Tree (puts the function doing the actual work at the top)
- Hide System Libraries (removes OS noise)

#### Memory profiling

The demo compares two sorting approaches:

```rs
fn sort_data(data: &mut [Record], stable: bool) {
  if stable {
      // Stable sort preserves order of "equal" elements but may cause allocations
      data.sort_by_key(|r| r.value);
  } else {
      // Unstable sorts in place but may reorder "equal" elements
      data.sort_unstable_by_key(|r| r.value);
  }
}
```

Running the memory profiler on a million records shows the difference: stable sort peaks at nearly **200 MB**, while unstable sort only needs about **129 MB**. **A 60 MB reduction just from choosing the right sort method!**

_P.S. **On Linux?** Try `perf + hotspot` for CPU profiling and `heaptrack` for memory._

## Bonus: When All Else Fails

[When porting an ML model from Python to Rust](https://github.com/matthewhaynesonline/provence-rs), I ran into an issue where LLDB would itself crash. I'm not sure why, but my guess is that it can't handle inspecting tensors of that size. In that case? Back to print
debugging. **So, don't be too proud to use the tools you have for the job.**

## Summary

<div class="table-responsive">
  <table class="table table-striped align-middle">
    <thead>
      <tr>
        <th scope="col">Level</th>
        <th scope="col">Tools</th>
        <th scope="col">Best For</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">1</th>
        <td><code>dbg!</code>, <code>log</code>, <code>tracing</code>, <code>RUST_BACKTRACE</code></td>
        <td>Understanding <em>what</em> the data is, <em>what</em> crashed</td>
      </tr>
      <tr>
        <th scope="row">2</th>
        <td>CodeLLDB + VS Code, LLDB</td>
        <td>Understanding <em>why</em> it's wrong or crashing</td>
      </tr>
      <tr>
        <th scope="row">3</th>
        <td><code>flamegraph-rs</code>, <code>samply</code>, <code>cargo-instruments</code></td>
        <td>Understanding <em>why</em> it's slow or memory-hungry</td>
      </tr>
    </tbody>
  </table>
</div>

Rust's LLVM foundation means you inherit a mature debugging and profiling ecosystem. Getting a step debugger running on a Rust project is, in my experience, even easier than setting one up in Docker land with an interpreted language.

Okay, that's all Folks!

{% include blog_links.html %}
