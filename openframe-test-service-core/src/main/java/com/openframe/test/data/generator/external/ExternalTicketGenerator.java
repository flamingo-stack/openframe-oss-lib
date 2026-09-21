package com.openframe.test.data.generator.external;

import com.openframe.test.data.dto.external.ticket.CreateTicketRequest;
import com.openframe.test.data.dto.external.ticket.UpdateTicketRequest;

import static com.openframe.test.data.generator.external.ExternalTestData.faker;
import static com.openframe.test.data.generator.external.ExternalTestData.uniqueName;

/** Ticket payloads for the External API. */
public class ExternalTicketGenerator {

    /** Contract cap on {@code title}; the boundary cases assert on either side of it. */
    public static final int MAX_TITLE_LENGTH = 255;
    /** Contract cap on {@code description}. */
    public static final int MAX_DESCRIPTION_LENGTH = 5000;

    public static CreateTicketRequest createTicketRequest() {
        return CreateTicketRequest.builder()
                .title(uniqueName("Ticket"))
                .description(faker().lorem().paragraph())
                .build();
    }

    /** Only {@code title} is required; this proves the minimal payload is accepted. */
    public static CreateTicketRequest minimalTicketRequest() {
        return CreateTicketRequest.builder()
                .title(uniqueName("Minimal Ticket"))
                .build();
    }

    public static UpdateTicketRequest updateTicketRequest() {
        return UpdateTicketRequest.builder()
                .title(uniqueName("Updated Ticket"))
                .description(faker().lorem().paragraph())
                .build();
    }

    public static String noteContent() {
        return "extapi note: " + faker().lorem().sentence();
    }

    /** A title one character over the documented limit, for the 400 case. */
    public static String overlongTitle() {
        return "x".repeat(MAX_TITLE_LENGTH + 1);
    }
}
