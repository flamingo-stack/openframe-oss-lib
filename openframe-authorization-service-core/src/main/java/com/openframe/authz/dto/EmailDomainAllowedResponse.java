package com.openframe.authz.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for the email-policy-only check.
 * Says nothing about whether the address is already registered.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailDomainAllowedResponse {

    private boolean allowed;

    /**
     * Which layer blocked the address: {@code BLOCKED_ADDRESS}, {@code BLOCKED_DOMAIN} or {@code DISPOSABLE};
     * omitted when {@code allowed} is true, like {@code EmailAvailabilityResponse.reason}. Callers that read only
     * {@code allowed} are unaffected.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Reason reason;

    public enum Reason {
        /** The address itself is on the blocked address list. */
        BLOCKED_ADDRESS,
        /** The domain is on a blocked domain list. */
        BLOCKED_DOMAIN,
        /** The domain was reported disposable by the external check. */
        DISPOSABLE
    }
}
