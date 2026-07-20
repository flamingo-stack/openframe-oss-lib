package com.openframe.test.api;

import io.restassured.http.ContentType;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

public class AgentApi {

    private static final String ACTIVE_REGISTRATION_SECRET = "api/agent/registration-secret/active";

    /**
     * The tenant's active agent registration secret (the {@code initialKey} used to enroll a device).
     * Must be called authenticated as a user of the target tenant.
     */
    public static String getActiveRegistrationSecret() {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .get(ACTIVE_REGISTRATION_SECRET)
                .then().statusCode(200)
                .extract().jsonPath().getString("key");
    }
}
