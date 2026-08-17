package com.openframe.core.util;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

public final class PlainText {

    public static final String ELLIPSIS = "…";

    // Rules 1-9 below mirror the web client's stripNotificationMarkup(), pattern for pattern and in
    // the same order, so a notification reads identically in the app and in a push. Any change here
    // has to be made there too, or the two surfaces drift apart.
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    private static final Pattern MARKDOWN_IMAGE = Pattern.compile("!\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern MARKDOWN_LINK = Pattern.compile("\\[([^\\]]+)]\\([^)]*\\)");
    private static final Pattern EMPHASIS = Pattern.compile("(\\*{1,3}|_{1,3}|~~)(\\S(?:.*?\\S)?)\\1");
    private static final Pattern CODE = Pattern.compile("`{1,3}([^`]*)`{1,3}");
    private static final Pattern HEADING = Pattern.compile("(?m)^[^\\S\\n]{0,3}#{1,6}[^\\S\\n]+");
    private static final Pattern MID_LINE_HEADING = Pattern.compile("[^\\S\\n]#{2,6}[^\\S\\n]+");
    private static final Pattern BLOCKQUOTE = Pattern.compile("(?m)^[^\\S\\n]{0,3}>[^\\S\\n]?");
    private static final Pattern LIST_MARKER = Pattern.compile("(?m)^[^\\S\\n]{0,3}(?:[-*+]|\\d+\\.)[^\\S\\n]+");

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private PlainText() {
    }

    public static String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value;
        text = HTML_TAG.matcher(text).replaceAll("");
        text = MARKDOWN_IMAGE.matcher(text).replaceAll("$1");
        text = MARKDOWN_LINK.matcher(text).replaceAll("$1");
        text = EMPHASIS.matcher(text).replaceAll("$2");
        text = CODE.matcher(text).replaceAll("$1");
        text = HEADING.matcher(text).replaceAll("");
        text = MID_LINE_HEADING.matcher(text).replaceAll(" ");
        text = BLOCKQUOTE.matcher(text).replaceAll("");
        text = LIST_MARKER.matcher(text).replaceAll("");
        text = WHITESPACE.matcher(text).replaceAll(" ").trim();
        return text.isEmpty() ? null : text;
    }

    public static String sanitizeAndExcerpt(String value, int maxChars) {
        return excerpt(sanitize(value), maxChars);
    }

    public static String excerpt(String value, int maxChars) {
        if (value == null || maxChars <= 0 || value.length() <= maxChars) {
            return value;
        }
        int budget = maxChars - ELLIPSIS.length();
        if (budget <= 0) {
            return ELLIPSIS;
        }
        int cut = safeSplit(value, budget);
        String head = value.substring(0, cut);
        // Back off to the previous word only when the cut lands *inside* one — a cut that already
        // sits on a space is a word boundary, and backing off would drop a whole word for nothing.
        if (!Character.isWhitespace(value.charAt(cut))) {
            int lastSpace = head.lastIndexOf(' ');
            if (lastSpace > 0) {
                head = head.substring(0, lastSpace);
            }
        }
        return stripTrailingPunctuation(head) + ELLIPSIS;
    }

    public static String excerptToBytes(String value, int maxBytes) {
        if (value == null || maxBytes <= 0 || utf8Length(value) <= maxBytes) {
            return value;
        }
        int budget = maxBytes - utf8Length(ELLIPSIS);
        if (budget <= 0) {
            return "";
        }
        StringBuilder kept = new StringBuilder();
        int used = 0;
        boolean cutInsideWord = false;
        for (int i = 0; i < value.length(); ) {
            int codePoint = value.codePointAt(i);
            int cost = utf8Length(new String(Character.toChars(codePoint)));
            if (used + cost > budget) {
                cutInsideWord = !Character.isWhitespace(codePoint);
                break;
            }
            kept.appendCodePoint(codePoint);
            used += cost;
            i += Character.charCount(codePoint);
        }
        if (cutInsideWord) {
            int lastSpace = kept.lastIndexOf(" ");
            if (lastSpace > 0) {
                kept.setLength(lastSpace);
            }
        }
        return stripTrailingPunctuation(kept.toString()) + ELLIPSIS;
    }

    private static int safeSplit(String value, int index) {
        return Character.isLowSurrogate(value.charAt(index)) ? index - 1 : index;
    }

    private static String stripTrailingPunctuation(String value) {
        int end = value.length();
        while (end > 0 && isTrailingPunctuation(value.charAt(end - 1))) {
            end--;
        }
        return value.substring(0, end);
    }

    private static boolean isTrailingPunctuation(char c) {
        return Character.isWhitespace(c) || c == ',' || c == ';' || c == ':' || c == '.' || c == '-';
    }

    private static int utf8Length(String value) {
        return value.getBytes(StandardCharsets.UTF_8).length;
    }
}
