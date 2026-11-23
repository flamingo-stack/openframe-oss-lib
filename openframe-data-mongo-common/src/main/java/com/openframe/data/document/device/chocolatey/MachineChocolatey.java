package com.openframe.data.document.device.chocolatey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MachineChocolatey {

    private String version;
    private String edition;
    private boolean ours;
    private ChocolateyStatus status;
    private String reason;
    private List<String> packages;
    private List<String> existingPackages;
}
