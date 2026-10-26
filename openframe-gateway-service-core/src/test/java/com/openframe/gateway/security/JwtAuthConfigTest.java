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
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
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
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Guards against the tenant-gateway outage where a JWT from an unreachable issuer made the gateway
 * block its event loops on issuer discovery: untrusted issuers must never cause a network call,
 * discovery must be bounded by a timeout, and a failing issuer must not be retried on every request.
 */
class JwtAuthConfigTest {

    private static final String OWN_ISSUER = "https://own.example/sas/own";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private HttpServer server;
    private final AtomicInteger requests = new AtomicInteger();
    private final CountDownLatch release = new CountDownLatch(1);
    private volatile Handler handler;
    private String issuerBase;
    private RSAKey key;
    private JwtIssuerReactiveAuthenticationManagerResolver resolver;

    interface Handler {
        void handle(HttpExchange exchange) throws Exception;
    }

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/", exchange -> {
            requests.incrementAndGet();
            try {
                handler.handle(exchange);
            } catch (Exception e) {
                throw new IOException(e);
            } finally {
                exchange.close();
            }
        });
        server.start();
        issuerBase = "http://127.0.0.1:" + server.getAddress().getPort() + "/sas";
        key = new RSAKeyGenerator(2048).keyID("k1").generate();

        JwtConfig jwtConfig = mock(JwtConfig.class);
        when(jwtConfig.getIssuer()).thenReturn(OWN_ISSUER);
        IssuerUrlProvider issuerUrlProvider = mock(IssuerUrlProvider.class);
        when(issuerUrlProvider.accepts(anyString()))
                .thenAnswer(inv -> inv.<String>getArgument(0).startsWith(issuerBase + "/"));

        JwtAuthConfig config = new JwtAuthConfig();
        ReflectionTestUtils.setField(config, "expireAfter", Duration.ofMinutes(30));
        ReflectionTestUtils.setField(config, "refreshAfter", Duration.ofMinutes(10));
        ReflectionTestUtils.setField(config, "maximumSize", 100L);
        ReflectionTestUtils.setField(config, "discoveryConnectTimeout", Duration.ofSeconds(1));
        ReflectionTestUtils.setField(config, "discoveryResponseTimeout", Duration.ofMillis(500));
        ReflectionTestUtils.setField(config, "discoveryFailureTtl", Duration.ofMinutes(1));

        LoadingCache<String, ReactiveAuthenticationManager> cache =
                config.issuerManagersCache(new ReactiveJwtAuthenticationConverter(), jwtConfig, issuerUrlProvider);
        resolver = config.jwtIssuerAuthenticationManagerResolver(cache, jwtConfig, issuerUrlProvider);
    }

    @AfterEach
    void tearDown() {
        release.countDown();
        server.stop(0);
    }

    @Test
    void untrustedIssuer_isRejectedWithoutAnyNetworkCall() throws Exception {
        handler = exchange -> respond(exchange, 404, "");

        assertThatThrownBy(() -> authenticate(token("https://evil.example/sas/" + UUID.randomUUID())).block(TIMEOUT))
                .isInstanceOf(InvalidBearerTokenException.class);

        assertThat(requests.get()).isZero();
    }

    @Test
    void discoveryNotFound_failsAndIsNotRetriedOnNextRequest() throws Exception {
        handler = exchange -> respond(exchange, 404, "");
        String token = token(issuerBase + "/" + UUID.randomUUID());

        assertThatThrownBy(() -> authenticate(token).block(TIMEOUT))
                .isInstanceOf(AuthenticationServiceException.class);
        int afterFirst = requests.get();
        assertThat(afterFirst).isPositive();

        assertThatThrownBy(() -> authenticate(token).block(TIMEOUT))
                .isInstanceOf(AuthenticationServiceException.class);
        assertThat(requests.get()).isEqualTo(afterFirst);
    }

    @Test
    void discoveryThatNeverAnswers_timesOutInsteadOfHanging() throws Exception {
        handler = exchange -> release.await();

        assertThatThrownBy(() -> authenticate(token(issuerBase + "/" + UUID.randomUUID())).block(TIMEOUT))
                .isInstanceOf(AuthenticationServiceException.class);
    }

    @Test
    void reachableTrustedIssuer_authenticates() throws Exception {
        String issuer = issuerBase + "/" + UUID.randomUUID();
        handler = exchange -> {
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
        };

        Authentication auth = authenticate(token(issuer)).block(TIMEOUT);
        assertThat(auth).isNotNull();
        assertThat(auth.isAuthenticated()).isTrue();
    }

    private Mono<Authentication> authenticate(String token) {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/"));
        return resolver.resolve(exchange)
                .flatMap(manager -> manager.authenticate(new BearerTokenAuthenticationToken(token)));
    }

    private String token(String issuer) throws Exception {
        var claims = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject("user")
                .issueTime(new Date())
                .expirationTime(Date.from(Instant.now().plusSeconds(300)))
                .build();
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
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
