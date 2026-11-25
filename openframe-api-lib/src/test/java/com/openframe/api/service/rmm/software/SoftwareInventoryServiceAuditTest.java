package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.service.rmm.software.SoftwareInventoryService.AutoUpdateTurnedOff;
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
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.SOFTWARE_AUTO_UPDATE_DISABLE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SoftwareInventoryServiceAuditTest {

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private SoftwareInventoryService service;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void turnOffAutoUpdate_storesTheEventOnTheSoftware() {
        assertThat(capturedCall())
                .returns(SOFTWARE_AUTO_UPDATE_DISABLE, AuditCall::action)
                .returns("42", turnOffCall -> turnOffCall.targetIdBeforeCall().get())
                .returns(false, AuditCall::compare);
    }

    @Test
    void turnOffAutoUpdate_onForTwoDevices_storesThemAsMachineIdsAndRemoved() {
        AutoUpdateTurnedOff turnedOff = turnedOffOn("m1", "m2");

        AuditCall call = capturedCall();

        assertThat(call.storeIf().test(turnedOff)).isTrue();
        assertThat(call.detailsFromResult().apply(turnedOff)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "machineIds", List.of("m1", "m2"), "removed", List.of("m1", "m2")));
        assertThat(call.targetNameOf().apply(turnedOff)).isEqualTo("Google Chrome");
    }

    @Test
    void turnOffAutoUpdate_alreadyOff_storesNoEvent() {
        assertThat(capturedCall().storeIf().test(turnedOffOn())).isFalse();
    }

    @Test
    void turnOffAutoUpdate_unknownSoftware_failureEventListsNoDevices() {
        AuditCall call = capturedCall();

        assertThat(call.detailsFromResult().apply(null)).isEmpty();
        assertThat(call.targetNameOf().apply(null)).isNull();
    }

    private static AutoUpdateTurnedOff turnedOffOn(String... machineIds) {
        SoftwareResponse chrome = SoftwareResponse.builder().id("42").name("Google Chrome").build();
        return new AutoUpdateTurnedOff(chrome, List.of(machineIds));
    }

    private AuditCall capturedCall() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(service);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        SoftwareInventoryService audited = proxyFactory.getProxy();
        audited.turnOffAutoUpdate("42", "admin@x");
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
