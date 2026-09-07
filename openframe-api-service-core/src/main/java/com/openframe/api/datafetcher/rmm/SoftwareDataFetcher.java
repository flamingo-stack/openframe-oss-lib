package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.rmm.software.InstallSoftwareInput;
import com.openframe.api.dto.rmm.software.ScheduleUpdateSoftwareInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.UninstallSoftwareInput;
import com.openframe.api.service.rmm.software.SoftwareDispatchService;
import com.openframe.api.service.rmm.software.SoftwareInventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;

@DgsComponent
@ConditionalOnProperty(name = "openframe.software-management.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareDataFetcher {

    private final SoftwareInventoryService softwareInventoryService;
    private final SoftwareDispatchService softwareDispatchService;

    @DgsQuery
    public SoftwareResponse software(@InputArgument String id) {
        return softwareInventoryService.findById(id).orElse(null);
    }

    @DgsQuery
    public Object softwares(@InputArgument Object filter,
                            @InputArgument Integer first, @InputArgument String after,
                            @InputArgument Integer last, @InputArgument String before,
                            @InputArgument String search, @InputArgument Object sort) {
        log.debug("[software-mgmt stub] softwares query");
        return null;
    }

    @DgsQuery
    public Object softwareDevices(@InputArgument String softwareId, @InputArgument Object filter,
                                  @InputArgument Integer first, @InputArgument String after,
                                  @InputArgument Integer last, @InputArgument String before,
                                  @InputArgument String search, @InputArgument Object sort) {
        log.debug("[software-mgmt stub] softwareDevices query softwareId={}", softwareId);
        return null;
    }

    @DgsQuery
    public Object softwareVulnerabilities(@InputArgument String softwareId, @InputArgument Object filter,
                                          @InputArgument Integer first, @InputArgument String after,
                                          @InputArgument Integer last, @InputArgument String before,
                                          @InputArgument String search, @InputArgument Object sort) {
        log.debug("[software-mgmt stub] softwareVulnerabilities query softwareId={}", softwareId);
        return null;
    }

    @DgsQuery
    public Object softwareFilters(@InputArgument Object filter, @InputArgument String search) {
        log.debug("[software-mgmt stub] softwareFilters query");
        return null;
    }

    @DgsMutation
    public DispatchResponse installSoftware(@InputArgument InstallSoftwareInput input) {
        return softwareDispatchService.install(input, currentUserId());
    }

    @DgsMutation
    public DispatchResponse uninstallSoftware(@InputArgument UninstallSoftwareInput input) {
        return softwareDispatchService.uninstall(input, currentUserId());
    }

    @DgsMutation
    public DispatchResponse scheduleUpdateSoftware(@InputArgument ScheduleUpdateSoftwareInput input) {
        return softwareDispatchService.scheduleUpdate(input, currentUserId());
    }

    @DgsMutation
    public DispatchResponse cancelScheduledSoftware(@InputArgument String executionId) {
        return softwareDispatchService.cancelScheduled(executionId, currentUserId());
    }

    private String currentUserId() {
        return null;
    }

    private static final List<SoftwareResponse> UNUSED_SHAPE_REFERENCE = List.of();
}
