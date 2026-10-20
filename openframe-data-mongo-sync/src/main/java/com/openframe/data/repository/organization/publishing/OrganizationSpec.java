package com.openframe.data.repository.organization.publishing;

import com.openframe.data.document.organization.Organization;
import com.openframe.publishing.api.PublishedAggregateSpec;
import com.openframe.publishing.api.PublishedAggregateType;
import org.springframework.stereotype.Component;

@Component
public class OrganizationSpec implements PublishedAggregateSpec<Organization, OrganizationEvent> {

    @Override
    public PublishedAggregateType getType() {
        return PublishedAggregateType.ORGANIZATIONS;
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
}
