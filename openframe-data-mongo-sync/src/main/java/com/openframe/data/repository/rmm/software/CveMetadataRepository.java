package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.CveMetadata;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CveMetadataRepository extends MongoRepository<CveMetadata, String> {

    Optional<CveMetadata> findByCveId(String cveId);

    List<CveMetadata> findByCveIdIn(Collection<String> cveIds);

    List<CveMetadata> findByCachedAtIsNull(Pageable pageable);

    List<CveMetadata> findByCachedAtBefore(Instant cutoff, Pageable pageable);
}
