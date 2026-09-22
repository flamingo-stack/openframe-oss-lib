package com.openframe.test.api.external;

import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.customer.CreateCustomerRequest;
import com.openframe.test.data.dto.external.customer.CustomerResponse;
import com.openframe.test.data.dto.external.customer.CustomersResponse;
import com.openframe.test.data.dto.external.customer.UpdateCustomerRequest;
import com.openframe.test.data.dto.external.customer.UpdateCustomerStatusRequest;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static io.restassured.RestAssured.given;

/**
 * External API client for {@code /api/v1/customers}.
 *
 * <p>This resource was called {@code organizations} until the API renamed it; the old paths now 404,
 * with no compatibility shim. The rename also collapsed the two identifiers the old resource carried —
 * a Mongo {@code id} and a business {@code organizationId} — into a single {@code id} holding the
 * business UUID. That removes the trap the previous contract had, where {@code {id}} was documented as
 * taking "the ID" but rejected the {@code id} the response body returned.
 *
 * <p>Distinct from {@link com.openframe.test.api.OrganizationApi}, which still drives the internal
 * GraphQL API, where the resource is called organizations to this day.
 */
@Slf4j
public class ExternalCustomerApi {

    /** The gateway blip this environment produces on the customer write path. */
    private static final int HTTP_BAD_GATEWAY = 502;

    private static final String CUSTOMERS = "api/v1/customers";
    private static final String BY_ID = CUSTOMERS + "/{id}";
    private static final String STATUS = BY_ID + "/status";
    private static final String CAN_ARCHIVE = BY_ID + "/can-archive";

    public static CustomersResponse listCustomers() {
        return listCustomers(Map.of());
    }

    /** @param queryParams any documented filter/sort/paging params; empty map for defaults. */
    public static CustomersResponse listCustomers(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(CUSTOMERS)
                .then().statusCode(200)
                .extract().as(CustomersResponse.class);
    }

    /** Raw response, for cases asserting on status codes or headers rather than the body. */
    public static Response listCustomersRaw(Map<String, Object> queryParams) {
        return given(getExternalApiSpec()).queryParams(queryParams).get(CUSTOMERS);
    }

    /**
     * Creates a customer, recovering from the gateway 502s this environment intermittently produces on
     * the write path.
     *
     * <p>A 502 says nothing about whether the request reached the service, so a blind retry could leave
     * two customers behind — which is why {@link com.openframe.test.helpers.TransientGatewayRetryFilter}
     * refuses to retry POST. Here it is safe anyway, because the caller's {@code name} is unique per run
     * (see {@code ExternalTestData}): on a 502 this looks the record up by name first and adopts it if
     * the write actually landed, and only re-posts when it did not. The unique name is the idempotency
     * key the API itself does not offer.
     *
     * @param request must carry a name unique to this run, or the reconciliation below cannot be trusted
     */
    public static CustomerResponse createCustomer(CreateCustomerRequest request) {
        Response response = postCustomer(request);

        if (response.getStatusCode() == HTTP_BAD_GATEWAY) {
            log.warn("502 creating customer '{}'; reconciling by name before retrying", request.getName());
            CustomerResponse landed = findByExactName(request.getName());
            if (landed != null) {
                log.info("The create actually succeeded despite the 502; adopting {}", landed.getId());
                return landed;
            }
            response = postCustomer(request);
        }

        return response.then().statusCode(201).extract().as(CustomerResponse.class);
    }

    private static Response postCustomer(CreateCustomerRequest request) {
        return given(getExternalApiSpec()).body(request).post(CUSTOMERS);
    }

    /**
     * Exact-name lookup used only for 502 reconciliation. {@code search} is a substring match, so the
     * result is filtered down to an exact hit rather than trusted as-is.
     */
    private static CustomerResponse findByExactName(String name) {
        return listCustomers(Map.of("search", name, "limit", 20)).getCustomers().stream()
                .filter(customer -> name.equals(customer.getName()))
                .findFirst()
                .orElse(null);
    }

    public static ExternalErrorResponse attemptCreateCustomer(CreateCustomerRequest request, int expectedStatus) {
        return given(getExternalApiSpec())
                .body(request)
                .post(CUSTOMERS)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    public static CustomerResponse getCustomer(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .get(BY_ID)
                .then().statusCode(200)
                .extract().as(CustomerResponse.class);
    }

    public static ExternalErrorResponse attemptGetCustomer(String id, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .get(BY_ID)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    public static CustomerResponse updateCustomer(String id, UpdateCustomerRequest request) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(request)
                .put(BY_ID)
                .then().statusCode(200)
                .extract().as(CustomerResponse.class);
    }

    /** {@code true} when every device belonging to the customer is already archived or deleted. */
    public static boolean canArchive(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .get(CAN_ARCHIVE)
                .then().statusCode(200)
                .extract().as(Boolean.class);
    }

    /** 204 No Content on success. {@code status} is ACTIVE or ARCHIVED — archiving is reversible. */
    public static void updateStatus(String id, String status) {
        given(getExternalApiSpec())
                .pathParam("id", id)
                .body(UpdateCustomerStatusRequest.builder().status(status).build())
                .patch(STATUS)
                .then().statusCode(204);
    }

    public static Response updateStatusRaw(String id, String status) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(UpdateCustomerStatusRequest.builder().status(status).build())
                .patch(STATUS);
    }
}
