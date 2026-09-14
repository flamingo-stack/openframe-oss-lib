package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalCustomerApi;
import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.customer.CreateCustomerRequest;
import com.openframe.test.data.dto.external.customer.CustomerResponse;
import com.openframe.test.data.dto.external.customer.CustomersResponse;
import com.openframe.test.data.dto.external.customer.UpdateCustomerRequest;
import com.openframe.test.data.generator.external.ExternalCustomerGenerator;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * {@code /api/v1/customers} — full lifecycle.
 *
 * <p>This resource was {@code organizations} until the API renamed it; the old paths now 404 outright.
 * The rename also collapsed the old pair of identifiers (a Mongo {@code id} plus a business
 * {@code organizationId}) into a single {@code id} carrying the business UUID, and dropped the
 * {@code by-organization-id} lookup that existed only to reach the second one.
 *
 * <p>Ordered: the create case publishes the customer the later cases read, update, and archive, so the
 * suite never touches a record it did not make. {@link #cleanup()} archives anything left over if a
 * case fails partway.
 */
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("ExtApi: External API - Customers")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalCustomersTest extends ExternalApiBaseTest {

    private static final String UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

    /**
     * The create response serialises timestamps straight from the in-memory {@link Instant} and so
     * carries nanoseconds, while every read serialises what Mongo stored and carries milliseconds. The
     * same record therefore never compares equal across the two paths on exact {@code Instant} equality.
     * Comparing at millisecond precision is the meaningful assertion; the discrepancy itself is a
     * contract wart worth raising with the API owners, not a test failure to chase.
     */
    private static final Comparator<Instant> MILLISECOND_PRECISION =
            Comparator.comparing(instant -> instant.truncatedTo(ChronoUnit.MILLIS));

    private static CustomerResponse created;

    @AfterAll
    public static void cleanup() {
        archiveTrackedCustomers();
    }

    /**
     * The customer created by {@link #testCreateCustomer()}, which every later case builds on.
     *
     * <p>If the create step failed, aborting here reports the dependent cases as skipped with a reason
     * rather than raising a {@code NullPointerException} in each of them — eight identical NPEs bury the
     * one failure that actually matters.
     */
    private static CustomerResponse fixture() {
        assumeTrue(created != null, "Skipped: the create step did not produce a customer");
        return created;
    }

    @Tag("feature")
    @Tag("create")
    @Order(1)
    @Test
    @DisplayName("ExtApi: Create customer")
    public void testCreateCustomer() {
        CreateCustomerRequest request = ExternalCustomerGenerator.createCustomerRequest(true);
        created = trackCustomer(ExternalCustomerApi.createCustomer(request));

        assertThat(created.getId()).as("Customer id should not be null").isNotNull();
        assertThat(created.getIsDefault()).as("A created customer should not be the default").isFalse();
        assertThat(created.getStatus()).as("A created customer should be active").isEqualTo(STATUS_ACTIVE);
        assertThat(created.getCreatedAt()).as("Customer createdAt should not be null").isNotNull();
        assertThat(created.getContactInformation()).as("Contact information should be echoed back").isNotNull();
        assertThat(created.getContactInformation().getMailingAddress())
                .as("mailingAddressSameAsPhysical=true should copy the physical address")
                .isEqualTo(created.getContactInformation().getPhysicalAddress());

        assertThat(created).as("Created customer should match the request")
                .usingRecursiveComparison()
                .ignoringFields("id", "isDefault", "createdAt", "updatedAt", "lastActivityAt",
                        "status", "statusChangedAt", "contactInformation.mailingAddress")
                .isEqualTo(request);
    }

    @Tag("feature")
    @Tag("read")
    @Order(2)
    @Test
    @DisplayName("ExtApi: Get customer by ID")
    public void testGetCustomerById() {
        CustomerResponse fetched = ExternalCustomerApi.getCustomer(fixture().getId());

        // Since the rename, the id in the response body is the same id the route takes. Under the old
        // organizations contract it was not, and passing it back gave a 404 — so this round-trip is
        // worth asserting rather than assuming.
        assertThat(fetched).as("Fetched customer should match the created one")
                .usingRecursiveComparison()
                .withComparatorForType(MILLISECOND_PRECISION, Instant.class)
                .isEqualTo(created);
    }

    @Tag("feature")
    @Tag("read")
    @Order(3)
    @Test
    @DisplayName("ExtApi: Created customer appears in the list")
    public void testCreatedCustomerIsListed() {
        CustomersResponse response = ExternalCustomerApi
                .listCustomers(Map.of("search", fixture().getName(), "limit", 20));

        assertThat(response.getCustomers())
                .as("Searching for the created customer's name should find it")
                .anySatisfy(customer -> assertThat(customer.getId()).isEqualTo(fixture().getId()));
        assertThat(response.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
    }

    @Tag("feature")
    @Tag("update")
    @Order(4)
    @Test
    @DisplayName("ExtApi: Update customer")
    public void testUpdateCustomer() {
        UpdateCustomerRequest request = ExternalCustomerGenerator.updateCustomerRequest(false);
        CustomerResponse updated = ExternalCustomerApi.updateCustomer(fixture().getId(), request);

        assertThat(updated.getId()).as("Update should not change the id").isEqualTo(fixture().getId());
        assertThat(updated).as("Updated customer should match the request")
                .usingRecursiveComparison()
                .ignoringFields("id", "isDefault", "createdAt", "updatedAt", "lastActivityAt",
                        "status", "statusChangedAt")
                .isEqualTo(request);

        created = updated;
    }

    @Tag("feature")
    @Tag("read")
    @Order(5)
    @Test
    @DisplayName("ExtApi: Customer with no devices can be archived")
    public void testCanArchive() {
        // Nothing has ever been installed for this customer, so the answer must be yes. This is the
        // precondition the archive case below depends on.
        assertThat(ExternalCustomerApi.canArchive(fixture().getId()))
                .as("A freshly created customer has no devices, so it should be archivable")
                .isTrue();
    }

    @Tag("feature")
    @Tag("archive")
    @Order(6)
    @Test
    @DisplayName("ExtApi: Archive customer")
    public void testArchiveCustomer() {
        ExternalCustomerApi.updateStatus(fixture().getId(), STATUS_ARCHIVED);

        assertThat(ExternalCustomerApi.getCustomer(fixture().getId()).getStatus())
                .as("Customer should report as archived").isEqualTo(STATUS_ARCHIVED);
    }

    @Tag("feature")
    @Tag("read")
    @Order(7)
    @Test
    @DisplayName("ExtApi: Archived customer is excluded from the active list")
    public void testArchivedCustomerIsNotActive() {
        CustomersResponse active = ExternalCustomerApi
                .listCustomers(Map.of("status", STATUS_ACTIVE, "search", fixture().getName(), "limit", 20));

        assertThat(active.getCustomers())
                .as("An archived customer must not appear under status=ACTIVE")
                .noneSatisfy(customer -> assertThat(customer.getId()).isEqualTo(fixture().getId()));
    }

    @Tag("feature")
    @Tag("update")
    @Order(8)
    @Test
    @DisplayName("ExtApi: Archiving is reversible")
    public void testUnarchiveCustomer() {
        // Worth asserting explicitly: archive being reversible is what makes it a safe cleanup action
        // for this suite, and what distinguishes it from the device status endpoint.
        ExternalCustomerApi.updateStatus(fixture().getId(), STATUS_ACTIVE);

        assertThat(ExternalCustomerApi.getCustomer(fixture().getId()).getStatus())
                .as("Customer should be active again").isEqualTo(STATUS_ACTIVE);
    }

    @Tag("feature")
    @Tag("read")
    @Order(9)
    @Test
    @DisplayName("ExtApi: Get customer returns 404 for an unknown ID")
    public void testGetUnknownCustomer() {
        ExternalErrorResponse error = ExternalCustomerApi.attemptGetCustomer(UNKNOWN_ID, 404);
        assertThat(error.getCode()).as("Unknown customer should report an error code").isNotNull();
    }

    @Tag("feature")
    @Tag("create")
    @Order(10)
    @Test
    @DisplayName("ExtApi: Create customer rejects a missing name")
    public void testCreateCustomerRequiresName() {
        CreateCustomerRequest request = ExternalCustomerGenerator.createCustomerRequest(true);
        request.setName(null);

        ExternalErrorResponse error = ExternalCustomerApi.attemptCreateCustomer(request, 400);

        assertThat(error.getCode()).as("Validation failure should carry an error code").isNotNull();
        if (error.getFieldErrors() != null && !error.getFieldErrors().isEmpty()) {
            assertThat(error.getFieldErrors())
                    .as("Field errors should name the offending field")
                    .anySatisfy(fieldError -> assertThat(fieldError.getField()).isEqualTo("name"));
        }
    }
}
