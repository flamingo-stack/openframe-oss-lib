package com.openframe.data.document.rmm.osupdate;

// From the widest to the most specific: of the policies that cover a device the most specific one applies.
public enum OsUpdatePolicyTargetType {
    TENANT,
    CUSTOMER,
    DEVICE_TAG,
    DEVICE
}
