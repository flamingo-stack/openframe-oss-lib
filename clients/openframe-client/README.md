# openframe-agent-lib

The cross-platform OpenFrame agent, packaged as a Rust library (crate/lib name
`openframe`). It registers the device, connects to NATS, installs and manages
integrated tools (MeshCentral, Tactical RMM, Fleet MDM, osquery), streams logs,
and self-updates.

Tenant repos depend on this crate and ship a thin binary that calls
`openframe::run()`. An optional binary target is also available here behind the
`bin` cargo feature for local development.

See [`../README.md`](../README.md) for the developer workflow (hooks, build,
lint) and the dependency snippet used by tenant repos.
