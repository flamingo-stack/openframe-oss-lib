package com.openframe.data.repository.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// The devices of one customer that one update is pending on, or that installed it.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateOrganizationDeviceCount {

    private String identifier;
    private String organizationId;
    private long deviceCount;
}
