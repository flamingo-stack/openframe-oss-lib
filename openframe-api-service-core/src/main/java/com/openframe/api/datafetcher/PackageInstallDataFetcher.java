package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.packageinstall.InstallPackageInput;
import com.openframe.api.dto.packageinstall.UninstallPackageInput;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.service.packageinstall.PackageInstallService;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

// @Validated activates the @Valid input constraints — without it every @Pattern/@NotBlank here is dead
@DgsComponent
@RequiredArgsConstructor
@Validated
public class PackageInstallDataFetcher {

    private final PackageInstallService packageInstallService;

    @DgsMutation
    public DispatchResponse installPackage(@InputArgument @Valid InstallPackageInput input) {
        String initiatedBy = getCurrentUserId();
        return packageInstallService.install(input, initiatedBy);
    }

    @DgsMutation
    public DispatchResponse uninstallPackage(@InputArgument @Valid UninstallPackageInput input) {
        String initiatedBy = getCurrentUserId();
        return packageInstallService.uninstall(input, initiatedBy);
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
