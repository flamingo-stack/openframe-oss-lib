package com.openframe.api.dto.update;

import com.openframe.api.dto.force.response.ForceToolAgentUpdateResponseItem;
import lombok.Data;

import java.util.List;

@Data
public class ForceToolAgentUpdateResponse {

    private List<ForceToolAgentUpdateResponseItem> items;

}

