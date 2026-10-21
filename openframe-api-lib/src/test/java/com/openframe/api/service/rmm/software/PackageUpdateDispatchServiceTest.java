package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.data.nats.packageupdate.UpdateMode;
import com.openframe.data.nats.packageupdate.UpdateSource;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageUpdateDispatchServiceTest {

    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Mock private PackageUpdateRequestRepository requestRepository;
    @Mock private PackageUpdateDeviceStateRepository deviceStateRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private PackageUpdateDispatchService service;

    private SoftwarePackageInput pkg(PackageManagerType manager, String name, BrewPackageType brew) {
        SoftwarePackageInput p = new SoftwarePackageInput();
        p.setPackageManager(manager);
        p.setPackageName(name);
        p.setBrewPackageType(brew);
        return p;
    }

    @Test
    void adminUpdateNow_winget_persistsRequestDeviceStatesAndOrdersPerMachine() {
        when(tenantIdProvider.getTenantId()).thenReturn("t1");

        service.dispatchAdminUpdateNow("req-1", SoftwareAction.UPDATE,
                pkg(PackageManagerType.WINGET, "Google.Chrome", null), List.of("m1", "m2"), "admin@x");

        ArgumentCaptor<PackageUpdateRequest> req = ArgumentCaptor.forClass(PackageUpdateRequest.class);
        verify(requestRepository).save(req.capture());
        PackageUpdateRequest r = req.getValue();
        assertThat(r.getTenantId()).isEqualTo("t1");
        assertThat(r.getRequestId()).isEqualTo("req-1");
        assertThat(r.getAction()).isEqualTo(SoftwareAction.UPDATE);
        assertThat(r.getSource()).isEqualTo(PackageUpdateSource.ADMIN);
        assertThat(r.getMode()).isEqualTo(PackageUpdateMode.WAIT);          // admin Update now never forces
        assertThat(r.getDeadlineSeconds()).isNull();
        assertThat(r.getForceCountdownSeconds()).isEqualTo(300);
        assertThat(r.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(r.getTotalMachineCount()).isEqualTo(2);
        assertThat(r.getAttempts()).isEqualTo(1);

        ArgumentCaptor<List<PackageUpdateDeviceState>> states = ArgumentCaptor.forClass(List.class);
        verify(deviceStateRepository).saveAll(states.capture());
        assertThat(states.getValue()).hasSize(2)
                .allSatisfy(s -> {
                    assertThat(s.getRequestId()).isEqualTo("req-1");
                    assertThat(s.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
                    assertThat(s.getMode()).isEqualTo(PackageUpdateMode.WAIT);
                });

        ArgumentCaptor<PackageUpdateDeliverySeed> seed = ArgumentCaptor.forClass(PackageUpdateDeliverySeed.class);
        verify(deliveryDispatcher, times(2)).dispatch(seed.capture());
        PackageUpdateDeliverySeed s1 = seed.getAllValues().get(0);
        assertThat(s1.getRequestId()).isEqualTo("req-1");
        assertThat(s1.getMode()).isEqualTo(UpdateMode.WAIT);
        assertThat(s1.getCountdownSeconds()).isNull();                       // WAIT carries no countdown
        assertThat(s1.getSource().getKind()).isEqualTo(UpdateSource.Kind.MANUAL);
        assertThat(s1.getSource().getOrigin()).isEqualTo(UpdateSource.Origin.ADMIN);
        assertThat(s1.getPackageRef().getManager()).isEqualTo(PackageManagerType.WINGET);
        assertThat(s1.getPackageRef().getId()).isEqualTo("Google.Chrome");
        assertThat(s1.getPackageRef().getName()).isNull();
        assertThat(seed.getAllValues()).extracting(PackageUpdateDeliverySeed::getMachineId)
                .containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    void dispatch_forceBrew_passesCountdownAndBrewReference() {
        when(tenantIdProvider.getTenantId()).thenReturn("t1");

        service.dispatch("req-2", SoftwareAction.INSTALL,
                pkg(PackageManagerType.BREW, "postman", BrewPackageType.CASK), List.of("m1"),
                PackageUpdateSource.AUTO, "system", PackageUpdateMode.FORCE, 120, null);

        ArgumentCaptor<PackageUpdateDeliverySeed> seed = ArgumentCaptor.forClass(PackageUpdateDeliverySeed.class);
        verify(deliveryDispatcher).dispatch(seed.capture());
        PackageUpdateDeliverySeed s = seed.getValue();
        assertThat(s.getMode()).isEqualTo(UpdateMode.FORCE);
        assertThat(s.getCountdownSeconds()).isEqualTo(120);
        assertThat(s.getSource().getKind()).isEqualTo(UpdateSource.Kind.AUTO);
        assertThat(s.getSource().getOrigin()).isNull();                      // AUTO carries no origin
        assertThat(s.getPackageRef().getManager()).isEqualTo(PackageManagerType.BREW);
        assertThat(s.getPackageRef().getKind()).isEqualTo(BrewPackageType.CASK);
        assertThat(s.getPackageRef().getName()).isEqualTo("postman");
        assertThat(s.getPackageRef().getId()).isNull();                      // brew: no winget id
    }
}
