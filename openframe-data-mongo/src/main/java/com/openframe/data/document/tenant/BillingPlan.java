package com.openframe.data.document.tenant;

import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class BillingPlan {

    private String name;
    private String hubspotId;
    private Instant expiresAt;
    private Instant trialExpirationDate;
    private List<OpenframeProduct> enabledProducts;

}
