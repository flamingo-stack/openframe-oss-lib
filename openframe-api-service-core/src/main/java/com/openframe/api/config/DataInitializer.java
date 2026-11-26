package com.openframe.api.config;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.PLATFORM_OAUTH_CLIENT_REGISTER;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final Environment env;

    @Bean
    CommandLineRunner initOAuthClients(OAuthClientRepository clientRepository, AuditedMethodRunner auditedMethodRunner) {
        return _ -> {
            String clientId = env.getProperty("oauth.client.default.id");
            String clientSecret = env.getProperty("oauth.client.default.secret");

            log.info("Initializing OAuth client - ID: {}", clientId);
            log.debug("Client secret length: {}", clientSecret != null ? clientSecret.length() : 0);

            clientRepository.findByClientId(clientId).ifPresentOrElse(
                    client -> updateDefaultClientSecret(client, clientSecret, clientRepository, auditedMethodRunner),
                    () -> createDefaultClient(clientId, clientSecret, clientRepository, auditedMethodRunner));
        };
    }

    private static void updateDefaultClientSecret(OAuthClient client, String clientSecret,
                                                  OAuthClientRepository clientRepository,
                                                  AuditedMethodRunner auditedMethodRunner) {
        String clientId = client.getClientId();
        if (client.getClientSecret().equals(clientSecret)) {
            log.info("OAuth client already exists with correct configuration: {}", clientId);
            return;
        }
        Map<String, Object> details = Map.of("clientId", clientId);
        auditedMethodRunner.run(PLATFORM_OAUTH_CLIENT_REGISTER, client.getId(), details, () -> {
            client.setClientSecret(clientSecret);
            clientRepository.save(client);
        });
        log.info("Updated OAuth client secret: {}", clientId);
    }

    private static void createDefaultClient(String clientId, String clientSecret,
                                            OAuthClientRepository clientRepository,
                                            AuditedMethodRunner auditedMethodRunner) {
        OAuthClient client = new OAuthClient();
        client.setClientId(clientId);
        client.setClientSecret(clientSecret);
        client.setGrantTypes(new String[]{"password", "refresh_token"});
        client.setScopes(new String[]{"read", "write"});
        Map<String, Object> details = Map.of("clientId", clientId,
                "grantTypes", List.of(client.getGrantTypes()), "scopes", List.of(client.getScopes()));
        AuditCall auditCall = AuditCall.of(PLATFORM_OAUTH_CLIENT_REGISTER, null, details)
                .withCompare(false)
                .withTargetIdInResult(true)
                .withTargetIdFromResult(saved -> ((OAuthClient) saved).getId());
        auditedMethodRunner.run(auditCall, () -> clientRepository.save(client));
        log.info("Created OAuth client: {}", clientId);
    }
}
