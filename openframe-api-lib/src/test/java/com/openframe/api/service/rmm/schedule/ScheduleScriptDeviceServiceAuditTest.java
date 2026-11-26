package com.openframe.api.service.rmm.schedule;

import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ScheduleScriptDeviceServiceAuditTest {

    private static final String SCHEDULE_ID = "schedule-1";
    private static final List<String> ASKED_IDS = List.of("m-1", "m-2");

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ScheduleDeviceTargetResolver targetResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    @Mock private ScheduleDeliveryRefresher deliveryRefresher;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private ScheduleScriptDeviceService deviceService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void setDevices_refused_keepsTheAskedDevicesInTheDetails() {
        audited().setDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().detailsFromResult().apply(null))
                .containsExactlyInAnyOrderEntriesOf(Map.of("machineIds", ASKED_IDS));
    }

    @Test
    void setDevices_nothingChanged_storesNoEvent() {
        audited().setDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().storeIf().test(new ScheduleDeviceChange(List.of(), List.of(), false))).isFalse();
    }

    @Test
    void addDevices_refused_keepsTheAskedDevicesInTheDetails() {
        audited().addDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().detailsFromResult().apply(null))
                .containsExactlyInAnyOrderEntriesOf(Map.of("machineIds", ASKED_IDS));
    }

    @Test
    void addDevices_someAlreadyAssigned_storesOnlyTheAddedDevices() {
        audited().addDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().detailsFromResult().apply(new ScheduleDeviceChange(List.of("m-2"), List.of(), false)))
                .containsEntry("machineIds", List.of("m-2"));
    }

    @Test
    void addDevices_allAlreadyAssigned_storesNoEvent() {
        audited().addDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().storeIf().test(new ScheduleDeviceChange(List.of(), List.of(), false))).isFalse();
    }

    @Test
    void removeDevices_noneWasAssigned_storesNoEvent() {
        audited().removeDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().storeIf().test(List.of())).isFalse();
    }

    @Test
    void removeDevices_refused_keepsTheAskedDevicesInTheDetails() {
        audited().removeDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().detailsFromResult().apply(null))
                .containsExactlyInAnyOrderEntriesOf(Map.of("machineIds", ASKED_IDS));
    }

    @Test
    void removeDevices_someNotAssigned_storesOnlyTheRemovedDevices() {
        audited().removeDevices(SCHEDULE_ID, ASKED_IDS, "user-1");

        assertThat(capturedCall().detailsFromResult().apply(List.of("m-2")))
                .containsExactlyInAnyOrderEntriesOf(Map.of("machineIds", List.of("m-2")));
    }

    private ScheduleScriptDeviceService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(deviceService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
