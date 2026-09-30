package com.openframe.gateway.security;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import com.openframe.gateway.security.filter.AddAuthorizationHeaderFilter;
import com.openframe.security.cookie.CookieService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.ReactiveAuthenticationManagerResolver;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken;
import org.springframework.security.web.server.WebFilterChainProxy;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pins who may call what through the gateway: every private path prefix against no token, a user
 * (ADMIN) token and an agent token. The token manager is a stand-in that maps fixed bearer values
 * to roles, so the test exercises the authorization rules, not JWT decoding.
 */
class GatewayRouteAuthorizationTest {

    private WebFilterChainProxy proxy;

    private final ReactiveAuthenticationManager tokenManager = authentication -> {
        String token = ((BearerTokenAuthenticationToken) authentication).getToken();
        return switch (token) {
            case "admin-token" -> Mono.just(new UsernamePasswordAuthenticationToken("user", null,
                    List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
            case "agent-token" -> Mono.just(new UsernamePasswordAuthenticationToken("agent", null,
                    List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));
            default -> Mono.error(new BadCredentialsException("bad token"));
        };
    };

    @BeforeEach
    void setUp() {
        CookieService cookieService = new CookieService();
        ReflectionTestUtils.setField(cookieService, "cookieSameSite", "Lax");
        ReactiveAuthenticationManagerResolver<ServerWebExchange> resolver = exchange -> Mono.just(tokenManager);
        proxy = new WebFilterChainProxy(new GatewaySecurityConfig().springSecurityFilterChain(
                ServerHttpSecurity.http(), resolver, new AddAuthorizationHeaderFilter(cookieService),
                new WsAwareAuthenticationEntryPoint(mock(GatewayTrafficMetrics.class))));
    }

    private int status(MockServerHttpRequest.BaseBuilder<?> request) {
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        AtomicBoolean reached = new AtomicBoolean();
        proxy.filter(exchange, ex -> {
            reached.set(true);
            return Mono.empty();
        }).block();
        HttpStatus status = (HttpStatus) exchange.getResponse().getStatusCode();
        return reached.get() ? 200 : (status == null ? 200 : status.value());
    }

    private int call(String path, String token) {
        MockServerHttpRequest.BaseBuilder<?> request = MockServerHttpRequest.get(path);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return status(request);
    }

    @ParameterizedTest(name = "{0}: none={1} admin={2} agent={3}")
    @CsvSource({
            "/api/graphql, 401, 200, 403",
            "/tools/fleet/api/x, 401, 200, 403",
            "/ws/tools/meshcentral/x, 401, 200, 403",
            "/tools/agent/fleet/x, 401, 403, 200",
            "/ws/tools/agent/meshcentral/x, 401, 403, 200",
            "/clients/api/agents/heartbeat, 401, 403, 200",
            "/ws/nats, 401, 200, 200",
            "/ws/nats-api, 401, 200, 200",
            "/chat/x, 401, 200, 200",
            "/content/x, 401, 200, 200"
    })
    void shouldEnforceRolesPerPathPrefix(String path, int none, int admin, int agent) {
        assertThat(call(path, null)).as("no token").isEqualTo(none);
        assertThat(call(path, "admin-token")).as("admin").isEqualTo(admin);
        assertThat(call(path, "agent-token")).as("agent").isEqualTo(agent);
    }

    @ParameterizedTest
    @CsvSource({"/clients/api/agents/register", "/clients/api/agents/reinstall", "/clients/api/agents/uninstall",
            "/clients/api/release-version", "/clients/oauth/token", "/clients/metrics/x", "/clients/tool-agent/x", "/public/x"})
    void shouldKeepPublicPathsOpen(String path) {
        assertThat(call(path, null)).isEqualTo(200);
    }

    @ParameterizedTest
    @CsvSource({"/api/graphql", "/clients/api/agents/heartbeat"})
    void shouldRejectInvalidBearerEverywherePrivate(String path) {
        assertThat(call(path, "forged-token")).isEqualTo(401);
    }

    @ParameterizedTest
    @CsvSource({"/api/../api/graphql"})
    void shouldNotOpenAdminApiThroughPathTricks(String path) {
        assertThat(call(path, "agent-token")).isNotEqualTo(200);
    }

    @ParameterizedTest
    @CsvSource({"cookie", "header", "query"})
    void shouldAuthenticateFromCookieHeaderOrQueryParam(String source) {
        MockServerHttpRequest.BaseBuilder<?> request = switch (source) {
            case "cookie" -> MockServerHttpRequest.get("/api/graphql").cookie(new HttpCookie("access_token", "admin-token"));
            case "header" -> MockServerHttpRequest.get("/api/graphql").header("Access-Token", "admin-token");
            default -> MockServerHttpRequest.get("/api/graphql?authorization=admin-token");
        };

        assertThat(status(request)).isEqualTo(200);
    }

    @ParameterizedTest
    @CsvSource({"/clients/api/agents/register"})
    void shouldNotInjectCookieTokenOnPublicClientPaths(String path) {
        assertThat(status(MockServerHttpRequest.get(path).cookie(new HttpCookie("access_token", "forged-token")))).isEqualTo(200);
    }
}
