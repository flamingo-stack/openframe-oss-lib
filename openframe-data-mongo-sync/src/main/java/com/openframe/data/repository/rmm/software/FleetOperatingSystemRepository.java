package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.FleetOperatingSystem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FleetOperatingSystemRepository extends MongoRepository<FleetOperatingSystem, String> {

    Optional<FleetOperatingSystem> findByOsId(Long osId);

    long deleteByOsId(Long osId);
}
