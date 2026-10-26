package com.openframe.notification.mail.service;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.function.Consumer;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Timeout(10)
class HubspotApiEmailServiceTest {

    private static final String TO = "ada@acme.com";
    private static final String FROM = "noreply@flamingo.run";
    private static final String DOWNLOAD_ID = "0b9f3c2e-5d1a-4c7e-9f60-2a8d4e1b7c35";
    private static final String ACCEPTED = "{\"status\":\"PENDING\"}";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final TypeReference<Map<String, Object>> PAYLOAD = new TypeReference<>() {
    };

    private final BlockingQueue<HubspotRequest> requests = new LinkedBlockingQueue<>();
    private volatile HubspotAnswer answer;
    private HttpServer hubspot;

    @BeforeEach
    void startHubspot() throws IOException {
        hubspot = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        hubspot.createContext("/", this::handle);
        hubspot.start();
    }

    @AfterEach
    void stopHubspot() {
        hubspot.stop(0);
    }

    @Test
    void sendDownloadLinkEmail_hubspotAccepts_postsSingleSendWithDownloadId() {
        hubspotAnswers(200, ACCEPTED);

        send(service -> service.sendDownloadLinkEmail(TO, DOWNLOAD_ID));

        assertThat(requests).containsExactly(new HubspotRequest("POST", "/marketing/v4/email/single-send",
                "Bearer hs-token", "application/json", downloadLinkPayload()));
    }

    @Test
    void sendDownloadLinkEmail_hubspotRejects_throwsWithStatusAndBody() {
        hubspotAnswers(400, "{\"category\":\"VALIDATION_ERROR\"}");

        assertThatThrownBy(() -> send(service -> service.sendDownloadLinkEmail(TO, DOWNLOAD_ID)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith("HubSpot API error: status=400")
                .hasMessageEndingWith(" body={\"category\":\"VALIDATION_ERROR\"}");
    }

    @Test
    void sendDownloadLinkEmail_hubspotFailsWithoutBody_throwsWithEmptyBody() {
        hubspotAnswers(503, "");

        assertThatThrownBy(() -> send(service -> service.sendDownloadLinkEmail(TO, DOWNLOAD_ID)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith("HubSpot API error: status=503")
                .hasMessageEndingWith(" body=");
    }

    private void send(Consumer<HubspotApiEmailService> call) {
        new ApplicationContextRunner()
                .withPropertyValues(
                        "openframe.mail.provider=hubspot-api",
                        "openframe.mail.from=" + FROM,
                        "openframe.mail.hubspot.access-token=hs-token",
                        "openframe.mail.hubspot.base-url=http://127.0.0.1:" + hubspot.getAddress().getPort(),
                        "openframe.mail.hubspot.download-link-email-id=download-link-template")
                .withUserConfiguration(HubspotApiEmailService.class)
                .run(context -> call.accept(context.getBean(HubspotApiEmailService.class)));
    }

    private void hubspotAnswers(int status, String body) {
        answer = new HubspotAnswer(status, body);
    }

    private void handle(HttpExchange exchange) throws IOException {
        requests.add(new HubspotRequest(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                exchange.getRequestHeaders().getFirst("Authorization"),
                exchange.getRequestHeaders().getFirst("Content-Type"),
                JSON.readValue(exchange.getRequestBody().readAllBytes(), PAYLOAD)));
        exchange.sendResponseHeaders(answer.status(), 0);
        exchange.getResponseBody().write(answer.body().getBytes(UTF_8));
        exchange.close();
    }

    private static Map<String, Object> downloadLinkPayload() {
        return Map.of(
                "emailId", "download-link-template",
                "message", Map.of("to", TO, "from", FROM, "subject", "Your OpenFrame download link"),
                "customProperties", Map.of("download_id", DOWNLOAD_ID));
    }

    private record HubspotRequest(String method, String path, String authorization, String contentType,
                                  Map<String, Object> payload) {
    }

    private record HubspotAnswer(int status, String body) {
    }
}
