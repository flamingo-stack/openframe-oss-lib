package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.rmm.software.SoftwareSettingsInput;
import com.openframe.api.dto.rmm.software.SoftwareSettingsResponse;
import com.openframe.data.document.rmm.software.SoftwareSettings;
import com.openframe.data.service.rmm.software.SoftwareSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.validation.annotation.Validated;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Validated
public class SoftwareSettingsDataFetcher {

    private final SoftwareSettingsService softwareSettingsService;

    @DgsQuery
    public SoftwareSettingsResponse softwareSettings() {
        SoftwareSettings settings = softwareSettingsService.get();
        return toResponse(settings);
    }

    @DgsMutation
    public SoftwareSettingsResponse updateSoftwareSettings(@InputArgument @Valid SoftwareSettingsInput input) {
        SoftwareSettings settings = softwareSettingsService.update(input.getUpdateExistingChocolateyPackages());
        return toResponse(settings);
    }

    private static SoftwareSettingsResponse toResponse(SoftwareSettings settings) {
        return SoftwareSettingsResponse.builder()
                .updateExistingChocolateyPackages(settings.isUpdateExistingChocolateyPackages())
                .build();
    }
}
