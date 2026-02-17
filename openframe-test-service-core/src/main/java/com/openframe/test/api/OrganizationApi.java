package com.openframe.test.api;

import com.openframe.test.api.graphql.OrganizationQueries;
import com.openframe.test.data.dto.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.helpers.RequestSpecHelper;
import io.restassured.http.ContentType;

import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.OrganizationQueries.FULL_ORGANIZATION;
import static com.openframe.test.api.graphql.OrganizationQueries.ORGANIZATION_NAMES;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static io.restassured.RestAssured.given;

public class OrganizationApi {

    private static final String ORGANIZATIONS = "api/organizations";

    public static List<String> getOrganizationNames() {
        Map<String, String> body = Map.ofEntries(Map.entry("query", ORGANIZATION_NAMES));
        return given(RequestSpecHelper.getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().extract().jsonPath().getList("data.organizations.edges.node.name", String.class);
    }

    public static List<Organization> listOrganizations() {
        Map<String, String> body = Map.of("query", OrganizationQueries.ORGANIZATIONS);
        return given(RequestSpecHelper.getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().extract().jsonPath().getList("data.organizations.edges.node", Organization.class);
    }

    public static List<Organization> getOrganizations(boolean isDefault) {
        return listOrganizations().stream()
                .filter(org -> Boolean.valueOf(isDefault).equals(org.getIsDefault()))
                .toList();
    }

    public static Organization retrieveOrganization(String id) {
        Map<String, Object> body = Map.of(
                "query", FULL_ORGANIZATION,
                "variables", Map.of("id", id)
        );
        return given(RequestSpecHelper.getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().extract().jsonPath().getObject("data.organization", Organization.class);
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

    public static void deleteOrganization(Organization organization) {
        final String DELETE_ORGANIZATION = ORGANIZATIONS.concat("/").concat(organization.getId());
        given(RequestSpecHelper.getAuthorizedSpec()).contentType(ContentType.JSON)
                .delete(DELETE_ORGANIZATION)
                .then().statusCode(204);
    }
}
