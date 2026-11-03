package com.openframe.api.mapper;

import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.data.document.organization.Organization;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OrganizationMapperTest {

    private static final String NAME = "Acme Corporation";

    private OrganizationMapper mapper;
    private Organization existing;

    @BeforeEach
    void setUp() {
        mapper = new OrganizationMapper();
        existing = Organization.builder().organizationId("org-1").name(NAME).build();
    }

    @Test
    void toEntity_nameWithSurroundingWhitespace_trimmed() {
        // setup
        CreateOrganizationRequest request = CreateOrganizationRequest.builder().name("  " + NAME + "\t\n").build();

        // execution
        Organization entity = mapper.toEntity(request);

        // verifications
        assertThat(entity.getName()).isEqualTo(NAME);
    }

    @Test
    void toEntity_nullRequest_null() {
        // setup

        // execution
        Organization entity = mapper.toEntity(null);

        // verifications
        assertThat(entity).isNull();
    }

    @Test
    void updateEntity_nameWithSurroundingWhitespace_trimmed() {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder().name("  New Name  ").build();

        // execution
        Organization entity = mapper.updateEntity(existing, request);

        // verifications
        assertThat(entity.getName()).isEqualTo("New Name");
    }

    @Test
    void updateEntity_nullName_existingNameKept() {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder().numberOfEmployees(7).build();

        // execution
        Organization entity = mapper.updateEntity(existing, request);

        // verifications
        assertThat(entity.getName()).isEqualTo(NAME);
        assertThat(entity.getNumberOfEmployees()).isEqualTo(7);
    }

    @Test
    void updateEntity_nullRequest_existingReturnedUntouched() {
        // setup

        // execution
        Organization entity = mapper.updateEntity(existing, null);

        // verifications
        assertThat(entity).isSameAs(existing);
        assertThat(entity.getName()).isEqualTo(NAME);
    }
}
