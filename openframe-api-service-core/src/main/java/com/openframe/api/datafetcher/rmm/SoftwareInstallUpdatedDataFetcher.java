package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.service.rmm.software.SoftwareInstallUpdateManagementService;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class SoftwareInstallUpdatedDataFetcher {

    private final SoftwareInstallUpdateManagementService softwareInstallUpdateManagementService;

    @DgsMutation
    public List<SoftwareDispatchResult> installSoftware(@InputArgument @Valid SoftwareManagementInput input) {
        return softwareInstallUpdateManagementService.install(input, getCurrentUserId(), ExecutionSource.MANUAL);
    }

    @DgsMutation
    public List<SoftwareDispatchResult> updateSoftware(@InputArgument @Valid SoftwareManagementInput input) {
        return softwareInstallUpdateManagementService.update(input, getCurrentUserId(), ExecutionSource.MANUAL);
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
