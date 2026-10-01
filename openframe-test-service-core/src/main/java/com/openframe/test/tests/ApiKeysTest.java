package com.openframe.test.tests;

import com.openframe.test.api.ApiKeyApi;
import com.openframe.test.data.dto.apikey.ApiKeyResponse;
import com.openframe.test.data.dto.apikey.CreateApiKeyRequest;
import com.openframe.test.data.dto.apikey.CreateApiKeyResponse;
import com.openframe.test.data.dto.apikey.UpdateApiKeyRequest;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * API key management from Settings → API Keys (coverage plan item CP-43): one key of this class's own is
 * walked through its states over {@code /api/api-keys} — created, listed, read, edited, disabled, re-enabled,
 * regenerated and deleted — one ordered case per state.
 *
 * <p>Keys are scoped to the calling user, so the list only ever holds the admin session's keys, and the class
 * touches only the key it minted. Regenerating replaces the key with a new {@code ak_*} id, so the id carried
 * to the later cases and to the {@link AfterAll} cleanup is updated there.
 */
@Tag("oss")
@Tag("api-keys")
@DisplayName("API keys")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ApiKeysTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final String NAME = "E2E key " + RUN_ID;
    private static final String DESCRIPTION = "created by the E2E suite";
    private static final String NEW_NAME = "E2E key renamed " + RUN_ID;
    private static final String NEW_DESCRIPTION = "edited by the E2E suite";
    private static final Instant EXPIRES_AT = Instant.now().plus(30, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

    private static CreateApiKeyResponse created;
    private static String keyId;
    private static String replacedKeyId;

    @Tag("feature")
    @Test
    @DisplayName("Create an API key")
    @Order(1)
    public void testCreateApiKey() {
        created = ApiKeyApi.createApiKey(CreateApiKeyRequest.builder()
                .name(NAME)
                .description(DESCRIPTION)
                .build());
        ApiKeyResponse key = created.getApiKey();
        keyId = key.getId();

        assertThat(keyId).as("A key id is ak_-prefixed").startsWith("ak_");
        assertThat(key.getName()).as("The name is stored").isEqualTo(NAME);
        assertThat(key.getDescription()).as("The description is stored").isEqualTo(DESCRIPTION);
        assertThat(key.getEnabled()).as("A new key is enabled").isTrue();
        assertThat(key.getTotalRequests()).as("A new key has no traffic").isZero();
        assertThat(created.getFullKey()).as("The secret is disclosed once, as <keyId>.sk_<secret>")
                .startsWith(keyId + ".sk_");
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("List API keys")
    @Order(2)
    public void testListApiKeys() {
        requireKey();

        Optional<ApiKeyResponse> listed = find(ApiKeyApi.getApiKeys(), keyId);

        assertThat(listed).as("The new key is listed").isPresent();
        assertThat(listed.get().getName()).as("The list shows the name").isEqualTo(NAME);
        assertThat(listed.get().getEnabled()).as("The list shows the key as enabled").isTrue();
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Get an API key")
    @Order(3)
    public void testGetApiKey() {
        requireKey();

        ApiKeyResponse fetched = ApiKeyApi.getApiKey(keyId);

        assertThat(fetched.getId()).as("GET returns the requested key").isEqualTo(keyId);
        assertThat(fetched.getName()).as("GET shows the name").isEqualTo(NAME);
        assertThat(fetched.getDescription()).as("GET shows the description").isEqualTo(DESCRIPTION);
        assertThat(fetched.getEnabled()).as("GET shows the key as enabled").isTrue();
    }

    @Tag("feature")
    @Test
    @DisplayName("Edit an API key")
    @Order(4)
    public void testEditApiKey() {
        requireKey();

        ApiKeyResponse updated = ApiKeyApi.updateApiKey(keyId, UpdateApiKeyRequest.builder()
                .name(NEW_NAME)
                .description(NEW_DESCRIPTION)
                .expiresAt(EXPIRES_AT)
                .build());

        assertThat(updated.getId()).as("Editing keeps the id").isEqualTo(keyId);
        assertThat(updated.getName()).as("The name is updated").isEqualTo(NEW_NAME);
        assertThat(updated.getDescription()).as("The description is updated").isEqualTo(NEW_DESCRIPTION);
        assertThat(updated.getExpiresAt()).as("The expiry is updated").isEqualTo(EXPIRES_AT);
        assertThat(updated.getEnabled()).as("An omitted enabled flag is kept").isTrue();
        assertThat(updated.getUpdatedAt()).as("Editing moves updatedAt")
                .isAfterOrEqualTo(created.getApiKey().getUpdatedAt());

        ApiKeyResponse fetched = ApiKeyApi.getApiKey(keyId);
        assertThat(fetched.getName()).as("GET shows the new name").isEqualTo(NEW_NAME);
        assertThat(fetched.getDescription()).as("GET shows the new description").isEqualTo(NEW_DESCRIPTION);
        assertThat(fetched.getExpiresAt()).as("GET shows the new expiry").isEqualTo(EXPIRES_AT);
    }

    @Tag("feature")
    @Test
    @DisplayName("Disable an API key")
    @Order(5)
    public void testDisableApiKey() {
        requireKey();

        ApiKeyResponse disabled = ApiKeyApi.updateApiKey(keyId, UpdateApiKeyRequest.builder().enabled(false).build());

        assertThat(disabled.getEnabled()).as("The key is disabled").isFalse();
        assertThat(disabled.getName()).as("An omitted name is kept").isEqualTo(NEW_NAME);
        assertThat(disabled.getDescription()).as("An omitted description is kept").isEqualTo(NEW_DESCRIPTION);
        assertThat(find(ApiKeyApi.getApiKeys(), keyId)).as("A disabled key is still listed, as disabled")
                .hasValueSatisfying(k -> assertThat(k.getEnabled()).isFalse());
        assertThat(ApiKeyApi.getApiKey(keyId).getEnabled()).as("GET reports the key as disabled").isFalse();
    }

    @Tag("feature")
    @Test
    @DisplayName("Re-enable a disabled API key")
    @Order(6)
    public void testEnableApiKey() {
        requireKey();

        ApiKeyResponse enabled = ApiKeyApi.updateApiKey(keyId, UpdateApiKeyRequest.builder().enabled(true).build());

        assertThat(enabled.getEnabled()).as("The key is enabled again").isTrue();
        assertThat(find(ApiKeyApi.getApiKeys(), keyId)).as("The list reports the key as enabled again")
                .hasValueSatisfying(k -> assertThat(k.getEnabled()).isTrue());
    }

    @Tag("feature")
    @Test
    @DisplayName("Regenerate an API key issues a new key id and secret with the same settings")
    @Order(7)
    public void testRegenerateApiKey() {
        requireKey();
        replacedKeyId = keyId;

        CreateApiKeyResponse regenerated = ApiKeyApi.regenerateApiKey(replacedKeyId);
        keyId = regenerated.getApiKey().getId();

        assertThat(keyId).as("Regenerating issues a new key id").startsWith("ak_").isNotEqualTo(replacedKeyId);
        assertThat(regenerated.getFullKey()).as("The new secret belongs to the new key id").startsWith(keyId + ".sk_");
        assertThat(secretOf(regenerated.getFullKey())).as("Regenerating issues a different secret")
                .isNotEqualTo(secretOf(created.getFullKey()));
        assertThat(regenerated.getApiKey().getName()).as("Regenerating keeps the name").isEqualTo(NEW_NAME);
        assertThat(regenerated.getApiKey().getDescription()).as("Regenerating keeps the description")
                .isEqualTo(NEW_DESCRIPTION);
        assertThat(regenerated.getApiKey().getExpiresAt()).as("Regenerating keeps the expiry").isEqualTo(EXPIRES_AT);
        assertThat(ApiKeyApi.getApiKeys()).extracting(ApiKeyResponse::getId)
                .as("The list holds the regenerated key in place of the original")
                .contains(keyId).doesNotContain(replacedKeyId);
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("A regenerated key's old id no longer resolves")
    @Order(8)
    public void testReplacedApiKeyIsGone() {
        assumeTrue(replacedKeyId != null,
                "No key was regenerated in \"Regenerate an API key issues a new key id and secret with the same settings\"; see that failure");

        assertThat(ApiKeyApi.getApiKeyRaw(replacedKeyId).getStatusCode())
                .as("The replaced key id is not found").isEqualTo(404);
        assertThat(ApiKeyApi.regenerateApiKeyRaw(replacedKeyId).getStatusCode())
                .as("A replaced key cannot be regenerated again").isEqualTo(404);
    }

    @Tag("feature")
    @Test
    @DisplayName("Delete an API key")
    @Order(9)
    public void testDeleteApiKey() {
        requireKey();
        String deletedId = keyId;

        ApiKeyApi.deleteApiKey(deletedId);
        keyId = null;

        assertThat(ApiKeyApi.getApiKeyRaw(deletedId).getStatusCode()).as("A deleted key is not found").isEqualTo(404);
        assertThat(ApiKeyApi.getApiKeys()).extracting(ApiKeyResponse::getId)
                .as("A deleted key is no longer listed").doesNotContain(deletedId);
    }

    /** Deletes the key when a case failed before "Delete an API key" did; the raw call never throws. */
    @AfterAll
    public static void cleanup() {
        if (keyId != null) {
            ApiKeyApi.deleteApiKeyRaw(keyId);
        }
    }

    private static void requireKey() {
        assumeTrue(keyId != null, "No API key was created in \"Create an API key\"; see that failure");
    }

    private static Optional<ApiKeyResponse> find(List<ApiKeyResponse> keys, String id) {
        return keys.stream().filter(k -> id.equals(k.getId())).findFirst();
    }

    /** The {@code sk_*} half of an {@code ak_<id>.sk_<secret>} key. */
    private static String secretOf(String fullKey) {
        return fullKey.substring(fullKey.indexOf('.') + 1);
    }
}
