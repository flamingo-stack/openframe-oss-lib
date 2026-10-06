package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class TicketNoteNotFoundException extends NotFoundException {
    public TicketNoteNotFoundException(String noteId) {
        super(ErrorCode.TICKET_NOTE_NOT_FOUND, "Ticket note not found: " + noteId);
    }
}
