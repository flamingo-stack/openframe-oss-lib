package com.openframe.test.tests;

import com.openframe.test.api.OrganizationApi;
import com.openframe.test.data.db.collections.OrganizationsCollection;
import com.openframe.test.data.dto.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.generator.OrganizationGenerator;
import com.openframe.test.tests.base.AuthorizedTest;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("oss")
@DisplayName("Organizations")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class OrganizationsTest extends AuthorizedTest {

    @Order(1)
    @Test
    @DisplayName("Create Organization")
    public void testCreateOrganization() {
        CreateOrganizationRequest request = OrganizationGenerator.createOrganizationRequest(true);
        Organization organization = OrganizationApi.createOrganization(request);
        assertThat(organization.getId()).isNotNull();
        assertThat(organization.getOrganizationId()).isNotNull();
        assertThat(organization.getIsDefault()).isFalse();
        assertThat(organization.getCreatedAt()).isNotNull();
        assertThat(organization.getUpdatedAt()).isNotNull();
        assertThat(organization.getDeleted()).isFalse();
        assertThat(organization.getDeletedAt()).isNull();
        assertThat(organization.getContactInformation()).isNotNull();
        assertThat(organization.getContactInformation().getMailingAddress())
                .isEqualTo(organization.getContactInformation().getPhysicalAddress());
        assertThat(organization).usingRecursiveComparison()
                .ignoringFields("id", "organizationId", "isDefault", "createdAt",
                        "updatedAt", "deleted", "deletedAt", "contactInformation.mailingAddress")
                .isEqualTo(request);
    }

    @Tag("monitor")
    @Order(2)
    @Test
    @DisplayName("Retrieve Organization")
    public void testRetrieveOrganization() {
        Organization dbOrganization = OrganizationsCollection.findOrganization(false, false);
        assertThat(dbOrganization).as("No Organization in DB to retrieve").isNotNull();
        Organization apiOrganization = OrganizationApi.retrieveOrganization(dbOrganization.getId());
        assertThat(apiOrganization).usingRecursiveComparison()
                .ignoringFields("monthlyRevenue")
                .isEqualTo(dbOrganization);
    }

    @Order(3)
    @Test
    @DisplayName("Update Organization")
    public void testUpdateOrganization() {
        CreateOrganizationRequest request = OrganizationGenerator.updateOrganizationRequest(false);
        Organization organization = OrganizationsCollection.findOrganization(false, false);
        assertThat(organization).as("No Organization in DB to update").isNotNull();
        organization = OrganizationApi.updateOrganization(organization.getId(), request);
        assertThat(organization.getId()).isNotNull();
        assertThat(organization.getOrganizationId()).isNotNull();
        assertThat(organization.getIsDefault()).isFalse();
        assertThat(organization.getCreatedAt()).isNotNull();
        assertThat(organization.getUpdatedAt()).isNotNull();
        assertThat(organization.getDeleted()).isFalse();
        assertThat(organization.getDeletedAt()).isNull();
        assertThat(organization).usingRecursiveComparison()
                .ignoringFields("id", "organizationId", "isDefault", "createdAt",
                        "updatedAt", "deleted", "deletedAt")
                .isEqualTo(request);
    }

    @Order(4)
    @Test
    @DisplayName("Delete Organization")
    public void testDeleteOrganization() {
        Organization organization = OrganizationsCollection.findOrganization(false, false);
        assertThat(organization).as("No Organization in DB to delete").isNotNull();
        OrganizationApi.deleteOrganization(organization);
        organization = OrganizationsCollection.findOrganization(organization.getId());
        assertThat(organization.getDeleted()).isTrue();
        assertThat(organization.getDeletedAt()).isNotNull();
    }

    @Order(5)
    @Test
    @DisplayName("Retrieve Active Organizations")
    public void testRetrieveAllOrganizations() {
        List<String> apiOrganizationsIds = OrganizationApi.getOrganizationIds();
        List<String> activeOrganizationIds = OrganizationsCollection.findOrganizationIds(false);
        List<String> deletedOrganizationIds = OrganizationsCollection.findOrganizationIds(true);
        assertThat(apiOrganizationsIds).containsExactlyInAnyOrderElementsOf(activeOrganizationIds);
        assertThat(apiOrganizationsIds).doesNotContainAnyElementsOf(deletedOrganizationIds);
    }
}
