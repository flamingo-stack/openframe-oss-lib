package com.openframe.test.api;

import com.openframe.test.data.dto.user.User;

import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthFlowRequestSpec;
import static io.restassured.RestAssured.given;

public class TenantApi {
    private static final String DISCOVER = "sas/tenant/discover";

    public static String discoverTenant(User user) {
        return given(getAuthFlowRequestSpec())
                .baseUri(getAuthUrl())
                .queryParam("email", user.getEmail())
                .get(DISCOVER)
                .then().statusCode(200)
                .extract().jsonPath().get("tenant_id");
    }
}
