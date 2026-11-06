package com.openframe.data.repository.ticket.publishing;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

// The time entry fields TicketOnTimeEntriesProjection reconciles; the job reads only these. Names are TimeEntry's properties.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TimeEntryTicketView {

    @Id
    private String id;
    private String tenantId;
    private String ticketId;
    private String ticketTitle;
}
