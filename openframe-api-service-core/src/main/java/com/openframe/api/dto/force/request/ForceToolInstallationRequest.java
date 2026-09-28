package com.openframe.api.dto.force.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForceToolInstallationRequest {

    private List<String> machineIds;
    private String toolAgentId;

}

