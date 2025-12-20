# ClientRegistrationStrategy Documentation

## Overview
The `ClientRegistrationStrategy` interface defines the contract for client registration strategies. Implementations of this interface can provide different strategies based on the provider ID.

## Core Responsibilities
- **Provider ID**: Method to retrieve the provider ID for the registration strategy.
- **Build Client**: Method to build a `ClientRegistration` object based on the tenant ID.

## Code Snippet
```java
public interface ClientRegistrationStrategy {
    String providerId();
    ClientRegistration buildClient(String tenantId);
}
```