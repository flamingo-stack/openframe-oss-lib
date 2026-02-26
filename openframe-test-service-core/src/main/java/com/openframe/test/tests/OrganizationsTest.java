package com.openframe.test.tests;

import com.openframe.test.api.OrganizationApi;
import com.openframe.test.data.dto.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.generator.OrganizationGenerator;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("oss")
@Tag("saas")
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
        assertThat(organization.getId()).as("Organization id should not be null").isNotNull();
        assertThat(organization.getOrganizationId()).as("Organization organizationId should not be null").isNotNull();
        assertThat(organization.getIsDefault()).as("Organization should not be default").isFalse();
        assertThat(organization.getCreatedAt()).as("Organization createdAt should not be null").isNotNull();
        assertThat(organization.getUpdatedAt()).as("Organization updatedAt should not be null").isNotNull();
        assertThat(organization.getDeleted()).as("Organization should not be deleted").isFalse();
        assertThat(organization.getDeletedAt()).as("Organization deletedAt should be null").isNull();
        assertThat(organization.getContactInformation()).as("Organization contactInformation should not be null").isNotNull();
        assertThat(organization.getContactInformation().getMailingAddress())
                .as("Mailing address should match physical address")
                .isEqualTo(organization.getContactInformation().getPhysicalAddress());
        assertThat(organization).as("Created organization should match request")
                .usingRecursiveComparison()
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
            assertThat(organization.getId()).as("Organization id should not be null").isNotNull();
            assertThat(organization.getOrganizationId()).as("Organization organizationId should not be null").isNotNull();
            assertThat(organization.getName()).as("Organization name should not be empty").isNotEmpty();
            assertThat(organization.getCategory()).as("Organization category should not be empty").isNotEmpty();
            assertThat(organization.getCreatedAt()).as("Organization createdAt should not be null").isNotNull();
            assertThat(organization.getUpdatedAt()).as("Organization updatedAt should not be null").isNotNull();
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
        assertThat(organization).as("Retrieved organization should match listed organization")
                .usingRecursiveComparison()
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
        assertThat(organization.getId()).as("Organization id should not be null").isNotNull();
        assertThat(organization.getOrganizationId()).as("Organization organizationId should not be null").isNotNull();
        assertThat(organization.getIsDefault()).as("Organization should not be default").isFalse();
        assertThat(organization.getCreatedAt()).as("Organization createdAt should not be null").isNotNull();
        assertThat(organization.getUpdatedAt()).as("Organization updatedAt should not be null").isNotNull();
        assertThat(organization.getDeleted()).as("Organization should not be deleted").isFalse();
        assertThat(organization.getDeletedAt()).as("Organization deletedAt should be null").isNull();
        assertThat(organization).as("Updated organization should match request")
                .usingRecursiveComparison()
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
        assertThat(organizations).as("Deleted organization should not be in the list").doesNotContain(organization);
    }
}
