package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.rmm.osupdate.OsUpdateOverrideInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.mapper.OsUpdatePolicyGraphQLMapper;
import com.openframe.api.service.rmm.osupdate.OsUpdateOverrideService;
import com.openframe.api.service.rmm.osupdate.OsUpdatePolicyService;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdatePolicyDataFetcher {

    private final OsUpdatePolicyService osUpdatePolicyService;
    private final OsUpdateOverrideService osUpdateOverrideService;
    private final OsUpdatePolicyGraphQLMapper osUpdatePolicyGraphQLMapper;

    @DgsQuery
    public List<OsUpdatePolicyResponse> osUpdatePolicies() {
        return osUpdatePolicyService.listPolicies().stream().map(osUpdatePolicyGraphQLMapper::toGraphQL).toList();
    }

    @DgsQuery
    public OsUpdatePolicyResponse osUpdatePolicy(@InputArgument String id) {
        return osUpdatePolicyService.findPolicy(id).map(osUpdatePolicyGraphQLMapper::toGraphQL).orElse(null);
    }

    @DgsQuery
    public OsUpdatePolicyResponse deviceOsUpdatePolicy(@InputArgument String machineId) {
        return osUpdatePolicyService.findPolicyOfDevice(machineId)
                .map(osUpdatePolicyGraphQLMapper::toGraphQL)
                .orElse(null);
    }

    @DgsQuery
    public List<OsUpdateOverride> osUpdateOverrides(@InputArgument String osUpdateId) {
        return osUpdateOverrideService.listOverrides(osUpdateId);
    }

    @DgsMutation
    public OsUpdatePolicyResponse createOsUpdatePolicy(@InputArgument OsUpdatePolicyInput input) {
        OsUpdatePolicyResponse osUpdatePolicyResponse =
                osUpdatePolicyService.createPolicy(osUpdatePolicyGraphQLMapper.toCommand(input));
        return osUpdatePolicyGraphQLMapper.toGraphQL(osUpdatePolicyResponse);
    }

    @DgsMutation
    public OsUpdatePolicyResponse updateOsUpdatePolicy(@InputArgument String id,
                                                       @InputArgument OsUpdatePolicyInput input) {
        OsUpdatePolicyResponse osUpdatePolicyResponse =
                osUpdatePolicyService.updatePolicy(id, osUpdatePolicyGraphQLMapper.toCommand(input));
        return osUpdatePolicyGraphQLMapper.toGraphQL(osUpdatePolicyResponse);
    }

    @DgsMutation
    public String deleteOsUpdatePolicy(@InputArgument String id) {
        osUpdatePolicyService.deletePolicy(id);
        return id;
    }

    @DgsMutation
    public OsUpdateOverride setOsUpdateOverride(@InputArgument OsUpdateOverrideInput input,
                                                @AuthenticationPrincipal AuthPrincipal principal) {
        return osUpdateOverrideService.setOverride(input.getOsUpdateId(), input.getAction(),
                input.getOrganizationId(), input.getMachineId(), principal.getId());
    }

    @DgsMutation
    public boolean removeOsUpdateOverride(@InputArgument String osUpdateId, @InputArgument String organizationId,
                                          @InputArgument String machineId) {
        return osUpdateOverrideService.removeOverride(osUpdateId, organizationId, machineId);
    }
}
