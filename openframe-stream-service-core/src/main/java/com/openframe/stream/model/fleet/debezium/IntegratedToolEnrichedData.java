package com.openframe.stream.model.fleet.debezium;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntegratedToolEnrichedData {

    private String machineId;
    private String hostname;
    private String nickname;
    private String organizationId;
    private String organizationName;
    private String userId;
    private String tenantId;

}
