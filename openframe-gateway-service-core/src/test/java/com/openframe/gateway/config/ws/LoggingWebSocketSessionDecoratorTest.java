package com.openframe.gateway.config.ws;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoggingWebSocketSessionDecoratorTest {

    @Test
    void shouldAppendLengthSuffixWhenTextExceedsMax() {
        // Arrange
        String text = "0123456789";

        // Act
        String shown = LoggingWebSocketSessionDecorator.truncate(text, 4);

        // Assert
        assertThat(shown).isEqualTo("0123...(10 chars)");
    }

    @Test
    void shouldReturnTextUnchangedWhenWithinMax() {
        // Arrange
        String text = "short";

        // Act / Assert
        assertThat(LoggingWebSocketSessionDecorator.truncate(text, 1024)).isEqualTo("short");
        assertThat(LoggingWebSocketSessionDecorator.truncate(text, 5)).isEqualTo("short");
    }

    @Test
    void shouldReturnTextUnchangedWhenMaxIsNonPositive() {
        // Arrange
        String text = "0123456789";

        // Act / Assert
        assertThat(LoggingWebSocketSessionDecorator.truncate(text, 0)).isEqualTo(text);
        assertThat(LoggingWebSocketSessionDecorator.truncate(text, -1)).isEqualTo(text);
    }
}
