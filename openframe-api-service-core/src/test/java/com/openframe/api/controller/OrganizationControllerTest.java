package com.openframe.api.controller;

import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.api.service.organization.OrganizationCommandService;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

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
}
