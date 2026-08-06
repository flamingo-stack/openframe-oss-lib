# Shared Logback Configurations

Logback configurations served by the config server (`openframe-saas-config` /
`openframe-config-server`) and loaded by every OpenFrame service at startup via the
`logging.config` property, e.g.:

```yaml
logging:
  config: ${SPRING_CONFIG_URL:http://openframe-saas-config:8888}/logging/shared-logback-spring-logfmt-shortened.xml
```

## Variants

| Entry point | Format | Stack traces |
|---|---|---|
| `shared-logback-spring.xml` | classic pattern | full |
| `shared-logback-spring-logfmt.xml` | logfmt (`ts= level= service= msg=`) | full |
| `shared-logback-spring-logfmt-shortened.xml` | logfmt | shortened, single-line (`%exShort`) |

Each `shared-logback-spring*.xml` is a thin wrapper that resolves Spring properties and
includes the matching `shared-logback-includes*.xml` with the actual appenders.

## Logging is stdout-only — deployments must handle collection and retention

All variants log **exclusively to the console (stdout)**. File appenders were removed
deliberately: log files inside containers were an unread duplicate of stdout and are not
part of any pipeline.

This library does **not** ship a log collector. Every deployment is responsible for
guaranteeing stdout forwarding and retention itself, otherwise logs only live in the
container runtime's rotated files (`/var/log/pods/...`) and are lost on pod deletion.

The reference OpenFrame setup does this with a Grafana Alloy DaemonSet that tails
`/var/log/pods/<pod-uid>/<container>/*.log` for pods annotated
`loki.grafana.com/scrape: "true"` and pushes to Loki, where retention is configured.
Any equivalent stack (Promtail, Fluent Bit, Vector, a cloud provider's log agent, ...)
works the same way — the contract is only: *collect stdout, own the retention*.

The logfmt variants keep every event on a single line (exception stacks are flattened
with `|` separators) precisely so line-based collectors ingest one event per line.
