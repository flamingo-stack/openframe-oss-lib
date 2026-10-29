package com.openframe.core.exception;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.HttpRequestMethodNotSupportedException;

import static org.assertj.core.api.Assertions.assertThat;

/** A 4xx is the caller's mistake: WARN without a stack trace. A 5xx is ours: ERROR with it. */
class BaseGlobalExceptionHandlerLoggingTest {

    private final BaseGlobalExceptionHandler handler = new BaseGlobalExceptionHandler();
    private final Logger logger = (Logger) LoggerFactory.getLogger(BaseGlobalExceptionHandler.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

    @BeforeEach
    void attach() {
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detach() {
        logger.detachAppender(appender);
    }

    @Test
    void notFoundIsAWarningWithoutAStackTrace() {
        assertThat(handler.handleBaseException(new NotFoundException("Device x not found")).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);

        assertOnlyEvent(Level.WARN, "NOT_FOUND: Device x not found", false);
    }

    @Test
    void serverErrorIsAnErrorWithTheStackTrace() {
        handler.handleBaseException(new ServerFault("Fleet unreachable"));

        assertOnlyEvent(Level.ERROR, "INTERNAL_ERROR: Fleet unreachable", true);
    }

    @Test
    void unsupportedMethodIsAWarningWithoutAStackTrace() {
        handler.handleMethodNotSupported(new HttpRequestMethodNotSupportedException("DELETE"));

        assertThat(appender.list).singleElement().satisfies(event -> {
            assertThat(event.getLevel()).isEqualTo(Level.WARN);
            assertThat(event.getThrowableProxy()).isNull();
        });
    }

    @Test
    void illegalArgumentIsAWarningThatKeepsItsStackTrace() {
        handler.handleIllegalArgument(new IllegalArgumentException("Invalid UUID string: x"));

        assertOnlyEvent(Level.WARN, "Invalid request: Invalid UUID string: x", true);
    }

    private void assertOnlyEvent(Level level, String message, boolean withStackTrace) {
        assertThat(appender.list).singleElement().satisfies(event -> {
            assertThat(event.getLevel()).isEqualTo(level);
            assertThat(event.getFormattedMessage()).isEqualTo(message);
            assertThat(event.getThrowableProxy() != null).isEqualTo(withStackTrace);
        });
    }

    private static final class ServerFault extends BaseException {
        ServerFault(String message) {
            super(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR, message);
        }
    }
}
