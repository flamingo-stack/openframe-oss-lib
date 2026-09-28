package com.openframe.test.api;

import com.openframe.test.data.dto.apikey.ApiKeyResponse;
import com.openframe.test.data.dto.apikey.CreateApiKeyRequest;
import com.openframe.test.data.dto.apikey.CreateApiKeyResponse;
import io.restassured.response.Response;

import java.util.List;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

/**
 * Client for {@code /api/api-keys} — the internal API-service surface that mints the {@code X-API-Key}
 * credentials the External API authenticates with.
 *
 * <p>Authenticated as the ADMIN session like every other {@code api/*} facade, <em>not</em> with an API
 * key: this is the endpoint you call when you do not have one yet. Keys are scoped to the calling user,
 * so a key can only be read or deleted by the session that created it.
 */
public class ApiKeyApi {

    private static final String API_KEYS = "api/api-keys";
    private static final String BY_ID = API_KEYS + "/{keyId}";

    /**
     * Mints a key. The returned {@link CreateApiKeyResponse#getFullKey()} is the only time the secret is
     * ever disclosed — the service stores it hashed — so a caller that means to use the key must keep it.
     */
    public static CreateApiKeyResponse createApiKey(CreateApiKeyRequest request) {
        return given(getAuthorizedSpec())
                .body(request)
                .post(API_KEYS)
                .then().statusCode(201)
                .extract().as(CreateApiKeyResponse.class);
    }

    public static List<ApiKeyResponse> getApiKeys() {
        return given(getAuthorizedSpec())
                .get(API_KEYS)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", ApiKeyResponse.class);
    }

    public static ApiKeyResponse getApiKey(String keyId) {
        return given(getAuthorizedSpec())
                .pathParam("keyId", keyId)
                .get(BY_ID)
                .then().statusCode(200)
                .extract().as(ApiKeyResponse.class);
    }

    /** Deletes the key and its statistics document. */
    public static void deleteApiKey(String keyId) {
        deleteApiKeyRaw(keyId).then().statusCode(204);
    }

    /** Raw form, for teardown paths that want to report a failure rather than throw on one. */
    public static Response deleteApiKeyRaw(String keyId) {
        return given(getAuthorizedSpec())
                .pathParam("keyId", keyId)
                .delete(BY_ID);
    }
}
