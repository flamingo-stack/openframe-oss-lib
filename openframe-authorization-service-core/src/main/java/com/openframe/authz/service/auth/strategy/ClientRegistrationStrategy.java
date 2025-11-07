package com.openframe.authz.service.auth.strategy;

import org.springframework.security.oauth2.client.registration.ClientRegistration;

public interface ClientRegistrationStrategy {

    String providerId();

    ClientRegistration buildClient(String tenantId);
}


