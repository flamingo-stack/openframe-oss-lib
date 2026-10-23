package com.openframe.data.repository.organization.publishing;

import com.openframe.data.document.organization.Organization;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class OrganizationAggregateSpec implements AggregateSpec<Organization, OrganizationEvent> {

    private final OrganizationOnTicketsProjection organizationOnTickets;

    @Override
    public String getType() {
        return "organizations";
    }

    @Override
    public OrganizationEvent toEvent(Organization organization) {
        boolean isDefault = Boolean.TRUE.equals(organization.getIsDefault());
        return OrganizationEvent.builder()
                .organizationId(organization.getOrganizationId())
                .name(organization.getName())
                .isDefault(isDefault)
                .status(organization.getStatus())
                .build();
    }

    @Override
    public List<Projection<OrganizationEvent, ?>> projections() {
        return List.of(organizationOnTickets);
    }
}
