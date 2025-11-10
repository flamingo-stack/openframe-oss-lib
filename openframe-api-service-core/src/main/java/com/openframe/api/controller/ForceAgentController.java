package com.openframe.api.controller;

import com.openframe.api.dto.force.request.ForceToolInstallationAllRequest;
import com.openframe.api.dto.force.request.ForceToolInstallationRequest;
import com.openframe.api.dto.force.response.ForceClientUpdateResponse;
import com.openframe.api.dto.force.response.ForceToolAgentInstallationResponse;
import com.openframe.api.dto.update.ForceClientUpdateRequest;
import com.openframe.api.dto.update.ForceToolAgentUpdateAllRequest;
import com.openframe.api.dto.update.ForceToolAgentUpdateRequest;
import com.openframe.api.dto.update.ForceToolAgentUpdateResponse;
import com.openframe.api.service.ForceClientUpdateService;
import com.openframe.api.service.ForceToolAgentUpdateService;
import com.openframe.api.service.ForceToolInstallationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("force")
@RequiredArgsConstructor
public class ForceAgentController {

    private final ForceToolInstallationService toolInstallationService;
    private final ForceClientUpdateService clientUpdateService;
    private final ForceToolAgentUpdateService toolAgentUpdateService;

    @PostMapping("tool-agent/install")
    public ForceToolAgentInstallationResponse forceToolInstallation(@RequestBody ForceToolInstallationRequest request) {
        return toolInstallationService.process(request);
    }

    @PostMapping("client/update")
    public ForceClientUpdateResponse forceClientUpdate(@RequestBody ForceClientUpdateRequest request) {
        return clientUpdateService.process(request);
    }

    @PostMapping("tool-agent/update")
    public ForceToolAgentUpdateResponse forceToolAgentUpdate(@RequestBody ForceToolAgentUpdateRequest request) {
        return toolAgentUpdateService.process(request);
    }

    @PostMapping("client/update/all")
    public ForceClientUpdateResponse forceClientUpdateAll() {
        return clientUpdateService.processAll();
    }

    @PostMapping("tool-agent/install/all")
    public ForceToolAgentInstallationResponse forceToolInstallationAll(@RequestBody ForceToolInstallationAllRequest request) {
        return toolInstallationService.processAll(request.getToolAgentId());
    }

    @PostMapping("tool-agent/update/all")
    public ForceToolAgentUpdateResponse forceToolAgentUpdateAll(@RequestBody ForceToolAgentUpdateAllRequest request) {
        return toolAgentUpdateService.processAll(request.getToolAgentId());
    }

}

