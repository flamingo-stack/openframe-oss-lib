package com.openframe.security.oauth.service.redirect;

import org.springframework.http.server.reactive.ServerHttpRequest;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.net.URISyntaxException;

public interface RedirectTargetResolver {

    /**
     * Resolve where to send the browser after a successful code exchange.
     *
     * @param tenantId          tenant the user authenticated into
     * @param userId            authenticated user's id ({@code sub} claim), or {@code null} when it
     *                          could not be read from the issued token
     * @param requestedRedirectTo redirect requested by the client, may be {@code null}
     */
    Mono<String> resolve(String tenantId, String userId, String requestedRedirectTo, ServerHttpRequest request);

    /**
     * Whether the URI is on the deployment's exact redirect allow-list (native-app callback URIs).
     * Used by hops that hand a sensitive handle (signup ticket) to a client-supplied target — the
     * default fails closed; the SaaS resolver exposes its configured list.
     */
    default boolean isAllowedRedirectUri(String uri) {
        return false;
    }

    // The ticket buys the user's tokens: only an exact allow-listed URI may carry it. The same site
    // already gets the auth cookies in this response, so a path never needs one.
    default boolean canReceiveDevTicket(String target) {
        return target != null && isAllowedRedirectUri(target);
    }

    // One leading slash and no whitespace, control characters or backslashes anywhere: browsers drop
    // tab/CR/LF from URLs, so "/\t/evil.com" would otherwise leave the site.
    static boolean isSafeRelativePath(String url) {
        if (url == null || !url.startsWith("/") || url.startsWith("//")) {
            return false;
        }
        return url.chars().noneMatch(RedirectTargetResolver::isUnsafePathChar);
    }

    // Plain http on the host localhost (any port); rejects lookalikes such as localhost@evil.com.
    static boolean isLocalhostOrigin(String target) {
        if (target == null) {
            return false;
        }
        try {
            URI uri = new URI(target);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            String userInfo = uri.getRawUserInfo();
            return "http".equalsIgnoreCase(scheme) && userInfo == null && "localhost".equalsIgnoreCase(host);
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static boolean isUnsafePathChar(int c) {
        return c <= 0x20 || c == 0x7f || c == '\\';
    }
}
