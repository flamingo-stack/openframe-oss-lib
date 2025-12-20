# ReactiveTenantRepository Documentation

## Overview
The `ReactiveTenantRepository` interface extends the `ReactiveMongoRepository` and provides methods to interact with tenant data in a reactive manner. It is designed to work with the Spring framework's reactive programming model.

## Core Methods
- **findByDomain(String domain)**: Retrieves a tenant by its domain.
- **existsByDomain(String domain)**: Checks if a tenant exists by its domain.

## Example Usage
```java
Mono<Tenant> tenantMono = reactiveTenantRepository.findByDomain("example.com");
```