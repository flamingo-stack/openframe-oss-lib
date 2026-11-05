package com.openframe.data.repository.email;

import com.openframe.data.document.email.BlockedEmailDomain;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** The email domain block list kept in the database, read by {@link StoredBlockedEmailDomainSource}. */
@Repository
public interface BlockedEmailDomainRepository extends MongoRepository<BlockedEmailDomain, String> {

    List<BlockedEmailDomain> findAll(Sort sort);
}
