package com.openframe.test.helpers;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins {@link RelayIds#raw}: the e2e suite runs against the chat API both before the Relay migration
 * (raw ids) and after it (global ids), so every comparison goes through this and it must never touch a
 * raw id.
 */
class RelayIdsTest {

    private static final String OBJECT_ID = "665f1c2e9a3b4d0012345678";
    private static final String UUID_ID = "d3b07384-d9a1-4c2e-8f0a-5e6f7a8b9c0d";

    @Test
    @DisplayName("An unpadded base64url global id gives the raw id")
    void unwrapsUnpaddedBase64Url() {
        assertThat(RelayIds.raw("RGlhbG9nOjY2NWYxYzJlOWEzYjRkMDAxMjM0NTY3OA")).isEqualTo(OBJECT_ID);
        assertThat(RelayIds.raw(RelayIds.toGlobalId("Ticket", OBJECT_ID))).isEqualTo(OBJECT_ID);
        assertThat(RelayIds.raw(RelayIds.toGlobalId("Machine", UUID_ID))).isEqualTo(UUID_ID);
    }

    @Test
    @DisplayName("A padded or standard-alphabet encoding is unwrapped too")
    void unwrapsPaddedAndStandardAlphabet() {
        String padded = Base64.getEncoder().encodeToString(("TicketNote:" + OBJECT_ID).getBytes(StandardCharsets.UTF_8));
        assertThat(padded).endsWith("=");
        assertThat(RelayIds.raw(padded)).isEqualTo(OBJECT_ID);

        // ":~?" lands on a 6-bit group of 63: "/" in the standard alphabet, "_" in the url-safe one.
        String standard = Base64.getEncoder().encodeToString("Dialog:~?>".getBytes(StandardCharsets.UTF_8));
        String urlSafe = Base64.getUrlEncoder().withoutPadding().encodeToString("Dialog:~?>".getBytes(StandardCharsets.UTF_8));
        assertThat(standard).isNotEqualTo(urlSafe);
        assertThat(RelayIds.raw(standard)).isEqualTo("~?>");
        assertThat(RelayIds.raw(urlSafe)).isEqualTo("~?>");
    }

    @Test
    @DisplayName("A raw ObjectId or UUID comes back unchanged")
    void leavesRawIdsAlone() {
        assertThat(RelayIds.raw(OBJECT_ID)).isEqualTo(OBJECT_ID);
        assertThat(RelayIds.raw(UUID_ID)).isEqualTo(UUID_ID);
        assertThat(RelayIds.raw("e2e-never-assigned-1234")).isEqualTo("e2e-never-assigned-1234");
    }

    @Test
    @DisplayName("Text that is not Base64, or whose payload is not Typename:rawId, comes back unchanged")
    void leavesOtherInputAlone() {
        assertThat(RelayIds.raw("Tag:665f1c2e9a3b4d0012345678")).as("an already global tag id").isEqualTo("Tag:665f1c2e9a3b4d0012345678");
        assertThat(RelayIds.raw(encode("dialog:" + OBJECT_ID))).as("lower-case type name").isEqualTo(encode("dialog:" + OBJECT_ID));
        assertThat(RelayIds.raw(encode("Dialog:"))).as("empty raw part").isEqualTo(encode("Dialog:"));
        assertThat(RelayIds.raw(encode("no separator here"))).as("no separator").isEqualTo(encode("no separator here"));
        assertThat(RelayIds.raw("////")).as("Base64 of bytes that are not UTF-8").isEqualTo("////");
        assertThat(RelayIds.raw("abcde")).as("impossible Base64 length").isEqualTo("abcde");
    }

    @Test
    @DisplayName("Null and empty pass through")
    void passesNullAndEmptyThrough() {
        assertThat(RelayIds.raw(null)).isNull();
        assertThat(RelayIds.raw("")).isEmpty();
    }

    private static String encode(String text) {
        return Base64.getEncoder().withoutPadding().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }
}
