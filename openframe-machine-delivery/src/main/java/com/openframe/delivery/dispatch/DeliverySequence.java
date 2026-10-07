package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.MachineDeliverySequence;
import com.openframe.data.repository.delivery.MachineDeliverySequenceRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

// read, increment, save under @Version: a concurrent increment loses on the version and retries, so no two dispatches
// of one row key get the same number and the order never goes backwards
@Component
@RequiredArgsConstructor
public class DeliverySequence {

    private final MachineDeliverySequenceRepository repository;

    @RetryOnOptimisticLockingFailure
    public int next(String id, String machineId) {
        MachineDeliverySequence counter = repository.findById(id).orElseGet(() -> fresh(id, machineId));
        int value = counter.getValue() + 1;
        counter.setValue(value);
        try {
            repository.save(counter);
        } catch (DuplicateKeyException createdConcurrently) {
            // two first dispatches of a new key at once: the second insert loses, which is the same conflict as a stale version
            throw new OptimisticLockingFailureException("Delivery sequence created concurrently: " + id, createdConcurrently);
        }
        return value;
    }

    private static MachineDeliverySequence fresh(String id, String machineId) {
        MachineDeliverySequence counter = new MachineDeliverySequence();
        counter.setId(id);
        counter.setMachineId(machineId);
        return counter;
    }
}
