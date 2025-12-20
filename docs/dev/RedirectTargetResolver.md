# RedirectTargetResolver Documentation

## Overview
The `RedirectTargetResolver` interface defines a method for resolving redirect targets based on tenant ID and requested URL.

### Core Components
- **resolve**: Method that takes tenant ID, requested redirect URL, and the HTTP request to determine the final redirect target.

### Example Usage
```java
public class MyRedirectResolver implements RedirectTargetResolver {
    @Override
    public Mono<String> resolve(String tenantId, String requestedRedirectTo, ServerHttpRequest request) {
        // Custom logic here
    }
}
```