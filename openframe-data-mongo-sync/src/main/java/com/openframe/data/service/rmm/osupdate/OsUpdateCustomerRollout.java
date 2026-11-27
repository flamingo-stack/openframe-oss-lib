package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.Builder;
import lombok.Value;

// What the policy of a customer and the technicians' decisions for that customer give for one update.
@Value
@Builder
public class OsUpdateCustomerRollout {

    OsUpdateCustomerStatus osUpdateCustomerStatus;
    // The policy of the customer, else the one of the tenant. Null = neither exists.
    OsUpdatePolicy osUpdatePolicy;
    // Null = the update has no urgency: a preview, a new OS version, a driver.
    OsUpdateUrgency osUpdateUrgency;
    // The rule of that urgency in the policy. Null = the policy does not roll the update out.
    OsUpdateRolloutRule osUpdateRolloutRule;
    // The decision for the customer, else the one for every customer. Null = no technician decided.
    OsUpdateOverride osUpdateOverride;
}
