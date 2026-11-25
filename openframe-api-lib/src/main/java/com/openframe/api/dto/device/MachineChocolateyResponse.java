package com.openframe.api.dto.device;

import com.openframe.data.document.device.chocolatey.ChocolateyAdminOption;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class MachineChocolateyResponse {

    private String version;
    private String edition;
    private boolean ours;
    private ChocolateyStatus status;
    private String reason;
    private List<ChocolateyAdminOption> options;
    private ChocolateyAdminOption decision;
}
