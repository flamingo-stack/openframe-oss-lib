package com.openframe.test.api;

import com.openframe.test.data.dto.user.UserRegistrationRequest;
import com.openframe.test.data.dto.user.UserRegistrationResponse;
import io.restassured.http.ContentType;
import io.restassured.response.Response;

import static com.openframe.test.config.EnvironmentConfig.getRegistrationUrl;
import static io.restassured.RestAssured.given;

public class RegistrationApi {

    private static final String REGISTER = getRegistrationUrl() + "sas/oauth/register";

    public static UserRegistrationResponse registerUser(UserRegistrationRequest user) {
        Response response = given()
                .log().ifValidationFails()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(user).post(REGISTER);
        return response
                .then().statusCode(200)
                .extract().as(UserRegistrationResponse.class);
    }

    /**
     * Attempts a registration expected to be rejected and returns the HTTP status code. The exact code
     * varies with tenant state — a conflict with a still-provisioning tenant returns 409, an established
     * tenant returns 400 — so callers assert only that it is a client/server error ({@code >= 400}).
     */
    public static int attemptRegistration(UserRegistrationRequest user) {
        return given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(user).post(REGISTER)
                .then()
                .extract().statusCode();
    }
}
