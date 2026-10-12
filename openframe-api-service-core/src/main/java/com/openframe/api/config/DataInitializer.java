package com.openframe.api.config;

import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final Environment env;

    @Bean
    CommandLineRunner initOAuthClients(OAuthClientRepository clientRepository) {
        return args -> {
            String clientId = env.getProperty("oauth.client.default.id");
            String clientSecret = env.getProperty("oauth.client.default.secret");

            if (!StringUtils.hasText(clientId)) {
                throw new IllegalStateException("Required property 'oauth.client.default.id' is missing or empty");
            }
            if (!StringUtils.hasText(clientSecret)) {
                throw new IllegalStateException("Required property 'oauth.client.default.secret' is missing or empty");
            }

            log.info("Initializing OAuth client - ID: {}", clientId);

            clientRepository.findByClientId(clientId)
                    .ifPresentOrElse(
                            existingClient -> {
                                if (!existingClient.getClientSecret().equals(clientSecret)) {
                                    existingClient.setClientSecret(clientSecret);
                                    clientRepository.save(existingClient);
                                    log.info("Updated OAuth client secret: {}", clientId);
                                } else {
                                    log.info("OAuth client already exists with correct configuration: {}", clientId);
                                }
                            },
                            () -> {
                                OAuthClient client = new OAuthClient();
                                client.setClientId(clientId);
                                client.setClientSecret(clientSecret);
                                client.setGrantTypes(new String[]{"password", "refresh_token"});
                                client.setScopes(new String[]{"read", "write"});
                                clientRepository.save(client);
                                log.info("Created OAuth client: {}", clientId);
                            }
                    );
        };
    }
} 
