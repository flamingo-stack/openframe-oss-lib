package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.OsUpdateOverrideResponse;
import com.openframe.api.mapper.OsUpdatePolicyResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OsUpdateOverrideServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String OS_UPDATE_ID = "os-update-1";
    private static final String IDENTIFIER = "kb-1";

    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private OsUpdateOverrideRepository osUpdateOverrideRepository;
    @Mock private OsUpdateService osUpdateService;
    @Mock private DeviceService deviceService;
    @Mock private DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;

    @Spy private OsUpdatePolicyResponseMapper osUpdatePolicyResponseMapper = new OsUpdatePolicyResponseMapper();
    @Captor private ArgumentCaptor<OsUpdateOverride> savedOsUpdateOverride;

    @InjectMocks private OsUpdateOverrideService osUpdateOverrideService;

    private OsUpdateOverride ofCustomer;

    @BeforeEach
    void setUp() {
        ofCustomer = OsUpdateOverride.builder()
                .id("override-1").tenantId(TENANT_ID).platform(OsPlatform.WINDOWS).identifier(IDENTIFIER)
                .organizationId("org-1").action(OsUpdateOverrideAction.HOLD).actedBy("user-0")
                .build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateService.getOsUpdate(OS_UPDATE_ID)).thenReturn(
                OsUpdate.builder().id(OS_UPDATE_ID).platform(OsPlatform.WINDOWS).identifier(IDENTIFIER).build());
        when(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, IDENTIFIER)).thenReturn(List.of(ofCustomer));
        when(osUpdateOverrideRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void setOverride_customerThatHasOne_replacesItsActionAndRefreshesEveryDevice() {
        // execution
        OsUpdateOverrideResponse saved = osUpdateOverrideService.setOverride(
                OS_UPDATE_ID, OsUpdateOverrideAction.APPROVE, "org-1", null, "user-1");

        // verifications
        verify(osUpdateOverrideRepository).save(ofCustomer);
        assertThat(saved.getAction()).isEqualTo(OsUpdateOverrideAction.APPROVE);
        assertThat(saved.getOrganizationId()).isEqualTo("org-1");
        assertThat(saved.getActedBy()).isEqualTo("user-1");
        assertThat(saved.getActedAt()).isNotNull();
        verify(deviceOsUpdateRolloutStateService).refreshAll();
    }

    @Test
    void setOverride_deviceWithoutOne_createsItForTheDeviceAndRefreshesOnlyThatDevice() {
        // execution
        OsUpdateOverrideResponse saved = osUpdateOverrideService.setOverride(
                OS_UPDATE_ID, OsUpdateOverrideAction.HOLD, null, "machine-1", "user-1");

        // verifications
        verify(osUpdateOverrideRepository).save(savedOsUpdateOverride.capture());
        assertThat(savedOsUpdateOverride.getValue()).isNotSameAs(ofCustomer);
        assertThat(savedOsUpdateOverride.getValue().getTenantId()).isEqualTo(TENANT_ID);
        assertThat(savedOsUpdateOverride.getValue().getPlatform()).isEqualTo(OsPlatform.WINDOWS);
        assertThat(savedOsUpdateOverride.getValue().getIdentifier()).isEqualTo(IDENTIFIER);
        assertThat(saved.getMachineId()).isEqualTo("machine-1");
        assertThat(saved.getOrganizationId()).isNull();
        verify(deviceService).verifyExists("machine-1");
        verify(deviceOsUpdateRolloutStateService).refreshMachines(List.of("machine-1"));
        verify(deviceOsUpdateRolloutStateService, never()).refreshAll();
    }

    @Test
    void setOverride_secondDeviceOfAnUpdateWithADeviceOverride_replacesTheOneOfThatDeviceOnly() {
        // setup
        OsUpdateOverride ofFirstDevice = OsUpdateOverride.builder()
                .id("override-2").identifier(IDENTIFIER).machineId("machine-1").action(OsUpdateOverrideAction.HOLD)
                .build();
        OsUpdateOverride ofSecondDevice = OsUpdateOverride.builder()
                .id("override-3").identifier(IDENTIFIER).machineId("machine-2").action(OsUpdateOverrideAction.HOLD)
                .build();
        when(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, IDENTIFIER)).thenReturn(List.of(ofFirstDevice, ofSecondDevice));

        // execution
        osUpdateOverrideService.setOverride(OS_UPDATE_ID, OsUpdateOverrideAction.REJECT, null, "machine-2", "user-1");

        // verifications
        verify(osUpdateOverrideRepository).save(ofSecondDevice);
        assertThat(ofSecondDevice.getAction()).isEqualTo(OsUpdateOverrideAction.REJECT);
        assertThat(ofFirstDevice.getAction()).isEqualTo(OsUpdateOverrideAction.HOLD);
    }

    @Test
    void setOverride_everyCustomer_createsOneWithoutACustomerOrADevice() {
        // execution
        OsUpdateOverrideResponse saved = osUpdateOverrideService.setOverride(
                OS_UPDATE_ID, OsUpdateOverrideAction.APPROVE, null, null, "user-1");

        // verifications
        verify(osUpdateOverrideRepository).save(savedOsUpdateOverride.capture());
        assertThat(savedOsUpdateOverride.getValue()).isNotSameAs(ofCustomer);
        assertThat(saved.getOrganizationId()).isNull();
        assertThat(saved.getMachineId()).isNull();
        verify(deviceOsUpdateRolloutStateService).refreshAll();
    }

    @Test
    void setOverride_customerAndDeviceTogether_refused() {
        // execution, verifications
        assertThatThrownBy(() -> osUpdateOverrideService.setOverride(
                OS_UPDATE_ID, OsUpdateOverrideAction.HOLD, "org-1", "machine-1", "user-1"))
                .isInstanceOf(ValidationException.class);
        verify(osUpdateOverrideRepository, never()).save(any());
    }

    @Test
    void removeOverride_customerThatHasOne_deletesItAndRefreshes() {
        // execution
        boolean removed = osUpdateOverrideService.removeOverride(OS_UPDATE_ID, "org-1", null);

        // verifications
        assertThat(removed).isTrue();
        verify(osUpdateOverrideRepository).delete(ofCustomer);
        verify(deviceOsUpdateRolloutStateService).refreshAll();
    }

    @Test
    void removeOverride_scopeWithoutOne_falseAndNothingDeleted() {
        // execution
        boolean removed = osUpdateOverrideService.removeOverride(OS_UPDATE_ID, "org-2", null);

        // verifications
        assertThat(removed).isFalse();
        verify(osUpdateOverrideRepository, never()).delete(any());
        verify(deviceOsUpdateRolloutStateService, never()).refreshAll();
    }

    @Test
    void listOverrides_osUpdate_theOverridesOfItsIdentifier() {
        // execution, verifications
        assertThat(osUpdateOverrideService.listOverrides(OS_UPDATE_ID)).containsExactly(
                OsUpdateOverrideResponse.builder()
                        .action(OsUpdateOverrideAction.HOLD).organizationId("org-1").actedBy("user-0")
                        .build());
    }
}
