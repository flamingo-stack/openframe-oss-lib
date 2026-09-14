package com.openframe.api.dto.force.response;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForceToolAgentUpdateResponse {

    private List<ForceToolAgentUpdateResponseItem> items;

}

