package com.openframe.api.service.rmm.software;

import com.openframe.api.service.rmm.schedule.ScheduleDeviceChange;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SoftwareScheduleServiceAuditTest {

    private static final String SCHEDULE_ID = "65f4a8000000000000000001";
    private static final String ACTOR = "user-1";
    private static final List<String> ASKED = List.of("m1", "m2");

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private SoftwareScheduleService service;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void setDevices_refused_keepsTheAskedDevices() {
        audited().setDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsEntry("machineIds", ASKED);
    }

    @Test
    void setDevices_switchedFromCriteria_marksTheSwitch() {
        audited().setDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().detailsFromResult().apply(new ScheduleDeviceChange(List.of(), List.of(), true)))
                .containsEntry("switchedFromCriteria", true);
    }

    @Test
    void setDevices_nothingChanged_storesNoEvent() {
        audited().setDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().storeIf().test(new ScheduleDeviceChange(List.of(), List.of(), false))).isFalse();
    }

    @Test
    void addDevices_refused_keepsTheAskedDevices() {
        audited().addDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsEntry("machineIds", ASKED);
    }

    @Test
    void addDevices_someAlreadyAssigned_listsOnlyTheAddedDevices() {
        audited().addDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().detailsFromResult().apply(new ScheduleDeviceChange(List.of("m2"), List.of(), false)))
                .containsEntry("machineIds", List.of("m2"));
    }

    @Test
    void addDevices_nothingAdded_storesNoEvent() {
        audited().addDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().storeIf().test(new ScheduleDeviceChange(List.of(), List.of(), false))).isFalse();
    }

    @Test
    void removeDevices_refused_keepsTheAskedDevices() {
        audited().removeDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsEntry("machineIds", ASKED);
    }

    @Test
    void removeDevices_someNotAssigned_listsOnlyTheRemovedDevices() {
        audited().removeDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().detailsFromResult().apply(List.of("m1"))).containsEntry("machineIds", List.of("m1"));
    }

    @Test
    void removeDevices_nothingRemoved_storesNoEvent() {
        audited().removeDevices(SCHEDULE_ID, ASKED, ACTOR);

        assertThat(capturedCall().storeIf().test(List.of())).isFalse();
    }

    private SoftwareScheduleService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(service);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
