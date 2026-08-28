package com.openframe.test.api.external;

import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.external.organization.OrganizationResponse;
import com.openframe.test.data.dto.external.organization.OrganizationsResponse;
import com.openframe.test.data.dto.external.organization.UpdateOrganizationRequest;
import com.openframe.test.data.dto.external.organization.UpdateOrganizationStatusRequest;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static io.restassured.RestAssured.given;

/**
 * External API client for {@code /api/v1/organizations}.
 *
 * <p>Distinct from {@link com.openframe.test.api.OrganizationApi}, which drives the same domain over
 * the internal GraphQL API as an admin. Same entities, different contract, different auth.
 *
 * <p><b>Path parameter caveat.</b> Every route the contract spells {@code {id}} actually takes the
 * business {@code organizationId} (a UUID), not the {@code id} field the response body returns (a Mongo
 * ObjectId). Passing the latter yields 404 on the reads and 400 on the mutations. The methods here name
 * the parameter {@code organizationId} to keep that from being rediscovered every time.
 */
@Slf4j
public class ExternalOrganizationApi {

    /** The gateway blip this environment produces on the organization write path. */
    private static final int HTTP_BAD_GATEWAY = 502;

    private static final String ORGANIZATIONS = "api/v1/organizations";
    private static final String BY_ORGANIZATION_ID = ORGANIZATIONS + "/by-organization-id/{organizationId}";
    private static final String BY_ID = ORGANIZATIONS + "/{organizationId}";
    private static final String STATUS = BY_ID + "/status";
    private static final String CAN_ARCHIVE = BY_ID + "/can-archive";

    public static OrganizationsResponse listOrganizations() {
        return listOrganizations(Map.of());
    }

    /** @param queryParams any documented filter/sort/paging params; empty map for defaults. */
    public static OrganizationsResponse listOrganizations(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(ORGANIZATIONS)
                .then().statusCode(200)
                .extract().as(OrganizationsResponse.class);
    }

    /** Raw response, for cases asserting on status codes or headers rather than the body. */
    public static Response listOrganizationsRaw(Map<String, Object> queryParams) {
        return given(getExternalApiSpec()).queryParams(queryParams).get(ORGANIZATIONS);
    }

    /**
     * Creates an organization, recovering from the gateway 502s this environment intermittently produces
     * on the write path.
     *
     * <p>A 502 says nothing about whether the request reached the service, so a blind retry could leave
     * two organizations behind — which is why {@link TransientGatewayRetryFilter} refuses to retry POST.
     * Here it is safe anyway, because the caller's {@code name} is unique per run (see
     * {@code ExternalTestData}): on a 502 this looks the record up by name first and adopts it if the
     * write actually landed, and only re-posts when it did not. The unique name is the idempotency key
     * the API itself does not offer.
     *
     * @param request must carry a name unique to this run, or the reconciliation below cannot be trusted
     */
    public static OrganizationResponse createOrganization(CreateOrganizationRequest request) {
        Response response = postOrganization(request);

        if (response.getStatusCode() == HTTP_BAD_GATEWAY) {
            log.warn("502 creating organization '{}'; reconciling by name before retrying", request.getName());
            OrganizationResponse landed = findByExactName(request.getName());
            if (landed != null) {
                log.info("The create actually succeeded despite the 502; adopting {}", landed.getOrganizationId());
                return landed;
            }
            response = postOrganization(request);
        }

        return response.then().statusCode(201).extract().as(OrganizationResponse.class);
    }

    private static Response postOrganization(CreateOrganizationRequest request) {
        return given(getExternalApiSpec()).body(request).post(ORGANIZATIONS);
    }

    /**
     * Exact-name lookup used only for 502 reconciliation. {@code search} is a substring match, so the
     * result is filtered down to an exact hit rather than trusted as-is.
     */
    private static OrganizationResponse findByExactName(String name) {
        return listOrganizations(Map.of("search", name, "limit", 20)).getOrganizations().stream()
                .filter(organization -> name.equals(organization.getName()))
                .findFirst()
                .orElse(null);
    }

    public static ExternalErrorResponse attemptCreateOrganization(CreateOrganizationRequest request, int expectedStatus) {
        return given(getExternalApiSpec())
                .body(request)
                .post(ORGANIZATIONS)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    /** @param organizationId the business UUID, not the Mongo {@code id} from the response body. */
    public static OrganizationResponse getOrganizationById(String organizationId) {
        return given(getExternalApiSpec())
                .pathParam("organizationId", organizationId)
                .get(BY_ID)
                .then().statusCode(200)
                .extract().as(OrganizationResponse.class);
    }

    public static ExternalErrorResponse attemptGetOrganizationById(String organizationId, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("organizationId", organizationId)
                .get(BY_ID)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    public static OrganizationResponse getOrganizationByOrganizationId(String organizationId) {
        return given(getExternalApiSpec())
                .pathParam("organizationId", organizationId)
                .get(BY_ORGANIZATION_ID)
                .then().statusCode(200)
                .extract().as(OrganizationResponse.class);
    }

    /** @param organizationId the business UUID, not the Mongo {@code id}. */
    public static OrganizationResponse updateOrganization(String organizationId, UpdateOrganizationRequest request) {
        return given(getExternalApiSpec())
                .pathParam("organizationId", organizationId)
                .body(request)
                .put(BY_ID)
                .then().statusCode(200)
                .extract().as(OrganizationResponse.class);
    }

    /** {@code true} when every device in the organization is already archived or deleted. */
    public static boolean canArchive(String organizationId) {
        return given(getExternalApiSpec())
                .pathParam("organizationId", organizationId)
                .get(CAN_ARCHIVE)
                .then().statusCode(200)
                .extract().as(Boolean.class);
    }

    /** 204 No Content on success. {@code status} is ACTIVE or ARCHIVED — archiving is reversible. */
    public static void updateStatus(String organizationId, String status) {
        given(getExternalApiSpec())
                .pathParam("organizationId", organizationId)
                .body(UpdateOrganizationStatusRequest.builder().status(status).build())
                .patch(STATUS)
                .then().statusCode(204);
    }

    public static Response updateStatusRaw(String organizationId, String status) {
        return given(getExternalApiSpec())
                .pathParam("organizationId", organizationId)
                .body(UpdateOrganizationStatusRequest.builder().status(status).build())
                .patch(STATUS);
    }
}
