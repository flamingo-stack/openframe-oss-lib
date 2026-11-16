package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Objects;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

class TicketResponseSchemaTextTest {

    @Test
    void ticketOwnerFieldSchemaTextMentionsEmail() throws NoSuchFieldException {
        Schema schema = TicketResponse.class.getDeclaredField("owner").getAnnotation(Schema.class);

        assertTrue(schema.description().contains("EMAIL"), schema.description());
    }

    @Test
    void ticketOwnerResponseSchemaTextMentionsEmail() {
        Stream<Schema> onFields = Arrays.stream(TicketOwnerResponse.class.getDeclaredFields())
                .map(field -> field.getAnnotation(Schema.class));
        Stream<Schema> schemas = Stream.concat(
                Stream.of(TicketOwnerResponse.class.getAnnotation(Schema.class)), onFields);

        assertTrue(schemas.filter(Objects::nonNull).map(Schema::description).anyMatch(text -> text.contains("EMAIL")));
    }
}
