package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.publishing.MachineAggregateSpec;
import com.openframe.publishing.api.OutboxPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;

import static com.openframe.data.service.machine.MachineFields.UPDATED_AT;

@Service
@Slf4j
@RequiredArgsConstructor
public class MachineWriter {

    private static final String MACHINE_ID_FIELD = "machineId";
    private static final String ID_FIELD = "_id";
    // The machine fields MachineEvent carries; a write of any other field changes no projection, so it is not published.
    private static final String HOSTNAME_PATH = MachineFields.HOSTNAME.path();
    private static final String NICKNAME_PATH = MachineFields.NICKNAME.path();
    static final Set<String> EVENT_PATHS = Set.of(HOSTNAME_PATH, NICKNAME_PATH);

    private final MongoTemplate mongoTemplate;
    // Present only while publishing is on: a write here must reach the projections like a MachineRepository save.
    private final ObjectProvider<OutboxPublisher> outboxPublisher;
    private final ObjectProvider<MachineAggregateSpec> machineSpec;

    public Optional<MachineWriteResult> update(String machineId, MachineUpdate update) {
        return update(machineId, null, update);
    }

    public Optional<MachineWriteResult> update(String machineId, Criteria guard, MachineUpdate update) {
        if (update.isEmpty()) {
            log.debug("No fields to update for machineId={}", machineId);
            return Optional.empty();
        }
        update.set(UPDATED_AT, Instant.now());

        Criteria criteria = Criteria.where(MACHINE_ID_FIELD).is(machineId);
        if (guard != null) {
            criteria = new Criteria().andOperator(criteria, guard);
        }

        Query query = Query.query(criteria);
        Update mongoUpdate = update.toMongoUpdate();
        FindAndModifyOptions returnOld = FindAndModifyOptions.options().returnNew(false);
        Supplier<Machine> write = () -> mongoTemplate.findAndModify(query, mongoUpdate, returnOld, Machine.class);
        Machine before = runPublishingIfEventFields(machineId, update, write);

        if (before == null) {
            log.info("Machine update matched nothing, skipping: machineId={}, fields={}",
                    machineId, update.paths());
            return Optional.empty();
        }

        Machine after = copyOf(before);
        update.applyTo(after);

        log.debug("Updated machineId={}, fields={}", machineId, update.paths());
        return Optional.of(new MachineWriteResult(before, after));
    }

    // Status and heartbeat writes stay outside a transaction, so they neither publish nor meet a write conflict.
    private Machine runPublishingIfEventFields(String machineId, MachineUpdate update, Supplier<Machine> write) {
        Set<String> paths = update.paths();
        boolean changesEvent = paths.stream().anyMatch(EVENT_PATHS::contains);
        if (!changesEvent) {
            return write.get();
        }
        return runPublishing(machineId, write);
    }

    // The write returns the old document, so the publisher reads the machine again after it, in the same transaction.
    private Machine runPublishing(String machineId, Supplier<Machine> write) {
        OutboxPublisher publisher = outboxPublisher.getIfAvailable();
        MachineAggregateSpec spec = machineSpec.getIfAvailable();
        if (publisher == null || spec == null) {
            return write.get();
        }
        String id = findIdByMachineId(machineId);
        if (id == null) {
            return write.get();
        }
        List<String> ids = List.of(id);
        return publisher.publishChangedByIds(spec, ids, write);
    }

    private String findIdByMachineId(String machineId) {
        Criteria byMachineId = Criteria.where(MACHINE_ID_FIELD).is(machineId);
        Query query = Query.query(byMachineId);
        query.fields().include(ID_FIELD);
        Machine machine = mongoTemplate.findOne(query, Machine.class);
        return machine == null ? null : machine.getId();
    }

    private static Machine copyOf(Machine source) {
        Machine copy = new Machine();
        BeanUtils.copyProperties(source, copy);
        return copy;
    }
}
