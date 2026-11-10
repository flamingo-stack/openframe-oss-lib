package com.openframe.data.repository.email;

import com.openframe.data.document.email.BlockedEmailDomain;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BlockedEmailDomainRepository extends MongoRepository<BlockedEmailDomain, String> {

    List<BlockedEmailDomain> findAll(Sort sort);

    Page<BlockedEmailDomain> findByDomainContainingIgnoreCaseOrReasonContainingIgnoreCase(
            String domain, String reason, Pageable pageable);
}
