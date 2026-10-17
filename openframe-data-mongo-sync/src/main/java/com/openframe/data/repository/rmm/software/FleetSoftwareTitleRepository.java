package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.FleetSoftwareTitle;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FleetSoftwareTitleRepository extends MongoRepository<FleetSoftwareTitle, String> {

    Optional<FleetSoftwareTitle> findBySoftwareTitleId(Long softwareTitleId);

    long deleteBySoftwareTitleId(Long softwareTitleId);
}
