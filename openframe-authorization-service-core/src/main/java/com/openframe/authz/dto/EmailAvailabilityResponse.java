package com.openframe.authz.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.core.email.EmailVerdict;
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

    public static EmailAvailabilityResponse taken() {
        return new EmailAvailabilityResponse(false, EmailRefusalReason.TAKEN);
    }

    public static EmailAvailabilityResponse of(EmailVerdict verdict) {
        EmailRefusalReason reason = EmailRefusalReason.of(verdict);
        return new EmailAvailabilityResponse(verdict.isAllowed(), reason);
    }
}
