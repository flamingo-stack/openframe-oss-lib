package com.openframe.gateway.config.ws;

import java.util.List;
import java.util.regex.Pattern;

/**
 * One allow pattern of {@link NatsSubjectFilterProperties}, compiled for one client.
 * <p>
 * Stricter than NATS permissions on purpose: {@code *} covers exactly one literal token, never a
 * wildcard the client sends, so {@code _INBOX.*.>} allows the {@code _INBOX.<nuid>.*} mux inbox of
 * nats.ws but not {@code _INBOX.*.*}, which would read every inbox of the tenant. {@code >} covers
 * the rest of the subject, wildcards included, so a client may subscribe {@code machine.<own id>.>}.
 */
final class NatsSubjectPattern {

    static final String ID_PLACEHOLDER = "{id}";

    private static final Pattern TOKEN_SEPARATOR = Pattern.compile("\\.");
    private static final String ANY_TOKEN = "*";
    private static final String REST_TOKEN = ">";

    private final List<String> tokens;

    private NatsSubjectPattern(List<String> tokens) {
        this.tokens = tokens;
    }

    static NatsSubjectPattern compile(String pattern, String id) {
        String substituted = pattern.replace(ID_PLACEHOLDER, id);
        String[] tokens = TOKEN_SEPARATOR.split(substituted, -1);
        return new NatsSubjectPattern(List.of(tokens));
    }

    boolean covers(String subject) {
        String[] subjectTokens = TOKEN_SEPARATOR.split(subject, -1);
        int index = 0;
        for (String token : tokens) {
            if (isRest(token)) {
                return hasTokensFrom(subjectTokens, index);
            }
            if (!hasTokensFrom(subjectTokens, index)) {
                return false;
            }
            if (!coversToken(token, subjectTokens[index])) {
                return false;
            }
            index++;
        }
        return index == subjectTokens.length;
    }

    private static boolean coversToken(String patternToken, String subjectToken) {
        if (isAny(patternToken)) {
            return isLiteral(subjectToken);
        }
        return patternToken.equals(subjectToken);
    }

    private static boolean hasTokensFrom(String[] subjectTokens, int index) {
        return index < subjectTokens.length;
    }

    private static boolean isLiteral(String token) {
        return !token.isEmpty() && !isAny(token) && !isRest(token);
    }

    private static boolean isAny(String token) {
        return ANY_TOKEN.equals(token);
    }

    private static boolean isRest(String token) {
        return REST_TOKEN.equals(token);
    }
}
