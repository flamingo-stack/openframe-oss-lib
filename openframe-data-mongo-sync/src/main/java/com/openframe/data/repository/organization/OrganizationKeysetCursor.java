package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.bson.types.ObjectId;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

// Raw page cursor of the organization list: the active sort value plus the row id, so a page resumes exactly after the cursor row.
@Getter
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public final class OrganizationKeysetCursor {

    public static final String ID_FIELD = "_id";
    public static final String NAME_FIELD = "name";
    public static final String ORGANIZATION_ID_FIELD = "organizationId";
    public static final String CREATED_AT_FIELD = "createdAt";
    public static final String UPDATED_AT_FIELD = "updatedAt";
    public static final String INVALID_CURSOR_MESSAGE = "Invalid cursor";

    private static final String SEPARATOR = "_";

    private final Object sortValue;
    private final ObjectId id;

    public static String encode(Organization org, String sortField) {
        if (ID_FIELD.equals(sortField)) {
            return org.getId();
        }
        String encodedValue = encodeSortValue(org, sortField);
        return encodedValue + SEPARATOR + org.getId();
    }

    public static boolean isBareId(String raw) {
        return ObjectId.isValid(raw);
    }

    public static OrganizationKeysetCursor parse(String raw, String sortField) {
        if (ID_FIELD.equals(sortField)) {
            ObjectId id = parseId(raw);
            return new OrganizationKeysetCursor(null, id);
        }
        int separator = raw.lastIndexOf(SEPARATOR);
        if (separator < 0) {
            throw new IllegalArgumentException(INVALID_CURSOR_MESSAGE);
        }
        String encodedValue = raw.substring(0, separator);
        String idPart = raw.substring(separator + 1);
        Object sortValue = decodeSortValue(encodedValue, sortField);
        ObjectId id = parseId(idPart);
        return new OrganizationKeysetCursor(sortValue, id);
    }

    private static ObjectId parseId(String raw) {
        if (!ObjectId.isValid(raw)) {
            throw new IllegalArgumentException(INVALID_CURSOR_MESSAGE);
        }
        return new ObjectId(raw);
    }

    private static String encodeSortValue(Organization org, String sortField) {
        return switch (sortField) {
            case UPDATED_AT_FIELD -> millis(lastActivity(org));
            case CREATED_AT_FIELD -> millis(org.getCreatedAt());
            case NAME_FIELD -> base64(org.getName());
            case ORGANIZATION_ID_FIELD -> base64(org.getOrganizationId());
            default -> throw new IllegalArgumentException("Unsupported sort field: " + sortField);
        };
    }

    private static Object decodeSortValue(String encoded, String sortField) {
        return switch (sortField) {
            case UPDATED_AT_FIELD, CREATED_AT_FIELD -> parseMillis(encoded);
            case NAME_FIELD, ORGANIZATION_ID_FIELD -> decodeBase64(encoded);
            default -> throw new IllegalArgumentException("Unsupported sort field: " + sortField);
        };
    }

    private static Instant lastActivity(Organization org) {
        return org.getUpdatedAt() != null ? org.getUpdatedAt() : org.getCreatedAt();
    }

    private static String millis(Instant value) {
        long millis = value != null ? value.toEpochMilli() : 0L;
        return Long.toString(millis);
    }

    private static Instant parseMillis(String encoded) {
        try {
            long millis = Long.parseLong(encoded);
            return Instant.ofEpochMilli(millis);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(INVALID_CURSOR_MESSAGE, ex);
        }
    }

    // Base64 keeps a sort value that itself contains the separator (e.g. "Acme_Corp") unambiguous.
    private static String base64(String value) {
        String safeValue = value != null ? value : "";
        byte[] bytes = safeValue.getBytes(StandardCharsets.UTF_8);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static String decodeBase64(String encoded) {
        try {
            byte[] bytes = Base64.getDecoder().decode(encoded);
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(INVALID_CURSOR_MESSAGE, ex);
        }
    }
}
