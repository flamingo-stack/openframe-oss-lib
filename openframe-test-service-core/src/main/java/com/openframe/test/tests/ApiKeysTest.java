package com.openframe.test.tests;

import com.openframe.test.api.ApiKeyApi;
import com.openframe.test.data.dto.apikey.ApiKeyResponse;
import com.openframe.test.data.dto.apikey.CreateApiKeyRequest;
import com.openframe.test.data.dto.apikey.CreateApiKeyResponse;
import com.openframe.test.data.dto.apikey.UpdateApiKeyRequest;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * API key management from Settings → API Keys (coverage plan item CP-43): a key of this case's own is
 * created, listed, edited, disabled, regenerated and deleted over {@code /api/api-keys}.
 *
 * <p>Keys are scoped to the calling user, so the list only ever holds the admin session's keys; every case
 * touches only the key it minted and deletes it in {@code finally}. Regenerating replaces the key with a
 * new {@code ak_*} id, so the id to clean up is updated after that call.
 */
@Tag("oss")
@Tag("api-keys")
@DisplayName("API keys")
public class ApiKeysTest extends BaseTest {

    @Tag("feature")
    @Test
    @DisplayName("Create, list, edit, regenerate and delete an API key")
    public void testApiKeyLifecycle() {
        String runId = RunId.next().value();
        String name = "E2E key " + runId;
        String keyId = null;
        try {
            CreateApiKeyResponse created = ApiKeyApi.createApiKey(CreateApiKeyRequest.builder()
                    .name(name)
                    .description("created by the E2E suite")
                    .build());
            ApiKeyResponse key = created.getApiKey();
            keyId = key.getId();
            assertThat(keyId).as("A key id is ak_-prefixed").startsWith("ak_");
            assertThat(key.getName()).as("The name is stored").isEqualTo(name);
            assertThat(key.getEnabled()).as("A new key is enabled").isTrue();
            assertThat(key.getTotalRequests()).as("A new key has no traffic").isZero();
            assertThat(created.getFullKey()).as("The secret is disclosed once, as <keyId>.sk_<secret>")
                    .startsWith(keyId + ".sk_");

            String originalId = keyId;
            assertThat(ApiKeyApi.getApiKeys()).extracting(ApiKeyResponse::getId)
                    .as("The new key is listed").contains(originalId);

            String newName = "E2E key renamed " + runId;
            Instant expiresAt = Instant.now().plus(30, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
            ApiKeyResponse updated = ApiKeyApi.updateApiKey(keyId, UpdateApiKeyRequest.builder()
                    .name(newName)
                    .description("edited by the E2E suite")
                    .expiresAt(expiresAt)
                    .build());
            assertThat(updated.getId()).as("Editing keeps the id").isEqualTo(originalId);
            assertThat(updated.getName()).as("The name is updated").isEqualTo(newName);
            assertThat(updated.getDescription()).as("The description is updated").isEqualTo("edited by the E2E suite");
            assertThat(updated.getExpiresAt()).as("The expiry is updated").isEqualTo(expiresAt);
            assertThat(updated.getEnabled()).as("An omitted enabled flag is kept").isTrue();
            assertThat(updated.getUpdatedAt()).as("Editing moves updatedAt").isAfterOrEqualTo(key.getUpdatedAt());

            ApiKeyResponse fetched = ApiKeyApi.getApiKey(keyId);
            assertThat(fetched.getName()).as("GET shows the new name").isEqualTo(newName);
            assertThat(fetched.getDescription()).as("GET shows the new description").isEqualTo("edited by the E2E suite");
            assertThat(fetched.getExpiresAt()).as("GET shows the new expiry").isEqualTo(expiresAt);

            CreateApiKeyResponse regenerated = ApiKeyApi.regenerateApiKey(keyId);
            keyId = regenerated.getApiKey().getId();
            assertThat(keyId).as("Regenerating issues a new key id").startsWith("ak_").isNotEqualTo(originalId);
            assertThat(regenerated.getFullKey()).as("The new secret belongs to the new key id")
                    .startsWith(keyId + ".sk_")
                    .isNotEqualTo(created.getFullKey());
            assertThat(secretOf(regenerated.getFullKey())).as("Regenerating issues a different secret")
                    .isNotEqualTo(secretOf(created.getFullKey()));
            assertThat(regenerated.getApiKey().getName()).as("Regenerating keeps the name").isEqualTo(newName);
            assertThat(regenerated.getApiKey().getDescription()).as("Regenerating keeps the description")
                    .isEqualTo("edited by the E2E suite");
            assertThat(regenerated.getApiKey().getExpiresAt()).as("Regenerating keeps the expiry").isEqualTo(expiresAt);
            assertThat(ApiKeyApi.getApiKeyRaw(originalId).getStatusCode())
                    .as("The replaced key id no longer resolves").isEqualTo(404);
            assertThat(ApiKeyApi.regenerateApiKeyRaw(originalId).getStatusCode())
                    .as("A replaced key cannot be regenerated again").isEqualTo(404);
            assertThat(ApiKeyApi.getApiKeys()).extracting(ApiKeyResponse::getId)
                    .as("The list holds the regenerated key in place of the original")
                    .contains(keyId).doesNotContain(originalId);

            ApiKeyApi.deleteApiKey(keyId);
            String deletedId = keyId;
            keyId = null;
            assertThat(ApiKeyApi.getApiKeyRaw(deletedId).getStatusCode())
                    .as("A deleted key is not found").isEqualTo(404);
            assertThat(ApiKeyApi.getApiKeys()).extracting(ApiKeyResponse::getId)
                    .as("A deleted key is no longer listed").doesNotContain(deletedId);
        } finally {
            if (keyId != null) {
                ApiKeyApi.deleteApiKeyRaw(keyId);
            }
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("Disable and re-enable an API key")
    public void testDisableApiKey() {
        String name = "E2E key " + RunId.next().value();
        String keyId = null;
        try {
            keyId = ApiKeyApi.createApiKey(CreateApiKeyRequest.builder()
                    .name(name)
                    .description("created by the E2E suite")
                    .build()).getApiKey().getId();

            ApiKeyResponse disabled = ApiKeyApi.updateApiKey(keyId, UpdateApiKeyRequest.builder().enabled(false).build());
            assertThat(disabled.getEnabled()).as("The key is disabled").isFalse();
            assertThat(disabled.getName()).as("An omitted name is kept").isEqualTo(name);
            assertThat(disabled.getDescription()).as("An omitted description is kept").isEqualTo("created by the E2E suite");

            Optional<ApiKeyResponse> listed = find(ApiKeyApi.getApiKeys(), keyId);
            assertThat(listed).as("A disabled key is still listed").isPresent();
            assertThat(listed.get().getEnabled()).as("The list reports the key as disabled").isFalse();
            assertThat(ApiKeyApi.getApiKey(keyId).getEnabled()).as("GET reports the key as disabled").isFalse();

            ApiKeyResponse enabled = ApiKeyApi.updateApiKey(keyId, UpdateApiKeyRequest.builder().enabled(true).build());
            assertThat(enabled.getEnabled()).as("The key is enabled again").isTrue();
            assertThat(find(ApiKeyApi.getApiKeys(), keyId)).as("The list reports the key as enabled again")
                    .hasValueSatisfying(k -> assertThat(k.getEnabled()).isTrue());
        } finally {
            if (keyId != null) {
                ApiKeyApi.deleteApiKeyRaw(keyId);
            }
        }
    }

    private static Optional<ApiKeyResponse> find(List<ApiKeyResponse> keys, String keyId) {
        return keys.stream().filter(k -> keyId.equals(k.getId())).findFirst();
    }

    /** The {@code sk_*} half of an {@code ak_<id>.sk_<secret>} key. */
    private static String secretOf(String fullKey) {
        return fullKey.substring(fullKey.indexOf('.') + 1);
    }
}
