package com.openframe.security.oauth.service.redirect;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Optional;

import static org.springframework.http.HttpHeaders.REFERER;
import static org.springframework.util.StringUtils.hasText;

/**
 * Redirect policy for deployments without a tenant-aware resolver (OSS): the requested target, or
 * the Referer, is honored only as a same-site path or an exact allow-listed URI. An absolute URL on
 * the gateway's own origin becomes its path; anything else lands on {@code /}.
 */
@Component
@ConditionalOnMissingBean(value = RedirectTargetResolver.class, ignored = DefaultRedirectTargetResolver.class)
public class DefaultRedirectTargetResolver implements RedirectTargetResolver {

    private static final String ROOT = "/";

    /** Exact allow-list (comma-separated), e.g. native-app callback URIs. Empty: nothing is allowed. */
    @Value("${openframe.gateway.redirect.allowed-uris:}")
    private String allowedRedirectUris;

    @Override
    public Mono<String> resolve(String tenantId, String userId, String requestedRedirectTo, ServerHttpRequest request) {
        String target = hasText(requestedRedirectTo) ? requestedRedirectTo : request.getHeaders().getFirst(REFERER);
        return Mono.just(sanitize(target, request.getURI()));
    }

    @Override
    public boolean isAllowedRedirectUri(String uri) {
        return hasText(uri) && allowedRedirectUris != null
                && Arrays.stream(allowedRedirectUris.split(",")).map(String::trim).anyMatch(uri::equals);
    }

    private String sanitize(String target, URI requestUri) {
        if (!hasText(target)) {
            return ROOT;
        }
        if (RedirectTargetResolver.isSafeRelativePath(target) || isAllowedRedirectUri(target)) {
            return target;
        }
        return sameOriginPath(target, requestUri).orElse(ROOT);
    }

    private static Optional<String> sameOriginPath(String target, URI requestUri) {
        try {
            URI uri = new URI(target);
            if (!uri.isAbsolute() || !sameOrigin(uri, requestUri)) {
                return Optional.empty();
            }
            String path = hasText(uri.getRawPath()) ? uri.getRawPath() : ROOT;
            String pathAndQuery = uri.getRawQuery() == null ? path : path + "?" + uri.getRawQuery();
            return Optional.of(pathAndQuery).filter(RedirectTargetResolver::isSafeRelativePath);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
    }

    private static boolean sameOrigin(URI target, URI request) {
        return target.getScheme().equalsIgnoreCase(request.getScheme())
                && target.getHost() != null && target.getHost().equalsIgnoreCase(request.getHost())
                && effectivePort(target) == effectivePort(request);
    }

    private static int effectivePort(URI uri) {
        if (uri.getPort() != -1) {
            return uri.getPort();
        }
        return switch (uri.getScheme().toLowerCase()) {
            case "https" -> 443;
            case "http" -> 80;
            default -> -1;
        };
    }
}
