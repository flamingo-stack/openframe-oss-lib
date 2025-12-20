# DefaultRedirectTargetResolver Documentation

## Overview
The `DefaultRedirectTargetResolver` class is the default implementation of the `RedirectTargetResolver` interface.

### Core Components
- **resolve**: Implements the method to determine the redirect target based on the requested URL and referer header.

### Example Usage
```java
DefaultRedirectTargetResolver resolver = new DefaultRedirectTargetResolver();
resolver.resolve(tenantId, requestedRedirectTo, request);
```