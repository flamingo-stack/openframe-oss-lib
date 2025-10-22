package com.openframe.authz.service.auth;

import com.openframe.authz.service.auth.strategy.ClientRegistrationStrategy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DynamicClientRegistrationService {

    private final List<ClientRegistrationStrategy> strategies;

    public ClientRegistration loadClient(String providerId, String tenantId) {
        ClientRegistrationStrategy strategy = strategies.stream().filter(it -> providerId.equals(it.providerId())).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported SSO provider: " + providerId));

        return strategy.buildClient(tenantId);
    }
}

