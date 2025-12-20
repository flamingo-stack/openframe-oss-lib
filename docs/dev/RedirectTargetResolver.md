# RedirectTargetResolver Documentation

## Overview
The `RedirectTargetResolver` interface defines a method for resolving redirect targets based on tenant ID and requested URL. It is part of the security OAuth service.

## Method
- `resolve(String tenantId, String requestedRedirectTo, ServerHttpRequest request)`: Resolves the redirect target for a given tenant and requested URL.