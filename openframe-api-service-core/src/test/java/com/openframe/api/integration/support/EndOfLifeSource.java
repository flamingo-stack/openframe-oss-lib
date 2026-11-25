package com.openframe.api.integration.support;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

// endoflife.date stand-in: rows as the real answer has them, trimmed.
public final class EndOfLifeSource {

    public static final String PATH = "/api/windows.json";

    private static final String WINDOWS_RELEASES = """
            [
              {"cycle": "11-25h2-e", "releaseLabel": "11 25H2 (E)", "eol": "2028-10-10", "latest": "10.0.26200",
               "lts": false, "support": "2028-10-10", "extendedSupport": false},
              {"cycle": "11-25h2-w", "releaseLabel": "11 25H2 (W)", "eol": "2027-10-12", "latest": "10.0.26200",
               "lts": false, "support": "2027-10-12", "extendedSupport": false},
              {"cycle": "11-24h2-e", "releaseLabel": "11 24H2 (E)", "eol": "2027-10-12", "latest": "10.0.26100",
               "lts": false, "support": "2027-10-12", "extendedSupport": false},
              {"cycle": "11-24h2-w", "releaseLabel": "11 24H2 (W)", "eol": "2026-10-13", "latest": "10.0.26100",
               "lts": false, "support": "2026-10-13", "extendedSupport": false},
              {"cycle": "10-22h2", "releaseLabel": "10 22H2", "eol": "2025-10-14", "latest": "10.0.19045",
               "lts": false, "support": "2025-10-14", "extendedSupport": "2028-10-10"}
            ]
            """;

    private EndOfLifeSource() {
    }

    public static String start() {
        try {
            HttpServer httpServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            httpServer.createContext(PATH, exchange -> {
                byte[] body = WINDOWS_RELEASES.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                try (OutputStream responseBody = exchange.getResponseBody()) {
                    responseBody.write(body);
                }
            });
            httpServer.start();
            return "http://127.0.0.1:" + httpServer.getAddress().getPort();
        } catch (IOException failure) {
            throw new UncheckedIOException(failure);
        }
    }
}
