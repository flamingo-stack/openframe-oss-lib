package com.openframe.test.helpers;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Relay global ids as the api-service encodes them: unpadded Base64 of {@code Typename:rawId}
 * (mirrors the dashboard's {@code toGlobalId} in {@code src/lib/relay-id.ts}). Mutation inputs on
 * {@code api/graphql} take global ids even where a query returns the raw id next to them — the
 * time-entry {@code user.id} / {@code userId} are raw, while {@code createTimeEntry.userId} and the
 * employee filters must be global.
 */
public final class RelayIds {

    private static final Pattern GLOBAL_ID_TEXT = Pattern.compile("^[A-Z][A-Za-z0-9]*:(.+)$");

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

    // The raw id inside a global id, as the External API takes it; returns the input unchanged if it is not Typename:rawId.
    public static String rawId(String globalId) {
        String decoded = decode(globalId);
        int separator = decoded.indexOf(':');
        return separator < 0 ? globalId : decoded.substring(separator + 1);
    }

    /**
     * The raw id behind an id that may or may not be a Relay global id, so a GraphQL {@code id} can be
     * compared with a raw id from REST, an {@code <entity>Id} field, a fixture or a notification — the
     * chat API answers raw ids before the Relay migration and global ids after it.
     *
     * <p>Accepts the unpadded base64url form the chat API emits as well as padded or standard-alphabet
     * Base64. Unlike {@link #rawId}, it unwraps only when the decoded text is valid UTF-8 shaped like
     * {@code Typename:rawId} (the type name starts with an upper-case letter), and otherwise returns the
     * input untouched: a Mongo ObjectId or a UUID can never decode to that shape, so a raw id passes
     * through whichever API version produced it. Use it for comparisons only; ids sent to the API stay
     * as received, because every id input takes either form.
     */
    public static String raw(String id) {
        if (id == null || id.isEmpty()) {
            return id;
        }
        String decoded = decodeUtf8(id);
        if (decoded == null) {
            return id;
        }
        Matcher global = GLOBAL_ID_TEXT.matcher(decoded);
        return global.matches() ? global.group(1) : id;
    }

    // The Base64 payload as UTF-8 text, or null when the input is not Base64 or does not decode to valid UTF-8.
    private static String decodeUtf8(String id) {
        try {
            byte[] bytes = Base64.getDecoder().decode(id.replace('-', '+').replace('_', '/'));
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (IllegalArgumentException | CharacterCodingException e) {
            return null;
        }
    }
}
