package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.document.rmm.script.ExecutionSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@ConditionalOnProperty("spring.cloud.stream.enabled")
@RequiredArgsConstructor
public class SoftwareInstallUpdateManagementService {

    private final PackageManagerRegistry packageManagerRegistry;
    private final ScriptService scriptService;
    private final SoftwareDispatchService softwareDispatchService;

    public List<SoftwareDispatchResult> install(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.INSTALL, input, initiatedBy, source);
    }

    public List<SoftwareDispatchResult> update(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.UPDATE, input, initiatedBy, source);
    }

    private List<SoftwareDispatchResult> dispatch(SoftwareAction action, SoftwareManagementInput input,
                                                  String initiatedBy, ExecutionSource source) {
        List<String> machineIds = input.getMachineIds();
        Map<SoftwareScriptCode, ScriptResponse> scriptCache = new EnumMap<>(SoftwareScriptCode.class);

        List<SoftwareDispatchResult> results = new ArrayList<>(input.getPackages().size());
        for (SoftwarePackageInput pkg : input.getPackages()) {
            PackageManagerHandler handler = packageManagerRegistry.handlerFor(pkg.getPackageManager());
            SoftwareScriptCode code = handler.scriptCode(action);
            ScriptResponse script = scriptCache.computeIfAbsent(code, scriptService::getSoftwareScript);
            List<String> args = handler.buildArgs(pkg.getPackageName(), pkg.getPackageType());

            String executionId = softwareDispatchService.dispatch(script, machineIds, args, initiatedBy, source);

            results.add(SoftwareDispatchResult.builder()
                    .packageManager(pkg.getPackageManager())
                    .packageName(pkg.getPackageName())
                    .executionId(executionId)
                    .build());
        }

        log.info("Software {} dispatched: packages={} machines={} initiatedBy={} source={}",
                action, input.getPackages().size(), machineIds.size(), initiatedBy, source);
        return results;
    }
}
