package com.openframe.api.controller;

import com.openframe.api.dto.toolinstallation.ForceToolInstallationRequest;
import com.openframe.api.dto.toolinstallation.ForceToolInstallationResponse;
import com.openframe.api.service.ForceToolInstallationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("tool-installation")
@RequiredArgsConstructor
public class AgentToolInstallationController {

    private final ForceToolInstallationService toolInstallationService;

    @PostMapping
    public ForceToolInstallationResponse forceToolInstallation(@RequestBody ForceToolInstallationRequest toolInstallationRequest) {
        return toolInstallationService.process(toolInstallationRequest);
    }

}
