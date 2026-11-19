package com.openframe.client.service.rmm;

import lombok.experimental.UtilityClass;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Hides the OpenFrame launch credential in diagnostics, including quoted values wrapped by PowerShell. */
@UtilityClass
final class OpenFrameSecretRedactor {

    private static final Pattern SECRET_OPTION =
            Pattern.compile("(?<!\\S)--openframe-secret(?=\\s|=|\\z)", Pattern.CASE_INSENSITIVE);
    private static final String HIDDEN_VALUE = "[REDACTED]";

    static String redactOpenFrameSecret(String text) {
        Matcher option = SECRET_OPTION.matcher(text);
        if (!option.find()) {
            return text;
        }

        StringBuilder redacted = new StringBuilder(text.length());
        int copyFrom = 0;
        do {
            copyFrom = appendRedactedValue(text, copyFrom, option.end(), redacted);
        } while (option.find(copyFrom));

        return redacted.append(text, copyFrom, text.length()).toString();
    }

    private static int appendRedactedValue(String text, int copyFrom, int optionEnd, StringBuilder redacted) {
        int valueStart = findValueStart(text, optionEnd);
        if (valueStart == optionEnd) {
            redacted.append(text, copyFrom, optionEnd);
            return optionEnd;
        }

        char first = text.charAt(valueStart);
        boolean quoted = isQuote(first);
        int contentStart = quoted ? valueStart + 1 : valueStart;
        int contentEnd = quoted ? quotedValueEnd(text, contentStart, first) : unquotedValueEnd(text, contentStart);
        redacted.append(text, copyFrom, contentStart);
        if (contentEnd > contentStart) {
            redacted.append(HIDDEN_VALUE);
        }
        return contentEnd;
    }

    private static int findValueStart(String text, int optionEnd) {
        int start = skipHorizontalSpace(text, optionEnd);
        boolean assigned = isAt(text, start, '=');
        if (assigned) {
            start = skipHorizontalSpace(text, start + 1);
        }
        if (start == text.length()) {
            return optionEnd;
        }
        if (isLineBreak(text.charAt(start))) {
            int continued = indentedContinuationStart(text, start);
            boolean hasWrappedQuotedValue = continued < text.length() && isQuote(text.charAt(continued));
            return hasWrappedQuotedValue ? continued : optionEnd;
        }
        boolean startsAnotherOption = !assigned && text.startsWith("--", start);
        return startsAnotherOption ? optionEnd : start;
    }

    private static int quotedValueEnd(String text, int start, char quote) {
        int cursor = start;
        int next = nextQuotedPart(text, cursor, quote);
        while (next > cursor) {
            cursor = next;
            next = nextQuotedPart(text, cursor, quote);
        }
        return cursor;
    }

    private static int nextQuotedPart(String text, int cursor, char quote) {
        if (cursor == text.length()) {
            return cursor;
        }
        char current = text.charAt(cursor);
        if (current == quote) {
            return isAt(text, cursor + 1, quote) ? cursor + 2 : cursor;
        }
        boolean startsEscape = quote == '"' && current == '\\';
        if (startsEscape) {
            return afterEscapedCharacter(text, cursor + 1);
        }
        return isLineBreak(current) ? indentedContinuationStart(text, cursor) : cursor + 1;
    }

    private static int afterEscapedCharacter(String text, int cursor) {
        int continued = indentedContinuationStart(text, cursor);
        while (continued > cursor) {
            cursor = continued;
            continued = indentedContinuationStart(text, cursor);
        }
        boolean atValueBoundary = cursor == text.length() || isLineBreak(text.charAt(cursor));
        return atValueBoundary ? cursor : cursor + 1;
    }

    private static int unquotedValueEnd(String text, int cursor) {
        while (isUnquotedValueCharacter(text, cursor)) {
            cursor++;
        }
        return cursor;
    }

    private static boolean isUnquotedValueCharacter(String text, int cursor) {
        return cursor < text.length() && !Character.isWhitespace(text.charAt(cursor));
    }

    private static int indentedContinuationStart(String text, int lineBreak) {
        boolean noLineBreak = lineBreak == text.length() || !isLineBreak(text.charAt(lineBreak));
        if (noLineBreak) {
            return lineBreak;
        }
        int start = lineBreak + (text.startsWith("\r\n", lineBreak) ? 2 : 1);
        int afterIndent = skipHorizontalSpace(text, start);
        return afterIndent == start ? lineBreak : afterIndent;
    }

    private static int skipHorizontalSpace(String text, int cursor) {
        while (isHorizontalSpace(text, cursor)) {
            cursor++;
        }
        return cursor;
    }

    private static boolean isHorizontalSpace(String text, int cursor) {
        return isAt(text, cursor, ' ') || isAt(text, cursor, '\t');
    }

    private static boolean isAt(String text, int index, char expected) {
        return index < text.length() && text.charAt(index) == expected;
    }

    private static boolean isLineBreak(char character) {
        return character == '\r' || character == '\n';
    }

    private static boolean isQuote(char character) {
        return character == '"' || character == '\'';
    }
}
