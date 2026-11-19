package com.openframe.gatewayauth;

import com.openframe.core.dto.ErrorResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AccessDeniedExceptionHandlerTest {

    private static final String REASON = "Denied by hasAuthority('OWNER')";

    private final List<String> told = new ArrayList<>();
    private final AccessDeniedObserver observer = denied -> told.add(denied.getMessage());
    private final AccessDeniedExceptionHandler handler = new AccessDeniedExceptionHandler(
            new StaticListableBeanFactory(Map.of("observer", observer)).getBeanProvider(AccessDeniedObserver.class));

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void handleAccessDenied_signedInCallerRefused_answersForbiddenWithAFixedMessage() {
        signIn();

        ResponseEntity<ErrorResponse> response = handler.handleAccessDenied(refused());

        assertThat(response)
                .returns(HttpStatus.FORBIDDEN, ResponseEntity::getStatusCode)
                .extracting(ResponseEntity::getBody)
                .returns("FORBIDDEN", ErrorResponse::getCode)
                .returns("Access denied", ErrorResponse::getMessage)
                .extracting(ErrorResponse::getTimestamp)
                .isNotNull();
    }

    @Test
    void handleAccessDenied_signedInCallerRefused_tellsTheObserversTheRefusal() {
        signIn();

        handler.handleAccessDenied(refused());

        assertThat(told).containsExactly(REASON);
    }

    private static AuthorizationDeniedException refused() {
        return new AuthorizationDeniedException(REASON, new AuthorizationDecision(false));
    }

    private static void signIn() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", "user-1")
                .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList("ADMIN")));
    }
}
