package com.openframe.client.service;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentLogKeyService;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import static com.openframe.data.document.audit.AuditAction.AGENT_LOG_KEY_VIEW;
import static com.openframe.data.document.audit.AuditActorType.DEVICE;
import static com.openframe.data.service.machine.MachineFields.FETCHED_LOG_KEY_CREATED_AT;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

@Service
@RequiredArgsConstructor
public class AgentLogKeyFetchService {

    private final AgentLogKeyService logKeyService;
    private final MachineWriter machineWriter;
    private final AuditedMethodRunner auditedMethodRunner;
    private final AuditRecorder auditRecorder;

    public AgentKeyResponse fetch() {
        String machineId = machineIdOf(auditRecorder.context().actor());
        AuditCall auditCall = AuditCall.of(AGENT_LOG_KEY_VIEW, null)
                .withDeviceIdOf(_ -> machineId)
                .withStoreIf(fetched -> ((FetchedLogKey) fetched).firstFetch());
        return auditedMethodRunner.run(auditCall, () -> fetchKey(machineId)).key();
    }

    private static String machineIdOf(AuditActor actor) {
        return actor.type() == DEVICE ? actor.id() : null;
    }

    private FetchedLogKey fetchKey(String machineId) {
        AgentKeyResponse key = logKeyService.current();
        if (machineId == null || !auditedMethodRunner.isEnabled()) {
            return new FetchedLogKey(key, true);
        }
        Criteria anotherKey = Criteria.where(FETCHED_LOG_KEY_CREATED_AT.path()).ne(key.createdAt());
        boolean firstFetch = machineWriter.update(machineId, anotherKey,
                machineUpdate().set(FETCHED_LOG_KEY_CREATED_AT, key.createdAt())).isPresent();
        return new FetchedLogKey(key, firstFetch);
    }

    private record FetchedLogKey(AgentKeyResponse key, boolean firstFetch) {
    }
}
