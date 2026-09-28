package com.openframe.api.dto.rmm;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DispatchResponse {

    private String executionId;
}
