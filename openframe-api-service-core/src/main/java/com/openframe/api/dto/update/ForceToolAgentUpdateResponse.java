package com.openframe.api.dto.update;

import com.openframe.api.dto.force.response.ForceToolAgentUpdateResponseItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForceToolAgentUpdateResponse {

    private List<ForceToolAgentUpdateResponseItem> items;

}

