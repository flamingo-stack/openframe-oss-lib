package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for the domain-policy-only check.
 * Says nothing about whether the address is already registered.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailDomainAllowedResponse {

    private boolean allowed;
}
