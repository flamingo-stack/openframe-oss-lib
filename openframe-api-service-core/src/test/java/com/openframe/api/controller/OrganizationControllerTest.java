package com.openframe.api.controller;

import com.openframe.api.dto.organization.OrganizationResponse;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.api.service.organization.OrganizationCommandService;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class OrganizationControllerTest {

    private static final String ORG_ID = "org-1";

    @Mock
    private OrganizationService organizationService;
    @Mock
    private OrganizationCommandService organizationCommandService;
    @Mock
    private OrganizationMapper organizationMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new OrganizationController(organizationService, organizationCommandService, organizationMapper))
                .setControllerAdvice(new BaseGlobalExceptionHandler())
                .build();
    }

    @Test
    void updateIs200AndReachesTheDomain() throws Exception {
        Organization updated = new Organization();
        OrganizationResponse response = OrganizationResponse.builder().organizationId(ORG_ID).name("Acme").build();
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(new Organization()));
        when(organizationCommandService.updateOrganization(eq(ORG_ID), any())).thenReturn(updated);
        when(organizationMapper.toResponse(updated)).thenReturn(response);

        mockMvc.perform(put("/organizations/" + ORG_ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Acme\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId").value(ORG_ID))
                .andExpect(jsonPath("$.name").value("Acme"));
    }

    @Test
    void updateOfUnknownOrganizationIs404WithTheNotFoundCodeAndNothingIsUpdated() throws Exception {
        when(organizationService.getOrganizationByOrganizationId("missing")).thenReturn(Optional.empty());

        mockMvc.perform(put("/organizations/missing")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Acme\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Organization not found with id: missing"));

        verifyNoInteractions(organizationCommandService);
    }

    @Test
    void canArchiveReturnsTheDomainAnswer() throws Exception {
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(new Organization()));
        when(organizationService.canArchiveOrganization(ORG_ID)).thenReturn(true);

        mockMvc.perform(get("/organizations/" + ORG_ID + "/can-archive"))
                .andExpect(status().isOk())
                .andExpect(content().string("true"));
    }

    @Test
    void canArchiveOfUnknownOrganizationIs404() throws Exception {
        when(organizationService.getOrganizationByOrganizationId("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get("/organizations/missing/can-archive"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Organization not found with id: missing"));

        verify(organizationService, never()).canArchiveOrganization(any());
    }

    @Test
    void updateStatusIs204AndReachesTheDomain() throws Exception {
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(new Organization()));

        mockMvc.perform(patch("/organizations/" + ORG_ID + "/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isNoContent());

        verify(organizationCommandService).updateOrganizationStatus(eq(ORG_ID), any());
    }

    @Test
    void updateStatusOfUnknownOrganizationIs404AndNothingIsUpdated() throws Exception {
        when(organizationService.getOrganizationByOrganizationId("missing")).thenReturn(Optional.empty());

        mockMvc.perform(patch("/organizations/missing/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_NOT_FOUND"));

        verifyNoInteractions(organizationCommandService);
    }

    @Test
    void statusChangeRefusedByTheDomainIsStill400() throws Exception {
        when(organizationService.getOrganizationByOrganizationId(ORG_ID)).thenReturn(Optional.of(new Organization()));
        doThrow(new IllegalArgumentException("Organization is already in status ARCHIVED"))
                .when(organizationCommandService).updateOrganizationStatus(eq(ORG_ID), any());

        mockMvc.perform(patch("/organizations/" + ORG_ID + "/status")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Organization is already in status ARCHIVED"));
    }

    @Test
    void createOrganizationWithContractEndingBeforeStartIs400AndNothingIsCreated() throws Exception {
        mockMvc.perform(post("/organizations").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Acme\",\"contractStartDate\":\"2026-06-01\",\"contractEndDate\":\"2026-01-01\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("contractEndDate"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Contract end date must not be before the start date"));

        verifyNoInteractions(organizationCommandService);
    }

    @Test
    void updateOrganizationWithContractEndingBeforeStartIs400AndNothingIsUpdated() throws Exception {
        mockMvc.perform(put("/organizations/" + ORG_ID).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contractStartDate\":\"2026-06-01\",\"contractEndDate\":\"2026-01-01\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("contractEndDate"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Contract end date must not be before the start date"));

        verifyNoInteractions(organizationCommandService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"name\":\"\"}", "{\"name\":\"   \"}", "{\"name\":\"\\t\\n\"}"})
    void updateOrganizationWithBlankNameIs400AndNothingIsUpdated(String body) throws Exception {
        mockMvc.perform(put("/organizations/" + ORG_ID).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Name must not be blank"));

        verifyNoInteractions(organizationCommandService);
    }

    @Test
    void updateOrganizationRefusedAfterTheMergeIs400WithTheFieldError() throws Exception {
        when(organizationCommandService.updateOrganization(eq(ORG_ID), any())).thenThrow(new ValidationException(
                "Contract end date must not be before the start date",
                List.of(new ValidationException.FieldError("contractEndDate", "Contract end date must not be before the start date"))));

        mockMvc.perform(put("/organizations/" + ORG_ID).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contractEndDate\":\"2026-01-01\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("contractEndDate"));
    }
}
