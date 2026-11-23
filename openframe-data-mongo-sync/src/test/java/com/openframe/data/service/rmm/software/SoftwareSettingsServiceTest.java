package com.openframe.data.service.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareSettings;
import com.openframe.data.repository.rmm.software.SoftwareSettingsRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareSettingsServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SETTINGS_ID = "settings-1";

    @Mock private SoftwareSettingsRepository softwareSettingsRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @Captor private ArgumentCaptor<SoftwareSettings> settingsCaptor;

    @InjectMocks private SoftwareSettingsService service;

    private SoftwareSettings stored;

    @BeforeEach
    void setUp() {
        stored = SoftwareSettings.builder()
                .id(SETTINGS_ID)
                .tenantId(TENANT_ID)
                .updateExistingChocolateyPackages(true)
                .build();
    }

    @Test
    void get_noDocument_defaultFalse() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.empty());

        // execution
        SoftwareSettings result = service.get();

        // verifications
        assertThat(result.isUpdateExistingChocolateyPackages()).isFalse();
    }

    @Test
    void get_noDocument_nothingSaved() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.empty());

        // execution
        service.get();

        // verifications
        verify(softwareSettingsRepository, never()).save(any(SoftwareSettings.class));
    }

    @Test
    void get_documentOfTheTenant_returned() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.of(stored));

        // execution
        SoftwareSettings result = service.get();

        // verifications
        assertThat(result).isEqualTo(stored);
    }

    @Test
    void updatesExistingChocolateyPackages_noDocument_false() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.empty());

        // execution
        boolean result = service.updatesExistingChocolateyPackages();

        // verifications
        assertThat(result).isFalse();
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void updatesExistingChocolateyPackages_documentOfTheTenant_itsValue(boolean updateExisting) {
        // setup
        stored.setUpdateExistingChocolateyPackages(updateExisting);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.of(stored));

        // execution
        boolean result = service.updatesExistingChocolateyPackages();

        // verifications
        assertThat(result).isEqualTo(updateExisting);
    }

    @Test
    void update_noDocument_newDocumentSavedForTheTenant() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.empty());
        when(softwareSettingsRepository.save(any(SoftwareSettings.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // execution
        service.update(true);

        // verifications
        verify(softwareSettingsRepository).save(settingsCaptor.capture());
        assertThat(settingsCaptor.getValue())
                .extracting(SoftwareSettings::getTenantId, SoftwareSettings::isUpdateExistingChocolateyPackages)
                .containsExactly(TENANT_ID, true);
    }

    @Test
    void update_noDocument_savedSettingsReturned() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.empty());
        when(softwareSettingsRepository.save(any(SoftwareSettings.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // execution
        SoftwareSettings result = service.update(true);

        // verifications
        verify(softwareSettingsRepository).save(settingsCaptor.capture());
        assertThat(result).isSameAs(settingsCaptor.getValue());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void update_documentOfTheTenant_sameDocumentSavedWithTheNewValue(boolean updateExisting) {
        // setup
        stored.setUpdateExistingChocolateyPackages(!updateExisting);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(softwareSettingsRepository.findByTenantId(TENANT_ID)).thenReturn(Optional.of(stored));
        when(softwareSettingsRepository.save(any(SoftwareSettings.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // execution
        service.update(updateExisting);

        // verifications
        verify(softwareSettingsRepository).save(settingsCaptor.capture());
        assertThat(settingsCaptor.getValue())
                .extracting(SoftwareSettings::getId, SoftwareSettings::getTenantId,
                        SoftwareSettings::isUpdateExistingChocolateyPackages)
                .containsExactly(SETTINGS_ID, TENANT_ID, updateExisting);
    }
}
