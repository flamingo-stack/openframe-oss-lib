package com.openframe.core.util;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

public final class PlainTextExcerpt {

    public static final String ELLIPSIS = "…";

    private static final Pattern FENCED_CODE = Pattern.compile("(?s)```.*?```|~~~.*?~~~");
    private static final Pattern HTML_TAG = Pattern.compile("(?s)<[^>]*>");
    private static final Pattern MARKDOWN_IMAGE = Pattern.compile("!\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern MARKDOWN_LINK = Pattern.compile("\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern AUTOLINK = Pattern.compile("<((?:https?|mailto):[^>]+)>");
    private static final Pattern REFERENCE_LINK = Pattern.compile("\\[([^\\]]*)]\\[[^\\]]*]");
    private static final Pattern INLINE_CODE = Pattern.compile("`+([^`]*)`+");
    private static final Pattern HEADING = Pattern.compile("(?m)^\\s{0,3}#{1,6}\\s*|(?<=\\s)#{1,6}\\s+");
    private static final Pattern SETEXT_UNDERLINE = Pattern.compile("(?m)^\\s{0,3}[=-]{2,}\\s*$");
    private static final Pattern BLOCKQUOTE = Pattern.compile("(?m)^\\s*>+\\s?");
    private static final Pattern LIST_MARKER = Pattern.compile("(?m)^\\s*(?:[-*+]|\\d{1,9}[.)])\\s+");
    private static final Pattern THEMATIC_BREAK = Pattern.compile("(?m)^\\s{0,3}(?:[-*_]\\s*){3,}$");
    private static final Pattern ASTERISK_EMPHASIS = Pattern.compile("(\\*{1,3})(?=\\S)(.*?)(?<=\\S)\\1");
    private static final Pattern STRIKETHROUGH = Pattern.compile("(~{1,2})(?=\\S)(.*?)(?<=\\S)\\1");
    private static final Pattern UNDERSCORE_EMPHASIS =
            Pattern.compile("(?<![\\w_])(_{1,3})(?=\\S)(.*?)(?<=\\S)\\1(?![\\w_])");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private PlainTextExcerpt() {
    }

    public static String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value;
        text = FENCED_CODE.matcher(text).replaceAll(" ");
        text = THEMATIC_BREAK.matcher(text).replaceAll(" ");
        text = SETEXT_UNDERLINE.matcher(text).replaceAll(" ");
        text = AUTOLINK.matcher(text).replaceAll("$1");
        text = HTML_TAG.matcher(text).replaceAll(" ");
        text = MARKDOWN_IMAGE.matcher(text).replaceAll("$1");
        text = MARKDOWN_LINK.matcher(text).replaceAll("$1");
        text = REFERENCE_LINK.matcher(text).replaceAll("$1");
        text = INLINE_CODE.matcher(text).replaceAll("$1");
        text = HEADING.matcher(text).replaceAll("");
        text = BLOCKQUOTE.matcher(text).replaceAll("");
        text = LIST_MARKER.matcher(text).replaceAll("");
        // Twice: `**_bold italic_**` needs the outer pair removed before the inner one matches.
        text = stripEmphasis(stripEmphasis(text));
        text = WHITESPACE.matcher(text).replaceAll(" ").trim();
        return text.isEmpty() ? null : text;
    }

    private static String stripEmphasis(String text) {
        String stripped = ASTERISK_EMPHASIS.matcher(text).replaceAll("$2");
        stripped = UNDERSCORE_EMPHASIS.matcher(stripped).replaceAll("$2");
        return STRIKETHROUGH.matcher(stripped).replaceAll("$2");
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
