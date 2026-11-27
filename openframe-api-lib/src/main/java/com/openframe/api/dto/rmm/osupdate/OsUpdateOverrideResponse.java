package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class OsUpdateOverrideResponse {

    private OsUpdateOverrideAction action;
    private String organizationId;
    private String machineId;
    private String actedBy;
    private Instant actedAt;
}
