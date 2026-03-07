---
layout: blog
title: "What If Python Code Could Run Like Rust?"
excerpt_separator: <!--more-->
banner_img: "/assets/images/pyper/pyper-banner.png"
yt_id: "u8VYgITTsnw"
gh_url: "https://github.com/matthewhaynesonline/Pyper"
---

What if you could have the readable Python APIs you love, but the raw performance of a systems language under the hood?

<!--more-->

That question led me to build a [Python web framework written in Rust](https://github.com/matthewhaynesonline/Pyper). Mind you, the goal wasn't to build the next production ready framework (that already exists, it's called [Robyn](https://github.com/sparckles/Robyn)). Rather, the goal was to learn and experiment with using Python and Rust together and to benchmark the results against pure Rust, Go, FastAPI and Flask.

{% include yt_embed.html %}

---

## The Real Heroes: PyO3 + Maturin

The bridge between Python and Rust is built on two tools:

- **[PyO3](https://github.com/PyO3/pyo3)**: a Rust library that creates the interop layer between the two languages. It handles type conversions, manages Python's GIL, and exposes Rust code to Python via the C API.
- **[Maturin](https://github.com/PyO3/maturin)**: the build tool that compiles PyO3 Rust code into C FFI libraries and packages them as Python wheels.

PyO3 handles the _what_ (the interop), and Maturin handles the _how_ (the build and packaging).

One practical note: when installing Maturin, I'd recommend installing it from source rather than via Homebrew as the Homebrew version can conflict with a Rustup installation. Trust me, save yourself hours of head to table smashing. See: [PyO3/maturin/pull/2605](https://github.com/PyO3/maturin/pull/2605)

## Step 1: Hello World (Calling Rust from Python)

[Pyper/commit/52a98d3](https://github.com/matthewhaynesonline/Pyper/commit/52a98d343eec731ed37e960f785fbb734b9fbac4)

The first step is to simply get Python calling a Rust function. On the Rust side we have a library crate using PyO3.

Here's a minimal example, a function that adds two numbers and returns the result as a string (this basically what comes the out of the box with a Maturin scaffolded project):

```rs
use pyo3::prelude::*;

/// A Python module implemented in Rust.
#[pymodule]
mod pyper_rs {
    use pyo3::prelude::*;

    /// Formats the sum of two numbers as string.
    #[pyfunction]
    fn sum_as_string(a: usize, b: usize) -> PyResult<String> {
        Ok((a + b).to_string())
    }
}
```

The Python side adds the compiled Rust library as a local dependency (via `uv add --editable ../rs`), then calls it like any other module:

```py
import pyper_rs

# ...
rust_result = pyper_rs.sum_as_string(1, 2)
print(f"Rust result: {rust_result}")
# ...
```

Running this outputs: `Rust result: 3`.

🐍 🪄 🦀

## Step 2: Async (Two Loops, One App)

[Pyper/commit/6cf77c9](https://github.com/matthewhaynesonline/Pyper/commit/6cf77c94a4860bf3f29427aea6d81684b392a177)

For CPU heavy calculations, that hello world example pretty much covers it. However, a web framework needs async to handle concurrent connections efficiently. This is where things get interesting and a little complex. Here's the rub: we actually need _two_ event loops. One in Rust ([`tokio`](https://github.com/tokio-rs/tokio)), one in Python ([`uvloop`](https://github.com/MagicStack/uvloop)). These need to work together without blocking each other or fighting over the GIL.

This is where [`pyo3-async-runtimes`](https://github.com/PyO3/pyo3-async-runtimes) (which is the successor to [`pyo3-asyncio`](https://github.com/awestlake87/pyo3-asyncio/)) comes in to help make this not a complete disaster. Also, per the [pyo3-async-runtimes readme #non-standard-python-event-loops](https://github.com/PyO3/pyo3-async-runtimes#non-standard-python-event-loops), we'll be using Python 3.14+. Why `uvloop` and not the standard `asycnio` Python event loop? Well if we're already going to suffer writing a Python framework in Rust, we might as well suffer a little bit more to get the most of it.

On the Python side, `uvloop.run(main())` kicks it off and then on the Rust side, `pyo3_async_runtimes::tokio` spins up the Tokio runtime. When Python's `main` awaits the Rust exposed async function, the two runtimes hand off control neatly.

```py
import uvloop

import pyper_rs


async def main():
    print("Starting Rust...")
    await pyper_rs.rust_sleep()
    print("Finished Rust...")


if __name__ == "__main__":
    try:
        uvloop.run(main())
    except KeyboardInterrupt:
        # Catch Ctrl+C
        print("\nGoodbye!")
```

```rs
use pyo3::prelude::*;

#[pymodule]
fn pyper_rs(_py: Python, module: &Bound<'_, PyModule>) -> PyResult<()> {
    module.add_function(wrap_pyfunction!(rust_sleep, module)?)?;

    Ok(())
}

#[pyfunction]
fn rust_sleep(py: Python) -> PyResult<Bound<PyAny>> {
    pyo3_async_runtimes::tokio::future_into_py(py, async {
        println!("RUST: Before sleep");
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        println!("RUST: After sleep");

        Ok(())
    })
}
```

## Step 3: HTTP with Hyper

[Pyper/commit/f4dacd9](https://github.com/matthewhaynesonline/Pyper/commit/f4dacd981ea5133fe4f3d13403289b208c4558d5)

Now we'll add our HTTP layer and we'll build on [Hyper](https://github.com/hyperium/hyper), a lower level Rust HTTP library. Using Hyper, as opposed to a higher level framework like Axum, gives us maximum flexibility to wire up the Python integration without fighting framework conventions.

The Rust server binds to a TCP socket, listens for incoming connections using a Tokio event loop and spawns a task per connection. A `router` function matches incoming requests by method and path, dispatching to handlers that return `Response<Bytes>`.

```rs
// ...
#[pyfunction]
fn server(py: Python) -> PyResult<Bound<PyAny>> {
    pyo3_async_runtimes::tokio::future_into_py(py, async {
        // ...
        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyIOError, _>(e.to_string()))?;

        info!("Listening on http://{}", addr);

        // Handle shutdowns
        loop {
            tokio::select! {
                accept_result = listener.accept() => {
                     match accept_result {
                        Ok((stream, _)) => {
                            let io = TokioIo::new(stream);

                            tokio::task::spawn(async move {
                                if let Err(err) = http1::Builder::new()
                                    .serve_connection(io, service_fn(router))
                                    .await
// ...

async fn router(req: Request<Incoming>) -> Result<Response<Full<Bytes>>, Infallible> {
    // ...
    let method = req.method().clone();
    let method_str = method.as_str();

    let uri = req.uri().clone();
    let request_path = uri.path();
    // ...
    async move {
       // ...
        let response = match (method_str, request_path) {
            ("GET", "/") => hello(req).await,
            (_, _) => not_found(req).await,
        };

// ...

async fn hello(_: Request<Incoming>) -> Result<Response<Full<Bytes>>, Infallible> {
    let body = "Hello, World!";
    do_response(body.to_string(), None)
}

// ...
fn do_response(
    body: String,
    status: Option<StatusCode>,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let response = Response::builder()
        .status(status.unwrap_or_default())
        .body(Full::new(Bytes::from(body)))
        .unwrap_or(get_fallback_response());

    Ok(response)
}
// ...
```

And then Python just fires up the server.

```py
# ...
async def main():
    print("Starting Rust server...\n")
    await pyper_rs.server()
# ...
```

At this stage, all the route handlers still live on the Rust side, which is pretty useless for a _Python_ framework, but hang in there.

## Step 4: Where's the Snake?

[Pyper/commit/1a399fc](https://github.com/matthewhaynesonline/Pyper/commit/1a399fc917c2e53fe1fe5da5f04c4b90fb287568)

Okay, now we're finally going to get something that looks like an actual framework. Rather than hardcoding routes in Rust, we expose an `add_route` function to Python. The Python code then defines routes using decorators, just like Flask or FastAPI:

```py
import uvloop
from pyper_rs import PyperRequest

from pyper_bindings import Pyper

app = Pyper()


@app.get("/")
async def index(request: PyperRequest) -> str:
    print(request.headers)
    print(request.body)
    print(request.body_string)

    return "PYTHON APP"
# ...

async def main() -> None:
    print("Starting Rust server...\n")
    await app.start(None, 3000)
```

Under the hood, each decorator invokes `server.add_route(method, path, handler)` on the Rust side, storing a mapping from `(HTTP method, path)` to a Python function (`Callable`).

```py
from typing import Callable

from pyper_rs import Server

# Define a type alias for the address
Address = tuple[int, int, int, int]


class Pyper:
    def __init__(self) -> None:
        self.server = Server()

    def add_route(self, method: str, route: str, handler: Callable) -> None:
        self.server.add_route(method, route, handler)

    async def start(self, address: Address | None, port: int) -> None:
        await self.server.start(address, port)

    def get(self, route: str) -> Callable:
        def inner(handler: Callable) -> Callable:
            self.add_route("GET", route, handler)
            return handler

        return inner
# ...
```

When a request arrives, Rust looks up the correct Python handler, builds a `PyperRequest` object (containing the method, path, headers, and body), passes it across the FFI boundary, awaits the Python response (coroutine), gets back a string response body, and wraps that into a full HTTP response.

```rs
// ...
impl Service<HandlerRequest> for RequestHandler {
    // ...
    let (request_parts, request_body_stream) = request.into_parts();
    let request_body_bytes = request_body_stream.collect().await?.to_bytes();

    // Acquire Read Lock (Non blocking for other readers)
    let py_handler = router
        .read()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get_route(&method, &path);

    let response = match py_handler {
        Some(handler) => {
            match Self::call_python_handler(
                handler,
                task_locals,
                request_parts,
                request_body_bytes,
            )
    // ...
```

```rs
// ...
impl RequestHandler {
   // ...
    async fn call_python_handler(
        handler: PyRouteHandler,
        task_locals: TaskLocals,
        request_parts: Parts,
        request_body: Bytes,
    ) -> PyResult<String> {
        pyo3_async_runtimes::tokio::scope(task_locals, async move {
            let future = Python::attach(|py| {
                let py_req = PyperRequest::from_parts(py, request_parts, request_body)?;
                let result = handler.call1(py, (py_req,))?;

                pyo3_async_runtimes::tokio::into_future(result.into_bound(py))
            })?;

            let result = future.await?;
            Python::attach(|py| result.extract::<String>(py))
        })
        .await
    }
// ...
```

The `PyperRequest` struct just carries request data from Rust to Python:

```rs
#[pyclass]
pub struct PyperRequest {
    #[pyo3(get)]
    pub method: String,
    #[pyo3(get)]
    pub uri: String,
    #[pyo3(get)]
    pub headers: Py<PyDict>,
    #[pyo3(get)]
    pub body: Py<PyBytes>,
}
```

A note on the Python locals capture (wtf is that): when the server starts, it captures Python's task local context. This is required so that later, when Rust calls back into Python to invoke a handler, it has the correct execution context. [pyo3_async_runtimes/#the-solution](https://docs.rs/pyo3-async-runtimes/latest/pyo3_async_runtimes/#the-solution)

## Step 5: Static Files

[Pyper/commit/212a136](https://github.com/matthewhaynesonline/Pyper/commit/212a13658ca39d59f662adfcacea437630dd4451)

Serving CSS, images, and other static assets requires a small addition on the Rust side. We'll use a `StaticFilesConfig` that holds the URL prefix (e.g. `/static`) and the filesystem directory to serve from. This will be passed in at runtime since we don't want our Rust library code hardcoding filesystem paths (that probably won't work on other systems, etc.).

The request handler checks whether the incoming path starts with the static prefix before routing to Python. If it does, Rust reads the file directly from disk using [`tokio::fs::read`](https://docs.rs/tokio/latest/tokio/fs/fn.read.html) and returns the bytes.

```rs
// ...
impl Service<HandlerRequest> for RequestHandler {
    // ...
    let response = if let Some(requested_static_filepath) = requested_static_filepath {
        match tokio::fs::read(requested_static_filepath).await {
            Ok(file_contents) => {
                Self::do_response_bytes(&file_contents, StatusCode::OK)
            }
            _ => Self::do_response("404: Not Found".to_string(), StatusCode::NOT_FOUND),
        }
    }
    // ...
```

Path sanitization is handled in Rust by [canonicalizing](https://doc.rust-lang.org/std/fs/fn.canonicalize.html) the path and verifying it still falls within the configured static directory (_note: this is fine for a proof of concept but probably not sufficient for securing production workloads_).

```rs
// ...
fn prep_static_response(&self, path: &str) -> Option<PathBuf> {
    // ...
    let requested_filename = path.strip_prefix(static_routes_prefix.as_str())?;
    let full_path = static_dir_path.join(requested_filename);

    match full_path.canonicalize() {
        Ok(canonical) => {
            if canonical.starts_with(static_dir_path) {
                Some(canonical)
            } else {
                error!("Path escapes static directory: {:?}", canonical);
                None
            }
        }
    // ...
```

From the Python side, we just pass in the config:

```py
static_routes_prefix = "/static/"
script_dir = Path(__file__).parent.resolve()
static_dir = script_dir / "static"

app = Pyper((static_routes_prefix, static_dir))
```

## Step 6: Templates with Handlebars

[Pyper/commit/206df5b](https://github.com/matthewhaynesonline/Pyper/commit/206df5b4b6c6bc2dba0c6e9104f2c56a4f71bc02)

For server side rendering, we'll use the [Handlebars](https://crates.io/crates/handlebars) crate. Why Handlebars and not something like [Askama](https://crates.io/crates/askama)? Well Askama uses strict type checking, and I figured the flexibility of Handlebars (as we're getting data from Python) would be easier to work with. Worse is better?

```rs
// ...
#[pyclass]
pub struct TemplateEngine {
    registry: RwLock<Handlebars<'static>>,
}

#[pymethods]
impl TemplateEngine {
    #[new]
    pub fn new() -> Self {
        Self {
            registry: RwLock::new(Handlebars::new()),
        }
    }

    pub fn register(&self, name: String, template: String) -> PyResult<()> {
        self.registry
            .write()
            .map_err(|_| PyRuntimeError::new_err("Template engine lock poisoned"))?
            .register_template_string(&name, &template)
            .map_err(|e| {
                PyErr::new::<PyValueError, _>(format!(
                    "Failed to register template '{}': {}",
                    name, e
                ))
            })
    }

    pub fn render(&self, name: &str, context: &Bound<'_, PyAny>) -> PyResult<String> {
        let json_context: Value = depythonize(context)?;

        self.registry
            .read()
            .map_err(|_| PyRuntimeError::new_err("Template engine lock poisoned"))?
            .render(name, &json_context)
            .map_err(|e| {
                PyErr::new::<PyValueError, _>(format!(
                    "Failed to render template '{}': {}",
                    name, e
                ))
            })
    }
}
// ...
```

Templates are registered once at startup (not on every request) and rendered in Rust using data passed from Python as a dict. The template engine is exposed through the bindings as a `TemplateEngine` class. A helper on the Python bindings side handles registration accepting either a file path or an inline template string, hashing it to generate a stable ID, and registering it with the Rust side Handlebars registry.

```py
def get(self, route: str, template: str | None = None) -> Callable:
    return self._register("GET", route, template)

# ...

def _register(
    self, method: str, route: str, template: str | None = None
) -> Callable:
    # ...
    def decorator(handler: Callable) -> Callable:
        if template:
            template_id = self._get_template_id(template)

            @functools.wraps(handler)
            async def wrapper(*args, **kwargs):
                result = await handler(*args, **kwargs)

                if not isinstance(result, dict):
                    raise TypeError(
                        f"{handler.__name__} with template must return dict, "
                        f"got {type(result).__name__}"
                    )

                return self.template_engine.render(template_id, result)

            self.server.add_route(method, route, wrapper)
        else:
            self.server.add_route(method, route, handler)

        return handler

    return decorator

def _get_template_id(self, template: str) -> str:
    # ...
    if template in self.templates_cache:
        return self.templates_cache[template]

    template_id = self._generate_template_id(template)

    # Template files
    if self.templates_dir:
        template_path = self.templates_dir / template

        if template_path.exists():
            with open(template_path) as f:
                content = f.read()

            self.template_engine.register(template_id, content)
            self.templates_cache[template] = template_id

            return template_id

    # Inline template
    self.template_engine.register(template_id, template)
    self.templates_cache[template] = template_id

    return template_id

@staticmethod
def _generate_template_id(template: str) -> str:
    return f"tpl_{hashlib.sha256(template.encode('utf-8')).hexdigest()}"
```

A simple index template:

```html
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Pyper 🐍 🦀</title>
    <link rel="stylesheet" href="/static/theme/pico.min.css" />
  </head>

  <body>
    {% raw %}
    <main class="container">{{body}}</main>
    {% endraw %}
  </body>
</html>
```

And the Python handler that renders it:

```py
@app.get("/", template="index.hbs")
async def index(request: PyperRequest) -> dict:
    print(request.headers)
    print(request.body)
    print(request.body_string)

    return {"body": "Hello World!"}
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

Python stays clean and simple. Rust handles the all the hard stuff. Neither side needs to know much about the other and you've successfully smuggled Rust into a Python project. Praise 🦀

## Benchmarks: Does It Actually Work?

[Pyper/commit/cd6c6b2](https://github.com/matthewhaynesonline/Pyper/commit/cd6c6b282780aa5d96606ea62be1286ce5c9b345)

Let's find out if all that effort was even worth it. I should mention that benchmarks, especially the simple ones for this project, never really tell the full story. However, I do think these benchmarks are useful as a rough gauge.

<img class="img-fluid rounded" src='{{"/assets/images/pyper/charts-only-py.png"  | relative_url }}'  alt="Benchmark">

**You love to see it.** We smashed the throughput and slashed the memory usage. Okay, that's all Folks!

Huh? What about Go and pure Rust?

Well...

<img class="img-fluid rounded" src='{{"/assets/images/pyper/charts-full.png"  | relative_url }}'  alt="Benchmark">

Pesky y axis scaling strikes again...

So we benchmarked against Axum (pure Rust), Go (net/http), FastAPI, and Flask using wrk with 1,000 concurrent connections over 10 seconds. Two scenarios were tested:

1.  An I/O bound test with an artificial delay (simulating database / API calls)
2.  A CPU bound test with no delay (raw throughput).

Also, thread counts were normalized; each framework was given 5 OS threads:

1. Rust: `TOKIO_WORKER_THREADS=4` (4 Tokio workers + 1 main thread)
2. Go: `GOMAXPROCS=2` (which gave 5 total)
3. FastAPI: defaults to 5
4. Flask: was tested in both single threaded and multi threaded modes
   1. **Note: for Flask, the threads weren't capped to give it a fighting chance and see how sync mulithreaded code would behave**

#### I/O Bound Results

<div class="table-responsive mb-4">
   <table class="table table-striped align-middle">
     <thead>
       <tr>
         <th scope="col">Framework</th>
         <th scope="col">Requests/sec</th>
         <th scope="col">Peak Memory</th>
         <th scope="col">Threads</th>
       </tr>
     </thead>
     <tbody>
       <tr>
         <td>Axum</td>
         <td>~244</td>
         <td>10 MB</td>
         <td>5</td>
       </tr>
       <tr>
         <td>Go</td>
         <td>~244</td>
         <td>21 MB</td>
         <td>5</td>
       </tr>
       <tr class="fw-bold">
         <td>Pyper (hybrid)</td>
         <td>~244</td>
         <td>36 MB</td>
         <td>5</td>
       </tr>
       <tr>
         <td>FastAPI</td>
         <td>~237</td>
         <td>60 MB</td>
         <td>5</td>
       </tr>
       <tr>
         <td>Flask (threaded)</td>
         <td>~221</td>
         <td>58 MB</td>
         <td>248</td>
       </tr>
       <tr>
         <td>Flask (single)</td>
         <td>~1</td>
         <td>39 MB</td>
         <td>1</td>
       </tr>
     </tbody>
   </table>
   </div>

For the I/O results: **Rust, Go, and the Pyper hybrid are essentially identical**. Even FastAPI is only about 3% slower.

**The lesson here is that for I/O bound workloads, architecture (async vs. sync) matters far more than language choice.**

#### CPU Bound Results

<div class="table-responsive mb-4">
   <table class="table table-striped align-middle">
     <thead>
       <tr>
         <th scope="col">Framework</th>
         <th scope="col">Requests/sec</th>
         <th scope="col">Peak Memory</th>
         <th scope="col">Threads</th>
       </tr>
     </thead>
     <tbody>
       <tr>
         <td>Axum</td>
         <td>~202,000</td>
         <td>13 MB</td>
         <td>5</td>
       </tr>
       <tr>
         <td>Go</td>
         <td>~107,000</td>
         <td>20 MB</td>
         <td>5</td>
       </tr>
       <tr class="fw-bold">
         <td>Pyper (hybrid)</td>
         <td>~39,000</td>
         <td>38 MB</td>
         <td>5</td>
       </tr>
       <tr>
         <td>FastAPI</td>
         <td>~22,000</td>
         <td>58 MB</td>
         <td>5</td>
       </tr>
       <tr>
         <td>Flask (threaded)</td>
         <td>~1,600</td>
         <td>45 MB</td>
         <td>47</td>
       </tr>
       <tr>
         <td>Flask (single)</td>
         <td>~1,600</td>
         <td>43 MB</td>
         <td>1</td>
       </tr>
     </tbody>
   </table>
   </div>

Here the picture is different. Pure Rust is around 5x faster than the hybrid. But the hybrid is still **~75% faster than FastAPI** (not bad, eh?).

I imagine we're constrained by the overhead of crossing the Rust / Python boundary on every request, plus the obligatory blame the Python GIL.

### The Efficiency Angle

The most underrated column in the benchmark is memory. With 1 GB of RAM:

- You can run ~17 FastAPI instances
- You can run ~27 Pyper hybrid instances
- You can run ~99 Axum instances

At scale, this translates directly to infra costs and could be the difference between your AWS account rep getting a Honda or a Mercedes with their year end bonus.

## Verdict: is Rust + Python Worth It?

**For I/O bound workloads** (most web apps), the answer is... it doesn't really matter much. Async Python with FastAPI or any proper async framework gets you nearly all of the performance of pure Rust, with far less complexity.

**For CPU bound workloads**, the hybrid is pretty compelling. You're 75% faster than FastAPI and using significantly less memory, while still writing Python flavored app code.

The real trade off is engineering complexity. You're maintaining a codebase with two languages, managing FFI boundaries, and navigating dual event loops and that's not free. But for teams that need Python's ecosystem and developer ergonomics _and_ need to squeeze performance out of hot paths, it's a real option.

Okay, that's all Folks!

_Remember: the proper version of this idea is [Robyn](https://github.com/sparckles/Robyn) and it's worth checking out if this approach interests you. This experiment was just a proof of concept that shows you how it works starting from the basics._

{% include blog_links.html %}
