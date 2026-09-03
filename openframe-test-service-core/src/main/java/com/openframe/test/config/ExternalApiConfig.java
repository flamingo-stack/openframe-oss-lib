package com.openframe.test.config;

import com.openframe.test.api.ApiKeyApi;
import com.openframe.test.data.dto.apikey.CreateApiKeyRequest;
import com.openframe.test.data.dto.apikey.CreateApiKeyResponse;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.UUID;

/**
 * The {@code X-API-Key} credential the External API ({@code /external-api/**}) suite runs as, and its
 * lifecycle.
 *
 * <p>The key is obtained from the first of these that yields one:
 * <ol>
 *   <li>an explicit {@link #configure(String)} call, for the downstream runner service;</li>
 *   <li>{@code TEST_EXTERNAL_API_KEY}, for a caller that wants to pin a specific key;</li>
 *   <li><b>a key the suite mints for itself</b> over {@code POST /api/api-keys}, as the ADMIN session
 *       the rest of the module already authenticates as.</li>
 * </ol>
 *
 * <p>Case 3 is the default, and the reason no secret has to be provisioned out of band to run this
 * suite. A self-minted key is deleted again by {@link #releaseProvisionedKey()} at the end of the run —
 * see {@link com.openframe.test.helpers.ExternalApiKeyExtension}, which is what calls it. A key supplied
 * by case 1 or 2 belongs to the caller and is never deleted.
 *
 * <p>The key is a two-part secret, {@code ak_<keyId>.sk_<secret>}. Only the {@code keyId} half is safe
 * to log, which is what {@link #getKeyId()} exists for — never log {@link #getApiKey()}.
 */
@Slf4j
public class ExternalApiConfig {

    private static final String API_KEY_ENV = "TEST_EXTERNAL_API_KEY";

    /** Names self-minted keys so an orphan left by a killed run is recognisable in the tenant's key list. */
    private static final String PROVISIONED_KEY_PREFIX = "e2e-external-api";

    private static final Object LOCK = new Object();

    private static String apiKey;
    /** The {@code ak_*} id of a key this class minted, and is therefore responsible for deleting. */
    private static String provisionedKeyId;

    public static void configure(String key) {
        synchronized (LOCK) {
            if (provisionedKeyId != null) {
                // Only reachable if a caller supplies a key mid-run, after one was already minted. Say so
                // rather than dropping the id quietly, because the id is the only handle on that key and
                // losing it leaks the key on the tenant.
                log.warn("Replacing the key minted for this run ({}) with a supplied one; {} will not be "
                        + "deleted automatically", provisionedKeyId, provisionedKeyId);
            }
            apiKey = key;
            provisionedKeyId = null;
        }
    }

    /**
     * The key for this run, minting one on first use if nothing was supplied.
     *
     * <p>Synchronized because test classes can run concurrently ({@code TestRunner.discover} takes a
     * parallelism) and two of them racing here would otherwise mint two keys, only one of which would
     * ever be cleaned up.
     */
    public static String getApiKey() {
        synchronized (LOCK) {
            if (apiKey == null) {
                apiKey = configuredKey();
            }
            if (apiKey == null) {
                apiKey = provisionKey();
            }
            return apiKey;
        }
    }

    /**
     * Whether the suite can obtain a key at all — either one was supplied, or there are admin
     * credentials to mint one with. Test classes gate on this via {@code @EnabledIf} so an environment
     * that cannot authenticate at all reports the External API cases as skipped rather than errored.
     */
    public static boolean canObtainApiKey() {
        return hasApiKey() || UserConfig.hasCredentials();
    }

    /** Whether a key is already available without minting one — supplied by the runner or the environment. */
    public static boolean hasApiKey() {
        synchronized (LOCK) {
            return (apiKey != null && provisionedKeyId == null) || configuredKey() != null;
        }
    }

    /** True once {@link #getApiKey()} has minted a key that {@link #releaseProvisionedKey()} owes a delete. */
    public static boolean isProvisioned() {
        synchronized (LOCK) {
            return provisionedKeyId != null;
        }
    }

    /**
     * Deletes the key this class minted, if it minted one, and forgets it.
     *
     * <p>Best-effort: a teardown failure is logged, never thrown. It must not turn a green run red, and
     * the worst case is one orphaned key named {@value #PROVISIONED_KEY_PREFIX}-* on the tenant.
     *
     * <p>Clearing {@link #apiKey} matters as much as the delete does. The runner service executes many
     * runs in one long-lived JVM, so a key left latched here after being deleted would make every
     * subsequent run authenticate with a credential the gateway no longer knows.
     */
    public static void releaseProvisionedKey() {
        synchronized (LOCK) {
            if (provisionedKeyId == null) {
                return;
            }
            String keyId = provisionedKeyId;
            provisionedKeyId = null;
            apiKey = null;
            try {
                Response response = ApiKeyApi.deleteApiKeyRaw(keyId);
                if (response.getStatusCode() == 204) {
                    log.info("Deleted the API key this run minted: {}", keyId);
                } else {
                    log.warn("Could not delete API key {} during teardown: HTTP {} {}",
                            keyId, response.getStatusCode(), response.getBody().asString());
                }
            } catch (Exception | AssertionError e) {
                // AssertionError as well as Exception: reaching the delete needs an ADMIN session, and a
                // failed login surfaces as a rest-assured AssertionError, which is an Error rather than
                // an Exception. Catching only Exception would let a broken login escape close() and turn
                // a finished run red during teardown.
                log.warn("Could not delete API key {} during teardown: {}", keyId, e.getMessage());
            }
        }
    }

    /** The public {@code ak_*} half of the key. Safe to log; identifies the key in gateway rate-limit buckets. */
    public static String getKeyId() {
        String key = getApiKey();
        int dot = key.indexOf('.');
        return dot > 0 ? key.substring(0, dot) : key;
    }

    /**
     * Key with the secret half elided, for log lines. Deliberately does <em>not</em> mint one — a
     * logging helper must not have the side effect of creating a credential. Reports {@code <unset>}
     * until something else has obtained the key.
     */
    public static String maskedKey() {
        synchronized (LOCK) {
            if (apiKey == null) {
                return "<unset>";
            }
            int dot = apiKey.indexOf('.');
            return (dot > 0 ? apiKey.substring(0, dot) : apiKey) + ".sk_****";
        }
    }

    private static String provisionKey() {
        String name = PROVISIONED_KEY_PREFIX + "-" + UUID.randomUUID().toString().substring(0, 8);
        CreateApiKeyResponse created = ApiKeyApi.createApiKey(CreateApiKeyRequest.builder()
                .name(name)
                .description("Ephemeral key minted by the External API E2E suite; deleted when the run ends")
                .build());

        provisionedKeyId = created.getApiKey().getId();
        log.info("Minted API key {} ('{}') for this run", provisionedKeyId, name);
        return created.getFullKey();
    }

    /** The supplied key, if there is one — never mints. */
    private static String configuredKey() {
        String envVar = System.getenv(API_KEY_ENV);
        return envVar == null || envVar.trim().isEmpty() ? null : envVar.trim();
    }
}
