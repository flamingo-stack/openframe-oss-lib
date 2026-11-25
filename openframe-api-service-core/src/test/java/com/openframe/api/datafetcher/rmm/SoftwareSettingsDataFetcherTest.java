package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.rmm.software.SoftwareSettingsInput;
import com.openframe.api.dto.rmm.software.SoftwareSettingsResponse;
import com.openframe.data.document.rmm.software.SoftwareSettings;
import com.openframe.data.service.rmm.software.SoftwareSettingsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareSettingsDataFetcherTest {

    private static final String TENANT = "t1";

    @Mock private SoftwareSettingsService softwareSettingsService;

    @InjectMocks private SoftwareSettingsDataFetcher dataFetcher;

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void softwareSettings_storedFlag_returned(boolean stored) {
        // setup
        when(softwareSettingsService.get()).thenReturn(settings(stored));

        // execution
        SoftwareSettingsResponse response = dataFetcher.softwareSettings();

        // verifications
        assertThat(response.isUpdateExistingChocolateyPackages()).isEqualTo(stored);
        verify(softwareSettingsService, never()).update(anyBoolean());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void updateSoftwareSettings_value_serviceUpdatedWithIt(boolean value) {
        // setup
        SoftwareSettingsInput input = input(value);
        when(softwareSettingsService.update(value)).thenReturn(settings(value));

        // execution
        SoftwareSettingsResponse response = dataFetcher.updateSoftwareSettings(input);

        // verifications
        verify(softwareSettingsService).update(value);
        assertThat(response.isUpdateExistingChocolateyPackages()).isEqualTo(value);
    }

    @Test
    void updateSoftwareSettings_serviceAnswersTheStoredSettings_theServiceResultIsReturnedNotTheInput() {
        // setup
        SoftwareSettingsInput input = input(true);
        when(softwareSettingsService.update(true)).thenReturn(settings(false));

        // execution
        SoftwareSettingsResponse response = dataFetcher.updateSoftwareSettings(input);

        // verifications
        assertThat(response.isUpdateExistingChocolateyPackages()).isFalse();
    }

    private static SoftwareSettings settings(boolean updateExistingChocolateyPackages) {
        return SoftwareSettings.builder()
                .tenantId(TENANT)
                .updateExistingChocolateyPackages(updateExistingChocolateyPackages)
                .build();
    }

    private static SoftwareSettingsInput input(boolean updateExistingChocolateyPackages) {
        SoftwareSettingsInput input = new SoftwareSettingsInput();
        input.setUpdateExistingChocolateyPackages(updateExistingChocolateyPackages);
        return input;
    }
}
