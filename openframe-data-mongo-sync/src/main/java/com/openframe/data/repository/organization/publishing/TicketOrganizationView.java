package com.openframe.data.repository.organization.publishing;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

// The ticket fields OrganizationOnTicketsProjection reconciles; the job reads only these. Names are Ticket's properties.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TicketOrganizationView {

    @Id
    private String id;
    private String tenantId;
    private String organizationId;
    private String organizationName;
}
