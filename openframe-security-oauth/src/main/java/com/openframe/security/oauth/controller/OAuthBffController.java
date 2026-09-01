package com.openframe.security.oauth.controller;

import com.openframe.security.cookie.CookieService;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.exception.AppleNativeRegistrationRequiredException;
import com.openframe.security.oauth.exception.InvalidRefreshTokenException;
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
import reactor.core.publisher.Mono;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

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
    @Value("${openframe.gateway.oauth.dev-ticket-enabled:true}")
    private boolean devTicketEnabled;
    @Value("${openframe.gateway.oauth.mobile-auth-enabled:true}")
    private boolean mobileAuthEnabled;
    @Value("${openframe.auth.error-url}")
    private String authErrorUrl;

    @GetMapping("/login")
    public Mono<ResponseEntity<Void>> login(@RequestParam String tenantId,
                                            @RequestParam(value = "redirectTo", required = false) String redirectTo,
                                            @RequestParam(value = "provider", required = false) String provider,
                                            @RequestParam(value = "authMobile", required = false, defaultValue = "false") boolean authMobile,
                                            ServerHttpRequest request) {
        HttpHeaders headers = new HttpHeaders();
        cookieService.addClearSasCookies(headers);
        return oauthBffService.buildAuthorizeRedirect(tenantId, redirectTo, provider, authMobile && mobileAuthEnabled, request)
                .map(data -> {
                    String token = oauthBffService.buildStateJwt(data, stateCookieTtlSeconds);
                    cookieService.addOAuthStateCookie(headers, data.state(), token, stateCookieTtlSeconds);
                    return ResponseEntity.status(FOUND).header(LOCATION, data.authorizeUrl()).headers(headers).build();
                });
    }

    /**
     * Initializes OAuth authorize redirect (PKCE/state) without clearing any cookies or session.
     * Useful for "continue" flows after SSO finalization where we already have an authenticated principal.
     */
    @GetMapping("/continue")
    public Mono<ResponseEntity<Void>> continueFlow(@RequestParam String tenantId,
                                                   @RequestParam(value = "redirectTo", required = false) String redirectTo,
                                                   @RequestParam(value = "authMobile", required = false, defaultValue = "false") boolean authMobile,
                                                   ServerHttpRequest request) {
        HttpHeaders headers = new HttpHeaders();
        return oauthBffService.buildAuthorizeRedirect(tenantId, redirectTo, null, authMobile && mobileAuthEnabled, request)
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
        return oauthBffService.handleCallback(code, state, request)
                .flatMap(result -> computeTargetWithOptionalDevTicketReactive(
                        safeRedirect(result.redirectTo()),
                        devTicketEnabled || result.authMobile(),
                        result.tokens()
                ).map(target -> buildFoundWithCookiesAndClearState(
                        target,
                        result.tokens(),
                        state
                )))
                .onErrorResume(e -> {
                    log.error("OAuth callback failed: {}", e.getMessage(), e);
                    String msg = URLEncoder.encode(
                            e.getMessage() != null ? e.getMessage() : "Authentication failed. Please try again.",
                            StandardCharsets.UTF_8);
                    return Mono.just(buildFound(authErrorUrl + "?error=" + msg, state));
                });
    }

    @PostMapping("/refresh")
    public Mono<ResponseEntity<Void>> refresh(@RequestParam(value = "tenantId", required = false) String tenantId,
                                              @CookieValue(name = REFRESH_TOKEN, required = false) String refreshCookie,
                                              ServerHttpRequest request) {
        boolean fromHeader = !hasText(refreshCookie);
        String token = fromHeader ? request.getHeaders().getFirst(REFRESH_TOKEN_HEADER) : refreshCookie;
        if (!hasText(token)) {
            return Mono.just(unauthorizedWithClearedCookies());
        }
        boolean includeHeaders = devTicketEnabled || (fromHeader && mobileAuthEnabled);
        Mono<TokenResponse> tokensMono = hasText(tenantId)
                ? oauthBffService.refreshTokensPublic(tenantId, token, request)
                : oauthBffService.refreshTokensByLookup(token, request);

        return tokensMono
                .map(tokens -> buildNoContentWithCookies(tokens, includeHeaders))
                // A rejected/unknown refresh token must NOT clear cookies. With rotation
                // (reuseRefreshTokens=false), concurrent refreshes race: the winner rotates the
                // token and Set-Cookies the new one; the loser's stale token lands here — and
                // wiping cookies in that response destroys the winner's freshly established
                // session (observed in prod: a login killed 150ms after completion by a stale
                // refresh from the previous session). A plain 401 leaves the browser's current —
                // possibly newer and valid — cookies intact; explicit /logout remains the only
                // place that clears an established session.
                .switchIfEmpty(Mono.fromSupplier(this::unauthorized))
                .onErrorResume(InvalidRefreshTokenException.class, e -> {
                    log.warn("Refresh rejected (cookies preserved): {}", e.getMessage());
                    return Mono.just(unauthorized());
                });
    }

    private ResponseEntity<Void> unauthorized() {
        return ResponseEntity.status(401).build();
    }

    @GetMapping("/logout")
    public Mono<ResponseEntity<Void>> logout(@RequestParam(value = "tenantId", required = false) String tenantId,
                                             @CookieValue(name = REFRESH_TOKEN, required = false) String refreshCookie,
                                             ServerHttpRequest request) {
        HttpHeaders headers = new HttpHeaders();
        cookieService.addClearAuthCookies(headers);
        String refreshToken = hasText(refreshCookie) ? refreshCookie : request.getHeaders().getFirst(REFRESH_TOKEN_HEADER);
        Mono<Void> revoke = hasText(tenantId)
                ? oauthBffService.revokeRefreshToken(tenantId, refreshToken)
                : oauthBffService.revokeRefreshTokenByLookup(refreshToken);
        return revoke.then(Mono.just(ResponseEntity.noContent().headers(headers).build()));
    }

    /**
     * Native Sign in with Apple (iOS): exchanges the credential from ASAuthorizationController for
     * OpenFrame tokens. Response mirrors dev-exchange — Access-Token / Refresh-Token headers (plus
     * auth cookies) — so the app's existing token-storage path is reused unchanged.
     */
    @PostMapping("/apple/native-exchange")
    public Mono<ResponseEntity<Object>> appleNativeExchange(@RequestBody AppleNativeExchangeRequest body,
                                                            ServerHttpRequest request) {
        if (!mobileAuthEnabled) {
            return Mono.just(ResponseEntity.status(404).build());
        }
        if (!hasText(body.identityToken()) || !hasText(body.authorizationCode())) {
            return Mono.just(ResponseEntity.badRequest().build());
        }
        // tenantId is optional: without it the tenant is resolved from the VERIFIED identity
        // token on the authorization server — the only option for Hide My Email users, who
        // don't know their relay address and so can't go through email discovery. An identity
        // with no account answers 409 {"error": "registration_required"} so the app can branch
        // into signup instead of showing a failed sign-in.
        Mono<String> tenantId = hasText(body.tenantId())
                ? Mono.just(body.tenantId())
                : oauthBffService.appleNativeDiscoverTenant(body.identityToken(), body.nonce(), request);
        return tenantId
                .flatMap(tid -> oauthBffService.appleNativeExchange(
                                tid, body.identityToken(), body.authorizationCode(),
                                body.nonce(), body.firstName(), body.lastName(), request)
                        .map(tokens -> (ResponseEntity<Object>) (ResponseEntity<?>) buildNoContentWithCookies(tokens, true)))
                .onErrorResume(AppleNativeRegistrationRequiredException.class, e ->
                        Mono.just(ResponseEntity.status(409).body(Map.of("error", "registration_required"))))
                .onErrorResume(e -> {
                    log.warn("Apple native exchange failed: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(401).build());
                });
    }

    /**
     * Fully native Apple signup: for an identity the exchange answered
     * {@code registration_required} to, this creates the tenant (identity from the verified
     * token, org name + domain from the app) and immediately runs the regular exchange with the
     * SAME authorization code — discovery never spent it, so replay protection still holds and
     * the app is signed up and signed in with one request. Errors carry the actual reason
     * (domain taken, account exists) as 400 {"error": …}.
     */
    @PostMapping("/apple/native-register")
    public Mono<ResponseEntity<Object>> appleNativeRegister(@RequestBody AppleNativeRegisterRequest body,
                                                            ServerHttpRequest request) {
        if (!mobileAuthEnabled) {
            return Mono.just(ResponseEntity.status(404).build());
        }
        if (!hasText(body.identityToken()) || !hasText(body.authorizationCode())
                || !hasText(body.tenantName()) || !hasText(body.tenantDomain())) {
            return Mono.just(ResponseEntity.badRequest().build());
        }
        return oauthBffService.appleNativeRegisterTenant(
                        body.identityToken(), body.nonce(), body.tenantName(), body.tenantDomain(),
                        body.firstName(), body.lastName(), request)
                .flatMap(tenantId -> oauthBffService.appleNativeExchange(
                                tenantId, body.identityToken(), body.authorizationCode(),
                                body.nonce(), body.firstName(), body.lastName(), request)
                        .map(tokens -> (ResponseEntity<Object>) (ResponseEntity<?>) buildNoContentWithCookies(tokens, true)))
                .onErrorResume(IllegalArgumentException.class, e ->
                        Mono.just(ResponseEntity.badRequest().body(Map.of("error", e.getMessage()))))
                .onErrorResume(e -> {
                    log.warn("Apple native registration failed: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(401).build());
                });
    }

    public record AppleNativeRegisterRequest(String identityToken,
                                             String authorizationCode,
                                             String nonce,
                                             String firstName,
                                             String lastName,
                                             String tenantName,
                                             String tenantDomain) {
    }

    public record AppleNativeExchangeRequest(String tenantId,
                                             String identityToken,
                                             String authorizationCode,
                                             String nonce,
                                             String firstName,
                                             String lastName) {
    }

    @GetMapping("/dev-exchange")
    public Mono<ResponseEntity<Object>> devExchange(@RequestParam("ticket") String ticket) {
        if (!devTicketEnabled && !mobileAuthEnabled) {
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

    private ResponseEntity<Void> unauthorizedWithClearedCookies() {
        HttpHeaders headers = new HttpHeaders();
        cookieService.addClearAuthCookies(headers);
        return ResponseEntity.status(401).headers(headers).<Void>build();
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

}
