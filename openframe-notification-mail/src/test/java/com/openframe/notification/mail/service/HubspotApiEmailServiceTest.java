package com.openframe.notification.mail.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.function.Consumer;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

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
    private final Logger logger = (Logger) LoggerFactory.getLogger(HubspotApiEmailService.class);
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

    @AfterEach
    void resetLogger() {
        logger.detachAndStopAllAppenders();
        logger.setLevel(null);
    }

    @Test
    void sendDownloadLinkEmail_hubspotAccepts_postsSingleSendWithDownloadTicket() {
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

    @Test
    void sendDownloadLinkEmail_hubspotAccepts_logsEmailSent() {
        hubspotAnswers(200, ACCEPTED);
        ListAppender<ILoggingEvent> logs = captureLogs(Level.INFO);

        send(service -> service.sendDownloadLinkEmail(TO, DOWNLOAD_ID));

        assertThat(logs.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getFormattedMessage)
                .containsExactly(tuple(Level.INFO, "[HubSpot API] Download link email sent to ada@acme.com"));
    }

    @Test
    void sendDownloadLinkEmail_debugEnabled_logsPayload() {
        hubspotAnswers(200, ACCEPTED);
        ListAppender<ILoggingEvent> logs = captureLogs(Level.DEBUG);

        send(service -> service.sendDownloadLinkEmail(TO, DOWNLOAD_ID));

        assertThat(logs.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getMessage, event -> List.of(event.getArgumentArray()))
                .contains(tuple(Level.DEBUG, "[HubSpot API] {} Payload: {}", List.of("Download link", downloadLinkPayload())));
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

    private ListAppender<ILoggingEvent> captureLogs(Level level) {
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        logger.setLevel(level);
        return appender;
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
                "customProperties", Map.of("download_ticket", DOWNLOAD_ID));
    }

    private record HubspotRequest(String method, String path, String authorization, String contentType,
                                  Map<String, Object> payload) {
    }

    private record HubspotAnswer(int status, String body) {
    }
}
