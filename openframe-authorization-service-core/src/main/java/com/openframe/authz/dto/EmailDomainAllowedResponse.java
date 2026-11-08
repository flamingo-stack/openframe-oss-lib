package com.openframe.authz.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
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
}
