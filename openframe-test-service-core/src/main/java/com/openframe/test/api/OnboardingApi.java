package com.openframe.test.api;

import com.openframe.test.data.dto.onboarding.UserOnboardingProgress;
import com.openframe.test.data.dto.shared.GraphqlError;
import io.restassured.response.Response;

import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.OnboardingQueries.COMPLETE_USER_ONBOARDING;
import static com.openframe.test.api.graphql.OnboardingQueries.COMPLETE_USER_ONBOARDING_STEP;
import static com.openframe.test.api.graphql.OnboardingQueries.RESET_USER_ONBOARDING;
import static com.openframe.test.api.graphql.OnboardingQueries.SKIP_USER_ONBOARDING;
import static com.openframe.test.api.graphql.OnboardingQueries.USER_ONBOARDING_PROGRESS;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Personal Get Started onboarding client; the record is keyed by the signed-in user and tenant, so it only ever touches the caller's own progress.
public class OnboardingApi {

    public static UserOnboardingProgress getUserOnboardingProgress() {
        return progress(USER_ONBOARDING_PROGRESS, Map.of(), "userOnboardingProgress");
    }

    public static UserOnboardingProgress completeUserOnboardingStep(String step) {
        return progress(COMPLETE_USER_ONBOARDING_STEP, Map.of("step", step), "completeUserOnboardingStep");
    }

    public static UserOnboardingProgress completeUserOnboarding() {
        return progress(COMPLETE_USER_ONBOARDING, Map.of(), "completeUserOnboarding");
    }

    public static UserOnboardingProgress skipUserOnboarding() {
        return progress(SKIP_USER_ONBOARDING, Map.of(), "skipUserOnboarding");
    }

    public static UserOnboardingProgress resetUserOnboarding() {
        return progress(RESET_USER_ONBOARDING, Map.of(), "resetUserOnboarding");
    }

    // A step expected to be refused (a value outside UserOnboardingStep); returns the GraphQL errors.
    public static List<GraphqlError> attemptCompleteUserOnboardingStepErrors(String step) {
        Response response = send(COMPLETE_USER_ONBOARDING_STEP, Map.of("step", step));
        if (response.statusCode() != 200) {
            throw new AssertionError("api/graphql answered HTTP " + response.statusCode()
                    + " to completeUserOnboardingStep instead of 200 with a GraphQL error; body: "
                    + response.asString().replaceAll("\\s+", " ").strip());
        }
        List<GraphqlError> errors = response.jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }

    // Cleanup variants: they return the HTTP status and never throw.
    public static int attemptResetUserOnboarding() {
        return send(RESET_USER_ONBOARDING, Map.of()).statusCode();
    }

    public static int attemptCompleteUserOnboardingStep(String step) {
        return send(COMPLETE_USER_ONBOARDING_STEP, Map.of("step", step)).statusCode();
    }

    public static int attemptCompleteUserOnboarding() {
        return send(COMPLETE_USER_ONBOARDING, Map.of()).statusCode();
    }

    public static int attemptSkipUserOnboarding() {
        return send(SKIP_USER_ONBOARDING, Map.of()).statusCode();
    }

    private static UserOnboardingProgress progress(String document, Map<String, Object> variables, String field) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", document, "variables", variables)).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data." + field, UserOnboardingProgress.class);
    }

    private static Response send(String document, Map<String, Object> variables) {
        return given(getAuthorizedSpec()).body(Map.of("query", document, "variables", variables)).post(GRAPHQL);
    }
}
