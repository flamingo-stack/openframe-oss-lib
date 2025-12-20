# GoogleClientRegistrationStrategy

## Overview
The `GoogleClientRegistrationStrategy` class implements the OIDC client registration strategy specifically for Google. It extends the `BaseOidcClientRegistrationStrategy` and provides the necessary properties and configurations required for Google SSO integration.

## Key Responsibilities
- **Provider ID**: Returns the provider ID for Google.
- **Properties**: Provides the Google SSO properties required for the OIDC configuration.

## Code Snippet
```java
@Override
public String providerId() {
    return GOOGLE;
}

@Override
protected AbstractOidcProviderProperties props() {
    return googleProps;
}
```

## Dependencies
- `SSOConfigService`: Service for managing SSO configurations.
- `GoogleSSOProperties`: Contains properties specific to Google SSO.