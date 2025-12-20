# ReactiveApiKeyRepository Documentation

## Overview
The `ReactiveApiKeyRepository` provides reactive access to API keys stored in MongoDB. It extends the `ReactiveMongoRepository` interface.

## Core Responsibilities
- **API Key Management**: Methods for finding API keys by user ID and checking for expired keys.

## Code Example
```java
@Query("{ '_id': ?0, 'userId': ?1 }")
Mono<ApiKey> findByIdAndUserId(String keyId, String userId);
```