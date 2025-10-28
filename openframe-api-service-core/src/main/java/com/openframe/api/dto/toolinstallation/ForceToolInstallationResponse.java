package com.openframe.api.dto.toolinstallation;

import lombok.Data;

import java.util.List;

@Data
public class ForceToolInstallationResponse {

    private List<ForceToolInstallationResponseItem> items;
    private ForceToolInstallationRequestStatus status;

}
