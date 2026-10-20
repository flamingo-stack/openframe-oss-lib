package com.openframe.data.repository.organization.publishing;

import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.publishing.api.PublishedEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// What consumers of events.organizations see. A proposal until stage 0 settles the public fields.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationEvent implements PublishedEvent {

    private String organizationId;
    private String name;
    // Boolean, as on Organization: with boolean, Jackson would name the property "default" while the payload key is "isDefault".
    private Boolean isDefault;
    private OrganizationStatus status;
}
