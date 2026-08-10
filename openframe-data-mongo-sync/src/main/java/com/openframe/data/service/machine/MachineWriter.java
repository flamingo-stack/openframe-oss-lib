package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.data.service.machine.MachineFields.UPDATED_AT;

@Service
@Slf4j
@RequiredArgsConstructor
public class MachineWriter {

    private static final String MACHINE_ID_FIELD = "machineId";

    private final MongoTemplate mongoTemplate;

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

        Machine before = mongoTemplate.findAndModify(
                Query.query(criteria),
                update.toMongoUpdate(),
                FindAndModifyOptions.options().returnNew(false),
                Machine.class);

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

    private static Machine copyOf(Machine source) {
        Machine copy = new Machine();
        BeanUtils.copyProperties(source, copy);
        return copy;
    }
}
