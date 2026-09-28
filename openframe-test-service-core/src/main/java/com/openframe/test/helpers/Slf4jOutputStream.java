package com.openframe.test.helpers;

import org.slf4j.Logger;

import java.io.OutputStream;
import java.util.regex.Pattern;

// Redacts secrets on the way through: RestAssured's header blacklist misses cookies and form params, so this is the one choke point that catches all of them.
class Slf4jOutputStream extends OutputStream {

    // Session cookies and OAuth client secret printed by RestAssured outside the header blacklist, matched case-insensitively.
    private static final Pattern NAMED_SECRET =
            Pattern.compile("(?i)\\b(access_token|refresh_token|client_secret)=\\S+");

    // Same secrets in a JSON body, where NAMED_SECRET's name=value shape never matches.
    private static final Pattern JSON_SECRET = Pattern.compile(
            "(?i)(\"(?:access_?token|refresh_?token|id_?token|client_?secret|api_?key|initial_?key"
                    + "|password|secret|token)\"\\s*:\\s*\")[^\"]*(\")");

    // A bearer value anywhere in a line, where the header blacklist cannot reach.
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
        redacted = JSON_SECRET.matcher(redacted).replaceAll("$1" + REDACTED + "$2");
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
