package com.openframe.external.dto.event;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for creating/updating an event.
 * Mirrors the {@code CreateEventInput} GraphQL input used by the dashboard API: only the
 * business fields are accepted — id, tenantId and timestamp are always server-assigned.
 */
@Schema(description = "Event payload for create/update")
public record EventRequest(
        @NotBlank(message = "User ID is required")
        @Schema(description = "User ID the event belongs to", example = "user-456")
        String userId,

        @NotBlank(message = "Event type is required")
        @Schema(description = "Event type", example = "USER_LOGIN")
        String type,

        @JsonAlias("payload")
        @Schema(description = "Event payload data (free-form string, usually JSON). Also accepted as 'payload'.",
                example = "{\"action\": \"login\", \"ip\": \"192.168.1.1\"}")
        String data
) {
}
