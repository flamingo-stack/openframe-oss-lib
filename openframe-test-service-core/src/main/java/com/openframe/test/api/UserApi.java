package com.openframe.test.api;

import com.openframe.test.data.dto.error.ErrorResponse;
import com.openframe.test.data.dto.user.*;
import io.restassured.response.Response;

import java.util.List;
import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.getUnAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.getUnAuthorizedAuthSpec;
import static io.restassured.RestAssured.given;

public class UserApi {

    private static final String ME = "api/me";
    private static final String USERS = "api/users";
    private static final String PASSWORD_RESET = "sas/password-reset/request";
    private static final String CONFIRM_RESET = "sas/password-reset/confirm";

    public static MeResponse me() {
        return given(getAuthorizedSpec())
                .get(ME)
                .then().statusCode(200)
                .extract().as(MeResponse.class);
    }

    public static List<AuthUser> getUsers() {
        return given(getAuthorizedSpec())
                .get(USERS)
                .then().statusCode(200)
                .extract().jsonPath().getList("items", AuthUser.class);
    }

    public static List<AuthUser> getUsers(UserRole role) {
        return getUsers().stream()
                .filter(user -> user.getRoles() != null && user.getRoles().contains(role))
                .toList();
    }

    public static AuthUser getUser(String userId) {
        return given(getAuthorizedSpec())
                .get(USERS.concat("/").concat(userId))
                .then().statusCode(200)
                .extract().as(AuthUser.class);
    }

    public static AuthUser updateUser(String userId, UpdateUserRequest request) {
        return given(getAuthorizedSpec())
                .body(request)
                .put(USERS.concat("/").concat(userId))
                .then().statusCode(200)
                .extract().as(AuthUser.class);
    }

    public static ErrorResponse attemptUpdateUser(String userId, UpdateUserRequest request) {
        return given(getAuthorizedSpec())
                .body(request)
                .put(USERS.concat("/").concat(userId))
                .then().statusCode(400)
                .extract().as(ErrorResponse.class);
    }

    public static int deleteUser(String userId) {
        final String DELETE_USER = USERS.concat("/").concat(userId);
        return given(getAuthorizedSpec())
                .delete(DELETE_USER).statusCode();
    }

    public static void transferOwnership(String userId) {
        final String TRANSFER_OWNERSHIP = USERS.concat("/").concat(userId).concat("/transfer-ownership");
        given(getAuthorizedSpec())
                .post(TRANSFER_OWNERSHIP)
                .then().statusCode(204);
    }

    // The same transfer made from another user's session (cookies from AuthFlow.login).
    public static void transferOwnership(String userId, Map<String, String> cookies) {
        final String TRANSFER_OWNERSHIP = USERS.concat("/").concat(userId).concat("/transfer-ownership");
        given(getUnAuthorizedSpec())
                .cookies(cookies)
                .post(TRANSFER_OWNERSHIP)
                .then().statusCode(204);
    }

    // A transfer expected to be refused, or made by cleanup that must not throw: returns the raw response.
    public static Response attemptTransferOwnership(String userId) {
        final String TRANSFER_OWNERSHIP = USERS.concat("/").concat(userId).concat("/transfer-ownership");
        return given(getAuthorizedSpec())
                .post(TRANSFER_OWNERSHIP);
    }

    // The same, from another user's session (cookies from AuthFlow.login).
    public static Response attemptTransferOwnership(String userId, Map<String, String> cookies) {
        final String TRANSFER_OWNERSHIP = USERS.concat("/").concat(userId).concat("/transfer-ownership");
        return given(getUnAuthorizedSpec())
                .cookies(cookies)
                .post(TRANSFER_OWNERSHIP);
    }

    public static void resetPassword(User user) {
        // sas/* endpoints are served on the apex auth host, not the tenant subdomain.
        given(getUnAuthorizedAuthSpec())
                .body(Map.of("email", user.getEmail()))
                .post(PASSWORD_RESET)
                .then().statusCode(202);
    }

    public static void confirmReset(ResetConfirmRequest request) {
        given(getUnAuthorizedAuthSpec())
                .body(request)
                .post(CONFIRM_RESET)
                .then().statusCode(204);
    }

    public static ErrorResponse attemptConfirmReset(ResetConfirmRequest request) {
        return given(getUnAuthorizedAuthSpec())
                .body(request)
                .post(CONFIRM_RESET)
                .then().statusCode(400)
                .extract().as(ErrorResponse.class);
    }
}
