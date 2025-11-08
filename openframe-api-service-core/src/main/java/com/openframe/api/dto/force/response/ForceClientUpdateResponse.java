package com.openframe.api.dto.force.response;

import lombok.Data;

import java.util.List;

@Data
public class ForceClientUpdateResponse {

    private List<ForceToolAgentUpdateResponseItem> items;

}
