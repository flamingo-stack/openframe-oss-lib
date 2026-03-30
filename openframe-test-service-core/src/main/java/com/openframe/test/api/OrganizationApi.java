package com.openframe.test.api;

import com.openframe.test.api.graphql.OrganizationQueries;
import com.openframe.test.data.dto.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.helpers.RequestSpecHelper;
import io.restassured.http.ContentType;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.OrganizationQueries.ORGANIZATION_BY_ORGANIZATION_ID;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

public class OrganizationApi {

    private static final String ORGANIZATIONS = "api/organizations";

    public static List<Organization> listOrganizations() {
        List<Organization> allOrganizations = new ArrayList<>();
        String cursor = null;
        boolean hasNextPage = true;

        while (hasNextPage) {
            Map<String, Object> variables = new HashMap<>();
            variables.put("first", 100);
            if (cursor != null) {
                variables.put("after", cursor);
            }
            Map<String, Object> body = Map.of(
                    "query", OrganizationQueries.ORGANIZATIONS,
                    "variables", variables
            );

            var response = given(RequestSpecHelper.getAuthorizedSpec())
                    .body(body).post(GRAPHQL)
                    .then().spec(graphqlSuccess())
                    .extract().jsonPath();

            List<Organization> page = response.getList("data.organizations.edges.node", Organization.class);
            allOrganizations.addAll(page);

            hasNextPage = response.getObject("data.organizations.pageInfo.hasNextPage", Boolean.class);
            cursor = response.getString("data.organizations.pageInfo.endCursor");
        }

        return allOrganizations;
    }

    public static List<Organization> getOrganizations(boolean isDefault) {
        return listOrganizations().stream()
                .filter(org -> Boolean.valueOf(isDefault).equals(org.getIsDefault()))
                .toList();
    }

    public static Organization retrieveOrganizationByOrganizationId(String organizationId) {
        Map<String, Object> body = Map.of(
                "query", ORGANIZATION_BY_ORGANIZATION_ID,
                "variables", Map.of("organizationId", organizationId)
        );
        return given(RequestSpecHelper.getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.organizationByOrganizationId", Organization.class);
    }

    public static Organization createOrganization(CreateOrganizationRequest request) {
        return given(RequestSpecHelper.getAuthorizedSpec()).contentType(ContentType.JSON)
                .body(request).post(ORGANIZATIONS)
                .then().statusCode(201)
                .extract().as(Organization.class);
    }

    public static Organization updateOrganization(String id, CreateOrganizationRequest request) {
        final String UPDATE_ORGANIZATION = ORGANIZATIONS.concat("/").concat(id);
        return given(RequestSpecHelper.getAuthorizedSpec()).contentType(ContentType.JSON)
                .body(request).put(UPDATE_ORGANIZATION)
                .then().statusCode(200)
                .extract().as(Organization.class);
    }

    public static void archiveOrganization(Organization organization) {
        final String ARCHIVE_ORGANIZATION = ORGANIZATIONS.concat("/").concat(organization.getOrganizationId()).concat("/status");
        given(RequestSpecHelper.getAuthorizedSpec()).contentType(ContentType.JSON)
                .body(Map.of("status", "ARCHIVED"))
                .patch(ARCHIVE_ORGANIZATION)
                .then().statusCode(204);
    }
}
