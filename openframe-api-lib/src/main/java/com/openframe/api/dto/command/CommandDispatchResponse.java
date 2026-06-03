package com.openframe.api.dto.command;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CommandDispatchResponse {

    private String executionId;
}
