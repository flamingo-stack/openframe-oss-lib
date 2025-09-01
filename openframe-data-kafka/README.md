# openframe-kafka

Kafka abstractions and Spring Boot auto-configuration for the OpenFrame platform, extracted for reuse.

Contents:

- `config/` Spring Boot auto-configuration for Kafka (producers, consumers, template)
- `producer/` Generic producer wrapper for sending messages
- `model/` Shared message payloads used by OpenFrame

Scope:

- Auto-configuration and thin wrappers only, no environment-specific logic
- Designed to be imported as a library and enabled via Spring Boot

Publishing:

- Configured to publish to GitHub Packages via Actions on tag `v*.*.*`

