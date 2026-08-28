package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalOrganizationApi;
import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.external.organization.OrganizationResponse;
import com.openframe.test.data.dto.external.organization.OrganizationsResponse;
import com.openframe.test.data.dto.external.organization.UpdateOrganizationRequest;
import com.openframe.test.data.generator.external.ExternalOrganizationGenerator;
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
 * {@code /api/v1/organizations} — full lifecycle.
 *
 * <p>Ordered: the create case publishes the organization the later cases read, update, and archive, so
 * the suite never touches a record it did not make. {@link #cleanup()} archives anything left over if a
 * case fails partway.
 */
@Tag("saas")
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("External API - Organizations")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalOrganizationsTest extends ExternalApiBaseTest {

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

    private static OrganizationResponse created;

    @AfterAll
    public static void cleanup() {
        archiveTrackedOrganizations();
    }

    /**
     * The organization created by {@link #testCreateOrganization()}, which every later case builds on.
     *
     * <p>If the create step failed, aborting here reports the dependent cases as skipped with a reason
     * rather than raising a {@code NullPointerException} in each of them — nine identical NPEs bury the
     * one failure that actually matters.
     */
    private static OrganizationResponse fixture() {
        assumeTrue(created != null, "Skipped: the create step did not produce an organization");
        return created;
    }

    @Tag("feature")
    @Tag("create")
    @Order(1)
    @Test
    @DisplayName("Create organization")
    public void testCreateOrganization() {
        CreateOrganizationRequest request = ExternalOrganizationGenerator.createOrganizationRequest(true);
        created = trackOrganization(ExternalOrganizationApi.createOrganization(request));

        assertThat(created.getId()).as("Organization id should not be null").isNotNull();
        assertThat(created.getOrganizationId()).as("Organization organizationId should not be null").isNotNull();
        assertThat(created.getIsDefault()).as("A created organization should not be the default").isFalse();
        assertThat(created.getStatus()).as("A created organization should be active").isEqualTo(STATUS_ACTIVE);
        assertThat(created.getCreatedAt()).as("Organization createdAt should not be null").isNotNull();
        assertThat(created.getContactInformation()).as("Contact information should be echoed back").isNotNull();
        assertThat(created.getContactInformation().getMailingAddress())
                .as("mailingAddressSameAsPhysical=true should copy the physical address")
                .isEqualTo(created.getContactInformation().getPhysicalAddress());

        assertThat(created).as("Created organization should match the request")
                .usingRecursiveComparison()
                .ignoringFields("id", "organizationId", "isDefault", "createdAt", "updatedAt",
                        "lastActivityAt", "status", "statusChangedAt",
                        "contactInformation.mailingAddress")
                .isEqualTo(request);
    }

    @Tag("feature")
    @Tag("read")
    @Order(2)
    @Test
    @DisplayName("Get organization by ID")
    public void testGetOrganizationById() {
        OrganizationResponse fetched = ExternalOrganizationApi.getOrganizationById(fixture().getOrganizationId());

        assertThat(fetched).as("Fetched organization should match the created one")
                .usingRecursiveComparison()
                .withComparatorForType(MILLISECOND_PRECISION, Instant.class)
                .isEqualTo(created);
    }

    @Tag("feature")
    @Tag("read")
    @Order(3)
    @Test
    @DisplayName("Get organization by organizationId")
    public void testGetOrganizationByOrganizationId() {
        OrganizationResponse fetched = ExternalOrganizationApi
                .getOrganizationByOrganizationId(fixture().getOrganizationId());

        // Two documented routes to the same record; they must not disagree.
        assertThat(fetched).as("Lookup by business organizationId should return the same record")
                .usingRecursiveComparison()
                .withComparatorForType(MILLISECOND_PRECISION, Instant.class)
                .isEqualTo(created);
    }

    @Tag("feature")
    @Tag("read")
    @Order(4)
    @Test
    @DisplayName("Created organization appears in the list")
    public void testCreatedOrganizationIsListed() {
        OrganizationsResponse response = ExternalOrganizationApi
                .listOrganizations(Map.of("search", fixture().getName(), "limit", 20));

        assertThat(response.getOrganizations())
                .as("Searching for the created organization's name should find it")
                .anySatisfy(org -> assertThat(org.getId()).isEqualTo(fixture().getId()));
        assertThat(response.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
    }

    @Tag("feature")
    @Tag("update")
    @Order(5)
    @Test
    @DisplayName("Update organization")
    public void testUpdateOrganization() {
        UpdateOrganizationRequest request = ExternalOrganizationGenerator.updateOrganizationRequest(false);
        OrganizationResponse updated = ExternalOrganizationApi.updateOrganization(fixture().getOrganizationId(), request);

        assertThat(updated.getId()).as("Update should not change the id").isEqualTo(fixture().getId());
        assertThat(updated.getOrganizationId()).as("Update should not change the organizationId")
                .isEqualTo(fixture().getOrganizationId());
        assertThat(updated).as("Updated organization should match the request")
                .usingRecursiveComparison()
                .ignoringFields("id", "organizationId", "isDefault", "createdAt", "updatedAt",
                        "lastActivityAt", "status", "statusChangedAt")
                .isEqualTo(request);

        created = updated;
    }

    @Tag("feature")
    @Tag("read")
    @Order(6)
    @Test
    @DisplayName("Organization with no devices can be archived")
    public void testCanArchive() {
        // Nothing has ever been installed into this organization, so the answer must be yes. This is the
        // precondition the archive case below depends on.
        assertThat(ExternalOrganizationApi.canArchive(fixture().getOrganizationId()))
                .as("A freshly created organization has no devices, so it should be archivable")
                .isTrue();
    }

    @Tag("feature")
    @Tag("archive")
    @Order(7)
    @Test
    @DisplayName("Archive organization")
    public void testArchiveOrganization() {
        ExternalOrganizationApi.updateStatus(fixture().getOrganizationId(), STATUS_ARCHIVED);

        assertThat(ExternalOrganizationApi.getOrganizationById(fixture().getOrganizationId()).getStatus())
                .as("Organization should report as archived").isEqualTo(STATUS_ARCHIVED);
    }

    @Tag("feature")
    @Tag("read")
    @Order(8)
    @Test
    @DisplayName("Archived organization is excluded from the active list")
    public void testArchivedOrganizationIsNotActive() {
        OrganizationsResponse active = ExternalOrganizationApi
                .listOrganizations(Map.of("status", STATUS_ACTIVE, "search", fixture().getName(), "limit", 20));

        assertThat(active.getOrganizations())
                .as("An archived organization must not appear under status=ACTIVE")
                .noneSatisfy(org -> assertThat(org.getId()).isEqualTo(fixture().getId()));
    }

    @Tag("feature")
    @Tag("update")
    @Order(9)
    @Test
    @DisplayName("Archiving is reversible")
    public void testUnarchiveOrganization() {
        // Worth asserting explicitly: archive being reversible is what makes it a safe cleanup action
        // for this suite, and what distinguishes it from the device status endpoint.
        ExternalOrganizationApi.updateStatus(fixture().getOrganizationId(), STATUS_ACTIVE);

        assertThat(ExternalOrganizationApi.getOrganizationById(fixture().getOrganizationId()).getStatus())
                .as("Organization should be active again").isEqualTo(STATUS_ACTIVE);
    }

    @Tag("feature")
    @Tag("read")
    @Order(10)
    @Test
    @DisplayName("Get organization returns 404 for an unknown ID")
    public void testGetUnknownOrganization() {
        ExternalErrorResponse error = ExternalOrganizationApi.attemptGetOrganizationById(UNKNOWN_ID, 404);
        assertThat(error.getCode()).as("Unknown organization should report an error code").isNotNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(11)
    @Test
    @DisplayName("The {id} route takes organizationId, not the Mongo id")
    public void testIdRouteRejectsMongoId() {
        // Worth pinning explicitly. The contract calls this parameter "id" and summarises the operation
        // as "Get organization by ID", but the value that works is the business organizationId (a UUID).
        // The `id` field the very same response body returns — a Mongo ObjectId — is rejected. Anyone
        // reading the swagger page would reach for the wrong one, so this documents which is which.
        assertThat(ExternalOrganizationApi.getOrganizationById(fixture().getOrganizationId()).getId())
                .as("The business organizationId is what the {id} route resolves")
                .isEqualTo(fixture().getId());

        ExternalOrganizationApi.attemptGetOrganizationById(fixture().getId(), 404);
    }

    @Tag("feature")
    @Tag("create")
    @Order(12)
    @Test
    @DisplayName("Create organization rejects a missing name")
    public void testCreateOrganizationRequiresName() {
        CreateOrganizationRequest request = ExternalOrganizationGenerator.createOrganizationRequest(true);
        request.setName(null);

        ExternalErrorResponse error = ExternalOrganizationApi.attemptCreateOrganization(request, 400);

        assertThat(error.getCode()).as("Validation failure should carry an error code").isNotNull();
        if (error.getFieldErrors() != null && !error.getFieldErrors().isEmpty()) {
            assertThat(error.getFieldErrors())
                    .as("Field errors should name the offending field")
                    .anySatisfy(fieldError -> assertThat(fieldError.getField()).isEqualTo("name"));
        }
    }
}
