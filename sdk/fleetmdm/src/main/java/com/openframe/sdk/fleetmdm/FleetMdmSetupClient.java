package com.openframe.sdk.fleetmdm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import com.openframe.sdk.fleetmdm.model.CreateUserRequest;
import com.openframe.sdk.fleetmdm.model.CreateUserResponse;
import com.openframe.sdk.fleetmdm.model.LoginRequest;
import com.openframe.sdk.fleetmdm.model.LoginResponse;
import com.openframe.sdk.fleetmdm.model.SetupRequest;
import com.openframe.sdk.fleetmdm.model.SetupResponse;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class FleetMdmSetupClient {

    private static final String SETUP_URL = "/api/v1/setup";
    private static final String LOGIN_URL = "/api/v1/fleet/login";
    private static final String CREATE_USER_URL = "/api/v1/fleet/users/admin";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String baseUrl;
    private final HttpClient httpClient;

    public FleetMdmSetupClient(String baseUrl) {
        this.baseUrl = baseUrl;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public SetupResponse setup(SetupRequest request) {
        HttpResponse<String> response = post(SETUP_URL, request, null);
        requireSuccess(response, "setup");
        return deserialize(response.body(), SetupResponse.class);
    }

    public LoginResponse login(LoginRequest request) {
        HttpResponse<String> response = post(LOGIN_URL, request, null);
        requireSuccess(response, "login");
        return deserialize(response.body(), LoginResponse.class);
    }

    public CreateUserResponse createApiOnlyUser(String adminToken, CreateUserRequest request) {
        HttpResponse<String> response = post(CREATE_USER_URL, request, adminToken);
        requireSuccess(response, "create API-only user");
        return deserialize(response.body(), CreateUserResponse.class);
    }

    private HttpResponse<String> post(String path, Object body, String bearerToken) {
        try {
            String json = MAPPER.writeValueAsString(body);
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + path))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json));
            if (bearerToken != null) {
                builder.header("Authorization", "Bearer " + bearerToken);
            }
            return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new FleetMdmException("HTTP POST " + path + " failed: " + e.getMessage(), e);
        }
    }

    private void requireSuccess(HttpResponse<String> response, String operation) {
        if (response.statusCode() / 100 != 2) {
            throw new FleetMdmApiException(
                    "Fleet " + operation + " failed with HTTP " + response.statusCode(),
                    response.statusCode(),
                    response.body()
            );
        }
    }

    private <T> T deserialize(String body, Class<T> type) {
        try {
            return MAPPER.readValue(body, type);
        } catch (Exception e) {
            throw new FleetMdmException("Failed to parse Fleet response", e);
        }
    }
}
