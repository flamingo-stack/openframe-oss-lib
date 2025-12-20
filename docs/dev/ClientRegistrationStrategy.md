# ClientRegistrationStrategy Documentation

## Overview
The `ClientRegistrationStrategy` interface defines the strategy for client registration, allowing for different implementations based on the provider.

## Core Components
### Methods
- **providerId()**
  - **Returns**: `String` - The unique identifier for the provider.
- **buildClient(String tenantId)**
  - **Returns**: `ClientRegistration` - Builds a client registration for the specified tenant.