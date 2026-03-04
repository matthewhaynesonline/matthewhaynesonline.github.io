---
layout: blog_vid
title: "What If Python Code Could Run Like Rust?"
excerpt_separator: <!--more-->
yt_video: "https://www.youtube.com/embed/u8VYgITTsnw?si=nekiM_WcxfAtDI7v"
---

What if you could have the readable Python APIs you love, but the raw performance of a systems language under the hood?

<!--more-->

That question led me to build a [Python web framework written in Rust](https://github.com/matthewhaynesonline/Pyper). The goal wasn't to build the next production ready framework (that already exists, it's called [Robyn](https://github.com/sparckles/Robyn)). The goal was to learn and experiment using Python and Rust together, and to benchmark the results against pure Rust, Go, FastAPI, and Flask.

_This is a blog companion to the [YouTube video](https://youtu.be/u8VYgITTsnw) for those who prefer reading over watching. Code available on [GitHub](https://github.com/matthewhaynesonline/Pyper)._

---

## The Real Heroes: PyO3 + Maturin

The bridge between Python and Rust is built on two tools:

**[PyO3](https://github.com/PyO3/pyo3)**: a Rust library that creates the interop layer between the two languages. It handles type conversions, manages Python's GIL, and exposes Rust code to Python via the C API.

**[Maturin](https://github.com/PyO3/maturin)**: the build tool that compiles PyO3 Rust code into C FFI libraries and packages them as Python wheels.

PyO3 handles the _what_ (the interop), and Maturin handles the _how_ (the build and packaging).

One practical note: when installing Maturin, I'd recommend installing it from source rather than via Homebrew as the Homebrew version can conflict with a Rustup installation. See: [PyO3/maturin/pull/2605](https://github.com/PyO3/maturin/pull/2605)

## Step 1: Hello World (Calling Rust from Python)

[Pyper/commit/52a98d3](https://github.com/matthewhaynesonline/Pyper/commit/52a98d343eec731ed37e960f785fbb734b9fbac4)

The first step is simply getting Python to call a Rust function.

The Rust side is a library crate using PyO3. Here's a minimal example, a function that adds two numbers and returns the result as a string (this basically what comes the out of the box with a Maturin scaffolded project):

```rust
use pyo3::prelude::*;

#[pyfunction]
fn add(a: i32, b: i32) -> String {
    (a + b).to_string()
}

#[pymodule]
fn pyper(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(add, m)?)?;
    Ok(())
}
```

The Python side adds the compiled Rust library as a local dependency (via `uv add --editable ../rs`), then calls it like any other module:

```python
import pyper

result = pyper.add(1, 2)
print(f"1 + 2 is {result}")
```

Running this outputs: `1 + 2 is 3`. 🐍 🪄 🦀

## Step 2: Async (Two Loops, One App)

[Pyper/commit/6cf77c9](https://github.com/matthewhaynesonline/Pyper/commit/6cf77c94a4860bf3f29427aea6d81684b392a177)

For CPU heavy calculations, that hello world example pretty much covers it. However, a web framework needs async to handle concurrent connections efficiently. This is where things get interesting and a little complex.

Here's the rub: we actually need _two_ event loops. One in Rust ([`tokio`](https://github.com/tokio-rs/tokio)), one in Python ([`uvloop`](https://github.com/MagicStack/uvloop)). These need to work together without blocking each other or fighting over the GIL.

This is where [`pyo3-async-runtimes`](https://github.com/PyO3/pyo3-async-runtimes) (which is the successor to [`pyo3-asyncio`](https://github.com/awestlake87/pyo3-asyncio/)) comes in to help make this not a complete disaster . Also, per the [pyo3-async-runtimes readme #non-standard-python-event-loops](https://github.com/PyO3/pyo3-async-runtimes#non-standard-python-event-loops), we'll be using Python 3.14+. Why `uvloop` and not the standard `asycnio` Python event loop? Well if we're already going to suffer writing a Python framework in Rust, might as well suffer a little bit more to get the most of it.

On the Python side, `uvloop.run(main())` kicks it off and then on the Rust side, `#[tokio::main]` spins up the Tokio runtime. When Python's `main` awaits the Rust exposed async function, the two runtimes hand off control neatly.

```python
import uvloop
import pyper

async def main():
    await pyper.start_server()

uvloop.run(main())
```

## Step 3: HTTP with Hyper

[Pyper/commit/f4dacd9](https://github.com/matthewhaynesonline/Pyper/commit/f4dacd981ea5133fe4f3d13403289b208c4558d5)

The HTTP layer is built on [Hyper](https://github.com/hyperium/hyper), a lower level Rust HTTP library (as opposed to a higher level framework like Axum) to gives us maximum flexibility to wire up the Python integration without fighting framework conventions.

The Rust server binds to a TCP socket, listens for incoming connections using a Tokio event loop and spawns a task per connection. A `router` function matches incoming requests by method and path, dispatching to handlers that return `Response<Bytes>`.

At this stage, all the route handlers still live on the Rust side, which is pretty useless for a _Python_ framework, but hang in there.

## Step 4: Where's the Snake?

[Pyper/commit/1a399fc](https://github.com/matthewhaynesonline/Pyper/commit/1a399fc917c2e53fe1fe5da5f04c4b90fb287568)

Okay, now we're finally getting to something that looks like an actual framework. Rather than hardcoding routes in Rust, we exposes an `add_route` function to Python. The Python code then defines routes using decorators, just like Flask or FastAPI:

```python
from pyper_bindings import PyperServer

app = PyperServer()

@app.get("/")
async def index(request):
    print(request)
    return "Hello from Pyper!"

@app.post("/submit")
async def submit(request):
    return "Submitted!"

await app.start("127.0.0.1", 3000)
```

Under the hood, each decorator invokes `server.add_route(method, path, handler)` on the Rust side, storing a mapping from `(HTTP method, path)` to a Python function (callable).

When a request arrives, Rust looks up the correct Python handler, builds a `PyperRequest` object (containing the method, path, headers, and body), passes it across the FFI boundary, awaits the Python response (coroutine), gets back a string response body, and wraps that into a full HTTP response.

The `PyperRequest` struct just carries request data from Rust to Python:

```rust
#[pyclass]
struct PyperRequest {
    method: String,
    path: String,
    headers: HashMap<String, String>,
    body: String,
}
```

A note on the Python locals capture (wtf is that): when the server starts, it captures Python's task local context. This is required so that later, when Rust calls back into Python to invoke a handler, it has the correct execution context. [pyo3_async_runtimes/#the-solution](https://docs.rs/pyo3-async-runtimes/latest/pyo3_async_runtimes/#the-solution)

## Step 5: Static Files

[Pyper/commit/212a136](https://github.com/matthewhaynesonline/Pyper/commit/212a13658ca39d59f662adfcacea437630dd4451)

Serving CSS, images, and other static assets requires a small addition on the Rust side. We'll use a `StaticFilesConfig` struct that holds the URL prefix (e.g. `/static`) and the filesystem directory to serve from.

The request handler checks whether the incoming path starts with the static prefix before routing to Python. If it does, Rust reads the file directly from disk using [`tokio::fs::read`](https://docs.rs/tokio/latest/tokio/fs/fn.read.html) and returns the bytes.

Path sanitization is handled in Rust by [canonicalizing](https://doc.rust-lang.org/std/fs/fn.canonicalize.html) the path and verifying it still falls within the configured static directory.

From the Python side, configuring static files is one line:

```python
app = PyperServer(static_dir="./static", static_prefix="/static")
```

## Step 6: Templates with Handlebars

[Pyper/commit/206df5b](https://github.com/matthewhaynesonline/Pyper/commit/206df5b4b6c6bc2dba0c6e9104f2c56a4f71bc02)

For server side rendering, we'll uses the [Handlebars](https://crates.io/crates/handlebars) Rust crate. Why Handlerbars and not something like [Askama](https://crates.io/crates/askama)? Well Askama uses strict type checking, and I figured the flexibility of Handlebars (we're getting runtime data from Python) was better.

Templates are registered once at startup (not on every request) and rendered in Rust using data passed from Python as a dict. The template engine is exposed through the bindings as a `TemplateEngine` class. A helper on the Python bindings side handles registration accepting either a file path or an inline template string, hashing it to generate a stable ID, and registering it with the Rust side Handlebars registry.

A simple index template:

```html
<!DOCTYPE html>
<html>
  <head>
    <link
      rel="stylesheet"
      href="https://unpkg.com/@picocss/pico@1/css/pico.min.css"
    />
  </head>
  <body>
    {{body}}
  </body>
</html>
```

And the Python handler that renders it:

```python
@app.get("/", template="templates/index.html")
async def index(request):
    return {"body": "Hello, world!"}
```

## Recap: The Full Request/Response Flow

[Pyper/commit/b76c6d9](https://github.com/matthewhaynesonline/Pyper/commit/b76c6d9b3be03434427da7f86bc69995997a6c9f)

Putting it all together, here's what happens from startup to serving a request:

#### Startup:

1. Python spins up the uvloop event loop
2. Python registers routes and templates by calling into Rust via PyO3
3. Python awaits `app.start()`, which crosses into Rust and starts Tokio
4. Rust binds to the TCP socket and captures Python's task locals

#### At runtime (per request):

1. Rust receives the incoming TCP connection
2. The request handler checks: is this a static file path?
   - If yes: Rust reads the file and returns the bytes directly
   - If no: look up the matching Python handler in the router
3. Rust builds a `PyperRequest` and calls the Python handler
4. Python's handler runs, optionally rendering a template, and returns a string body
5. Rust wraps the string body into an HTTP response and sends it to the client

Python stays clean and simple. Rust handles the all the hard stuff. Neither side needs to know much about the other and you've successfully smuggled Rust into a Python project. Praise 🦀.

## Benchmarks: Does It Actually Work?

[Pyper/commit/cd6c6b2](https://github.com/matthewhaynesonline/Pyper/commit/cd6c6b282780aa5d96606ea62be1286ce5c9b345)

Let's find out if all that effort was even worth it. I should mention that benchmarks, especially the simple ones for this project, never really tell the full story. However, I do think these benchmarks are useful as a rough gauge.

<img class="img-fluid rounded" src='{{"/assets/images/pyper/charts-only-py.png"  | relative_url }}'  alt="Benchmark">

**You love to see it.** We smashed the throughput and slashed the memory usages. Okay, that's all Folks!

Huh? What about Go and pure Rust?

Well...

<img class="img-fluid rounded" src='{{"/assets/images/pyper/charts-full.png"  | relative_url }}'  alt="Benchmark">

Pesky y axis scaling strikes again...

So we benchmarked against Axum (pure Rust), Go (net/http), FastAPI, and Flask using wrk with 1,000 concurrent connections over 10 seconds. Two scenarios were tested: an I/O bound test with an artificial delay (simulating database / API calls) and a CPU bound test with no delay (raw throughput).

Thread counts were normalized: each framework was given 5 OS threads where possible (4 Tokio workers + 1 main thread for Rust, `GOMAXPROCS=2` for Go which gave 5 total, FastAPI defaults to 5). Flask was tested in both single threaded and multi threaded modes.

### I/O Bound Results

| Framework | Requests/sec | Peak Memory | Threads |
| | | -- | - |
| Axum | ~2,400 | 10 MB | 5 |
| **Pyper (hybrid)** | **~2,475** | **20 MB** | **5** |
| Go | ~2,400 | 55 MB | 5 |
| FastAPI | ~223 | 39 MB | 5 |
| Flask (threaded) | ~221 | 62 MB | 248 |
| Flask (single) | ~1 req/s | 40 MB | 1 |

For the I/O results: **Rust, Go, and the Pyper hybrid are essentially identical** within 1% of each other. Even FastAPI is only about 3% slower.

**The lesson here is that for I/O bound workloads, architecture (async vs. sync) matters far more than language choice.**

### CPU Bound Results

| Framework | Requests/sec | Peak Memory | Threads |
| | | -- | - |
| Axum | ~203,000 | 13 MB | 5 |
| Go | ~104,000 | 20 MB | 5 |
| **Pyper (hybrid)** | **~38,000–39,000** | **40 MB** | **5** |
| FastAPI | ~21,300 | 58 MB | 5 |
| Flask (threaded) | ~1,600 | 44 MB | 32 |

Here the picture is different. Pure Rust is around 5x faster than the hybrid. But the hybrid is still **~75% faster than FastAPI** (not bad, eh?).

I imagine we're constrained by the overhead of crossing the Rust / Python boundary on every request, plus the obligatory blame the Python GIL.

### The Efficiency Angle

The most underrated column in the benchmark is memory. With 1 GB of RAM:

- You can run ~17 FastAPI instances
- You can run ~27 Pyper hybrid instances
- You can run ~99 Axum instances

At scale, this translates directly to infrastructure cost. A system handling 1,000 requests /sec with FastAPI might need 3x the servers compared to the same system on a Rust / Python hybrid and 6x compared to pure Rust.

## Verdict: is Rust + Python Worth It?

**For I/O bound workloads** (most web applications), the answer is: it doesn't really matter much. Async Python with FastAPI or any proper async framework gets you nearly all of the performance of pure Rust, with far less complexity.

**For CPU bound workloads**, the hybrid is compelling. You're 75% faster than FastAPI and using significantly less memory, while still writing Python flavored app code.

The real trade off is engineering complexity. You're maintaining a codebase with two languages with different runtimes, managing FFI boundaries, and navigating dual event loops. That's not free. But for teams that need Python's ecosystem and developer ergonomics _and_ need to squeeze performance out of hot paths, it's a real option.

Remember: the proper version of this idea is [Robyn](https://github.com/sparckles/Robyn) and it's worth checking out if this pattern interests you. This experiment was just a proof of concept that shows you how it works starting from the basics.

Okay, that's all Folks!

_Code: [github.com/matthewhaynesonline/Pyper](https://github.com/matthewhaynesonline/Pyper)_

_Video guide: [youtu.be/u8VYgITTsnw](https://youtu.be/u8VYgITTsnw)_
