package com.openframe.management.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.management.config.FleetMdmSetupProperties;
import com.openframe.sdk.fleetmdm.FleetMdmSetupClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.model.CreateUserRequest;
import com.openframe.sdk.fleetmdm.model.CreateUserResponse;
import com.openframe.sdk.fleetmdm.model.LoginRequest;
import com.openframe.sdk.fleetmdm.model.LoginResponse;
import com.openframe.sdk.fleetmdm.model.SetupRequest;
import com.openframe.sdk.fleetmdm.model.SetupResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class FleetApiKeyResolver {

    public static final String API_USER_NAME = "API Service User";
    public static final String API_USER_ROLE = "admin";

    private final FleetMdmSetupProperties fleetMdmSetupProperties;

    public String resolve(IntegratedTool tool) {
        String fleetUrl = extractApiUrl(tool);
        FleetMdmSetupClient client = new FleetMdmSetupClient(fleetUrl);

        ToolCredentials credentials = tool.getCredentials();

        String adminToken = setupOrLogin(client, credentials);
        return createOrLoginApiUser(client, credentials, adminToken);
    }

    private String extractApiUrl(IntegratedTool tool) {
        ToolUrl toolUrl = tool.getToolUrls().stream()
                .filter(u -> u.getType() == ToolUrlType.API)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No API URL configured for tool: " + tool.getName()));

        String url = toolUrl.getUrl();
        String port = toolUrl.getPort();
        if (port != null && !port.isBlank()) {
            return url + ":" + port;
        }
        return url;
    }

    private String setupOrLogin(FleetMdmSetupClient client, ToolCredentials credentials) {
        try {
            SetupRequest setupRequest = buildSetupRequest(credentials);
            SetupResponse setupResponse = client.setup(setupRequest);

            log.info("Fleet initial setup completed");
            return setupResponse.getToken();
        } catch (FleetMdmApiException e) {
            if (e.getStatusCode() >= 400 && e.getStatusCode() < 500) {
                log.info("Fleet already initialized (HTTP {}), logging in as admin", e.getStatusCode());

                LoginRequest adminLoginRequest = buildLoginRequest(credentials);
                return client.login(adminLoginRequest).getToken();
            }
            throw e;
        }
    }

    private SetupRequest buildSetupRequest(ToolCredentials credentials) {
        SetupRequest.AdminInfo admin = new SetupRequest.AdminInfo();
        admin.setEmail(credentials.getUsername());
        admin.setPassword(credentials.getPassword());
        admin.setName(fleetMdmSetupProperties.getAdminName());

        SetupRequest.OrgInfo orgInfo = new SetupRequest.OrgInfo();
        orgInfo.setOrgName(fleetMdmSetupProperties.getOrgName());

        SetupRequest request = new SetupRequest();
        request.setAdmin(admin);
        request.setOrgInfo(orgInfo);

        return request;
    }

    private String createOrLoginApiUser(FleetMdmSetupClient client, ToolCredentials credentials, String adminToken) {
        try {
            CreateUserRequest createUserRequest = buildCreateUserRequest(credentials);
            CreateUserResponse createUserResponse = client.createApiOnlyUser(adminToken, createUserRequest);

            log.info("API-only service user created");
            return createUserResponse.getToken();
        } catch (FleetMdmApiException e) {
            if (e.getStatusCode() >= 400 && e.getStatusCode() < 500) {
                log.info("API user already exists (HTTP {}), logging in", e.getStatusCode());
                LoginRequest loginRequest = buildLoginRequest(credentials);
                LoginResponse loginResponse = client.login(loginRequest);
                return loginResponse.getToken();
            }
            throw e;
        }
    }

    private CreateUserRequest buildCreateUserRequest(ToolCredentials credentials) {
        CreateUserRequest request = new CreateUserRequest();
        request.setEmail(credentials.getUsername());
        request.setPassword(credentials.getPassword());
        request.setName(API_USER_NAME);
        request.setGlobalRole(API_USER_ROLE);
        request.setApiOnly(true);
        return request;
    }

    private LoginRequest buildLoginRequest(ToolCredentials credentials) {
        LoginRequest request = new LoginRequest();
        request.setEmail(credentials.getUsername());
        request.setPassword(credentials.getPassword());
        return request;
    }

}
