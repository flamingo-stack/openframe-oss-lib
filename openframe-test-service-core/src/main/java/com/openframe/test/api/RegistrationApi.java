package com.openframe.test.api;

import com.openframe.test.data.dto.error.ErrorResponse;
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

    public static ErrorResponse attemptRegistration(UserRegistrationRequest user) {
        // A registration that conflicts with a just-registered tenant (same domain / existing owner)
        // returns 409 Conflict while that tenant is still provisioning — which is exactly when the
        // negative registration tests run (right after registration). (An established tenant returns 400.)
        return given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(user).post(REGISTER)
                .then().statusCode(409)
                .extract().as(ErrorResponse.class);
    }
}
