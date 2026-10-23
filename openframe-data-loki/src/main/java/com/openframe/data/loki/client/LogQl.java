package com.openframe.data.loki.client;

/**
 * Builds LogQL literals from untrusted values. Every value placed into a query must go through here,
 * otherwise a quote in user input can widen the stream selector to other tenants' logs.
 */
public final class LogQl {

    private static final String REGEX_METACHARACTERS = "\\.+*?()|[]{}^$";

    private LogQl() {
    }

    /**
     * A double-quoted LogQL string literal holding {@code value} verbatim (Go string escaping).
     */
    public static String quote(String value) {
        StringBuilder quoted = new StringBuilder(value.length() + 2).append('"');
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"' -> quoted.append("\\\"");
                case '\\' -> quoted.append("\\\\");
                case '\n' -> quoted.append("\\n");
                case '\r' -> quoted.append("\\r");
                case '\t' -> quoted.append("\\t");
                default -> {
                    if (c < 0x20 || c == 0x7f) {
                        quoted.append(String.format("\\u%04x", (int) c));
                    } else {
                        quoted.append(c);
                    }
                }
            }
        }
        return quoted.append('"').toString();
    }

    /**
     * An RE2 pattern matching {@code value} literally; mirrors Go's {@code regexp.QuoteMeta}.
     * The result is a pattern, not a literal: wrap it with {@link #quote(String)} before use.
     */
    public static String regexLiteral(String value) {
        StringBuilder escaped = new StringBuilder(value.length() * 2);
        for (char c : value.toCharArray()) {
            if (REGEX_METACHARACTERS.indexOf(c) >= 0) {
                escaped.append('\\');
            }
            escaped.append(c);
        }
        return escaped.toString();
    }
}
