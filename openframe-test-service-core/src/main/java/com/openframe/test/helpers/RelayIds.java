package com.openframe.test.helpers;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Relay global ids as the api-service encodes them: unpadded Base64 of {@code Typename:rawId}
 * (mirrors the dashboard's {@code toGlobalId} in {@code src/lib/relay-id.ts}). Mutation inputs on
 * {@code api/graphql} take global ids even where a query returns the raw id next to them — the
 * time-entry {@code user.id} / {@code userId} are raw, while {@code createTimeEntry.userId} and the
 * employee filters must be global.
 */
public final class RelayIds {

    private RelayIds() {
    }

    public static String toGlobalId(String typename, String rawId) {
        return Base64.getEncoder().withoutPadding()
                .encodeToString((typename + ":" + rawId).getBytes(StandardCharsets.UTF_8));
    }

    public static String userId(String rawUserId) {
        return toGlobalId("User", rawUserId);
    }

    /** {@code Typename:rawId} for a global id, or the input unchanged when it is not Base64. */
    public static String decode(String globalId) {
        try {
            return new String(Base64.getDecoder().decode(globalId), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return globalId;
        }
    }
}
