# ReactiveTenantRepository Documentation

## Overview
The `ReactiveTenantRepository` interface provides reactive access to tenant data, allowing for asynchronous operations on tenant entities.

## Core Components
### Methods
- **findByDomain(String domain)**
  - **Returns**: `Mono<Tenant>` - A reactive stream that emits the tenant associated with the given domain.
- **existsByDomain(String domain)**
  - **Returns**: `Mono<Boolean>` - A reactive stream that indicates whether a tenant exists for the given domain.