package com.openframe.api.dto.update;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForceToolAgentUpdateRequest {

    private List<String> machineIds;
    private String toolAgentId;

}

