package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdatePolicyTarget {

    private OsUpdatePolicyTargetType type;

    // CUSTOMER only.
    private String organizationId;

    // DEVICE_TAG only: a device with any of the tags, at any customer.
    private List<String> tagIds;

    // DEVICE only.
    private List<String> machineIds;
}
