package com.openframe.security.oauth.controller;

import com.openframe.security.cookie.CookieService;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.exception.InvalidRefreshTokenException;
import com.openframe.security.oauth.service.OAuthBffService;
import com.openframe.security.oauth.service.OAuthDevTicketStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthBffControllerRefreshTest {

    private static final String CLEAR_COOKIE = "refresh_token=; Max-Age=0; Path=/oauth";
    private static final String AUTH_COOKIE = "access_token=at; Path=/";

    @Mock
    private OAuthBffService oauthBffService;
    @Mock
    private OAuthDevTicketStore devTicketStore;
    @Mock
    private CookieService cookieService;
    @Mock
    private com.openframe.security.oauth.service.redirect.RedirectTargetResolver redirectTargetResolver;

    private OAuthBffController controller;

    private final ServerHttpRequest request = MockServerHttpRequest.post("/oauth/refresh").build();

    @BeforeEach
    void setUp() {
        controller = new OAuthBffController(oauthBffService, devTicketStore, cookieService, redirectTargetResolver);
        ReflectionTestUtils.setField(controller, "devTicketEnabled", false);
        ReflectionTestUtils.setField(controller, "mobileAuthEnabled", false);
    }

    /**
     * With rotation, a rejected token is routinely the LOSER of a concurrent-refresh race while
     * the browser already holds the winner's fresh cookie — clearing cookies here destroyed valid
     * sessions in prod (login killed 150ms after completion by a stale refresh). The 401 must
     * leave cookies untouched.
     */
    @Test
    void shouldReturn401WithoutTouchingCookiesWhenRefreshTokenRejected() {
        when(oauthBffService.refreshTokensPublic(eq("tenant-1"), eq("dead"), any()))
                .thenReturn(Mono.error(new InvalidRefreshTokenException()));

        ResponseEntity<Void> response = controller.refresh("tenant-1", "dead", request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).isNullOrEmpty();
        verify(cookieService, never()).addClearAuthCookies(any(HttpHeaders.class));
    }

    @Test
    void shouldReturn401WithoutTouchingCookiesWhenLookupFindsNoToken() {
        when(oauthBffService.refreshTokensByLookup(eq("unknown"), any())).thenReturn(Mono.empty());

        ResponseEntity<Void> response = controller.refresh(null, "unknown", request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).isNullOrEmpty();
        verify(cookieService, never()).addClearAuthCookies(any(HttpHeaders.class));
    }

    @Test
    void shouldReturn401WithClearedCookiesWhenNoTokenProvided() {
        doAnswer(inv -> {
            inv.getArgument(0, HttpHeaders.class).add(HttpHeaders.SET_COOKIE, CLEAR_COOKIE);
            return null;
        }).when(cookieService).addClearAuthCookies(any(HttpHeaders.class));

        ResponseEntity<Void> response = controller.refresh("tenant-1", null, request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).containsExactly(CLEAR_COOKIE);
    }

    @Test
    void shouldReturn204WithAuthCookiesWhenRefreshSucceeds() {
        TokenResponse tokens = new TokenResponse("at", "rt", "Bearer", 300, "openid");
        when(oauthBffService.refreshTokensPublic(eq("tenant-1"), eq("valid"), any()))
                .thenReturn(Mono.just(tokens));
        doAnswer(inv -> {
            inv.getArgument(0, HttpHeaders.class).add(HttpHeaders.SET_COOKIE, AUTH_COOKIE);
            return null;
        }).when(cookieService).addAuthCookies(any(HttpHeaders.class), eq("at"), eq("rt"));

        ResponseEntity<Void> response = controller.refresh("tenant-1", "valid", request).block();

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).containsExactly(AUTH_COOKIE);
        verify(cookieService).addAuthCookies(any(HttpHeaders.class), eq("at"), eq("rt"));
    }
}
