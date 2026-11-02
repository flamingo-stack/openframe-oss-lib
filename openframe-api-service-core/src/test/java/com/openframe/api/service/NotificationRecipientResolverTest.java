package com.openframe.api.service;

import com.openframe.api.dto.notification.NotificationRecipient;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.notification.RecipientType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationRecipientResolverTest {

    private static final String ALICE = "user-alice";
    private static final String MACHINE_1 = "machine-1";

    private final NotificationRecipientResolver resolver = new NotificationRecipientResolver();

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void current_adminJwt_userRecipientWithTheUserId() {
        // setup
        login(jwt(ALICE, "ADMIN", null));

        // execution
        NotificationRecipient recipient = resolver.current();

        // verifications
        assertThat(recipient).isEqualTo(new NotificationRecipient(ALICE, RecipientType.USER));
    }

    @Test
    void current_agentJwtWithMachineId_machineRecipientWithTheMachineId() {
        // setup
        login(jwt("agent-" + MACHINE_1, "AGENT", MACHINE_1));

        // execution
        NotificationRecipient recipient = resolver.current();

        // verifications
        assertThat(recipient).isEqualTo(new NotificationRecipient(MACHINE_1, RecipientType.MACHINE));
    }

    @Test
    void current_agentJwtWithoutMachineId_unauthorized() {
        // setup
        login(jwt("agent-x", "AGENT", null));

        // execution + verifications
        assertThatThrownBy(resolver::current)
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("machine_id");
    }

    @Test
    void current_adminJwtWithoutUserId_unauthorized() {
        // setup
        login(jwt("", "ADMIN", null));

        // execution + verifications
        assertThatThrownBy(resolver::current).isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void current_noJwtAuthentication_unauthorized() {
        // setup
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("someone", "secret", List.of()));

        // execution + verifications
        assertThatThrownBy(resolver::current)
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("JWT");
    }

    @Test
    void current_noAuthenticationAtAll_unauthorized() {
        // execution + verifications
        assertThatThrownBy(resolver::current).isInstanceOf(UnauthorizedException.class);
    }

    private static Jwt jwt(String userId, String role, String machineId) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("subject-" + userId)
                .claim("userId", userId)
                .claim("roles", List.of(role))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60));
        if (machineId != null) {
            builder.claim("machine_id", machineId);
        }
        return builder.build();
    }

    private static void login(Jwt jwt) {
        String role = jwt.getClaimAsStringList("roles").getFirst();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority(role))));
    }
}
