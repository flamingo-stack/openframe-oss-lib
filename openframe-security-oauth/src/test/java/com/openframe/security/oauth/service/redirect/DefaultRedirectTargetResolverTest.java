package com.openframe.security.oauth.service.redirect;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.REFERER;

class DefaultRedirectTargetResolverTest {

    private static final String NATIVE_APP = "com.openframe.app://auth";
    private static final String DESKTOP_RETURN = "https://oss.example.com:8443/auth/desktop-return/#";

    private final DefaultRedirectTargetResolver resolver = new DefaultRedirectTargetResolver();
    private final ServerHttpRequest request = MockServerHttpRequest.get("https://oss.example.com:8443/oauth/callback").build();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(resolver, "allowedRedirectUris", NATIVE_APP + ", " + DESKTOP_RETURN);
    }

    private String resolve(String redirectTo) {
        return resolver.resolve("acme", "u1", redirectTo, request).block();
    }

    private String resolveFromReferer(String referer) {
        ServerHttpRequest withReferer = MockServerHttpRequest.get("https://oss.example.com:8443/oauth/callback")
                .header(REFERER, referer).build();
        return resolver.resolve("acme", "u1", null, withReferer).block();
    }

    @Test
    void shouldKeepOnlySafeRelativePaths() {
        assertThat(resolve("/devices?x=1")).isEqualTo("/devices?x=1");
        assertThat(resolve("/")).isEqualTo("/");
        assertThat(resolve("//devices")).isEqualTo("/");
        assertThat(resolve("/\\devices")).isEqualTo("/");
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://evil.example/x", "//evil.example/x", "/\\evil.example/x",
            "javascript:alert(1)", "http://oss.example.com:8443/devices", "evil.example/x"})
    void shouldReplaceExternalRedirectWithRoot(String redirectTo) {
        assertThat(resolve(redirectTo)).isEqualTo("/");
    }

    @Test
    void shouldReplaceExternalRefererWithRootAndFallBackToRootWhenNothingRequested() {
        assertThat(resolveFromReferer("https://evil.example/x")).isEqualTo("/");
        assertThat(resolve(null)).isEqualTo("/");
        assertThat(resolve(" ")).isEqualTo("/");
    }

    @Test
    void shouldNormalizeSameOriginAbsoluteRedirectAndRefererToPath() {
        assertThat(resolve("https://oss.example.com:8443/devices/42?q=1")).isEqualTo("/devices/42?q=1");
        assertThat(resolveFromReferer("https://oss.example.com:8443/devices/42?q=1")).isEqualTo("/devices/42?q=1");
        assertThat(resolve("https://oss.example.com:8443")).isEqualTo("/");
    }

    @Test
    void shouldTreatExplicitDefaultPortAsSameOrigin() {
        ServerHttpRequest defaultPort = MockServerHttpRequest.get("https://oss.example.com/oauth/callback").build();

        assertThat(resolver.resolve("acme", "u1", "https://oss.example.com:443/devices", defaultPort).block())
                .isEqualTo("/devices");
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://oss.example.com/devices", "https://oss.example.com:9443/devices",
            "http://oss.example.com:8443/devices", "https://other.example.com:8443/devices"})
    void shouldTreatOtherSchemeHostOrPortAsExternal(String redirectTo) {
        assertThat(resolve(redirectTo)).isEqualTo("/");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\t\\evil.example",
            "/ /evil.example", "/devices\u007f"})
    void shouldReplacePathsWithControlCharactersWithRoot(String redirectTo) {
        assertThat(resolve(redirectTo)).isEqualTo("/");
        assertThat(resolveFromReferer(redirectTo)).isEqualTo("/");
        assertThat(resolver.canReceiveDevTicket(redirectTo)).isFalse();
    }

    @Test
    void shouldHonorLocalhostOnlyWhenDevTicketsAreOn() {
        assertThat(resolve("http://localhost:3000/devices")).isEqualTo("/");
        assertThat(resolver.canReceiveDevTicket("http://localhost:3000/devices")).isFalse();

        ReflectionTestUtils.setField(resolver, "devTicketEnabled", true);

        assertThat(resolve("http://localhost:3000/devices")).isEqualTo("http://localhost:3000/devices");
        assertThat(resolver.canReceiveDevTicket("http://localhost:3000/devices")).isTrue();
        assertThat(resolver.canReceiveDevTicket("http://localhost/")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost@evil.example/", "http://localhost.evil.example/", "http://localhostevil.example/",
            "http://localhost:3000@evil.example/", "https://localhost:3000/", "http://localhost/a b"})
    void shouldNotTreatLookalikeHostsAsLocalhostEvenWithDevTicketsOn(String redirectTo) {
        ReflectionTestUtils.setField(resolver, "devTicketEnabled", true);

        assertThat(resolve(redirectTo)).isEqualTo("/");
        assertThat(resolver.canReceiveDevTicket(redirectTo)).isFalse();
    }

    @Test
    void shouldDefaultDevTicketEnabledToFalse() throws NoSuchFieldException {
        Value value = DefaultRedirectTargetResolver.class.getDeclaredField("devTicketEnabled").getAnnotation(Value.class);

        assertThat(value.value()).isEqualTo("${openframe.gateway.oauth.dev-ticket-enabled:false}");
    }

    @Test
    void shouldReturnOnlyExactlyAllowListedUrisAsGiven() {
        assertThat(resolve(NATIVE_APP)).isEqualTo(NATIVE_APP);
        assertThat(resolve(DESKTOP_RETURN)).isEqualTo(DESKTOP_RETURN);
        assertThat(resolve(NATIVE_APP + "?x=1")).isEqualTo("/");
        assertThat(resolve("openframe-console://auth")).isEqualTo("/");
    }

    @Test
    void shouldMatchAllowListExactly() {
        assertThat(resolver.isAllowedRedirectUri(NATIVE_APP)).isTrue();
        assertThat(resolver.isAllowedRedirectUri(DESKTOP_RETURN)).isTrue();
        assertThat(resolver.isAllowedRedirectUri(NATIVE_APP + "?x=1")).isFalse();
        assertThat(resolver.isAllowedRedirectUri("com.openframe.app://")).isFalse();
        assertThat(resolver.isAllowedRedirectUri(" " + NATIVE_APP)).isFalse();
        assertThat(resolver.isAllowedRedirectUri(null)).isFalse();
    }

    @Test
    void shouldFailClosedWithEmptyAllowList() {
        ReflectionTestUtils.setField(resolver, "allowedRedirectUris", "");

        assertThat(resolver.isAllowedRedirectUri(NATIVE_APP)).isFalse();
        assertThat(resolver.isAllowedRedirectUri("")).isFalse();
        assertThat(resolve(NATIVE_APP)).isEqualTo("/");
    }

    @Test
    void shouldLetOnlyAllowListedTargetsReceiveDevTicket() {
        assertThat(resolver.canReceiveDevTicket(NATIVE_APP)).isTrue();
        assertThat(resolver.canReceiveDevTicket("/devices")).isFalse();
        assertThat(resolver.canReceiveDevTicket("/")).isFalse();
        assertThat(resolver.canReceiveDevTicket("//evil.example/x")).isFalse();
        assertThat(resolver.canReceiveDevTicket("/\\evil.example/x")).isFalse();
        assertThat(resolver.canReceiveDevTicket("https://acme.openframe.ai/")).isFalse();
        assertThat(resolver.canReceiveDevTicket(NATIVE_APP + "?x=1")).isFalse();
        assertThat(resolver.canReceiveDevTicket(null)).isFalse();
        assertThat(resolver.canReceiveDevTicket("")).isFalse();
    }
}
