package com.openframe.authz.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.core.email.EmailVerdict;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailDomainAllowedResponse {

    private boolean allowed;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private EmailRefusalReason reason;

    public static EmailDomainAllowedResponse of(EmailVerdict verdict) {
        EmailRefusalReason reason = EmailRefusalReason.of(verdict);
        return new EmailDomainAllowedResponse(verdict.isAllowed(), reason);
    }
}
