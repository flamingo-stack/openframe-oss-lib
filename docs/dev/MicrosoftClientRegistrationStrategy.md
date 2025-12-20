# Microsoft Client Registration Strategy Documentation

## Overview
The `MicrosoftClientRegistrationStrategy` class is responsible for managing the registration of Microsoft clients for authentication purposes.

## Core Components
- **Microsoft SSO Properties**: Configuration properties specific to Microsoft Single Sign-On.

## Example Usage
```java
MicrosoftClientRegistrationStrategy strategy = new MicrosoftClientRegistrationStrategy(ssoConfigService, microsoftProps);
String providerId = strategy.providerId();
```