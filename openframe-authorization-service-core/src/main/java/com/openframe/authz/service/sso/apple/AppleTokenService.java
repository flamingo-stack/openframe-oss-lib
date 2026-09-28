package com.openframe.authz.service.sso.apple;

import com.openframe.authz.config.oidc.AppleSSOProperties;
import com.openframe.authz.service.auth.strategy.AppleClientSecretFactory;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.auth.AppleUserToken;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.repository.auth.AppleUserTokenRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;
import static com.openframe.authz.service.auth.strategy.AppleClientSecretFactory.APPLE_ISSUER;
import static org.springframework.util.StringUtils.hasText;

/**
 * Keeps and revokes the per-user Apple refresh token, as App Store guideline 5.1.1(v) requires:
 * deleting an account that used Sign in with Apple must revoke its Apple tokens. Storage happens
 * on every Apple sign-in (web and native — each code exchange issues a fresh refresh token);
 * revocation is driven by {@link AppleTokenRevocationScheduler} once the user is deleted.
 */
@Slf4j
@Service
public class AppleTokenService {

    private final AppleUserTokenRepository tokenRepository;
    private final EncryptionService encryptionService;
    private final SSOConfigService ssoConfigService;
    private final AppleClientSecretFactory clientSecretFactory;
    private final AppleSSOProperties appleProps;
    private final RestClient restClient;

    public AppleTokenService(AppleUserTokenRepository tokenRepository,
                             EncryptionService encryptionService,
                             SSOConfigService ssoConfigService,
                             AppleClientSecretFactory clientSecretFactory,
                             AppleSSOProperties appleProps,
                             RestClient.Builder restClientBuilder) {
        this.tokenRepository = tokenRepository;
        this.encryptionService = encryptionService;
        this.ssoConfigService = ssoConfigService;
        this.clientSecretFactory = clientSecretFactory;
        this.appleProps = appleProps;
        this.restClient = restClientBuilder.build();
    }

    /**
     * Best-effort by design: failing to keep the token must never fail a sign-in. Upserts — every
     * Apple code exchange returns a new refresh token, and only the latest is worth revoking.
     */
    public void store(String tenantId, String userId, String clientId, String refreshToken) {
        if (!hasText(refreshToken)) {
            return;
        }
        try {
            AppleUserToken doc = tokenRepository.findByUserId(userId).orElseGet(AppleUserToken::new);
            doc.setTenantId(tenantId);
            doc.setUserId(userId);
            doc.setClientId(clientId);
            doc.setRefreshToken(encryptionService.encryptClientSecret(refreshToken));
            doc.setUpdatedAt(Instant.now());
            tokenRepository.save(doc);
        } catch (Exception e) {
            log.warn("Failed to store Apple refresh token for user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Revokes the stored token with Apple and forgets it. Returns {@code true} when there is
     * nothing left to revoke — including "no token stored" and Apple's success response — so the
     * caller can tell a completed revocation from one to retry.
     */
    public boolean revokeAndForget(AppleUserToken token) {
        try {
            SSOConfig cfg = ssoConfigService.getEffectiveSSOConfig(token.getTenantId(), APPLE).orElse(null);
            if (cfg == null) {
                // No Apple key material — nothing we can do; drop the token rather than retry forever.
                log.warn("event=apple-token-revocation-skipped user={} reason=no-apple-config", token.getUserId());
                tokenRepository.delete(token);
                return true;
            }
            String pem = ssoConfigService.getDecryptedClientSecret(cfg);
            String clientSecret = clientSecretFactory.mint(cfg.getTeamId(), cfg.getKeyId(), pem, token.getClientId());

            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("client_id", token.getClientId());
            form.add("client_secret", clientSecret);
            form.add("token", encryptionService.decryptClientSecret(token.getRefreshToken()));
            form.add("token_type_hint", "refresh_token");

            restClient.post()
                    .uri(revokeUrl())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toBodilessEntity();

            tokenRepository.delete(token);
            log.info("event=apple-token-revoked user={}", token.getUserId());
            return true;
        } catch (Exception e) {
            log.warn("event=apple-token-revocation-failed user={} msg={}", token.getUserId(), e.getMessage());
            return false;
        }
    }

    public Optional<AppleUserToken> findByUserId(String userId) {
        return tokenRepository.findByUserId(userId);
    }

    private String revokeUrl() {
        return APPLE_ISSUER + "/auth/revoke";
    }
}
