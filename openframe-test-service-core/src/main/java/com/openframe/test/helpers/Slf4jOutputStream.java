package com.openframe.test.helpers;

import org.slf4j.Logger;

import java.io.OutputStream;
import java.util.regex.Pattern;

/**
 * Bridges an {@link OutputStream} to an SLF4J {@link Logger}, emitting one log line per
 * newline-terminated chunk. Used to route RestAssured's request/response logging through SLF4J.
 *
 * <p><b>Redacts secrets on the way through.</b> RestAssured can blacklist headers, and
 * {@code RequestSpecHelper} does, but a header blacklist reaches neither cookies nor form params —
 * RestAssured prints those from its own model, in their own sections. So the session cookies and the
 * agent's client secret were logged in full, into the console, the pod log, Loki and the Slack run
 * report. Every line the request logger emits passes through here, which makes this the one place that
 * catches all of them regardless of which section they appear in.
 */
class Slf4jOutputStream extends OutputStream {

    /**
     * {@code name=value} secrets RestAssured prints outside the header blacklist: the session cookies
     * and the OAuth client secret. Case-insensitive because the cookie section and a {@code Set-Cookie}
     * header do not agree on case.
     */
    private static final Pattern NAMED_SECRET =
            Pattern.compile("(?i)\\b(access_token|refresh_token|client_secret)=\\S+");

    /** A bearer value anywhere in a line — a body or a param, where the header blacklist cannot reach. */
    private static final Pattern BEARER = Pattern.compile("(?i)(Bearer\\s+)\\S+");

    private static final String REDACTED = "<redacted>";

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

    /** Visible for testing: strips secret values while leaving the field name, so the shape still reads. */
    static String redact(String line) {
        String redacted = NAMED_SECRET.matcher(line).replaceAll("$1=" + REDACTED);
        return BEARER.matcher(redacted).replaceAll("$1" + REDACTED);
    }

    private void flushLine() {
        String line = buffer.toString();
        buffer.setLength(0);
        if (!line.isBlank()) {
            logger.info(redact(line));
        }
    }
}
