package com.openframe.data.repository.user.publishing;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

// The ticket fields UserOnTicketsProjection reconciles; the job reads only these. Names are Ticket's properties.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TicketUserView {

    @Id
    private String id;
    private String tenantId;
    private String assignedTo;
    private String assignedName;
    private String resolvedById;
    private String resolvedByName;
}
