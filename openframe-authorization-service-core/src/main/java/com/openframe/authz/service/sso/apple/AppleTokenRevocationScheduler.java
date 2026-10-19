package com.openframe.authz.service.sso.apple;

import com.openframe.data.document.auth.AppleUserToken;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.AppleUserTokenRepository;
import com.openframe.data.repository.auth.AuthUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Page;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

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

    private static final int PAGE_SIZE = 500;

    private final AppleUserTokenRepository tokenRepository;
    private final AuthUserRepository authUserRepository;
    private final AppleTokenService appleTokenService;

    @Scheduled(fixedDelayString = "${openframe.sso.apple.revocation.sweep-interval-ms:3600000}",
            initialDelayString = "${openframe.sso.apple.revocation.initial-delay-ms:300000}")
    public void revokeTokensOfDeletedUsers() {
        int revoked = 0;
        int failed = 0;
        int pageNumber = 0;
        Page<AppleUserToken> page;
        do {
            page = tokenRepository.findAll(PageRequest.of(pageNumber, PAGE_SIZE));
            List<AppleUserToken> tokens = page.getContent();
            if (!tokens.isEmpty()) {
                Set<String> userIds = tokens.stream()
                        .map(AppleUserToken::getUserId)
                        .collect(Collectors.toCollection(HashSet::new));
                Set<String> activeUserIds = authUserRepository.findAllById(userIds).stream()
                        .filter(user -> user.getStatus() != UserStatus.DELETED)
                        .map(user -> user.getId())
                        .collect(Collectors.toCollection(HashSet::new));
                for (AppleUserToken token : tokens) {
                    boolean userGone = !activeUserIds.contains(token.getUserId());
                    if (!userGone) {
                        continue;
                    }
                    if (appleTokenService.revokeAndForget(token)) {
                        revoked++;
                    } else {
                        failed++;
                    }
                }
            }
            pageNumber++;
        } while (page.hasNext());
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
