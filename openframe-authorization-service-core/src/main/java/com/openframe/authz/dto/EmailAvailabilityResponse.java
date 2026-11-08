package com.openframe.authz.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for the email availability check.
 * True when the address may be used to register: nobody active owns it and its domain is allowed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailAvailabilityResponse {

    private boolean available;

    /** Why it is unavailable. Omitted when {@code available} is true. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private EmailRefusalReason reason;
}
