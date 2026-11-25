package com.openframe.gateway.config.error;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.web.ErrorProperties;
import org.springframework.boot.autoconfigure.web.WebProperties;
import org.springframework.boot.webflux.error.DefaultErrorAttributes;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.ServerCodecConfigurer;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.WebHandler;
import org.springframework.web.server.handler.ExceptionHandlingWebHandler;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PathOnlyErrorWebExceptionHandlerTest {

    private static final String PATH = "/ws/tools/some-tool/socket";
    private static final String QUERY = "id=42&token=s3cr3t-value";

    private Logger handlerLogger;
    private ListAppender<ILoggingEvent> appender;
    private MockServerWebExchange exchange;
    private WebHandler failingChain;

    @BeforeEach
    void setUp() {
        handlerLogger = (Logger) LoggerFactory.getLogger(PathOnlyErrorWebExceptionHandler.class);
        handlerLogger.setLevel(Level.DEBUG);
        appender = new ListAppender<>();
        appender.start();
        handlerLogger.addAppender(appender);

        GenericApplicationContext applicationContext = new GenericApplicationContext();
        applicationContext.refresh();
        ServerCodecConfigurer codecConfigurer = ServerCodecConfigurer.create();
        PathOnlyErrorWebExceptionHandler handler = new PathOnlyErrorWebExceptionHandler(new DefaultErrorAttributes(),
                new WebProperties.Resources(), new ErrorProperties(), applicationContext);
        handler.setMessageWriters(codecConfigurer.getWriters());
        handler.setMessageReaders(codecConfigurer.getReaders());

        IllegalStateException failure = new IllegalStateException("upstream unavailable",
                new IllegalArgumentException("root cause"));
        failure.addSuppressed(new IllegalStateException("cleanup failed"));
        WebHandler failing = webExchange -> Mono.error(failure);
        failingChain = new ExceptionHandlingWebHandler(failing, List.of(handler));

        MockServerHttpRequest request = MockServerHttpRequest.get(PATH + "?" + QUERY).build();
        exchange = MockServerWebExchange.from(request);
    }

    @AfterEach
    void tearDown() {
        handlerLogger.detachAppender(appender);
    }

    @Test
    void handle_unexpectedFailure_errorMessageHasPathAndNoQuery() {
        // setup
        String expectedLine = "500 Server Error for HTTP GET \"" + PATH + "\"";

        // execution
        failingChain.handle(exchange).block();

        // verifications
        assertThat(appender.list)
                .filteredOn(event -> event.getLevel() == Level.ERROR)
                .extracting(ILoggingEvent::getFormattedMessage)
                .singleElement()
                .asString()
                .contains(expectedLine)
                .doesNotContain("?", "s3cr3t-value");
    }

    @Test
    void handle_unexpectedFailure_loggedStackTraceKeepsTheFailureAndHasNoQuery() {
        // setup
        String expectedFailure = "java.lang.IllegalStateException: upstream unavailable";

        // execution
        failingChain.handle(exchange).block();

        // verifications
        assertThat(appender.list)
                .filteredOn(event -> event.getLevel() == Level.ERROR)
                .extracting(ILoggingEvent::getThrowableProxy)
                .extracting(ThrowableProxyUtil::asString)
                .singleElement()
                .asString()
                .contains(expectedFailure, "java.lang.IllegalArgumentException: root cause", "cleanup failed",
                        "PathOnlyErrorWebExceptionHandlerTest")
                .doesNotContain("s3cr3t-value", "id=42", "checkpoint");
    }

    @Test
    void handle_unexpectedFailure_noLoggedMessageCarriesTheQuery() {
        // setup
        String secret = "s3cr3t-value";

        // execution
        failingChain.handle(exchange).block();

        // verifications
        assertThat(appender.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .isNotEmpty()
                .noneMatch(message -> message.contains(secret));
    }

    @Test
    void handle_unexpectedFailure_respondsWithInternalServerError() {
        // setup
        HttpStatus expectedStatus = HttpStatus.INTERNAL_SERVER_ERROR;

        // execution
        failingChain.handle(exchange).block();

        // verifications
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(expectedStatus);
    }

    @Test
    void handle_unexpectedFailure_responseBodyKeepsThePathWithoutQuery() {
        // setup
        String expectedPath = "\"path\":\"" + PATH + "\"";

        // execution
        failingChain.handle(exchange).block();

        // verifications
        String body = exchange.getResponse().getBodyAsString().block();
        assertThat(body)
                .contains(expectedPath)
                .doesNotContain("s3cr3t-value");
    }
}
