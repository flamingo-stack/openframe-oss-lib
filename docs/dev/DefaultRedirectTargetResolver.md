# DefaultRedirectTargetResolver Documentation

## Overview
The `DefaultRedirectTargetResolver` class resolves redirect targets for OAuth flows, determining where to redirect users after authentication.

## Key Methods
- **resolve(String tenantId, String requestedRedirectTo, ServerHttpRequest request)**: Determines the redirect target based on the request and provided parameters.