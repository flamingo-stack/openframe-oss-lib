package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InstalledAgent {
    private String id;
    private String machineId;
    private String agentType;
    private String version;
    private String createdAt;
    private String updatedAt;
}
