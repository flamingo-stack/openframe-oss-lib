package com.openframe.client.service;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentLogKeyService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Criteria;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentLogKeyFetchServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final Instant KEY_CREATED_AT = Instant.parse("2026-03-01T10:00:00Z");
    private static final AgentKeyResponse KEY = new AgentKeyResponse("log-key", KEY_CREATED_AT);
    private static final Criteria FETCHED_ANOTHER_KEY = Criteria.where("fetchedLogKeyCreatedAt").ne(KEY_CREATED_AT);

    @Mock private AgentLogKeyService logKeyService;
    @Mock private MachineWriter machineWriter;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private AgentLogKeyFetchService service;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    private Object fetched;

    @Test
    void fetch_keyTheDeviceHasNotFetched_storesTheView() {
        deviceAsks();
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        deviceHasNotFetchedTheKey();

        service.fetch();

        assertThat(capturedCall().storeIf().test(fetched)).isTrue();
    }

    @Test
    void fetch_keyTheDeviceHasNotFetched_marksTheDeviceWithTheKeysCreationTime() {
        deviceAsks();
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        deviceHasNotFetchedTheKey();

        service.fetch();

        verify(machineWriter).update(eq(MACHINE_ID), eq(FETCHED_ANOTHER_KEY), updateCaptor.capture());
        Machine marked = new Machine();
        updateCaptor.getValue().applyTo(marked);
        assertThat(marked.getFetchedLogKeyCreatedAt()).isEqualTo(KEY_CREATED_AT);
    }

    @Test
    void fetch_keyTheDeviceAlreadyFetched_storesNoView() {
        deviceAsks();
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        deviceAlreadyFetchedTheKey();

        service.fetch();

        assertThat(capturedCall().storeIf().test(fetched)).isFalse();
    }

    private void deviceAsks() {
        AuditActor device = AuditActor.fromAgent(MACHINE_ID, List.of("AGENT"), "tenant-1");
        when(auditRecorder.context()).thenReturn(new AuditContext(device, null, null));
        when(logKeyService.current()).thenReturn(KEY);
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenAnswer(invocation -> {
            AuditedWork<?, ?> work = invocation.getArgument(1);
            fetched = work.run();
            return fetched;
        });
    }

    private void deviceHasNotFetchedTheKey() {
        when(machineWriter.update(eq(MACHINE_ID), eq(FETCHED_ANOTHER_KEY), any(MachineUpdate.class)))
                .thenReturn(Optional.of(new MachineWriteResult(new Machine(), new Machine())));
    }

    private void deviceAlreadyFetchedTheKey() {
        when(machineWriter.update(eq(MACHINE_ID), eq(FETCHED_ANOTHER_KEY), any(MachineUpdate.class)))
                .thenReturn(Optional.empty());
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
