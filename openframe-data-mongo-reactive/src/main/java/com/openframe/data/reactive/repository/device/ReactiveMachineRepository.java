package com.openframe.data.reactive.repository.device;

import com.openframe.data.document.device.Machine;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface ReactiveMachineRepository extends ReactiveMongoRepository<Machine, String> {

    Mono<Machine> findByMachineId(String machineId);
}
