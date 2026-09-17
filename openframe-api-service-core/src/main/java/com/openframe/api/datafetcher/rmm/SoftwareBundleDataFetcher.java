package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.rmm.software.CreateSoftwareBundleInput;
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareBundleInput;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
@Validated
public class SoftwareBundleDataFetcher {

    private final SoftwareBundleService softwareBundleService;

    @DgsQuery
    public SoftwareBundleResponse softwareBundle(@InputArgument String id) {
        return softwareBundleService.findById(id).orElse(null);
    }

    @DgsQuery
    public List<SoftwareBundleResponse> softwareBundles(@InputArgument SoftwareBundleStatus status) {
        return softwareBundleService.list(status);
    }

    @DgsMutation
    public SoftwareBundleResponse createSoftwareBundle(@InputArgument @Valid CreateSoftwareBundleInput input) {
        return softwareBundleService.create(input, getCurrentUserId());
    }

    @DgsMutation
    public SoftwareBundleResponse updateSoftwareBundle(@InputArgument @Valid UpdateSoftwareBundleInput input) {
        return softwareBundleService.update(input, getCurrentUserId());
    }

    @DgsMutation
    public boolean deleteSoftwareBundle(@InputArgument String id) {
        return softwareBundleService.delete(id, getCurrentUserId());
    }

    @DgsMutation
    public SoftwareBundleResponse runSoftwareBundle(@InputArgument String id) {
        return softwareBundleService.run(id, getCurrentUserId());
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
