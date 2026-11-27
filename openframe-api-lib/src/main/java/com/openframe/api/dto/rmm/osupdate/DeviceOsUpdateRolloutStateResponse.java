package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class DeviceOsUpdateRolloutStateResponse {
    private String policyId;
    private DeviceOsUpdateRolloutStatus status;
    private OsUpdateOverrideAction overrideAction;
    private Instant installFrom;
    private Instant focusAt;
    private Instant softAt;
    private Instant hardAt;
}
