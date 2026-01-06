package com.openframe.data.document.tenant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Represents a billing plan for a tenant.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillingPlan {

    private String name;
    private String hubspotId;
    private Instant expiresAt;
    private Instant trialExpirationDate;
    private List<OpenframeProduct> enabledProducts;

}
