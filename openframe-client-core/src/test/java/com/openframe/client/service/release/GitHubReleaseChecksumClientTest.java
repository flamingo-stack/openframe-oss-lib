package com.openframe.client.service.release;

import com.openframe.client.config.AgentBinaryPolicyProperties;
import com.openframe.client.service.release.model.ReleaseChecksumLookup;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.FOUND;
import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.NOT_PUBLISHED;
import static com.openframe.client.service.release.model.ReleaseChecksumLookupStatus.UNAVAILABLE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GitHubReleaseChecksumClientTest {

    private static final String TOKEN = "test-token";
    private static final String RELEASE_PATH = "/repos/flamingo-stack/openframe-saas-tenant/releases/tags/";
    private static final String MAC_SHA256 = "ccb156415a8ae80b5a3b8eacc7ebd281f0468e32676a4d1dfb66f887eea4cb9f";

    private HttpServer server;
    private String baseUrl;
    private final List<String> storageAuthorizations = new CopyOnWriteArrayList<>();
    private GitHubReleaseChecksumClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(RELEASE_PATH, this::serveRelease);
        server.createContext("/assets/", this::serveAsset);
        server.createContext("/storage/", this::serveStorage);
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();

        AgentBinaryPolicyProperties properties = new AgentBinaryPolicyProperties();
        properties.getReleases().setOwner("flamingo-stack");
        properties.getReleases().setRepository("openframe-saas-tenant");
        properties.getReleases().setToken(TOKEN);
        JsonMapper objectMapper = JsonMapper.builder().build();
        client = new GitHubReleaseChecksumClient(properties, objectMapper, baseUrl);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void fetch_FollowsAssetRedirectWithoutLeakingToken() {
        ReleaseChecksumLookup lookup = client.fetch("1.5.74");

        assertEquals(FOUND, lookup.getStatus());
        assertEquals(MAC_SHA256, lookup.getBinaries().get("MAC_OS"));
        assertEquals(List.of(""), storageAuthorizations);
    }

    @Test
    void fetch_WithMissingRelease_IsNotPublished() {
        ReleaseChecksumLookup lookup = client.fetch("0.0.0-dev");

        assertEquals(NOT_PUBLISHED, lookup.getStatus());
        assertTrue(lookup.getBinaries().isEmpty());
    }

    @Test
    void fetch_WithReleaseWithoutChecksumsAsset_IsNotPublished() {
        ReleaseChecksumLookup lookup = client.fetch("1.1.5");

        assertEquals(NOT_PUBLISHED, lookup.getStatus());
    }

    @Test
    void fetch_WhenGitHubFails_IsUnavailable() {
        ReleaseChecksumLookup lookup = client.fetch("broken");

        assertEquals(UNAVAILABLE, lookup.getStatus());
    }

    private void serveRelease(HttpExchange exchange) throws IOException {
        String tag = exchange.getRequestURI().getPath().substring(RELEASE_PATH.length());
        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if (!("Bearer " + TOKEN).equals(authorization)) {
            respond(exchange, 401, "{}");
            return;
        }
        switch (tag) {
            case "1.5.74" -> respond(exchange, 200, """
                    {"tag_name":"1.5.74","assets":[
                      {"name":"openframe-client_macos.tar.gz","url":"%1$s/assets/1"},
                      {"name":"checksums.json","url":"%1$s/assets/2"}]}""".formatted(baseUrl));
            case "1.1.5" -> respond(exchange, 200, """
                    {"tag_name":"1.1.5","assets":[{"name":"SHA256SUMS","url":"%s/assets/3"}]}""".formatted(baseUrl));
            case "broken" -> respond(exchange, 502, "bad gateway");
            default -> respond(exchange, 404, "{\"message\":\"Not Found\"}");
        }
    }

    private void serveAsset(HttpExchange exchange) throws IOException {
        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if (!("Bearer " + TOKEN).equals(authorization)) {
            respond(exchange, 401, "{}");
            return;
        }
        exchange.getResponseHeaders().add("Location", baseUrl + "/storage/checksums.json?sig=abc");
        exchange.sendResponseHeaders(302, -1);
        exchange.close();
    }

    private void serveStorage(HttpExchange exchange) throws IOException {
        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        storageAuthorizations.add(authorization == null ? "" : authorization);
        respond(exchange, 200, """
                {"version":"1.5.74","binaries":{"MAC_OS":"%s","WINDOWS":"f6b7"}}""".formatted(MAC_SHA256));
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }
}
