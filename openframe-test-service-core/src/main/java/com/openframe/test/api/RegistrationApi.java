package com.openframe.test.api;

import com.openframe.test.data.dto.error.ErrorResponse;
import com.openframe.test.data.dto.user.UserRegistrationRequest;
import com.openframe.test.data.dto.user.UserRegistrationResponse;
import io.restassured.http.ContentType;

import static com.openframe.test.config.EnvironmentConfig.getRegistrationUrl;
import static io.restassured.RestAssured.given;

public class RegistrationApi {

    private static final String REGISTER = getRegistrationUrl() + "sas/oauth/register";

    public static UserRegistrationResponse registerUser(UserRegistrationRequest user) {
        return given().contentType(ContentType.JSON)
                .body(user).post(REGISTER)
                .then().statusCode(200)
                .extract().as(UserRegistrationResponse.class);
    }

    public static ErrorResponse attemptRegistration(UserRegistrationRequest user) {
        return given().contentType(ContentType.JSON)
                .body(user).post(REGISTER)
                .then().statusCode(400)
                .extract().as(ErrorResponse.class);
    }
}
