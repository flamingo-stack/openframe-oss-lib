package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateOverrideInput {
    private String osUpdateId;
    private OsUpdateOverrideAction action;
    private String organizationId;
    private String machineId;
}
