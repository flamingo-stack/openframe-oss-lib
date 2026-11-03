package com.openframe.api.service.organization;

import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationCommandServiceTest {

    private static final String ORG_ID = "org-1";
    private static final LocalDate START = LocalDate.of(2026, 6, 1);
    private static final LocalDate BEFORE_START = LocalDate.of(2026, 1, 1);
    private static final LocalDate AFTER_START = LocalDate.of(2026, 12, 31);

    @Mock private OrganizationService organizationService;
    @Mock private OrganizationMapper organizationMapper;

    @InjectMocks private OrganizationCommandService service;

    private Organization existing;
    private Organization merged;
    private UpdateOrganizationRequest request;

    @BeforeEach
    void setUp() {
        existing = Organization.builder().organizationId(ORG_ID).name("Acme").contractStartDate(START).build();
        merged = Organization.builder().organizationId(ORG_ID).name("Acme").contractStartDate(START).build();
        request = UpdateOrganizationRequest.builder().contractEndDate(BEFORE_START).build();
    }

    @Test
    void updateOrganization_mergedContractEndsBeforeStart_throwsValidationExceptionWithFieldError() {
        // setup
        merged.setContractEndDate(BEFORE_START);
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(existing));
        when(organizationMapper.updateEntity(existing, request)).thenReturn(merged);

        // execution
        ValidationException ex = assertThrows(ValidationException.class, () -> service.updateOrganization(ORG_ID, request));

        // verifications
        assertThat(ex.getMessage()).contains("Contract end date must not be before the start date");
        assertThat(ex.getFieldErrors())
                .extracting(ValidationException.FieldError::field, ValidationException.FieldError::message)
                .containsExactly(tuple("contractEndDate", "Contract end date must not be before the start date"));
    }

    @Test
    void updateOrganization_mergedContractEndsBeforeStart_nothingSaved() {
        // setup
        merged.setContractEndDate(BEFORE_START);
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(existing));
        when(organizationMapper.updateEntity(existing, request)).thenReturn(merged);

        // execution
        assertThrows(ValidationException.class, () -> service.updateOrganization(ORG_ID, request));

        // verifications
        verify(organizationService, never()).updateOrganization(merged);
    }

    @Test
    void updateOrganization_mergedContractEndsOnStartDay_saved() {
        // setup
        merged.setContractEndDate(START);
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(existing));
        when(organizationMapper.updateEntity(existing, request)).thenReturn(merged);
        when(organizationService.updateOrganization(merged)).thenReturn(merged);

        // execution
        Organization result = service.updateOrganization(ORG_ID, request);

        // verifications
        assertThat(result).isSameAs(merged);
        verify(organizationService).updateOrganization(merged);
    }

    @Test
    void updateOrganization_mergedContractEndsAfterStart_saved() {
        // setup
        merged.setContractEndDate(AFTER_START);
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(existing));
        when(organizationMapper.updateEntity(existing, request)).thenReturn(merged);
        when(organizationService.updateOrganization(merged)).thenReturn(merged);

        // execution
        Organization result = service.updateOrganization(ORG_ID, request);

        // verifications
        assertThat(result).isSameAs(merged);
        verify(organizationService).updateOrganization(merged);
    }

    @Test
    void updateOrganization_mergedWithoutStartDate_saved() {
        // setup
        merged.setContractStartDate(null);
        merged.setContractEndDate(BEFORE_START);
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(existing));
        when(organizationMapper.updateEntity(existing, request)).thenReturn(merged);
        when(organizationService.updateOrganization(merged)).thenReturn(merged);

        // execution
        service.updateOrganization(ORG_ID, request);

        // verifications
        verify(organizationService).updateOrganization(merged);
    }

    @Test
    void updateOrganization_mergedWithoutEndDate_saved() {
        // setup
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(existing));
        when(organizationMapper.updateEntity(existing, request)).thenReturn(merged);
        when(organizationService.updateOrganization(merged)).thenReturn(merged);

        // execution
        service.updateOrganization(ORG_ID, request);

        // verifications
        verify(organizationService).updateOrganization(merged);
    }

    @Test
    void updateOrganization_unknownId_throwsIllegalArgument() {
        // setup
        when(organizationService.getOrganizationByOrganizationId("missing")).thenReturn(Optional.empty());

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.updateOrganization("missing", request));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Organization not found with id: missing");
        verify(organizationService, never()).updateOrganization(merged);
    }
}
