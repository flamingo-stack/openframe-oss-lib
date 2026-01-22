package com.openframe.security.oauth.service;

import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import com.openframe.security.jwt.JwtService;
import com.openframe.security.oauth.dto.OAuthCallbackResult;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.headers.ForwardedHeadersContributor;
import com.openframe.security.oauth.service.redirect.RedirectTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.net.URI;
import java.util.Base64;
import java.util.Optional;

import static com.openframe.core.constants.HttpHeaders.ACCEPT;
import static com.openframe.security.pkce.PKCEUtils.*;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.time.Instant.now;
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
    private final MongoOAuth2AuthorizationRepository authorizationRepository;

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
                                                    ServerHttpRequest request) {
        OAuthSessionData sessionData = validateAndExtractCookieData(state, request)
                .orElse(null);
        if (sessionData == null) return Mono.error(new IllegalStateException("invalid_state"));
        return exchangeCodeForTokens(sessionData, code, request)
                .flatMap(tokens -> redirectTargetResolver
                        .resolve(sessionData.tenantId(), sessionData.redirectTo(), request)
                        .map(target -> new OAuthCallbackResult(sessionData.tenantId(), target, tokens))
                );
    }

    public Mono<TokenResponse> refreshTokensPublic(String tenantId, String refreshToken, ServerHttpRequest request) {
        return refreshTokens(tenantId, refreshToken, request);
    }

    /**
     * Best-effort refresh that does NOT require tenantId parameter.
     * If tenant cannot be resolved from MongoDB, returns Mono.empty().
     */
    public Mono<TokenResponse> refreshTokensByLookup(String refreshToken, ServerHttpRequest request) {
        if (!hasText(refreshToken)) {
            return Mono.empty();
        }

        return Mono.defer(() -> Mono.justOrEmpty(authorizationRepository.findByRefreshTokenValue(refreshToken)))
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap(auth -> {
                    String tenantId = extractTenantIdFromAuthorizationUri(auth.getArAuthorizationUri()).orElse(null);
                    if (!hasText(tenantId)) return Mono.empty();
                    return refreshTokensPublic(tenantId, refreshToken, request);
                });
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

    /**
     * Best-effort revoke that does NOT require tenantId parameter.
     *
     * Looks up the OAuth2 authorization by refresh token in MongoDB and extracts the tenant id from the saved
     * authorizationUri (e.g. ".../{tenantId}/oauth2/authorize"). If lookup/parsing fails, it becomes a no-op.
     */
    public Mono<Void> revokeRefreshTokenByLookup(String refreshToken) {
        if (!hasText(refreshToken)) {
            return Mono.empty();
        }

        return Mono.defer(() -> Mono.justOrEmpty(authorizationRepository.findByRefreshTokenValue(refreshToken)))
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap(auth -> {
                    String tenantId = extractTenantIdFromAuthorizationUri(auth.getArAuthorizationUri()).orElse(null);
                    if (!hasText(tenantId)) return Mono.empty();
                    return revokeRefreshToken(tenantId, refreshToken);
                })
                .onErrorResume(e -> Mono.empty());
    }

    private Optional<String> extractTenantIdFromAuthorizationUri(String authorizationUri) {
        if (!hasText(authorizationUri)) {
            return Optional.empty();
        }
        try {
            URI uri = URI.create(authorizationUri);
            String path = uri.getPath();
            if (!hasText(path)) {
                return Optional.empty();
            }
            // - "/sas/{tenantId}/oauth2/authorize"
            String[] parts = path.split("/");
            // parts[0] = "" because path starts with "/"
            if (parts.length >= 3 && "sas".equals(parts[1]) && hasText(parts[2])) return Optional.of(parts[2]);
            if (parts.length >= 2 && hasText(parts[1])) return Optional.of(parts[1]); // fallback for older "/{tenantId}/..."
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Incorrect authorizationUri format: {}", authorizationUri, e);
            return Optional.empty();
        }
    }

    public record AuthorizeData(String authorizeUrl, String state, String codeVerifier, String tenantId, String redirectToAbs) {}

    public String buildStateJwt(AuthorizeData data, int ttlSeconds) {
        var builder = JwtClaimsSet.builder()
                .subject("oauth_state")
                .claim("s", data.state())
                .claim("cv", data.codeVerifier())
                .claim("tid", data.tenantId())
                .issuedAt(now())
                .expiresAt(now().plusSeconds(ttlSeconds));
        if (data.redirectToAbs() != null) {
            builder.claim("rt", data.redirectToAbs());
        }
        var claims = builder.build();
        return jwtService.generateToken(claims);
    }

    public String tryGetRedirectFromStateCookie(String state, ServerHttpRequest request) {
        String cookieName = "of_oauth_" + state;
        var cookie = request.getCookies().getFirst(cookieName);
        if (cookie == null) return null;
        try {
            var jwt = jwtService.decodeToken(cookie.getValue());
            Object rt = jwt.getClaims().get("rt");
            return rt != null ? rt.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }
}


