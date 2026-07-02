package com.openframe.gateway.config.ws;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;

import java.nio.charset.StandardCharsets;

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

    @Test
    void shouldRenderBinaryPayloadAsPrintableTextWithoutConsumingIt() {
        // Arrange — 0x00,0x1e (non-printable, e.g. a 2-byte command prefix) + "Hi" + 0x00
        DataBuffer buf = new DefaultDataBufferFactory().wrap(new byte[]{0x00, 0x1e, 'H', 'i', 0x00});
        int positionBefore = buf.readPosition();
        int readableBefore = buf.readableByteCount();

        // Act
        String shown = LoggingWebSocketSessionDecorator.toPrintablePreview(buf, 1024);

        // Assert — printable chars kept, others become '.'
        assertThat(shown).isEqualTo("..Hi.");
        // non-consuming: the relay must still receive the full payload after the tap reads it
        assertThat(buf.readPosition()).isEqualTo(positionBefore);
        assertThat(buf.readableByteCount()).isEqualTo(readableBefore);
    }

    @Test
    void shouldRenderJsonOverBinaryFrameAsReadableText() {
        // A MeshCentral server->agent frame: JSON sent over a BINARY opcode.
        DataBuffer buf = new DefaultDataBufferFactory().wrap("{\"action\":\"serverInfo\"}".getBytes(StandardCharsets.US_ASCII));

        assertThat(LoggingWebSocketSessionDecorator.toPrintablePreview(buf, 1024)).isEqualTo("{\"action\":\"serverInfo\"}");
    }

    @Test
    void shouldTruncatePrintablePreviewToMaxChars() {
        DataBuffer buf = new DefaultDataBufferFactory().wrap(new byte[]{'a', 'b', 'c', 'd'});

        // maxChars=2 renders 2 bytes, suffix shows the full byte count
        assertThat(LoggingWebSocketSessionDecorator.toPrintablePreview(buf, 2)).isEqualTo("ab…(4 bytes total)");
    }
}
