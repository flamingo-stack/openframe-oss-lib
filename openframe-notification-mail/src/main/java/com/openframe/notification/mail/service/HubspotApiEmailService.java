package com.openframe.notification.mail.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "openframe.mail", name = "provider", havingValue = "hubspot-api")
public class HubspotApiEmailService implements EmailService {

    private WebClient webClient;

    @Value("${openframe.mail.from}")
    private String from;

    @Value("${openframe.invitations.link-template}")
    private String linkTemplate;

    @Value("${openframe.mail.hubspot.access-token}")
    private String accessToken;

    @Value("${openframe.mail.hubspot.invitation-email-id}")
    private String invitationEmailId;

    @Value("${openframe.mail.hubspot.base-url}")
    private String baseUrl;

    @PostConstruct
    void init() {
        this.webClient = WebClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public void sendInvitationEmail(String toEmail, String invitationId) {
        String link = linkTemplate.replace("{id}", invitationId);

        Map<String, Object> payload = Map.of(
                "emailId", invitationEmailId,
                "message", Map.of(
                        "to", toEmail,
                        "from", from,
                        "subject", "You’re invited to join Flamingo Workspace"
                ),
                "customProperties", Map.of("link", link)
        );

        if (log.isDebugEnabled()) {
            log.debug("[HubSpot API] Payload: {}", payload);
        }

        webClient.post()
                .uri(uriBuilder -> uriBuilder.path("/marketing/v4/email/single-send").build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .exchangeToMono(response -> {
                    if (response.statusCode().is2xxSuccessful()) {
                        log.info("[HubSpot API] Invitation email sent to {}", toEmail);
                        return response.releaseBody();
                    }
                    return response.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .flatMap(body -> Mono.error(new IllegalStateException(
                                    "HubSpot API error: status=" + response.statusCode() + " body=" + body
                            )));
                })
                .block();
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        // Optional: configure another template id for reset if needed
        log.info("[HubSpot API] sendPasswordResetEmail not implemented");
    }
}


