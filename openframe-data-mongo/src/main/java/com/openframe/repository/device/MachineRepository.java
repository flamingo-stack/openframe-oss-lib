package com.openframe.repository.device;

import com.openframe.document.device.Machine;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MachineRepository extends MongoRepository<Machine, String> {
    Optional<Machine> findByMachineId(String machineId);
} 