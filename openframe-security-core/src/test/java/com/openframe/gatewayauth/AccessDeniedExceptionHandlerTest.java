package com.openframe.gatewayauth;

import com.openframe.core.dto.ErrorResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class AccessDeniedExceptionHandlerTest {

    private static final String REASON = "Denied by hasAuthority('OWNER')";

    private final AccessDeniedExceptionHandler handler = new AccessDeniedExceptionHandler();

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
    void handleAccessDenied_anonymousCallerRefused_answersUnauthorizedWithAFixedMessage() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken("key", "anonymousUser",
                AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));

        ResponseEntity<ErrorResponse> response = handler.handleAccessDenied(refused());

        assertThat(response)
                .returns(HttpStatus.UNAUTHORIZED, ResponseEntity::getStatusCode)
                .extracting(ResponseEntity::getBody)
                .returns("UNAUTHORIZED", ErrorResponse::getCode)
                .returns("Access denied", ErrorResponse::getMessage);
    }

    @Test
    void handleAccessDenied_signedInCallerRefused_logsTheReasonWithoutAStackTrace(CapturedOutput output) {
        signIn();

        handler.handleAccessDenied(refused());

        assertThat(output.getOut())
                .containsPattern("WARN .*Access denied \\(FORBIDDEN\\): Denied by hasAuthority\\('OWNER'\\)")
                .doesNotContain("AuthorizationDeniedException");
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
