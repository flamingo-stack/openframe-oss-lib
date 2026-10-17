package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.FleetSoftware;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FleetSoftwareRepository extends MongoRepository<FleetSoftware, String> {

    Optional<FleetSoftware> findBySoftwareId(Long softwareId);

    long deleteBySoftwareId(Long softwareId);
}
