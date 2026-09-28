package com.openframe.core.util;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

public class PlainText {

    public static final String ELLIPSIS = "…";

    // Rule order mirrors the web client's stripNotificationMarkup(); reorder here and the two surfaces drift.
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

    private static final String ALT_TEXT = "$1";
    private static final String LINK_TEXT = "$1";
    private static final String EMPHASISED_TEXT = "$2";
    private static final String CODE_BODY = "$1";

    private PlainText() {
    }

    public static String sanitize(String value) {
        if (!hasText(value)) {
            return null;
        }
        String stripped = stripMarkup(value);
        String collapsed = collapseWhitespace(stripped);
        return collapsed.isEmpty() ? null : collapsed;
    }

    public static String sanitizeAndExcerpt(String value, int maxChars) {
        String sanitized = sanitize(value);
        return excerpt(sanitized, maxChars);
    }

    public static String excerpt(String value, int maxChars) {
        if (value == null) {
            return null;
        }
        if (maxChars <= 0) {
            return value;
        }
        int length = value.length();
        if (length <= maxChars) {
            return value;
        }
        int ellipsisLength = ELLIPSIS.length();
        int budget = maxChars - ellipsisLength;
        if (budget <= 0) {
            return ELLIPSIS;
        }
        int cut = codePointSafeCut(value, budget);
        return excerptAt(value, cut);
    }

    public static String excerptToBytes(String value, int maxBytes) {
        if (value == null) {
            return null;
        }
        if (maxBytes <= 0) {
            return value;
        }
        int length = utf8Length(value);
        if (length <= maxBytes) {
            return value;
        }
        int ellipsisBytes = utf8Length(ELLIPSIS);
        int budget = maxBytes - ellipsisBytes;
        if (budget <= 0) {
            return "";
        }
        int cut = byteBudgetCut(value, budget);
        return excerptAt(value, cut);
    }

    private static String stripMarkup(String value) {
        String text = HTML_TAG.matcher(value).replaceAll("");
        text = MARKDOWN_IMAGE.matcher(text).replaceAll(ALT_TEXT);
        text = MARKDOWN_LINK.matcher(text).replaceAll(LINK_TEXT);
        text = EMPHASIS.matcher(text).replaceAll(EMPHASISED_TEXT);
        text = CODE.matcher(text).replaceAll(CODE_BODY);
        text = HEADING.matcher(text).replaceAll("");
        text = MID_LINE_HEADING.matcher(text).replaceAll(" ");
        text = BLOCKQUOTE.matcher(text).replaceAll("");
        return LIST_MARKER.matcher(text).replaceAll("");
    }

    // Notification and FCM push titles render on one line, so paragraph breaks collapse to spaces.
    private static String collapseWhitespace(String value) {
        return WHITESPACE.matcher(value).replaceAll(" ").trim();
    }

    private static String excerptAt(String value, int cut) {
        String head = value.substring(0, cut);
        String trimmed = isCutInsideWord(value, cut) ? backOffToWordBoundary(head) : head;
        String stripped = stripTrailingPunctuation(trimmed);
        return stripped + ELLIPSIS;
    }

    // Back off only when the cut lands inside a word — a cut already sitting on a space is a word
    // boundary, and backing off would drop a whole word for nothing.
    private static boolean isCutInsideWord(String value, int cut) {
        int length = value.length();
        if (cut >= length) {
            return false;
        }
        int codePoint = value.codePointAt(cut);
        return !Character.isWhitespace(codePoint);
    }

    private static String backOffToWordBoundary(String head) {
        int lastSpace = head.lastIndexOf(' ');
        return lastSpace > 0 ? head.substring(0, lastSpace) : head;
    }

    private static int codePointSafeCut(String value, int index) {
        char at = value.charAt(index);
        return Character.isLowSurrogate(at) ? index - 1 : index;
    }

    private static int byteBudgetCut(String value, int budget) {
        int length = value.length();
        int used = 0;
        int index = 0;
        while (index < length) {
            int codePoint = value.codePointAt(index);
            int cost = utf8Length(codePoint);
            if (used + cost > budget) {
                return index;
            }
            used += cost;
            index += Character.charCount(codePoint);
        }
        return length;
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

    private static int utf8Length(int codePoint) {
        char[] chars = Character.toChars(codePoint);
        String single = new String(chars);
        return utf8Length(single);
    }

    private static int utf8Length(String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        return bytes.length;
    }
}
