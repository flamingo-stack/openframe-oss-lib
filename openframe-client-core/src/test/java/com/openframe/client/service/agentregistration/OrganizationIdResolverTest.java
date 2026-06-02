package com.openframe.client.service.agentregistration;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationIdResolverTest {

    @Mock
    private OrganizationService organizationService;

    @InjectMocks
    private OrganizationIdResolver resolver;

    private static final String DEFAULT_ID = "default-uuid";

    @Test
    void resolve_WithExistingRequestedOrg_ReturnsIt() {
        when(organizationService.getOrganizationByOrganizationId("org-1"))
                .thenReturn(Optional.of(organization("org-1")));

        String result = resolver.resolve("org-1");

        assertEquals("org-1", result);
        verify(organizationService, never()).getDefaultOrganization();
    }

    @Test
    void resolve_WithUnknownRequestedOrg_FallsBackToDefault() {
        when(organizationService.getOrganizationByOrganizationId("org-x")).thenReturn(Optional.empty());
        when(organizationService.getDefaultOrganization()).thenReturn(Optional.of(organization(DEFAULT_ID)));

        String result = resolver.resolve("org-x");

        assertEquals(DEFAULT_ID, result);
    }

    @Test
    void resolve_WithBlank_ReturnsDefaultWithoutLookup() {
        when(organizationService.getDefaultOrganization()).thenReturn(Optional.of(organization(DEFAULT_ID)));

        String result = resolver.resolve("   ");

        assertEquals(DEFAULT_ID, result);
        verify(organizationService, never()).getOrganizationByOrganizationId(any());
    }

    @Test
    void resolve_WhenNoDefaultOrganization_Throws() {
        when(organizationService.getDefaultOrganization()).thenReturn(Optional.empty());

        assertThrows(
                IllegalStateException.class,
                () -> resolver.resolve(null)
        );
    }

    private Organization organization(String organizationId) {
        return new Organization("id", null, "name", organizationId, true,
                null, null, null, null, null, null, null, null, null, null, null, null);
    }
}
