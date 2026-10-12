package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Keyset position inside a knowledge base item listing.
 *
 * A listing is two ordered streams — folders (name asc, _id desc), then articles (updatedAt desc,
 * _id desc) — so a position names the stream it is in and carries that stream's sort key next to
 * the id. The key travels in the cursor instead of being re-read from the cursor document: the
 * listing's own row actions (rename, move, archive, delete) change or remove exactly that
 * document between two pages, and a position derived from it afterwards would skip or repeat rows.
 *
 * Serialized as {@code F:<id>:<url-encoded name>} for a folder and
 * {@code A:<id>:<updatedAt epoch millis>} for an article. The name is URL-encoded because the
 * cursor is base64'd afterwards and clients paste it into query strings: kept to that alphabet,
 * the base64 form never contains '+' or '/', which an unencoded query string would corrupt.
 * Cursors issued before the tag existed are a bare item id; {@link #parse} returns null for them
 * and the caller positions them off the document.
 */
public record KnowledgeBaseItemCursor(KnowledgeBaseItemType type, String id, String name, Instant updatedAt) {

    private static final String FOLDER_TAG = "F";
    private static final String ARTICLE_TAG = "A";
    private static final String SEPARATOR = ":";

    public static KnowledgeBaseItemCursor of(KnowledgeBaseItem item) {
        return item.getType() == KnowledgeBaseItemType.FOLDER
                ? new KnowledgeBaseItemCursor(KnowledgeBaseItemType.FOLDER, item.getId(), item.getName(), null)
                : new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, item.getId(), null, item.getUpdatedAt());
    }

    /** The position a tagged cursor names, or null when {@code raw} is not one. */
    public static KnowledgeBaseItemCursor parse(String raw) {
        if (raw == null) {
            return null;
        }
        String[] parts = raw.split(SEPARATOR, 3);
        if (parts.length < 2 || parts[1].isEmpty()) {
            return null;
        }
        String sortKey = parts.length == 3 ? parts[2] : "";
        if (FOLDER_TAG.equals(parts[0])) {
            String name = decodeName(sortKey);
            return name == null ? null : new KnowledgeBaseItemCursor(KnowledgeBaseItemType.FOLDER, parts[1], name, null);
        }
        if (ARTICLE_TAG.equals(parts[0])) {
            return new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, parts[1], null, parseEpochMillis(sortKey));
        }
        return null;
    }

    public String serialize() {
        if (type == KnowledgeBaseItemType.FOLDER) {
            return FOLDER_TAG + SEPARATOR + id + SEPARATOR
                    + URLEncoder.encode(name != null ? name : "", StandardCharsets.UTF_8);
        }
        return ARTICLE_TAG + SEPARATOR + id + SEPARATOR
                + (updatedAt != null ? String.valueOf(updatedAt.toEpochMilli()) : "");
    }

    private static String decodeName(String encoded) {
        try {
            return URLDecoder.decode(encoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static Instant parseEpochMillis(String value) {
        if (value.isEmpty()) {
            return null;
        }
        try {
            return Instant.ofEpochMilli(Long.parseLong(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
