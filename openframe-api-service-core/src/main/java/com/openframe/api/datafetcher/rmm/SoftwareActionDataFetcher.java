package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareActionFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionFilters;
import com.openframe.api.dto.rmm.software.SoftwareActionId;
import com.openframe.api.dto.rmm.software.SoftwareActionResponse;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.software.SoftwareActionDetailService;
import com.openframe.api.service.rmm.software.SoftwareActionService;
import com.openframe.audit.Audited;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.SCRIPT_OUTPUT_VIEW;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareActionDataFetcher {

    private final SoftwareActionService softwareActionService;
    private final SoftwareActionDetailService softwareActionDetailService;

    @DgsQuery
    public SoftwareActionResponse softwareAction(@InputArgument String id) {
        return softwareActionService.findById(id).orElse(null);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareActionResponse>> softwareActions(
            @InputArgument SoftwareActionFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = PageCursors.decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        return PageCursors.toConnection(softwareActionService.list(filter, search, sort, page, perPage));
    }

    @DgsQuery
    public SoftwareActionFilters softwareActionFilters(
            @InputArgument SoftwareActionFilterInput filter,
            @InputArgument String search) {
        return softwareActionService.filters(filter, search);
    }

    @DgsQuery
    public List<SoftwareActionDeviceResponse> softwareActionExecutions(
            @InputArgument String actionId,
            @InputArgument SoftwareActionDeviceFilterInput filter,
            @InputArgument String search) {
        SoftwareActionId id = SoftwareActionId.decode(actionId);
        return softwareActionDetailService.devices(id.executionId(), id.bundleId(), id.scheduleId(), filter, search);
    }

    @DgsData(parentType = "SoftwareActionDevice", field = "stdout")
    @DgsData(parentType = "SoftwareActionDevice", field = "stderr")
    @Audited(action = SCRIPT_OUTPUT_VIEW, targetType = DEVICE, targetId = "#dfe.source.machineId")
    public String output(DgsDataFetchingEnvironment dfe) {
        SoftwareActionDeviceResponse device = dfe.getSource();
        return "stdout".equals(dfe.getField().getName()) ? device.getStdout() : device.getStderr();
    }
}
