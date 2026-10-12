# NATS integration tests

Tests that run real client code against a real NATS server on your machine —
subjects, JSON payloads, JetStream publishes and acks all go over the wire.
No mocks of NATS.

## How it works

```
test
 ├─ NatsServer::start()          spawns `nats-server -a 127.0.0.1 -p <free port> -js -sd <tmp dir>`
 │                               waits until the port accepts connections, kills it on drop
 ├─ builds the agent side        real services on a temp DirectoryManager,
 │                               NatsConnectionManager given a plain nats:// client
 ├─ "tester" async-nats client   plays the backend: publishes commands, subscribes to results
 └─ asserts on what comes back   ACKED / DONE / FAILED, files on disk, signals
```

- Every test starts its **own** server on a free port with its own temp storage,
  so tests run in parallel and leave nothing behind.
- JetStream is on (`-js`), so code that publishes to a stream (`publish_acked`)
  works. The test creates the streams it needs.
- The agent connects without TLS and without a token: the test hands
  `NatsConnectionManager` a ready client instead of calling `connect()`.

### Pieces

| What | Where | Use |
|---|---|---|
| `NatsServer` | `src/test_support.rs` (`cfg(test)`) | `NatsServer::start() -> Option<NatsServer>`, `.url()` |
| `use_client_for_tests` | `src/services/nats_connection_manager.rs` (`cfg(test)`) | puts a connected `async_nats::Client` into the manager |
| Example suite | `src/listener/command/integration_tests.rs` | the feature-flags listener end to end |

## Running

Install the server once (single ~1 MB binary):

```bash
brew install nats-server
```

On Windows or Linux, download a release from
<https://github.com/nats-io/nats-server/releases> and put it on `PATH`.

Then the usual:

```bash
make test
```

runs them together with the unit tests.

Only the integration suite, failing if the server is missing:

```bash
REQUIRE_NATS_SERVER=1 OPENFRAME_VERSION=0.0.0-dev cargo test --lib -- integration_tests
```

| Variable | Effect |
|---|---|
| *(none)* | no `nats-server` on `PATH` → each test returns early and **passes without running** |
| `REQUIRE_NATS_SERVER=1` | a missing binary is a test failure — use in CI so the suite can't silently skip |
| `NATS_SERVER_BIN=/path/to/nats-server` | use a binary that isn't on `PATH` |

A skipped test prints ``skipping: `nats-server` is not installed (brew install nats-server)`` to stderr
(visible with `-- --nocapture`).

### CI

CI does not install `nats-server` yet, so there the suite skips and nothing
fails. To make it run: add an install step before `make test` in the Rust job
(`brew install nats-server` on macOS, a release download or `choco install nats-server`
on Windows) and set `REQUIRE_NATS_SERVER: "1"` on that step.

## Writing a test

### 1. Start a server and skip if there is none

```rust
use crate::test_support::NatsServer;

#[tokio::test]
async fn my_command_is_acked_and_done() {
    let Some(server) = NatsServer::start() else {
        return;
    };
    // ...
}
```

Always use the `let … else { return }` form: that is what makes the test skip
on machines without the binary.

### 2. Build the agent side with real services

Everything is built on a temp directory, the same way `Client::new` does it:

```rust
let dir = tempfile::tempdir().unwrap();
let directories = DirectoryManager::with_custom_dirs(
    dir.path().join("logs"),
    dir.path().join("app"),
    dir.path().join("secured"),
);
let config = AgentConfigurationService::new(directories.clone()).unwrap();
config
    .save_registration_data("it-machine".into(), "client".into(), "secret".into())
    .await
    .unwrap();

let manager = NatsConnectionManager::new(/* config, initial config, auth, tls, ... */);
manager.use_client_for_tests(async_nats::connect(server.url()).await.unwrap());
```

The machine id saved in the config is what listeners put into their subjects
(`machine.<id>.…`). See `Agent::start()` in `listener/command/integration_tests.rs`
for the full list of services and copy it.

### 3. Create the streams your code publishes to

`nats-server` starts empty. If the code under test publishes with an ack, create
the stream first, or the publish fails with "no responders":

```rust
let tester = async_nats::connect(server.url()).await.unwrap();
async_nats::jetstream::new(tester.clone())
    .create_stream(async_nats::jetstream::stream::Config {
        name: "DELIVERY_RESULT".into(),
        subjects: vec!["machine.*.delivery.result".into()],
        ..Default::default()
    })
    .await
    .unwrap();
```

### 4. Subscribe to what you assert on before sending

```rust
let mut results = tester
    .subscribe("machine.it-machine.delivery.result")
    .await
    .unwrap();
tester.flush().await.unwrap();
```

Core NATS has no backlog: anything published before the subscription exists is
lost. The same applies to the agent's listener — see the next step.

### 5. Wait until the listener is subscribed

A listener subscribes asynchronously after `start()`. Don't `sleep`; send a probe
command and repeat until it is answered:

```rust
timeout(BOUND, async {
    loop {
        send(probe()).await;
        if timeout(Duration::from_millis(200), next_result("probe")).await.is_ok() {
            return;
        }
    }
})
.await
.expect("listener never answered");
```

Pick a probe that has no side effects (the flags suite uses a stale `sequence`).
Later assertions must ignore extra probe answers — filter results by `dispatchId`.

### 6. Assert with bounded waits

- **Something must happen:** wait for it with `timeout(BOUND, …)` (10 s in the
  example suite) and fail with a message that says what was expected.
- **Something must not happen:** there is no event to wait for, so wait a short
  fixed window (`QUIET`, 500 ms) and assert nothing arrived. Keep these few.
- **Results arrive out of order or interleaved:** don't drop messages you don't
  want yet — buffer them (`Agent::next_result` keeps an `unclaimed` list).
  Dropping them is the classic flaky-test bug: a later `expect` waits for a
  message the helper already threw away.

### 7. Assert on real side effects

Read the files the code wrote (`feature_flags.json`), wait on the signals it
raises (`CommandContext::restart_requested()`), check what reached the "backend"
subscription. Prefer these over inspecting internal state.

## Reusing the example harness

`listener/command/integration_tests.rs` wraps all of the above in a small
`Agent` struct:

| Helper | Does |
|---|---|
| `Agent::start()` | server + agent + streams + result subscription + listener up, or `None` to skip |
| `agent.launch()` | starts another listener on the same agent state — "the next process" after a restart |
| `agent.send(payload)` | publishes a command to the listener's subject |
| `agent.expect(dispatch_id, result)` | waits for `ACKED` / `DONE` / `FAILED` for that dispatch |
| `agent.expect_silence(dispatch_id)` | asserts nothing arrives for that dispatch within `QUIET` |
| `agent.persisted()` | reads the state file the listener wrote |
| `command(dispatch_id, sequence, body)` | builds a payload with a `delivery` block |

For a new delivery command, copy the struct, swap the handler in `launch()`
and the subject in `send()`, and keep the helpers.

## Limits

- What the server enforces in production but the local server doesn't: auth,
  TLS, and the per-user subject permissions. A `Permissions Violation` on a real
  environment is not caught here — check the NATS config when you add a subject.
- Process-level effects (the service manager restarting the client, `exit`) are
  out of reach; tests stop at the signal the code raises.
- Each test starts its own server; the 7 tests of the example suite take about a second in total. Fine for dozens of tests, not thousands.
