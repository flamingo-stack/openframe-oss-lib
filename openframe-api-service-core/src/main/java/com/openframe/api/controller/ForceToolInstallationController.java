package com.openframe.api.controller;

import com.openframe.api.dto.toolinstallation.ForceToolInstallationRequest;
import com.openframe.api.dto.toolinstallation.ForceToolInstallationResponse;
import com.openframe.api.service.ForceToolInstallationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("tool-agent")
@RequiredArgsConstructor
public class ForceToolInstallationController {

    private final ForceToolInstallationService toolInstallationService;

    @PostMapping("force-install")
    public ForceToolInstallationResponse forceToolInstallation(@RequestBody ForceToolInstallationRequest toolInstallationRequest) {
        return toolInstallationService.install(toolInstallationRequest);
    }

}
