package com.openframe.notification.mail.service;

import com.openframe.notification.mail.config.HubspotVerificationMailProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

/** Sends transactional mail through HubSpot and bounds how long verification delivery can wait. */
@Service
@RequiredArgsConstructor
@Slf4j
@EnableConfigurationProperties(HubspotVerificationMailProperties.class)
@ConditionalOnProperty(prefix = "openframe.mail", name = "provider", havingValue = "hubspot-api")
public class HubspotApiEmailService implements EmailService {

    private static final String LINK_PROPERTY = "link";

    private final HubspotVerificationMailProperties verificationProperties;
    private WebClient webClient;

    @Value("${openframe.mail.from}")
    private String from;

    @Value("${openframe.invitations.link-template:}")
    private String linkTemplate;

    @Value("${openframe.password-reset.link-template:}")
    private String resetLinkTemplate;

    @Value("${openframe.email-verify.link-template:}")
    private String verifyLinkTemplate;

    @Value("${openframe.mail.hubspot.access-token}")
    private String accessToken;

    @Value("${openframe.mail.hubspot.invitation-email-id:}")
    private String invitationEmailId;

    @Value("${openframe.mail.hubspot.reset-email-id:}")
    private String resetEmailId;

    @Value("${openframe.mail.hubspot.verify-email-id:}")
    private String verifyEmailId;

    @Value("${openframe.mail.hubspot.owner-transfer-email-id:}")
    private String ownerTransferEmailId;

    @Value("${openframe.mail.hubspot.delete-account-email-id:}")
    private String deleteAccountEmailId;

    @Value("${openframe.mail.hubspot.download-link-email-id:}")
    private String downloadLinkEmailId;

    @Value("${openframe.mail.hubspot.base-url}")
    private String baseUrl;

    @PostConstruct
    void init() {
        this.webClient = WebClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public void sendInvitationEmail(String toEmail, String invitationId) {
        String link = linkTemplate.replace("{id}", invitationId);
        sendWithTemplate(invitationEmailId, toEmail, "You’re invited to join Flamingo Workspace", link, "Invitation");
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        String link = resetLinkTemplate.replace("{token}", resetToken);
        sendWithTemplate(resetEmailId, toEmail, "Reset your OpenFrame password", link, "Password reset");
    }

    @Override
    public void sendEmailVerificationEmail(String toEmail, String verifyToken) {
        String link = verifyLinkTemplate.replace("{token}", verifyToken);
        sendRequest(verifyEmailId, toEmail, "Verify your email and continue", Map.of(LINK_PROPERTY, link), "Email verification")
                .block(verificationProperties.verificationSendTimeout());
    }

    @Override
    public void sendOwnershipTransferEmail(String toEmail) {
        send(ownerTransferEmailId, toEmail, "You're now the owner", Map.of(), "Ownership transfer");
    }

    @Override
    public void sendAccountDeletedEmail(String toEmail) {
        send(deleteAccountEmailId, toEmail, "Your account has been deleted", Map.of(), "Account deletion");
    }

    @Override
    public void sendDownloadLinkEmail(String toEmail, String downloadId) {
        send(downloadLinkEmailId, toEmail, "Your OpenFrame download link", Map.of("download_id", downloadId), "Download link");
    }

    @Override
    public void send(String templateId, String toEmail, String subject, Map<String, Object> properties) {
        send(templateId, toEmail, subject, properties, "Templated (" + templateId + ")");
    }

    private void sendWithTemplate(String emailTemplateId, String toEmail, String subject, String link, String debugContext) {
        send(emailTemplateId, toEmail, subject, Map.of(LINK_PROPERTY, link), debugContext);
    }

    private void send(String emailTemplateId, String toEmail, String subject, Map<String, Object> customProperties, String debugContext) {
        sendRequest(emailTemplateId, toEmail, subject, customProperties, debugContext).block();
    }

    private Mono<Void> sendRequest(String emailTemplateId, String toEmail, String subject,
                                   Map<String, Object> customProperties, String debugContext) {
        Map<String, Object> payload = Map.of(
                "emailId", emailTemplateId,
                "message", Map.of(
                        "to", toEmail,
                        "from", from,
                        "subject", subject
                ),
                "customProperties", customProperties
        );

        if (log.isDebugEnabled()) {
            log.debug("[HubSpot API] {} Payload: {}", debugContext, payload);
        }

        return webClient.post()
                .uri(uriBuilder -> uriBuilder.path("/marketing/v4/email/single-send").build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .exchangeToMono(response -> {
                    if (response.statusCode().is2xxSuccessful()) {
                        log.info("[HubSpot API] {} email sent to {}", debugContext, toEmail);
                        return response.releaseBody();
                    }
                    return response.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .flatMap(body -> Mono.error(new IllegalStateException(
                                    "HubSpot API error: status=" + response.statusCode() + " body=" + body
                            )));
                });
    }
}


