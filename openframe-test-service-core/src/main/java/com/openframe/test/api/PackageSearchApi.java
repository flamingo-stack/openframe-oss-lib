package com.openframe.test.api;

import com.openframe.test.data.dto.packagesearch.PackageDetails;
import com.openframe.test.data.dto.packagesearch.PackageSearchConnection;
import com.openframe.test.data.dto.shared.GraphqlError;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.PackageSearchQueries.PACKAGE_DETAILS;
import static com.openframe.test.api.graphql.PackageSearchQueries.SEARCH_PACKAGES;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * Client for the public package catalog: {@code searchPackages} over Homebrew, Chocolatey or winget and
 * {@code packageDetails} for one package. Read-only — nothing here writes tenant state. Package managers
 * are passed as their schema enum names (BREW, CHOCO, WINGET); {@code packageType} (FORMULA, CASK) is
 * BREW-only and may be null.
 */
public class PackageSearchApi {

    /** One page of matches; {@code after} is the previous page's {@code pageInfo.endCursor}, or null. */
    public static PackageSearchConnection searchPackages(String packageManager, String search, int first, String after) {
        JsonPath response = query(SEARCH_PACKAGES, searchVariables(packageManager, search, first, after));
        return response.getObject("data.searchPackages", PackageSearchConnection.class);
    }

    /** A search expected to be refused (a package manager the deployment disables); returns the GraphQL errors. */
    public static List<GraphqlError> attemptSearchPackagesErrors(String packageManager, String search, int first) {
        return errorsOf(SEARCH_PACKAGES, searchVariables(packageManager, search, first, null));
    }

    public static PackageDetails packageDetails(String packageManager, String packageId, String packageType) {
        JsonPath response = query(PACKAGE_DETAILS, detailsVariables(packageManager, packageId, packageType));
        return response.getObject("data.packageDetails", PackageDetails.class);
    }

    /** A lookup expected to be refused (unknown id, blank id, the wrong Homebrew type); returns the GraphQL errors. */
    public static List<GraphqlError> attemptPackageDetailsErrors(String packageManager, String packageId, String packageType) {
        return errorsOf(PACKAGE_DETAILS, detailsVariables(packageManager, packageId, packageType));
    }

    // ---- plumbing ----

    private static Map<String, Object> searchVariables(String packageManager, String search, int first, String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("packageManager", packageManager);
        variables.put("search", search);
        variables.put("first", first);
        if (after != null) {
            variables.put("after", after);
        }
        return variables;
    }

    private static Map<String, Object> detailsVariables(String packageManager, String packageId, String packageType) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("packageManager", packageManager);
        variables.put("packageId", packageId);
        if (packageType != null) {
            variables.put("packageType", packageType);
        }
        return variables;
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }

    /**
     * Sends a document without the success spec and returns its top-level GraphQL errors (never null).
     * A non-200 answer is a contract violation in its own right — GraphQL reports rejections as 200 +
     * errors — so it fails with the status and the body instead of a bare status mismatch.
     */
    private static List<GraphqlError> errorsOf(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        Response response = given(getAuthorizedSpec()).body(body).post(GRAPHQL);
        if (response.statusCode() != 200) {
            String operation = document.lines().findFirst().orElse("").trim();
            throw new AssertionError("api/graphql answered HTTP " + response.statusCode() + " to \"" + operation
                    + "\" instead of 200 with a GraphQL error; body: "
                    + response.asString().replaceAll("\\s+", " ").strip());
        }
        List<GraphqlError> errors = response.jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }
}
