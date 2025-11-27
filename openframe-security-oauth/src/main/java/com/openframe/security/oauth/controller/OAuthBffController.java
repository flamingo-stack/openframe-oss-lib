package com.openframe.security.oauth.controller;

import com.openframe.security.cookie.CookieService;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.service.OAuthBffService;
import com.openframe.security.oauth.service.OAuthDevTicketStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.WebSession;
import reactor.core.publisher.Mono;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import static com.openframe.security.oauth.SecurityConstants.*;
import static org.springframework.http.HttpHeaders.LOCATION;
import static org.springframework.http.HttpStatus.FOUND;
import static org.springframework.util.StringUtils.hasText;

@RestController
@RequestMapping("/oauth")
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "openframe.gateway.oauth", name = "enable", havingValue = "true")
public class OAuthBffController {

    private final OAuthBffService oauthBffService;
    private final OAuthDevTicketStore devTicketStore;
    private final CookieService cookieService;

    @Value("${openframe.gateway.oauth.state-cookie-ttl-seconds:180}")
    private int stateCookieTtlSeconds;

    @GetMapping("/login")
    public Mono<ResponseEntity<Void>> login(@RequestParam String tenantId,
                                            @RequestParam(value = "redirectTo", required = false) String redirectTo,
                                            @RequestParam(value = "provider", required = false) String provider,
                                            ServerHttpRequest request) {
        HttpHeaders headers = new HttpHeaders();
        cookieService.addClearSasCookies(headers);
        return oauthBffService.buildAuthorizeRedirect(tenantId, redirectTo, provider, request)
                .map(data -> {
                    String token = oauthBffService.buildStateJwt(data, stateCookieTtlSeconds);
                    cookieService.addOAuthStateCookie(headers, data.state(), token, stateCookieTtlSeconds);
                    return ResponseEntity.status(FOUND).header(LOCATION, data.authorizeUrl()).headers(headers).build();
                });
    }

    @GetMapping("/callback")
    public Mono<ResponseEntity<Void>> callback(@RequestParam String code,
                                               @RequestParam String state,
                                               ServerHttpRequest request) {
        boolean includeDevTicket = isLocalHost(request);
        return oauthBffService.handleCallback(code, state, request)
                .flatMap(result -> computeTargetWithOptionalDevTicketReactive(
                        safeRedirect(result.redirectTo()),
                        includeDevTicket,
                        result.tokens()
                ).map(target -> buildFoundWithCookiesAndClearState(
                        target,
                        result.tokens(),
                        state
                )))
                .onErrorResume(e -> {
                    String msg = URLEncoder.encode(
                            e.getMessage() != null ? e.getMessage() : "token_exchange_failed",
                            StandardCharsets.UTF_8);
                    String target = buildErrorRedirectTarget(state, request, msg);
                    return Mono.just(buildFound(target, state));
                });
    }

    @PostMapping("/refresh")
    public Mono<ResponseEntity<Void>> refresh(@RequestParam String tenantId,
                                              @CookieValue(name = REFRESH_TOKEN, required = false) String refreshCookie,
                                              ServerHttpRequest request) {
        String token = hasText(refreshCookie) ? refreshCookie : request.getHeaders().getFirst(REFRESH_TOKEN_HEADER);
        if (!hasText(token)) {
            return Mono.just(ResponseEntity.status(401).build());
        }
        boolean includeDevHeaders = isLocalHost(request);
        return oauthBffService.refreshTokensPublic(tenantId, token, request)
                .map(tokens -> buildNoContentWithCookies(tokens, includeDevHeaders));
    }

    @GetMapping("/logout")
    public Mono<ResponseEntity<Void>> logout(@RequestParam String tenantId,
                                             @CookieValue(name = REFRESH_TOKEN, required = false) String refreshCookie,
                                             ServerHttpRequest request,
                                             WebSession session) {
        HttpHeaders headers = new HttpHeaders();
        cookieService.addClearAuthCookies(headers);
        String refreshToken = hasText(refreshCookie) ? refreshCookie : request.getHeaders().getFirst(REFRESH_TOKEN_HEADER);
        return oauthBffService.revokeRefreshToken(tenantId, refreshToken)
                .then(Mono.just(ResponseEntity.noContent().headers(headers).build()));
    }

    @GetMapping("/dev-exchange")
    public Mono<ResponseEntity<Object>> devExchange(@RequestParam("ticket") String ticket,
                                            ServerHttpRequest request) {
        if (!isLocalHost(request)) {
            return Mono.just(ResponseEntity.status(404).build());
        }
        return devTicketStore.consumeTicket(ticket)
                .map(tokens -> {
                    HttpHeaders headers = new HttpHeaders();
                    addDevHeaders(headers, tokens);
                    return ResponseEntity.noContent().headers(headers).build();
                })
                .switchIfEmpty(Mono.just(ResponseEntity.status(404).build()));
    }

    private boolean isLocalHost(ServerHttpRequest request) {
        String host = request.getURI().getHost();
        if (hasText(host) && "localhost".equalsIgnoreCase(host)) return true;
        String hostHeader = request.getHeaders().getFirst(HttpHeaders.HOST);
        return hasText(hostHeader) && hostHeader.toLowerCase().startsWith("localhost");
    }

    private static boolean isAbsoluteUrl(String url) {
        if (url == null) return false;
        String u = url.toLowerCase();
        return (u.startsWith("https://") || u.startsWith("http://"));
    }

    private String safeRedirect(String redirectTo) {
        return (redirectTo != null && !redirectTo.isBlank()) ? redirectTo : "/";
    }

    private Mono<String> computeTargetWithOptionalDevTicketReactive(String baseTarget, boolean includeDevTicket, TokenResponse tokens) {
        if (!includeDevTicket) {
            return Mono.just(baseTarget);
        }
        return devTicketStore.createTicket(tokens)
                .map(ticket -> baseTarget + (baseTarget.contains("?") ? "&" : "?") + "devTicket=" + ticket);
    }

    private ResponseEntity<Void> buildFound(String target, String stateToClear) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(LOCATION, target);
        if (hasText(stateToClear)) {
            cookieService.addClearOAuthStateCookie(headers, stateToClear);
        }
        return ResponseEntity.status(FOUND).headers(headers).build();
    }

    private ResponseEntity<Void> buildFoundWithCookiesAndClearState(String target, TokenResponse tokens, String state) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(LOCATION, target);
        cookieService.addAuthCookies(headers, tokens.access_token(), tokens.refresh_token());
        cookieService.addClearOAuthStateCookie(headers, state);
        return ResponseEntity.status(FOUND).headers(headers).build();
    }

    private ResponseEntity<Void> buildNoContentWithCookies(TokenResponse tokens, boolean includeDevHeaders) {
        HttpHeaders headers = new HttpHeaders();
        cookieService.addAuthCookies(headers, tokens.access_token(), tokens.refresh_token());
        if (includeDevHeaders) {
            addDevHeaders(headers, tokens);
        }
        return ResponseEntity.noContent().headers(headers).build();
    }

    private void addDevHeaders(HttpHeaders headers, TokenResponse tokens) {
        if (hasText(tokens.access_token())) headers.add(ACCESS_TOKEN_HEADER, tokens.access_token());
        if (hasText(tokens.refresh_token())) headers.add(REFRESH_TOKEN_HEADER, tokens.refresh_token());
    }

    private String buildErrorRedirectTarget(String state, ServerHttpRequest request, String msg) {
        String originalRedirectTo = oauthBffService.tryGetRedirectFromStateCookie(state, request);
        String base;
        if (isAbsoluteUrl(originalRedirectTo)) {
            base = originalRedirectTo;
        } else {
            String referer = request.getHeaders().getFirst(HttpHeaders.REFERER);
            base = (referer != null && !referer.isBlank()) ? referer : "/";
        }
        return base.contains("?")
                ? base + "&error=oauth_failed&message=" + msg
                : base + "?error=oauth_failed&message=" + msg;
    }
}
