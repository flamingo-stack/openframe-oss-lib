package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.CveMetadata;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CveMetadataRepository extends MongoRepository<CveMetadata, String> {

    Optional<CveMetadata> findByCveId(String cveId);

    List<CveMetadata> findByCveIdIn(Collection<String> cveIds);
}
