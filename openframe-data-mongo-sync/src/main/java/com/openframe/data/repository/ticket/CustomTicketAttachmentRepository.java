package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketAttachment;

/** Stores each ticket attachment once using a storage path owned by that ticket and unique within its tenant. */
public interface CustomTicketAttachmentRepository {

    TicketAttachment insertIfAbsent(TicketAttachment attachment);
}
