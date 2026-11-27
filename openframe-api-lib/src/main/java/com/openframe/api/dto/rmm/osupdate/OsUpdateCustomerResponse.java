package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import lombok.Builder;
import lombok.Data;

// One update at one customer that has a device the update is pending on or installed by.
@Data
@Builder
public class OsUpdateCustomerResponse {

    private String osUpdateId;
    private String organizationId;
    private OsUpdateCustomerStatus status;
    // The policy of the customer, else the one of the tenant. Null = neither exists.
    private String policyId;
    private String policyName;
    // The rule of the update's urgency in that policy. Null = the policy does not roll the update out.
    private OsUpdateRolloutRuleResponse rolloutRule;
    // The decision for the customer, else the one for every customer. Null = no technician decided.
    private OsUpdateOverrideResponse override;
    private int pendingDeviceCount;
    private int installedDeviceCount;
}
