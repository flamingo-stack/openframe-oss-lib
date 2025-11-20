package com.openframe.security.oauth.service;

import com.openframe.security.jwt.JwtService;
import com.openframe.security.oauth.dto.OAuthCallbackResult;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.headers.ForwardedHeadersContributor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.WebSession;
import reactor.core.publisher.Mono;
import com.openframe.security.oauth.service.redirect.RedirectTargetResolver;

import java.util.Base64;
import java.util.Optional;

import static com.openframe.core.constants.HttpHeaders.ACCEPT;
import static com.openframe.security.pkce.PKCEUtils.*;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.util.StringUtils.hasText;

@RequiredArgsConstructor
@Slf4j
@Service
@ConditionalOnProperty(prefix = "openframe.gateway.oauth", name = "enable", havingValue = "true")
public class OAuthBffService {

    private final WebClient.Builder webClientBuilder;
    private final RedirectTargetResolver redirectTargetResolver;
    private final ForwardedHeadersContributor headersContributor;
    private final JwtService jwtService;

    @Value("${openframe.auth.server.url}")
    private String authServerUrl;

    @Value("${openframe.auth.server.authorize-url}")
    private String authUrl;

    @Value("${openframe.gateway.oauth.client-id}")
    private String clientId;

    @Value("${openframe.gateway.oauth.client-secret}")
    private String clientSecret;

    @Value("${openframe.gateway.oauth.redirect-uri}")
    private String redirectUri;

    public Mono<AuthorizeData> buildAuthorizeRedirect(String tenantId,
                                                      String redirectTo,
                                                      String provider,
                                                      WebSession session,
                                                      ServerHttpRequest request) {
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);
        String state = generateState();

        String effectiveRedirect = resolveRedirectTarget(redirectTo, request);
        String absoluteRedirect = isAbsoluteUrl(effectiveRedirect) ? effectiveRedirect : null;

        String authorizeUrl = buildAuthorizeUrl(tenantId, codeChallenge, state, provider);
        return Mono.just(new AuthorizeData(authorizeUrl, state, codeVerifier, tenantId, absoluteRedirect));
    }

    public Mono<OAuthCallbackResult> handleCallback(String code,
                                                    String state,
                                                    WebSession session,
                                                    ServerHttpRequest request) {
        OAuthSessionData sessionData = validateAndExtractCookieData(state, request)
                .orElse(null);
        if (sessionData == null) return Mono.error(new IllegalStateException("invalid_state"));
        return exchangeCodeForTokens(sessionData, code, request)
                .flatMap(tokens -> redirectTargetResolver
                        .resolve(sessionData.tenantId(), sessionData.redirectTo(), session, request)
                        .map(target -> new OAuthCallbackResult(sessionData.tenantId(), target, tokens))
                );
    }

    public Mono<TokenResponse> refreshTokensPublic(String tenantId, String refreshToken, ServerHttpRequest request) {
        return refreshTokens(tenantId, refreshToken, request);
    }

    public Mono<Void> logout(WebSession session) {
        return session.invalidate();
    }

    private String buildAuthorizeUrl(String tenantId, String codeChallenge, String state, String provider) {
        String base = String.format(
                "%s/%s/oauth2/authorize?response_type=code&client_id=%s&code_challenge=%s&code_challenge_method=S256&redirect_uri=%s&scope=openid%%20profile%%20email%%20offline_access&state=%s",
                authUrl,
                tenantId,
                clientId,
                codeChallenge,
                urlEncode(redirectUri),
                state);
        if (StringUtils.hasText(provider)) {
            base = base + "&provider=" + provider;
        }
        return base;
    }

    private Optional<OAuthSessionData> validateAndExtractCookieData(String state, ServerHttpRequest request) {
        String cookieName = "of_oauth_" + state;
        var cookie = request.getCookies().getFirst(cookieName);
        if (cookie == null) return Optional.empty();
        try {
            var jwt = jwtService.decodeToken(cookie.getValue());
            String tokenState = (String) jwt.getClaims().get("s");
            if (tokenState == null || !tokenState.equals(state)) return Optional.empty();
            String codeVerifier = (String) jwt.getClaims().get("cv");
            String tenantId = (String) jwt.getClaims().get("tid");
            String redirectTo = (String) jwt.getClaims().get("rt");
            if (codeVerifier == null || tenantId == null) return Optional.empty();
            return Optional.of(new OAuthSessionData(codeVerifier, tenantId, isAbsoluteUrl(redirectTo) ? redirectTo : null));
        } catch (Exception e) {
            log.warn("Failed to decode OAuth state cookie: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private Mono<TokenResponse> exchangeCodeForTokens(OAuthSessionData sessionData, String code, ServerHttpRequest request) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("code_verifier", sessionData.codeVerifier());
        form.add("redirect_uri", redirectUri);

        return webClientBuilder.build()
                .post()
                .uri(String.format("%s/%s/oauth2/token", authServerUrl, sessionData.tenantId()))
                .headers(h -> {
                    h.add(com.openframe.core.constants.HttpHeaders.AUTHORIZATION, basicAuth(clientId, clientSecret));
                    headersContributor.contribute(h, request);
                })
                .header(ACCEPT, "application/json")
                .body(BodyInserters.fromFormData(form))
                .retrieve()
                .onStatus(s -> s.is4xxClientError() || s.is5xxServerError(), resp ->
                        resp.bodyToMono(String.class).defaultIfEmpty("")
                                .flatMap(body -> Mono.error(new IllegalStateException("token_exchange_failed:" + body)))
                )
                .bodyToMono(TokenResponse.class);
    }

    private Mono<TokenResponse> refreshTokens(String tenantId, String refreshToken, ServerHttpRequest request) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", refreshToken);

        return webClientBuilder.build()
                .post()
                .uri(String.format("%s/%s/oauth2/token", authServerUrl, tenantId))
                .headers(h -> {
                    h.add(com.openframe.core.constants.HttpHeaders.AUTHORIZATION, basicAuth(clientId, clientSecret));
                    headersContributor.contribute(h, request);
                })
                .header(ACCEPT, "application/json")
                .body(BodyInserters.fromFormData(form))
                .retrieve()
                .onStatus(s -> s.is4xxClientError() || s.is5xxServerError(), resp ->
                        resp.bodyToMono(String.class).defaultIfEmpty("")
                                .flatMap(body -> Mono.error(new IllegalStateException("token_refresh_failed:" + body)))
                )
                .bodyToMono(TokenResponse.class);
    }

    private String basicAuth(String clientId, String clientSecret) {
        String raw = clientId + ":" + clientSecret;
        return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(UTF_8));
    }

    private static boolean isAbsoluteUrl(String url) {
        if (url == null) return false;
        String u = url.toLowerCase();
        return (u.startsWith("https://") || u.startsWith("http://"));
    }

    private record OAuthSessionData(String codeVerifier, String tenantId, String redirectTo) {
    }

    private String resolveRedirectTarget(String redirectTo, ServerHttpRequest request) {
        String effectiveRedirect = redirectTo;
        if (!hasText(effectiveRedirect)) {
            String referer = request.getHeaders().getFirst(HttpHeaders.REFERER);
            if (hasText(referer)) {
                effectiveRedirect = referer;
            }
        }
        return effectiveRedirect;
    }

    public Mono<Void> revokeRefreshToken(String tenantId, String refreshToken) {
        if (!hasText(refreshToken)) {
            return Mono.empty();
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", refreshToken);
        form.add("token_type_hint", "refresh_token");

        return webClientBuilder.build()
                .post()
                .uri(String.format("%s/%s/oauth2/revoke", authServerUrl, tenantId))
                .header(AUTHORIZATION, basicAuth(clientId, clientSecret))
                .body(BodyInserters.fromFormData(form))
                .retrieve()
                .bodyToMono(Void.class)
                .onErrorResume(e -> Mono.empty());
    }

    public record AuthorizeData(String authorizeUrl, String state, String codeVerifier, String tenantId, String redirectToAbs) {}
}


