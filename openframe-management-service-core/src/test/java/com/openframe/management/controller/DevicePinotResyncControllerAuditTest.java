package com.openframe.management.controller;

import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.MachineTagEventService;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DevicePinotResyncControllerAuditTest {

    @Mock private MachineRepository machineRepository;
    @Mock private MachineTagEventService machineTagEventService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private DevicePinotResyncController controller;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void resyncAllDevicesToPinot_noDevice_storesNoEvent() {
        ResponseEntity<Map<String, Object>> answer = answerFor(List.of());

        audited().resyncAllDevicesToPinot();

        assertThat(capturedCall().storeIf().test(answer)).isFalse();
    }

    @Test
    void resyncAllDevicesToPinot_oneDevice_storesTheEvent() {
        ResponseEntity<Map<String, Object>> answer = answerFor(List.of(new Machine()));

        audited().resyncAllDevicesToPinot();

        assertThat(capturedCall().storeIf().test(answer)).isTrue();
    }

    private ResponseEntity<Map<String, Object>> answerFor(List<Machine> machines) {
        when(machineRepository.findAll()).thenReturn(machines);
        return controller.resyncAllDevicesToPinot();
    }

    private DevicePinotResyncController audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(controller);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
