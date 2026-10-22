package com.openframe.data.repository.ticket.publishing;

import com.openframe.publishing.api.spec.PublishedEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// What consumers of events.tickets see. A proposal until stage 0 settles the public fields.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketEvent implements PublishedEvent {

    private String ticketId;
    private String title;
}
