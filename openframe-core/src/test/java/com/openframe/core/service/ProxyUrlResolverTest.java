package com.openframe.core.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProxyUrlResolverTest {

    private static final String TOOL_URL = "http://fleet.tools.svc";
    private static final String PORT = "8070";

    private final ProxyUrlResolver resolver = new ProxyUrlResolver(environment("k8s"));

    // ------------------------------------------------ resolve: behaviour the gateway relies on

    @ParameterizedTest
    @CsvSource({
            "/tools/fleet/api/v1/fleet/hosts,                 http://fleet.tools.svc:8070/api/v1/fleet/hosts",
            "/tools/fleet/api/v1/hosts?page=2&order=asc,      http://fleet.tools.svc:8070/api/v1/hosts?page=2&order=asc",
            "/tools/fleet,                                    http://fleet.tools.svc:8070/",
            "/tools/fleet/,                                   http://fleet.tools.svc:8070/",
            "/tools/fleet/api?q=a%20b,                        http://fleet.tools.svc:8070/api?q=a%20b",
            "/tools/fleet/api?filter[name]=x,                 http://fleet.tools.svc:8070/api?filter[name]=x",
            "/tools/fleet/api?auth=abc==,                     http://fleet.tools.svc:8070/api?auth=abc=="
    })
    void resolveStripsThePrefixAndKeepsPathAndQuery(String original, String expected) {
        assertEquals(expected, resolver.resolve("fleet", TOOL_URL, PORT, URI.create(original), "/tools").toString());
    }

    @Test
    void resolveStripsTheAgentPrefix() {
        URI target = resolver.resolve("fleet", TOOL_URL, PORT,
                URI.create("https://tenant.example.com/tools/agent/fleet/api/osquery/config"), "/tools/agent");

        assertEquals("http://fleet.tools.svc:8070/api/osquery/config", target.toString());
    }

    @Test
    void resolveKeepsTheSchemeOfTheToolUrlAndWorksWithoutAPort() {
        URI target = resolver.resolve("meshcentral", "wss://mesh.tools.svc", null,
                URI.create("/ws/tools/meshcentral/meshrelay.ashx?id=1"), "/ws/tools");

        assertEquals("wss://mesh.tools.svc/meshrelay.ashx?id=1", target.toString());
    }

    @ParameterizedTest
    @ValueSource(strings = {"local", ""})
    void localAndDefaultProfilesTargetLocalhost(String profile) {
        ProxyUrlResolver local = new ProxyUrlResolver(environment(profile));
        URI original = URI.create("/tools/fleet/api?q=a%26b");

        assertEquals("http://localhost:8070/api?q=a&b", local.resolve("fleet", TOOL_URL, PORT, original, "/tools").toString());
        assertEquals("http://localhost:8070/api?q=a%26b",
                local.resolvePreservingEncoding("fleet", TOOL_URL, PORT, original, "/tools").toString());
    }

    /** Pins the decoding of resolve() so that it cannot change unnoticed: gateway traffic depends on it. */
    @ParameterizedTest
    @CsvSource({
            "/tools/fleet/api?q=a%26b%3Dc,   http://fleet.tools.svc:8070/api?q=a&b=c",
            "/tools/fleet/api?x=%2B1,        http://fleet.tools.svc:8070/api?x=+1",
            "/tools/fleet/files/a%2Fb,       http://fleet.tools.svc:8070/files/a/b"
    })
    void resolveForwardsEncodedReservedCharactersDecoded(String original, String expected) {
        assertEquals(expected, resolver.resolve("fleet", TOOL_URL, PORT, URI.create(original), "/tools").toString());
    }

    // ------------------------------------------------ resolvePreservingEncoding

    @ParameterizedTest
    @CsvSource({
            "/tools/fleet/api?q=a%26b%3Dc,   http://fleet.tools.svc:8070/api?q=a%26b%3Dc",
            "/tools/fleet/api?x=%2B1,        http://fleet.tools.svc:8070/api?x=%2B1",
            "/tools/fleet/files/a%2Fb,       http://fleet.tools.svc:8070/files/a%2Fb",
            "/tools/fleet/files/caf%C3%A9,   http://fleet.tools.svc:8070/files/caf%C3%A9",
            "/tools/fleet/api?q=50%25,       http://fleet.tools.svc:8070/api?q=50%25"
    })
    void preservingVariantForwardsEncodedCharactersAsSent(String original, String expected) {
        assertEquals(expected,
                resolver.resolvePreservingEncoding("fleet", TOOL_URL, PORT, URI.create(original), "/tools").toString());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/tools/fleet/api/v1/fleet/hosts",
            "/tools/fleet/api/v1/hosts?page=2&order=asc",
            "/tools/fleet",
            "/tools/fleet/",
            "/tools/fleet/api?q=a%20b",
            "/tools/fleet/api?q=a+b",
            "/tools/fleet/api?filter[name]=x",
            "/tools/fleet/api?auth=abc==",
            "https://tenant.example.com/tools/fleet/api?x=1"
    })
    void bothVariantsAgreeWhenNothingReservedIsEncoded(String original) {
        URI uri = URI.create(original);

        assertEquals(resolver.resolve("fleet", TOOL_URL, PORT, uri, "/tools"),
                resolver.resolvePreservingEncoding("fleet", TOOL_URL, PORT, uri, "/tools"));
    }

    @Test
    void preservingVariantFallsBackToResolveWhenTheToolIdArrivesEncoded() {
        URI original = URI.create("/tools/fl%65et/api?q=1");

        assertEquals(resolver.resolve("fleet", TOOL_URL, PORT, original, "/tools"),
                resolver.resolvePreservingEncoding("fleet", TOOL_URL, PORT, original, "/tools"));
    }

    @Test
    void preservingVariantFallsBackToResolveWhenThePathOnlySharesThePrefixOfTheToolId() {
        URI original = URI.create("/tools/fleet-extra/api");

        assertEquals(resolver.resolve("fleet", TOOL_URL, PORT, original, "/tools"),
                resolver.resolvePreservingEncoding("fleet", TOOL_URL, PORT, original, "/tools"));
    }

    private static MockEnvironment environment(String profile) {
        MockEnvironment environment = new MockEnvironment();
        if (!profile.isEmpty()) {
            environment.setActiveProfiles(profile);
        }
        return environment;
    }
}
