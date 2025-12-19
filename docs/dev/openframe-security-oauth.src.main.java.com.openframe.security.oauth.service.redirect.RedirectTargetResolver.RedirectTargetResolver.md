# RedirectTargetResolver Documentation

## Overview
The `RedirectTargetResolver` interface is responsible for resolving redirect targets in OAuth services.

## Core Responsibilities
- **Resolve Redirect Targets**: Provides a method to resolve the redirect target based on tenant ID and requested URL.

## Methods
### `Mono<String> resolve(String tenantId, String requestedRedirectTo, ServerHttpRequest request)`
- **Parameters**:
  - `tenantId`: The ID of the tenant for which the redirect is being resolved.
  - `requestedRedirectTo`: The requested redirect URL.
  - `request`: The original HTTP request.
- **Returns**: A `Mono` containing the resolved redirect URL.