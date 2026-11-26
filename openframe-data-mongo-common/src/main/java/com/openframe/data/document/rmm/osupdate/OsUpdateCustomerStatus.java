package com.openframe.data.document.rmm.osupdate;

// Read from the policy and the decisions of a customer on every request; never stored.
public enum OsUpdateCustomerStatus {
    LISTED_ONLY,
    SCHEDULED,
    PILOT,
    APPROVED,
    HELD,
    REJECTED
}
