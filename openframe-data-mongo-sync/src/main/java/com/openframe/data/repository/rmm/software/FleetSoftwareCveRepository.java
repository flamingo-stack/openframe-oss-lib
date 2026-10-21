package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.FleetSoftwareCve;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FleetSoftwareCveRepository extends MongoRepository<FleetSoftwareCve, String> {

    List<FleetSoftwareCve> findBySoftwareId(Long softwareId);

    Optional<FleetSoftwareCve> findBySoftwareIdAndCve(Long softwareId, String cve);

    long deleteBySoftwareIdAndCve(Long softwareId, String cve);

    long deleteBySoftwareId(Long softwareId);
}
