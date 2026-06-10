package com.openframe.test.helpers;

import org.slf4j.Logger;

import java.io.OutputStream;

/**
 * Bridges an {@link OutputStream} to an SLF4J {@link Logger}, emitting one log line per
 * newline-terminated chunk. Used to route RestAssured's request/response logging through SLF4J.
 */
class Slf4jOutputStream extends OutputStream {

    private final Logger logger;
    private final StringBuilder buffer = new StringBuilder();

    Slf4jOutputStream(Logger logger) {
        this.logger = logger;
    }

    @Override
    public void write(int b) {
        if (b == '\n') {
            flushLine();
        } else {
            buffer.append((char) b);
        }
    }

    @Override
    public void write(byte[] b, int off, int len) {
        for (int i = off; i < off + len; i++) {
            write(b[i]);
        }
    }

    @Override
    public void flush() {
        if (!buffer.isEmpty()) {
            flushLine();
        }
    }

    private void flushLine() {
        String line = buffer.toString();
        buffer.setLength(0);
        if (!line.isBlank()) {
            logger.info(line);
        }
    }
}
