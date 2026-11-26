package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdatePolicyTargetInput {
    private OsUpdatePolicyTargetType type;
    private String organizationId;
    private List<String> tagIds;
    private List<String> machineIds;
}
