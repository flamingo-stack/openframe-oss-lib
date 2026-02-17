package com.openframe.test.tests;

import com.openframe.test.api.OrganizationApi;
import com.openframe.test.data.dto.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.generator.OrganizationGenerator;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("oss")
@DisplayName("Organizations")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class OrganizationsTest {

    @Tag("create")
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

    @Tag("read")
    @Order(2)
    @Test
    @DisplayName("List Organizations")
    public void testListOrganizations() {
        List<Organization> organizations = OrganizationApi.listOrganizations();
        assertThat(organizations).as("No organizations").isNotEmpty();
        assertThat(organizations).allSatisfy(organization -> {
            assertThat(organization.getId()).isNotNull();
            assertThat(organization.getOrganizationId()).isNotNull();
            assertThat(organization.getName()).isNotEmpty();
            assertThat(organization.getCategory()).isNotEmpty();
            assertThat(organization.getCreatedAt()).isNotNull();
            assertThat(organization.getUpdatedAt()).isNotNull();
        });
    }

    @Tag("read")
    @Order(3)
    @Test
    @DisplayName("Get Organization")
    public void testRetrieveOrganization() {
        List<Organization> organizations = OrganizationApi.listOrganizations();
        Organization organization = OrganizationApi.retrieveOrganization(organizations.getFirst().getId());
        assertThat(organization).as("No organization").isNotNull();
        assertThat(organization).usingRecursiveComparison()
                .ignoringFields("isDefault")
                .isEqualTo(organizations.getFirst());
    }

    @Tag("update")
    @Order(4)
    @Test
    @DisplayName("Update Organization")
    public void testUpdateOrganization() {
        List<Organization> organizations = OrganizationApi.getOrganizations(false);
        assertThat(organizations).as("No Organization to update").isNotEmpty();
        CreateOrganizationRequest request = OrganizationGenerator.updateOrganizationRequest(false);
        Organization organization = OrganizationApi.updateOrganization(organizations.getFirst().getId(), request);
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

    @Tag("delete")
    @Order(5)
    @Test
    @DisplayName("Delete Organization")
    public void testDeleteOrganization() {
        List<Organization> organizations = OrganizationApi.getOrganizations(false);
        assertThat(organizations).as("No Organization to delete").isNotEmpty();
        Organization organization = organizations.getFirst();
        OrganizationApi.deleteOrganization(organization);
        organizations = OrganizationApi.getOrganizations(false);
        assertThat(organizations).doesNotContain(organization);
    }
}
