package com.openframe.data.repository.organization.publishing;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.repository.organization.OrganizationRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class OrganizationAggregateSpecTest {

    private final OrganizationOnTicketsProjection organizationOnTickets = new OrganizationOnTicketsProjection(mock(OrganizationRepository.class));
    private final OrganizationAggregateSpec spec = new OrganizationAggregateSpec(organizationOnTickets);

    @Test
    void theOrganizationIsProjectedOnTickets() {
        assertThat(spec.projections()).containsExactly(organizationOnTickets);
    }

    @Test
    void publishesUnderTheOrganizationsType() {
        assertThat(spec.getType()).isEqualTo("organizations");
    }

    @Test
    void theEventCarriesOnlyThePublicFields() {
        Organization organization = Organization.builder()
                .organizationId("org-1")
                .name("Acme")
                .isDefault(true)
                .status(OrganizationStatus.ARCHIVED)
                .monthlyRevenue(BigDecimal.TEN)
                .notes("internal")
                .build();

        OrganizationEvent event = spec.toEvent(organization);

        assertThat(event).isEqualTo(new OrganizationEvent("org-1", "Acme", true, OrganizationStatus.ARCHIVED));
    }

    @Test
    void aMissingDefaultFlag_isPublishedAsNotDefault() {
        Organization organization = Organization.builder().organizationId("org-1").isDefault(null).build();

        assertThat(spec.toEvent(organization).getIsDefault()).isFalse();
    }
}
