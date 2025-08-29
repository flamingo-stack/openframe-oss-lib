package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MachineRepository extends MongoRepository<Machine, String>, CustomMachineRepository{
    Optional<Machine> findByMachineId(String machineId);
} 