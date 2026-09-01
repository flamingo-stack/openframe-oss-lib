package com.openframe.authz.service.sso.apple;

import com.openframe.data.document.auth.AppleUserToken;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.AppleUserTokenRepository;
import com.openframe.data.repository.auth.AuthUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Compliance reaper for App Store guideline 5.1.1(v): accounts are deleted in the API service,
 * which holds no Apple key material — so instead of a cross-service call, this scheduler (running
 * in the auth-server, the one service with the .p8 key) periodically sweeps stored Apple tokens
 * whose user is gone or DELETED and revokes them with Apple. Failed revocations stay stored and
 * are retried on the next sweep. Apple doesn't require the revocation to be synchronous with the
 * deletion — a bounded delay is fine.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(value = "openframe.sso.apple.revocation.enabled", havingValue = "true", matchIfMissing = true)
public class AppleTokenRevocationScheduler {

    private final AppleUserTokenRepository tokenRepository;
    private final AuthUserRepository authUserRepository;
    private final AppleTokenService appleTokenService;

    @Scheduled(fixedDelayString = "${openframe.sso.apple.revocation.sweep-interval-ms:3600000}",
            initialDelayString = "${openframe.sso.apple.revocation.initial-delay-ms:300000}")
    public void revokeTokensOfDeletedUsers() {
        int revoked = 0;
        int failed = 0;
        for (AppleUserToken token : tokenRepository.findAll()) {
            boolean userGone = authUserRepository.findById(token.getUserId())
                    // SELF_DELETED is the case Apple's guideline is actually about — the user
                    // deleting their own account — so both terminal states revoke.
                    .map(user -> user.getStatus() == UserStatus.DELETED
                            || user.getStatus() == UserStatus.SELF_DELETED)
                    .orElse(true);
            if (!userGone) {
                continue;
            }
            if (appleTokenService.revokeAndForget(token)) {
                revoked++;
            } else {
                failed++;
            }
        }
        if (revoked > 0 || failed > 0) {
            log.info("event=apple-token-revocation-sweep revoked={} failed={}", revoked, failed);
        }
    }

    @Configuration
    @EnableScheduling
    @ConditionalOnProperty(value = "openframe.sso.apple.revocation.enabled", havingValue = "true", matchIfMissing = true)
    static class SchedulingEnabler {
    }
}
