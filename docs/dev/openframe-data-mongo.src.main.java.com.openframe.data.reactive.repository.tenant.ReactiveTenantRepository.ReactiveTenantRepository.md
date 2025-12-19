# ReactiveTenantRepository Documentation

## Overview
The `ReactiveTenantRepository` interface is a reactive repository for managing tenant data in a MongoDB database.

## Core Responsibilities
- **Find Tenant by Domain**: Provides a method to find a tenant based on its domain.
- **Check Tenant Existence**: Provides a method to check if a tenant exists based on its domain.

## Methods
### `Mono<Tenant> findByDomain(String domain)`
- **Parameters**:
  - `domain`: The domain of the tenant to be found.
- **Returns**: A `Mono` containing the found tenant or empty if not found.

### `Mono<Boolean> existsByDomain(String domain)`
- **Parameters**:
  - `domain`: The domain of the tenant to check.
- **Returns**: A `Mono` containing `true` if the tenant exists, `false` otherwise.