# Reactive User Repository Documentation

## Overview
The `ReactiveUserRepository` interface extends `ReactiveMongoRepository` to provide reactive access to user data stored in MongoDB.

## Core Methods
- **findByEmail(String email)**: Retrieves a user by their email address.
- **existsByEmail(String email)**: Checks if a user exists by their email address.
- **existsByEmailAndStatus(String email, UserStatus status)**: Checks if a user exists by their email and status.

## Example
```java
Mono<User> user = reactiveUserRepository.findByEmail("user@example.com");
```