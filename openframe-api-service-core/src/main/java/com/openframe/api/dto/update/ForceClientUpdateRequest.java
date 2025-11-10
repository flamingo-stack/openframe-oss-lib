package com.openframe.api.dto.update;

import lombok.Data;

import java.util.List;

@Data
public class ForceClientUpdateRequest {

    private List<String> machineId;

}

