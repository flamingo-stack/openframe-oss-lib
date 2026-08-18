package com.openframe.api.dto.force.request;

import lombok.Data;

import java.util.List;

@Data
public class ForceClientUninstallRequest {

    private List<String> machineIds;

}
