# Reactive API Key Repository Documentation

## Overview
The `ReactiveApiKeyRepository` interface provides methods for managing API keys in a reactive manner, allowing for efficient data handling in a non-blocking way.

## Core Components
- **Find by ID and User ID**: Retrieves an API key based on its ID and the associated user ID.
- **Find by User ID**: Retrieves all API keys associated with a specific user ID.
- **Find Expired Keys**: Retrieves all expired API keys based on the current time.

## Example Usage
```java
Mono<ApiKey> apiKey = reactiveApiKeyRepository.findByIdAndUserId("keyId", "userId");
```