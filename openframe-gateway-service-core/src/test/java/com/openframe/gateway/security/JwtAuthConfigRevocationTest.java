package com.openframe.gateway.security;

import com.github.benmanes.caffeine.cache.LoadingCache;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.openframe.gateway.security.revocation.RevokedKeyRegistry;
import com.openframe.gateway.security.tenant.IssuerUrlProvider;
import com.openframe.security.jwt.JwtConfig;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtIssuerReactiveAuthenticationManagerResolver;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * End to end: a tenant-issuer token signed with a kid that was revoked is rejected by the gateway
 * as a bad token (401), not as an unreachable issuer.
 */
class JwtAuthConfigRevocationTest {

    private static final String OWN_ISSUER = "https://own.example/sas/own";
    private static final String KID = "tenant-kid-1";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private HttpServer server;
    private String issuer;
    private RSAKey key;
    private RevokedKeyRegistry registry;
    private JwtIssuerReactiveAuthenticationManagerResolver resolver;

    @BeforeEach
    void setUp() throws Exception {
        key = new RSAKeyGenerator(2048).keyID(KID).generate();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/", this::serveIssuer);
        server.start();
        issuer = "http://127.0.0.1:" + server.getAddress().getPort() + "/sas/acme";

        JwtConfig jwtConfig = mock(JwtConfig.class);
        when(jwtConfig.getIssuer()).thenReturn(OWN_ISSUER);
        IssuerUrlProvider issuerUrlProvider = mock(IssuerUrlProvider.class);
        when(issuerUrlProvider.accepts(issuer)).thenReturn(true);

        JwtAuthConfig config = new JwtAuthConfig();
        ReflectionTestUtils.setField(config, "expireAfter", Duration.ofMinutes(30));
        ReflectionTestUtils.setField(config, "refreshAfter", Duration.ofMinutes(10));
        ReflectionTestUtils.setField(config, "maximumSize", 100L);
        ReflectionTestUtils.setField(config, "discoveryConnectTimeout", Duration.ofSeconds(1));
        ReflectionTestUtils.setField(config, "discoveryResponseTimeout", Duration.ofSeconds(2));
        ReflectionTestUtils.setField(config, "discoveryFailureTtl", Duration.ofMinutes(1));

        registry = new RevokedKeyRegistry(Duration.ofHours(1));
        LoadingCache<String, ReactiveAuthenticationManager> cache = config.issuerManagersCache(
                new ReactiveJwtAuthenticationConverter(), jwtConfig, issuerUrlProvider, registry);
        TokenRevocationChecker revocationOff = new TokenRevocationChecker(null, null, false, Duration.ofSeconds(10), 100L);
        resolver = config.jwtIssuerAuthenticationManagerResolver(cache, jwtConfig, issuerUrlProvider, revocationOff);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void tokenSignedWithCurrentKidAuthenticates() throws Exception {
        // setup
        String token = token();

        // execution
        Authentication auth = authenticate(token).block(TIMEOUT);

        // verifications
        assertThat(auth).isNotNull();
        assertThat(auth.isAuthenticated()).isTrue();
    }

    @Test
    void tokenSignedWithRevokedKidIsRejectedAsBadToken() throws Exception {
        // setup
        String token = token();
        authenticate(token).block(TIMEOUT);
        registry.revoke(KID);

        // execution / verifications
        assertThatThrownBy(() -> authenticate(token).block(TIMEOUT))
                .isInstanceOf(AuthenticationException.class)
                .isNotInstanceOf(AuthenticationServiceException.class)
                .hasMessageContaining("revoked signing key");
    }

    private void serveIssuer(HttpExchange exchange) throws IOException {
        try (exchange) {
            String path = exchange.getRequestURI().getPath();
            if (path.endsWith("/.well-known/openid-configuration")) {
                respond(exchange, 200, """
                        {"issuer":"%s","jwks_uri":"%s/jwks","subject_types_supported":["public"]}
                        """.formatted(issuer, issuer));
            } else if (path.endsWith("/jwks")) {
                respond(exchange, 200, new JWKSet(key.toPublicJWK()).toString());
            } else {
                respond(exchange, 404, "");
            }
        }
    }

    private Mono<Authentication> authenticate(String token) {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/"));
        return resolver.resolve(exchange)
                .flatMap(manager -> manager.authenticate(new BearerTokenAuthenticationToken(token)));
    }

    private String token() throws Exception {
        var claims = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject("user")
                .issueTime(new Date())
                .expirationTime(Date.from(Instant.now().plusSeconds(300)))
                .build();
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KID).build(), claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
        if (bytes.length > 0) {
            exchange.getResponseBody().write(bytes);
        }
    }
}
